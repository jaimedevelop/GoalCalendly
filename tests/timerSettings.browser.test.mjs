import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { build } from 'esbuild';
import { chromium } from 'playwright';

// Render the production settings and timer components with an in-memory API.
// This fixture never connects to Firebase or changes a real account.
test('settings inputs and simultaneous timer controls work in the browser', async () => {
  const bundle = await build({
    stdin: {
      contents: `
        import React from 'react';
        import { createRoot } from 'react-dom/client';
        import { MemoryRouter } from 'react-router-dom';
        import { Settings } from './src/pages/Settings';
        import { ActiveTimer } from './src/components/ActiveTimer';
        import { useStore } from './src/store';
        import { DEFAULT_GOAL_SETTINGS } from './src/types';
        useStore.setState({ goals: ['Alpha', 'Beta', 'Gamma'].map(id => ({
          id, name: id, targetHours: 100, currentLevel: 1, startDate: '2026-10-05',
          totalTimeSpent: 0, weeklyTimeSpent: 0, weeklyGoal: 5, trophies: 0,
          practiceDays: [], medals: [], weeklyTrophies: [], settings: DEFAULT_GOAL_SETTINGS,
        })) });
        window.timerTest = useStore;
        createRoot(document.getElementById('root')).render(
          <MemoryRouter><Settings /><ActiveTimer /></MemoryRouter>
        );`,
      resolveDir: process.cwd(), loader: 'tsx',
    },
    bundle: true, write: false, format: 'iife', jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"test"' },
    plugins: [{
      name: 'in-memory-goal-api',
      setup(builder) {
        builder.onResolve({ filter: /services\/goals\.js$/ }, () => ({ path: 'goals', namespace: 'mock' }));
        builder.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents:
          ['createGoal', 'updateGoalFields', 'completeGoal', 'deleteGoalRemote', 'saveGoalSnapshots']
            .map(name => `export const ${name} = async () => ({ ok: true });`).join('\n') }));
      },
    }],
  });
  const server = createServer((req, res) => {
    res.setHeader('Content-Type', req.url === '/fixture.js' ? 'text/javascript' : 'text/html');
    res.end(req.url === '/fixture.js' ? bundle.outputFiles[0].text
      : '<!doctype html><div id="root"></div><script src="/fixture.js"></script>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const limit = page.getByLabel('Timers that can run at once');
    await limit.fill('');
    assert.equal(await limit.inputValue(), '', 'clearing the field must not replace it with 3');
    await limit.fill('12');
    await limit.blur();
    assert.equal(await limit.inputValue(), '12');
    assert.equal(await page.evaluate(() => localStorage.getItem('max-active-timers')), '12');
    await limit.fill('0'); await limit.blur();
    assert.equal(await limit.inputValue(), '12');
    await limit.fill('2.5'); await limit.blur();
    assert.equal(await limit.inputValue(), '12');
    await limit.fill('21'); await limit.blur();
    assert.equal(await limit.inputValue(), '12');

    const target = page.getByLabel('Default Target Value');
    await target.fill('');
    assert.equal(await target.inputValue(), '');
    await target.fill('0.5'); await target.blur();
    assert.equal(await page.evaluate(() => window.timerTest.getState().defaultSettings.target.value), 0.5);
    await target.fill('-2'); await target.blur();
    assert.equal(await target.inputValue(), '0.5');

    await limit.fill('2'); await limit.blur();
    await page.evaluate(() => {
      const s = window.timerTest.getState();
      s.startTimer('Alpha'); s.startTimer('Beta'); s.startTimer('Gamma');
    });
    await page.getByRole('button', { name: 'Stop timer for Beta' }).waitFor();
    assert.deepEqual(await page.getByRole('button', { name: /^Stop timer for/ }).evaluateAll(elements => elements.map(e => e.getAttribute('aria-label'))),
      ['Stop timer for Beta', 'Stop timer for Alpha']);
    await limit.fill('1'); await limit.blur();
    assert.equal(await page.getByRole('button', { name: /^Stop timer for/ }).count(), 2);

    // An old notification for the same goal must not stop its newer session.
    await page.evaluate(() => navigator.serviceWorker.dispatchEvent(new MessageEvent('message', {
      data: { type: 'STOP_TIMER', goalId: 'Beta', startTime: 1 },
    })));
    assert.equal(await page.getByRole('button', { name: /^Stop timer for/ }).count(), 2);
    await page.evaluate(() => navigator.serviceWorker.dispatchEvent(new MessageEvent('message', {
      data: { type: 'STOP_TIMER', goalId: 'Beta', startTime: window.timerTest.getState().activeTimer.startTime },
    })));
    await page.getByRole('button', { name: 'Stop timer for Beta' }).waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'Stop timer for Alpha' }).click();
    assert.equal(await page.getByRole('button', { name: /^Stop timer for/ }).count(), 0);
    assert.deepEqual(errors, []);
    await page.reload();
    assert.equal(await page.getByLabel('Timers that can run at once').inputValue(), '1');
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
});
