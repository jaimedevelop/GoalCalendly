import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeEffectiveEntitlement } from '../src/lib/entitlements.ts';

test('Free account with no grant or billing gets Free with ads', () => {
  const e = computeEffectiveEntitlement({ isTrustedAdmin: false });
  assert.equal(e.plan, 'free');
  assert.equal(e.source, 'free');
  assert.equal(e.hasAdvertising, true);
  assert.equal(e.maxActiveGoals, 2);
});

test('Trusted admin is unlimited and ad-free regardless of other state', () => {
  const e = computeEffectiveEntitlement({
    isTrustedAdmin: true,
    billing: { status: 'canceled', plan: 'pro' },
  });
  assert.equal(e.source, 'admin');
  assert.equal(e.maxActiveGoals, -1);
  assert.equal(e.hasAdvertising, false);
});

test('Active subscription grants the purchased tier', () => {
  const e = computeEffectiveEntitlement({
    isTrustedAdmin: false,
    billing: { status: 'active', plan: 'platinum' },
  });
  assert.equal(e.plan, 'platinum');
  assert.equal(e.source, 'stripe');
  assert.equal(e.maxActiveGoals, 30);
});

test('trialing does not grant paid access before an explicit trial feature exists', () => {
  const e = computeEffectiveEntitlement({
    isTrustedAdmin: false,
    billing: { status: 'trialing', plan: 'pro' },
  });
  assert.equal(e.plan, 'free');
});

test('past_due within an active grace period keeps paid access', () => {
  const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  const e = computeEffectiveEntitlement({
    isTrustedAdmin: false,
    billing: { status: 'past_due', plan: 'pro', gracePeriodEndsAt: future },
  });
  assert.equal(e.plan, 'pro');
  assert.equal(e.source, 'stripe');
  assert.equal(e.expiresAt, future);
});

test('past_due after grace period expiry falls back to Free', () => {
  const past = new Date(Date.now() - 1000).toISOString();
  const e = computeEffectiveEntitlement({
    isTrustedAdmin: false,
    billing: { status: 'past_due', plan: 'pro', gracePeriodEndsAt: past },
  });
  assert.equal(e.plan, 'free');
});

test('an initial failed payment (no prior grace period set) does not earn one', () => {
  const e = computeEffectiveEntitlement({
    isTrustedAdmin: false,
    billing: { status: 'past_due', plan: 'pro' },
  });
  assert.equal(e.plan, 'free');
});

test('cancellation scheduled for period end keeps access through paidThroughDate', () => {
  const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
  const e = computeEffectiveEntitlement({
    isTrustedAdmin: false,
    billing: { status: 'canceled', plan: 'platinum', paidThroughDate: future },
  });
  assert.equal(e.plan, 'platinum');
  assert.equal(e.expiresAt, future);
});

test('ended subscription past its paid-through date falls back to Free, preserving goal data elsewhere', () => {
  const past = new Date(Date.now() - 1000).toISOString();
  const e = computeEffectiveEntitlement({
    isTrustedAdmin: false,
    billing: { status: 'canceled', plan: 'platinum', paidThroughDate: past },
  });
  assert.equal(e.plan, 'free');
});

test('a valid complimentary grant is honored and labeled separately from billing', () => {
  const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const e = computeEffectiveEntitlement({
    isTrustedAdmin: false,
    complimentaryGrant: { plan: 'pro', expiresAt: future },
  });
  assert.equal(e.plan, 'pro');
  assert.equal(e.source, 'complimentary');
});

test('an expired complimentary grant falls through to billing/Free instead of staying active', () => {
  const past = new Date(Date.now() - 1000).toISOString();
  const e = computeEffectiveEntitlement({
    isTrustedAdmin: false,
    complimentaryGrant: { plan: 'platinum', expiresAt: past },
  });
  assert.equal(e.plan, 'free');
});

test('a permanent complimentary grant (no expiresAt) never lapses', () => {
  const e = computeEffectiveEntitlement({
    isTrustedAdmin: false,
    complimentaryGrant: { plan: 'enterprise' },
  });
  assert.equal(e.plan, 'enterprise');
  assert.equal(e.source, 'complimentary');
});

test('admin takes priority even over an active complimentary grant', () => {
  const e = computeEffectiveEntitlement({
    isTrustedAdmin: true,
    complimentaryGrant: { plan: 'free' },
  });
  assert.equal(e.source, 'admin');
});

test('deterministic with an injected clock', () => {
  const fixedNow = new Date('2026-01-01T00:00:00.000Z');
  const e = computeEffectiveEntitlement({
    isTrustedAdmin: false,
    billing: { status: 'canceled', plan: 'pro', paidThroughDate: '2026-01-02T00:00:00.000Z' },
    now: fixedNow,
  });
  assert.equal(e.plan, 'pro');
});
