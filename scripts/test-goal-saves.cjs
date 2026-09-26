const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const { getWeek } = require('date-fns');

// Run the real store with an in-memory database boundary; no Firebase credentials or writes.
const saves = [];
let now = new Date(2026, 8, 26, 12).getTime();
class Clock extends Date {
  constructor(...args) { super(...(args.length ? args : [now])); }
  static now() { return now; }
}
function load(file, dependencies = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    exports, Date: Clock, console: { log() {}, error() {}, warn() {} },
    setTimeout: () => { throw new Error('Unexpected retry'); },
    require: name => dependencies[name] || require(name),
  }, { filename: file });
  return exports;
}
const types = load('src/types.ts');
const { useStore } = load('src/store.ts', {
  './types': types,
  './services/db': {
    saveToFirestore: async goals => { saves.push(structuredClone(goals)); return true; },
    deleteGoalFromFirestore: async () => true,
  },
});
function goal(id) {
  return {
    id, name: id, targetHours: 100, currentLevel: 1, startDate: '2026-09-26',
    totalTimeSpent: 0, weeklyTimeSpent: 0, weeklyGoal: 5, trophies: 0,
    practiceDays: [], medals: [], settings: types.DEFAULT_GOAL_SETTINGS,
    weeklyTrophies: [{ weekNumber: getWeek(new Date(now)), year: 2026, trophies: 0, weeklyTimeSpent: 0 }],
  };
}
const goals = Array.from({ length: 15 }, (_, i) => goal(`goal-${i}`));
useStore.setState({ goals });
useStore.getState().startTimer('goal-7');
assert.equal(saves.length, 1);
assert.deepEqual(saves[0].map(g => g.id), ['goal-7']);
now += 60 * 60 * 1000;
assert.equal(saves.length, 1, 'elapsed time causes no database saves');
useStore.getState().stopTimer();
assert.equal(saves.length, 2);
assert.deepEqual(saves[1].map(g => g.id), ['goal-7']);
assert.equal(saves[1][0].totalTimeSpent, 1);
assert.equal(saves[1][0].weeklyTimeSpent, 1);
assert.equal(saves[1][0].lastTimerStartedAt, now - 3600000);
assert.equal(useStore.getState().activeTimer.isRunning, false);
assert.equal(useStore.getState().goals[0], goals[0], 'unrelated goals unchanged');
useStore.getState().stopTimer();
assert.equal(saves.length, 2, 'repeated stop cannot count time twice');
useStore.getState().updateGoal('goal-2', { note: 'Edited' });
assert.deepEqual(saves.at(-1).map(g => g.id), ['goal-2']);
useStore.getState().addGoal(goal('new'));
assert.deepEqual(saves.at(-1).map(g => g.id), ['new']);
const beforeMissing = saves.length;
useStore.getState().updateGoal('missing', { note: 'Ignored' });
useStore.getState().startTimer('missing');
assert.equal(saves.length, beforeMissing);
const loaded = [goal('unchanged'), { ...goal('changed'), weeklyTimeSpent: 1 }];
useStore.getState().setGoals(loaded);
assert.deepEqual(saves.at(-1).map(g => g.id), ['changed']);
assert.equal(loaded[1].weeklyTrophies[0].weeklyTimeSpent, 0, 'input is not mutated');
const beforeReload = saves.length;
useStore.getState().setGoals(useStore.getState().goals);
assert.equal(saves.length, beforeReload, 'unchanged load causes no save');
console.log('PASS: single-goal start/stop/edit/create saves, elapsed totals, selective trophy saves, unchanged load');
