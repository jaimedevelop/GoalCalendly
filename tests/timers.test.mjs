import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
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
    saveGoalSnapshots: async () => ({ ok: true }),
    ...overrides,
  };
  const cache = new Map();
  function load(file) {
    let path = resolve(file);
    if (!existsSync(path) || !statSync(path).isFile()) path = path.replace(/\.js$/, '') + '.ts';
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
    setTime: value => { now = value; },
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

function target(h, frequency = 'weekly', value = 1) {
  h.store.setState(state => ({ goals: state.goals.map(g => ({ ...g,
    settings: { ...g.settings, frequency, target: { type: 'hours', value } },
  })) }));
}

test('timer feedback stays pending until saved, then promotes to one trophy', async () => {
  let finish;
  const h = setup({ updateGoalFields: async (_id, updates) => updates.totalTimeSpent === undefined
    ? { ok: true } : new Promise(resolve => { finish = resolve; }) });
  target(h);
  const s = h.store.getState();
  s.startTimer('a'); h.advance(3600000);
  const stopped = s.stopTimer('a');
  assert.equal(h.store.getState().celebrations[0].saveState, 'saving');
  assert.equal(h.store.getState().celebrations[0].kind, 'timer');
  assert.equal(await s.stopTimer('a'), false);
  finish({ ok: true });
  assert.equal(await stopped, true);
  assert.equal(h.store.getState().celebrations.length, 1);
  assert.equal(h.store.getState().celebrations[0].kind, 'trophy');
  assert.equal(h.store.getState().celebrations[0].durationMs, 3600000);
  s.dismissCelebration(h.store.getState().celebrations[0].id);
  s.startTimer('a'); h.advance(3600000);
  const again = s.stopTimer('a'); finish({ ok: true }); await again;
  assert.equal(h.store.getState().celebrations[0].kind, 'timer');
});

test('dismissed pending timer does not reopen on success but a new trophy can', async () => {
  for (const earnsTrophy of [false, true]) {
    let finish;
    const h = setup({ updateGoalFields: async (_id, updates) => updates.totalTimeSpent === undefined
      ? { ok: true } : new Promise(resolve => { finish = resolve; }) });
    target(h, 'weekly', earnsTrophy ? 1 : 5);
    const s = h.store.getState();
    s.startTimer('a'); h.advance(3600000);
    const stopped = s.stopTimer('a');
    s.dismissCelebration(h.store.getState().celebrations[0].id);
    finish({ ok: true }); await stopped;
    assert.equal(h.store.getState().celebrations.length, earnsTrophy ? 1 : 0);
    if (earnsTrophy) assert.equal(h.store.getState().celebrations[0].dismissed, false);
  }
});

test('failed timer never celebrates; only a confirmed progress Save recovers its award once', async () => {
  let saveOk = false;
  const h = setup({
    updateGoalFields: async (_id, updates) => ({ ok: updates.totalTimeSpent === undefined }),
    saveGoalSnapshots: async () => ({ ok: saveOk }),
  });
  target(h);
  const s = h.store.getState();
  s.startTimer('a'); h.advance(3600000); await s.stopTimer('a');
  assert.equal(h.store.getState().celebrations[0].kind, 'error');
  assert.equal(h.store.getState().goals[0].totalTimeSpent, 1);
  assert.equal(h.store.getState().failedSessions.length, 1);
  s.dismissCelebration(h.store.getState().celebrations[0].id);
  assert.equal(await s.updateGoal('a', { note: 'unrelated edit' }), true);
  assert.equal(h.store.getState().celebrations.length, 0);
  assert.equal(await s.saveGoals(), false);
  assert.equal(h.store.getState().celebrations.length, 0);
  saveOk = true;
  assert.equal(await s.saveGoals(), true);
  assert.equal(h.store.getState().celebrations[0].kind, 'trophy');
  assert.equal(h.store.getState().failedSessions.length, 0);
  s.dismissCelebration(h.store.getState().celebrations[0].id);
  await s.saveGoals();
  assert.equal(h.store.getState().celebrations.length, 0);
});

test('manual time celebrates successful awards only and rolls back failed saves', async () => {
  for (const ok of [true, false]) {
    const h = setup({ updateGoalFields: async () => ({ ok }) });
    target(h);
    assert.equal(await h.store.getState().addManualTime('a', new Date(2026, 9, 5), 60), ok);
    assert.equal(h.store.getState().celebrations.length, ok ? 1 : 0);
    assert.equal(h.store.getState().goals[0].trophies, ok ? 1 : 0);
  }
});

test('a midnight session groups daily awards and does not replay them after loading', async () => {
  const h = setup(); target(h, 'daily', 0.25);
  h.setTime(new Date(2026, 9, 5, 23, 30).getTime());
  h.store.getState().startTimer('a'); h.advance(3600000);
  await h.store.getState().stopTimer('a');
  assert.equal(h.store.getState().celebrations[0].periodKeys.length, 2);
  const saved = h.store.getState().goals;
  h.store.getState().dismissCelebration(h.store.getState().celebrations[0].id);
  h.store.getState().setGoals(saved);
  assert.equal(h.store.getState().celebrations.length, 0);
});

test('completion queues trophy then completion, suppressing the ordinary timer popup', async () => {
  for (const earns of [true, false]) {
    const h = setup(); target(h, 'weekly', earns ? 1 : 5);
    h.store.getState().startTimer('a'); h.advance(3600000);
    await h.store.getState().completeGoalById('a');
    assert.deepEqual(Array.from(h.store.getState().celebrations, item => item.kind), earns ? ['trophy', 'completed'] : ['completed']);
    assert.ok(h.store.getState().celebrations.every(item => !item.suppressed));
  }
});

test('late save callbacks cannot publish into a different authenticated session', async () => {
  let finish;
  const h = setup({ updateGoalFields: async (_id, updates) => updates.totalTimeSpent === undefined
    ? { ok: true } : new Promise(resolve => { finish = resolve; }) });
  const s = h.store.getState();
  s.startTimer('a'); h.advance(3600000); const stopped = s.stopTimer('a');
  s.setUser({ uid: 'another-user' });
  finish({ ok: false }); await stopped;
  assert.equal(h.store.getState().celebrations.length, 0);
  assert.equal(h.store.getState().lastGoalError, null);
  assert.equal(h.store.getState().failedSessions.length, 0);
});

test('admin previews replay without goal mutations and require a trusted admin', () => {
  const h = setup();
  const s = h.store.getState();
  s.previewCelebration('trophy');
  assert.equal(h.store.getState().celebrations.length, 0);
  h.store.setState({ user: { uid: 'admin', isTrustedAdmin: true } });
  const original = JSON.stringify(h.store.getState().goals);
  s.previewCelebration('timer'); const first = h.store.getState().celebrations[0].id;
  s.previewCelebration('trophy');
  assert.equal(h.store.getState().celebrations.length, 1);
  assert.notEqual(h.store.getState().celebrations[0].id, first);
  assert.equal(h.store.getState().celebrations[0].kind, 'trophy');
  assert.equal(JSON.stringify(h.store.getState().goals), original);
  assert.equal(h.writes.length, 0);
});

test('full celebration motion defaults on and persists both choices on the device', () => {
  const h = setup();
  assert.equal(h.store.getState().fullCelebrationMotion, true);
  h.store.getState().setFullCelebrationMotion(false);
  assert.equal(h.storage.get('celebration-full-motion'), 'false');
  const reloaded = setup({}, h.storage);
  assert.equal(reloaded.store.getState().fullCelebrationMotion, false);
  reloaded.store.getState().setFullCelebrationMotion(true);
  assert.equal(setup({}, h.storage).store.getState().fullCelebrationMotion, true);
  reloaded.store.getState().setUser({ uid: 'another-user' });
  assert.equal(reloaded.store.getState().fullCelebrationMotion, true);
  assert.equal(h.writes.length, 0, 'motion preference does not write goal data');
});

test('a zero-duration stop acknowledges no recorded time and cannot earn a trophy', async () => {
  const h = setup(); target(h);
  h.store.getState().startTimer('a'); await h.store.getState().stopTimer('a');
  assert.equal(h.store.getState().celebrations[0].saveState, 'empty');
  assert.equal(h.store.getState().celebrations[0].kind, 'timer');
  assert.equal(h.store.getState().goals[0].totalTimeSpent, 0);
});

test('out-of-order saves on different goals keep each duration and award attached to its session', async () => {
  const finish = new Map();
  const h = setup({ updateGoalFields: async (id, updates) => updates.totalTimeSpent === undefined
    ? { ok: true } : new Promise(resolve => { finish.set(id, resolve); }) });
  target(h);
  h.store.getState().startTimer('a'); h.advance(1800000);
  h.store.getState().startTimer('b'); h.advance(1800000);
  const a = h.store.getState().stopTimer('a');
  const b = h.store.getState().stopTimer('b');
  finish.get('b')({ ok: true }); await b;
  finish.get('a')({ ok: true }); await a;
  const events = h.store.getState().celebrations;
  assert.deepEqual(Array.from(events, item => item.goalId), ['a', 'b']);
  assert.deepEqual(Array.from(events, item => item.kind), ['trophy', 'timer']);
  assert.deepEqual(Array.from(events, item => item.durationMs), [3600000, 1800000]);
});
