const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const assert = require('node:assert/strict');
const calls = [];
let perform = async () => ({});
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/services/goals.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, {
  exports: exportsObject, crypto: require('node:crypto'), JSON, Map, Promise,
  require: name => name === 'firebase/functions'
    ? { httpsCallable: () => async payload => { calls.push(payload); return perform(payload); } }
    : { functions: {} },
});
async function run() {
  let release;
  perform = () => new Promise(resolve => { release = resolve; });
  const first = exportsObject.updateGoalFields('one', { note: 'earlier' });
  const second = exportsObject.updateGoalFields('one', { note: 'later' });
  await Promise.resolve();
  assert.equal(calls.length, 1, 'same-goal updates must not race');
  perform = async () => ({});
  release({});
  await Promise.all([first, second]);
  assert.deepEqual(calls.map(call => call.updates.note), ['earlier', 'later']);
  calls.length = 0;
  const goal = { id: 'one', name: 'Goal', note: undefined, completed: true,
    completedDate: '2026-09-27', totalTimeSpent: 0, settings: { sound: false, optional: undefined } };
  assert.equal((await exportsObject.saveGoalSnapshots([goal])).ok, true);
  assert.equal(calls[0].type, 'update');
  assert.equal(calls[0].goalId, 'one');
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0].updates)), { name: 'Goal', totalTimeSpent: 0, settings: { sound: false } });
  assert.equal(goal.completed, true);
  calls.length = 0;
  perform = async () => { throw { code: 'functions/permission-denied', message: 'Save rejected' }; };
  const failed = await exportsObject.saveGoalSnapshots([goal, { ...goal, id: 'two' }]);
  assert.equal(failed.ok, false);
  assert.equal(calls.length, 2, 'save every snapshot and surface any failure instead of reporting success');
  perform = async () => ({});
  assert.equal((await exportsObject.updateGoalFields('one', { note: 'retry' })).ok, true);
  console.log('PASS: ordered autosaves, protected manual save, optional-field cleanup, failure and retry');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
