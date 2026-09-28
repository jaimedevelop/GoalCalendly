const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const assert = require('node:assert/strict');
const context = { exports: {}, JSON };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/services/sharedGoalData.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, context);
const goal = {
  id: 'existing-goal', name: 'Practice', completed: false, completedDate: undefined,
  note: undefined, lastTimerStartedAt: undefined, weeklyGoal: 0,
  settings: { color: 'blue', optional: undefined, sound: false },
  sessions: [{ date: '2026-09-27', minutes: 12, note: undefined }],
  dates: [],
};
const shared = context.exports.serializeSharedGoals([goal]);
assert.deepEqual(shared, [{
  id: 'existing-goal', name: 'Practice', completed: false, weeklyGoal: 0,
  settings: { color: 'blue', sound: false },
  sessions: [{ date: '2026-09-27', minutes: 12 }], dates: [],
}]);
assert.ok(Object.hasOwn(goal, 'completedDate'), 'serialization must not mutate the stored goal');
assert.ok(Object.hasOwn(goal.settings, 'optional'));
console.log('PASS: shared goal optional fields omitted at every depth; history, false, zero and source preserved');
