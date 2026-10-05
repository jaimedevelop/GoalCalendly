import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);

// Exercise the real store and time calculations, replacing only the remote API.
function setup(overrides = {}, storage = new Map()) {
  let now = new Date(2026, 9, 5, 12).getTime();
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  const writes = [];
  const api = {
    updateGoalFields: async (id, updates) => { writes.push({ id, updates }); return { ok: true }; },
    completeGoal: async () => ({ ok: true }),
    deleteGoalRemote: async () => ({ ok: true }),
    ...overrides,
  };
  const cache = new Map();
  function load(file) {
    let path = resolve(file);
    if (!existsSync(path)) path = path.replace(/\.js$/, '') + '.ts';
    if (cache.has(path)) return cache.get(path);
    const exports = {};
    cache.set(path, exports);
    const code = ts.transpileModule(readFileSync(path, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    runInNewContext(code, {
      exports, Date: Clock, console,
      localStorage: {
        getItem: key => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, value),
      },
      require: name => name === './services/goals.js' ? api
        : name.startsWith('.') ? load(resolve(dirname(path), name)) : require(name),
    }, { filename: path });
    return exports;
  }
  const { useStore } = load('src/store.ts');
  const { DEFAULT_GOAL_SETTINGS } = load('src/types.ts');
  const { sortActiveGoals } = load('src/services/goalOrder.ts');
  const goal = id => ({
    id, name: id, targetHours: 100, currentLevel: 1, startDate: '2026-10-05',
    totalTimeSpent: 0, weeklyTimeSpent: 0, weeklyGoal: 5, trophies: 0,
    practiceDays: [], medals: [], weeklyTrophies: [], settings: DEFAULT_GOAL_SETTINGS,
  });
  useStore.setState({ goals: ['a', 'b', 'c', 'd'].map(goal) });
  return {
    store: useStore, writes, storage, advance: ms => { now += ms; },
    running: () => Array.from(useStore.getState().activeTimers, t => t.goalId),
    ordered: () => Array.from(sortActiveGoals(useStore.getState().goals, useStore.getState().activeTimers), g => g.id),
  };
}

test('simultaneous sessions stop independently and repeated Stop does not count twice', () => {
  const h = setup();
  const s = h.store.getState();
  s.startTimer('a');
  h.advance(30 * 60000);
  s.startTimer('b');
  s.startTimer('b');
  s.startTimer('missing');
  h.advance(30 * 60000);
  s.stopTimer('a');
  s.stopTimer('a');
  assert.deepEqual(h.running(), ['b']);
  assert.equal(h.store.getState().activeTimer.goalId, 'b');
  assert.equal(h.store.getState().goals.find(g => g.id === 'a').totalTimeSpent, 1);
  assert.equal(h.store.getState().goals.find(g => g.id === 'b').totalTimeSpent, 0);
  s.stopTimer('b');
  assert.equal(h.store.getState().goals.find(g => g.id === 'b').totalTimeSpent, 0.5);
  assert.equal(h.store.getState().activeTimer.isRunning, false);
  assert.equal(h.writes.length, 4);
});

test('timer limits persist and lowering the limit preserves existing sessions', () => {
  const h = setup();
  const s = h.store.getState();
  assert.equal(s.maxActiveTimers, 3);
  s.setMaxActiveTimers(2);
  s.startTimer('a'); s.startTimer('b'); s.startTimer('c');
  assert.deepEqual(h.running(), ['b', 'a']);
  assert.match(h.store.getState().lastGoalError, /up to 2 timers/);
  s.setMaxActiveTimers(1);
  assert.deepEqual(h.running(), ['b', 'a']);
  assert.equal(setup({}, h.storage).store.getState().maxActiveTimers, 1);
  s.stopTimer('a'); s.startTimer('c');
  assert.deepEqual(h.running(), ['b']);
  s.stopTimer('b'); s.startTimer('c');
  assert.deepEqual(h.running(), ['c']);
  assert.equal(h.store.getState().lastGoalError, null);
  s.setMaxActiveTimers(100);
  assert.equal(h.store.getState().maxActiveTimers, 20);
  s.setMaxActiveTimers(-1);
  assert.equal(h.store.getState().maxActiveTimers, 1);
});

test('newest running task wins tied timestamps; stopped tasks sort by recent activity', () => {
  const h = setup();
  const s = h.store.getState();
  s.startTimer('b'); s.startTimer('c');
  assert.deepEqual(h.ordered(), ['c', 'b', 'a', 'd']);
  h.advance(1000); s.stopTimer('b');
  assert.deepEqual(h.ordered(), ['c', 'b', 'a', 'd']);
  h.advance(1000); s.stopTimer('c');
  assert.deepEqual(h.ordered(), ['c', 'b', 'a', 'd']);
  s.startTimer('a');
  assert.deepEqual(h.ordered(), ['a', 'c', 'b', 'd']);
  assert.deepEqual(Array.from(h.store.getState().goals, g => g.id), ['a', 'b', 'c', 'd']);
});

test('failed deletion restores only its own timer while other sessions keep their changes', async () => {
  let rejectDelete;
  const h = setup({ deleteGoalRemote: () => new Promise(resolve => { rejectDelete = resolve; }) });
  const s = h.store.getState();
  s.startTimer('a'); h.advance(1000); s.startTimer('b');
  const pending = s.deleteGoal('a');
  s.stopTimer('b'); h.advance(1000); s.startTimer('c');
  rejectDelete({ ok: false });
  assert.equal(await pending, false);
  assert.deepEqual(h.running(), ['c', 'a']);
  assert.equal(h.store.getState().activeTimer.goalId, 'c');
  assert.ok(h.store.getState().goals.some(g => g.id === 'a'));
});

for (const ok of [true, false]) {
  test(`completion ${ok ? 'success' : 'failure'} stops only that session and retains its time`, async () => {
    const h = setup({ completeGoal: async () => ({ ok }) });
    const s = h.store.getState();
    s.startTimer('a'); s.startTimer('b'); h.advance(3600000);
    assert.equal(await s.completeGoalById('a'), ok);
    assert.deepEqual(h.running(), ['b']);
    const completed = h.store.getState().goals.find(g => g.id === 'a');
    assert.equal(completed.totalTimeSpent, 1);
    assert.equal(!!completed.completed, ok);
    assert.equal(h.ordered().includes('a'), !ok);
  });
}

test('default target accepts fractions and rejects empty, negative and non-finite values', () => {
  const h = setup();
  const s = h.store.getState();
  s.updateDefaultSettings({ target: { type: 'hours', value: 0.5 } });
  for (const value of [0, -1, NaN, Infinity]) s.updateDefaultSettings({ target: { type: 'hours', value } });
  assert.equal(h.store.getState().defaultSettings.target.value, 0.5);
});
