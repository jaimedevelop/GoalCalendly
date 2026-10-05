import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import { chromium } from 'playwright';

test('admin previews and real timer/manual outcomes share accessible, responsive popups', async () => {
  const bundle = await build({
    stdin: {
      contents: `
        import React, { useState } from 'react';
        import { createRoot } from 'react-dom/client';
        import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
        import AdminDashboard from './src/components/AdminDashboard';
        import { ActiveTimer } from './src/components/ActiveTimer';
        import { ManualTimeDialog } from './src/components/ManualTimeDialog';
        import { Toaster } from './src/components/ui/toaster';
        import { useCelebrations } from './src/hooks/useCelebrations';
        import { useStore } from './src/store';
        import { DEFAULT_GOAL_SETTINGS } from './src/types';
        window.goalWrites = 0; window.apiMode = 'success';
        const user = { uid: 'admin', isTrustedAdmin: true, role: 'admin', email: 'preview@example.test', subscriptionPlan: 'pro', isActive: true };
        useStore.getState().setUser(user);
        const fresh = () => ['Practice', 'Other'].map(id => ({ id, name: id, targetHours: 100, currentLevel: 1,
          startDate: '2026-10-05', totalTimeSpent: 0, weeklyTimeSpent: 0, weeklyGoal: 1, trophies: 0,
          practiceDays: [], medals: [], weeklyTrophies: [], settings: { ...DEFAULT_GOAL_SETTINGS, target: { type: 'hours', value: 1 } } }));
        useStore.setState({ goals: fresh() });
        window.celebrationTest = useStore;
        window.resetFixture = () => {
          window.apiMode = 'success';
          useStore.setState(state => ({ goals: fresh(), activeTimers: [],
            activeTimer: { goalId: null, isRunning: false, startTime: null, elapsedTime: 0 },
            celebrations: [], failedSessions: [], celebratedPeriods: [], lastGoalError: null,
            authGeneration: state.authGeneration + 1 }));
        };
        window.beginSession = (goalId, duration) => {
          useStore.getState().startTimer(goalId);
          useStore.setState(state => {
            const activeTimers = state.activeTimers.map(timer => timer.goalId === goalId ? { ...timer, startTime: Date.now() - duration } : timer);
            return { activeTimers, activeTimer: activeTimers[0] };
          });
        };
        function Fixture() {
          useCelebrations();
          const [manual, setManual] = useState(false);
          const location = useLocation();
          window.openManual = () => setManual(true);
          return <>
            <header className="h-16 bg-white border-b p-4">Goal Calendly</header>
            <main id="app-content" tabIndex={-1}>
              <span data-testid="route">{location.pathname}</span>
              <Routes><Route path="*" element={<AdminDashboard />} /></Routes>
            </main>
            <ActiveTimer /><Toaster />
            {manual && <ManualTimeDialog goal={useStore.getState().goals[0]} date={new Date()} onClose={() => setManual(false)} />}
          </>;
        }
        createRoot(document.getElementById('root')).render(<React.StrictMode><MemoryRouter initialEntries={['/admin']}><Fixture /></MemoryRouter></React.StrictMode>);
      `,
      resolveDir: process.cwd(), loader: 'tsx',
    },
    bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
    plugins: [{
      name: 'isolated-apis',
      setup(builder) {
        builder.onResolve({ filter: /services\/(goals|admin|db|user|notifications)(\.js)?$/ }, args => ({
          path: args.path.match(/services\/(\w+)/)[1], namespace: 'fixture-api',
        }));
        builder.onLoad({ filter: /.*/, namespace: 'fixture-api' }, args => {
          if (args.path === 'goals') return { contents: `
            export const createGoal = async () => ({ ok: true });
            export const completeGoal = async () => ({ ok: true });
            export const deleteGoalRemote = async () => ({ ok: true });
            export const saveGoalSnapshots = async () => ({ ok: true });
            export const updateGoalFields = async (_id, updates) => {
              window.goalWrites++;
              if (updates.totalTimeSpent === undefined) return { ok: true };
              if (window.apiMode === 'pending') return new Promise(resolve => { window.finishSave = resolve; });
              return { ok: window.apiMode !== 'failure', error: { message: 'Fixture save failed.' } };
            };
          ` };
          if (args.path === 'notifications') return { contents: `export const timerNotificationService = {
            isNotificationSupported: () => false, clearNotification: () => {}, showTimerNotification: () => {},
            getPermissionStatus: () => 'denied', requestPermission: async () => 'denied'
          };` };
          if (args.path === 'user') return { contents: 'export const getAllUsers = async () => [];' };
          if (args.path === 'admin') return { contents: [
            'export const listUserAccessSummaries = async () => ({ ok: true, summaries: [] });',
            ...['grantComplimentaryAccess', 'revokeComplimentaryAccess', 'checkAccountBillingStatus', 'deactivateAccount', 'reactivateAccount', 'deleteAccount']
              .map(name => `export const ${name} = async () => ({ ok: true });`),
          ].join('\n') };
          return { contents: [
            'export const getGoalsCountByUser = async () => ({});',
            ...['getAllCampaigns', 'getAllAdvertisingWays'].map(name => `export const ${name} = async () => [];`),
            ...['createCampaign', 'updateCampaign', 'deleteCampaign', 'createAdvertisingWay', 'updateAdvertisingWay', 'deleteAdvertisingWay']
              .map(name => `export const ${name} = async () => ({ ok: true });`),
          ].join('\n') };
        });
      },
    }],
  });
  const css = (await postcss([tailwindcss()]).process(await readFile('src/index.css', 'utf8'), { from: 'src/index.css' })).css;
  const server = createServer((req, res) => {
    res.setHeader('Content-Type', req.url === '/fixture.js' ? 'text/javascript' : req.url === '/style.css' ? 'text/css' : 'text/html');
    res.end(req.url === '/fixture.js' ? bundle.outputFiles[0].text : req.url === '/style.css' ? css
      : '<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="root"></div><script src="/fixture.js"></script>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const before = await page.evaluate(() => ({ goals: JSON.stringify(window.celebrationTest.getState().goals), writes: window.goalWrites }));
    const popup = page.locator('.celebration-popup');
    const screenshotDir = await mkdtemp(join(tmpdir(), 'goal-celebrations-'));

    await page.getByRole('button', { name: 'Preview timer animation' }).click();
    await page.getByText('Timer stopped', { exact: true }).waitFor();
    assert.equal(await popup.count(), 1);
    assert.equal(await popup.getAttribute('data-animation'), 'timer');
    assert.equal(await popup.evaluate(element => getComputedStyle(element).animationName), 'timer-popup-in');
    await popup.evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)));
    const timerFrames = await page.locator('.celebration-art').evaluate(element => {
      const animations = element.getAnimations({ subtree: true });
      const frame = time => {
        animations.forEach(animation => { animation.pause(); animation.currentTime = time; });
        return { hand: getComputedStyle(element.querySelector('.timer-hand')).transform,
          ring: getComputedStyle(element.querySelector('.timer-progress')).strokeDashoffset,
          check: getComputedStyle(element.querySelector('.timer-check')).strokeDashoffset };
      };
      return [frame(100), frame(1100), frame(2900)];
    });
    assert.notEqual(timerFrames[0].hand, timerFrames[1].hand, 'timer hand visibly sweeps');
    assert.notEqual(timerFrames[0].ring, timerFrames[1].ring, 'progress ring fills over time');
    assert.notEqual(timerFrames[0].check, timerFrames[2].check, 'checkmark draws after the timer stops');
    await page.screenshot({ path: join(screenshotDir, 'timer-desktop.png') });
    await popup.getByRole('button', { name: 'Replay timer celebration' }).click();
    assert.equal(await page.locator('.celebration-art').getAttribute('data-run'), '1');
    await popup.getByRole('button', { name: 'Replay animation', exact: true }).focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('.celebration-art').getAttribute('data-run'), '2');
    await page.getByRole('button', { name: 'Preview trophy animation' }).click();
    await page.getByText('Trophy earned!', { exact: true }).waitFor();
    assert.equal(await popup.getAttribute('data-animation'), 'trophy');
    assert.equal(await page.locator('.trophy-particle').count(), 36);
    assert.equal(await popup.evaluate(element => getComputedStyle(element).animationName), 'trophy-popup-in');
    await popup.evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)));
    const trophyFrames = await page.locator('.celebration-art').evaluate(element => {
      const animations = element.getAnimations({ subtree: true });
      const frame = time => {
        animations.forEach(animation => { animation.pause(); animation.currentTime = time; });
        return { cup: getComputedStyle(element.querySelector('.trophy-cup')).transform,
          particle: getComputedStyle(element.querySelector('.trophy-particle')).transform };
      };
      return [frame(100), frame(1600)];
    });
    assert.notEqual(trophyFrames[0].cup, trophyFrames[1].cup, 'trophy lifts and settles');
    assert.notEqual(trophyFrames[0].particle, trophyFrames[1].particle, 'confetti visibly travels');
    await page.screenshot({ path: join(screenshotDir, 'trophy-desktop.png') });
    await popup.getByRole('button', { name: 'Replay trophy celebration' }).click();
    assert.equal(await page.locator('.celebration-art').getAttribute('data-run'), '1');
    assert.deepEqual(await page.evaluate(() => ({ goals: JSON.stringify(window.celebrationTest.getState().goals), writes: window.goalWrites })), before);

    await popup.getByRole('button', { name: 'Close' }).focus();
    await page.keyboard.press('Escape');
    await popup.waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'Preview trophy animation' }).click();
    await page.getByText('Trophy earned!', { exact: true }).waitFor();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await popup.evaluate(element => getComputedStyle(element).animationName), 'none');
    assert.equal(await page.locator('.trophy-burst').evaluate(element => getComputedStyle(element).display), 'none');
    assert.equal(await page.locator('.trophy-cup').evaluate(element => getComputedStyle(element).animationName), 'none');
    await page.getByLabel('Play full motion in previews').check();
    await page.getByRole('button', { name: 'Preview trophy animation' }).click();
    await page.waitForFunction(() => document.querySelector('.celebration-popup')?.getAttribute('data-full-motion') === 'true');
    assert.equal(await page.locator('.trophy-cup').evaluate(element => getComputedStyle(element).animationName), 'trophy-lift');
    await page.getByLabel('Play full motion in previews').uncheck();
    await page.getByRole('button', { name: 'Preview trophy animation' }).click();
    await page.waitForFunction(() => document.querySelector('.celebration-popup')?.getAttribute('data-full-motion') === 'false');
    await page.setViewportSize({ width: 320, height: 720 });
    await page.evaluate(() => window.scrollTo(0, 0));
    const bounds = await popup.boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 320);
    assert.ok(bounds.y >= 64 && bounds.y + bounds.height < 720);
    assert.equal(await popup.getByRole('button', { name: 'Close' }).isVisible(), true);
    await page.screenshot({ path: join(screenshotDir, 'trophy-mobile.png') });
    await page.evaluate(() => window.celebrationTest.setState(state => ({ celebrations: state.celebrations.map(event => ({
      ...event, goalName: 'A_very_long_goal_name_without_spaces_'.repeat(5),
    })) })));
    const longBounds = await popup.boundingBox();
    assert.ok(longBounds.x >= 0 && longBounds.x + longBounds.width <= 320);
    assert.ok(longBounds.height <= 720 - 96);
    await popup.getByRole('button', { name: 'Close' }).click();
    await popup.waitFor({ state: 'detached' });

    // Visible and hidden-tab deferral do not consume an unseen popup's duration.
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
      window.celebrationTest.getState().previewCelebration('timer');
    });
    assert.equal(await popup.count(), 0);
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.getByText('Timer stopped', { exact: true }).waitFor();
    await popup.getByRole('button', { name: 'Close' }).click(); await popup.waitFor({ state: 'detached' });

    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.evaluate(() => { window.resetFixture(); window.apiMode = 'pending'; window.beginSession('Practice', 25 * 60000); });
    await page.getByRole('button', { name: 'Stop timer for Practice' }).click();
    await page.getByText(/recorded locally. Saving/).waitFor();
    assert.equal(await page.evaluate(() => document.activeElement.id), 'app-content');
    await popup.getByRole('button', { name: 'Close' }).focus();
    await page.evaluate(() => window.finishSave({ ok: true }));
    await page.getByText(/25m saved/).waitFor();
    assert.equal(await popup.count(), 1);
    assert.equal(await popup.getByRole('button', { name: 'Close' }).evaluate(element => element === document.activeElement), true);
    assert.equal(await popup.evaluate(element => getComputedStyle(element).animationName), 'none', 'save confirmation must not replay the card entrance');
    await page.waitForFunction(() => Array.from(document.querySelectorAll('[aria-live="polite"]')).some(element => element.textContent.includes('25m saved')));
    await popup.getByRole('button', { name: 'Close' }).click(); await popup.waitFor({ state: 'detached' });

    await page.evaluate(() => { window.resetFixture(); window.beginSession('Practice', 25 * 60000); window.beginSession('Other', 5 * 60000); });
    await page.getByRole('button', { name: 'Stop timer for Practice' }).click();
    await page.getByRole('button', { name: 'Stop timer for Other' }).click();
    await popup.getByText(/Practice.*25m saved/).waitFor();
    assert.equal(await popup.count(), 1);
    await popup.getByRole('button', { name: 'Close' }).click();
    await popup.getByText(/Other.*5m saved/).waitFor();
    await popup.getByRole('button', { name: 'Close' }).click(); await popup.waitFor({ state: 'detached' });

    await page.evaluate(() => { window.resetFixture(); window.apiMode = 'failure'; window.beginSession('Practice', 3600000); });
    await page.getByRole('button', { name: 'Stop timer for Practice' }).click();
    await page.getByText('Time could not be saved', { exact: true }).waitFor();
    assert.equal(await page.getByText('Trophy earned!', { exact: true }).count(), 0);
    await page.getByRole('link', { name: 'Go to Goals to retry Save' }).click();
    await page.waitForFunction(() => document.querySelector('[data-testid="route"]').textContent === '/goals');
    assert.equal(await page.getByTestId('route').textContent(), '/goals');
    assert.equal(await page.evaluate(() => window.celebrationTest.getState().goals[0].totalTimeSpent >= 1), true);
    await page.evaluate(() => window.celebrationTest.getState().saveGoals());
    await page.getByText('Trophy earned!', { exact: true }).waitFor();
    await popup.getByRole('button', { name: 'Close' }).click(); await popup.waitFor({ state: 'detached' });

    await page.evaluate(() => { window.resetFixture(); window.openManual(); });
    await page.getByRole('dialog').waitFor();
    await page.getByLabel('Hours', { exact: true }).fill('1');
    await page.getByLabel('Minutes', { exact: true }).fill('0');
    await page.getByRole('button', { name: 'Save time', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    await page.getByText('Trophy earned!', { exact: true }).waitFor();
    await popup.getByRole('button', { name: 'Close' }).click(); await popup.waitFor({ state: 'detached' });

    await page.evaluate(() => { window.openManual(); window.celebrationTest.getState().previewCelebration('timer'); });
    await page.getByRole('dialog').waitFor();
    assert.equal(await popup.count(), 0);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByText('Timer stopped', { exact: true }).waitFor();
    await page.evaluate(() => window.celebrationTest.getState().setUser(null));
    await popup.waitFor({ state: 'detached' });
    assert.equal(await page.getByRole('button', { name: 'Preview trophy animation' }).count(), 0);
    assert.deepEqual(errors, []);
    console.log(`Animation screenshots: ${screenshotDir}`);
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
});
