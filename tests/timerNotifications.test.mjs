import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function setup(showNotification) {
  const handlers = {};
  const shown = [];
  const messages = [];
  let closed = 0;
  const self = {
    addEventListener: (type, handler) => { handlers[type] = handler; },
    registration: {
      showNotification: showNotification ?? (async (title, options) => { shown.push(options); }),
      getNotifications: async () => [{ close() { closed++; } }],
    },
    clients: { matchAll: async () => [{ postMessage: message => messages.push(message) }] },
  };
  runInNewContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), { self, console: { log() {}, error() {} } });
  const send = (type, payload) => {
    let pending;
    handlers.message({ data: { type, payload }, waitUntil: promise => { pending = promise; } });
    return pending;
  };
  return { handlers, shown, messages, send, closed: () => closed };
}

test('notification updates retain the session and Stop targets that session', async () => {
  const h = setup();
  const payload = { goalId: 'older-task', startTime: 123, title: 'Older', body: '00:01:00' };
  await h.send('SHOW_TIMER_NOTIFICATION', payload);
  await h.send('UPDATE_TIMER_NOTIFICATION', { ...payload, body: '00:01:01' });
  assert.equal(h.shown.length, 2);
  for (const notification of h.shown) {
    assert.equal(notification.data.goalId, 'older-task');
    assert.equal(notification.data.startTime, 123);
  }
  let pending;
  h.handlers.notificationclick({ action: 'stop', notification: { close() {}, data: h.shown[1].data }, waitUntil: promise => { pending = promise; } });
  await pending;
  assert.equal(h.messages.length, 1);
  assert.equal(h.messages[0].type, 'STOP_TIMER');
  assert.equal(h.messages[0].goalId, 'older-task');
  assert.equal(h.messages[0].startTime, 123);
});

test('pending notification updates finish before Clear, preventing stale notifications after Stop', async () => {
  let finishShow;
  const h = setup(() => new Promise(resolve => { finishShow = resolve; }));
  const showing = h.send('UPDATE_TIMER_NOTIFICATION', { goalId: 'a', startTime: 123 });
  await Promise.resolve();
  const clearing = h.send('CLEAR_TIMER_NOTIFICATION');
  await Promise.resolve();
  assert.equal(h.closed(), 0);
  finishShow();
  await Promise.all([showing, clearing]);
  assert.equal(h.closed(), 1);
});

test('a failed notification does not block later Clear', async () => {
  const h = setup(async () => { throw new Error('Permission revoked'); });
  await h.send('SHOW_TIMER_NOTIFICATION', { goalId: 'a', startTime: 123 });
  await h.send('CLEAR_TIMER_NOTIFICATION');
  assert.equal(h.closed(), 1);
});

test('immediate Stop closes fallback notification and cancels updates without reopening it', async () => {
  let closed = 0;
  let created = 0;
  const intervals = new Set();
  class Notification {
    static permission = 'granted';
    constructor() { created++; }
    close() { closed++; }
  }
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL('../src/services/notifications.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(code, {
    exports, Notification,
    window: { Notification, setInterval: () => { intervals.add(1); return 1; } },
    navigator: { serviceWorker: { controller: null } },
    clearInterval: id => intervals.delete(id),
  });
  const service = exports.timerNotificationService;
  const showing = service.showTimerNotification('Alpha', Date.now(), 'a');
  service.clearNotification();
  await showing;
  assert.equal(created, 1);
  assert.equal(closed, 1);
  assert.equal(intervals.size, 0);
});
