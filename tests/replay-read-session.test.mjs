import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createReplayReadSession} from '../reference/replay-read-session.mjs';
const fixture = JSON.parse(readFileSync(new URL('../reference/fixtures/replay-input-binding.json', import.meta.url))).input;
const text = JSON.stringify(fixture);
const address = fixture.dependencies.selection.dependencies[0].address;
const key = fixture.dependencies.selection.dependencies[0].storageKeys[0];

test('valid reads leave a session usable without returning an execution verdict', () => {
  const s = createReplayReadSession(text);
  assert.equal(s.account(address).address, address);
  assert.equal(s.code(address), fixture.dependencies.witnesses[0].code);
  assert.equal(typeof s.storage(address, key), 'string');
  assert.equal(s.assertUsable(), undefined);
});
test('caught missing slot invalidates final check and all subsequent reads', () => {
  const s = createReplayReadSession(text);
  assert.throws(() => s.storage(address, '0x'+'ff'.repeat(32)), {code:'WITNESS_STATE_MISSING_SLOT'});
  for (const call of [() => s.assertUsable(), () => s.account(address), () => s.code(address), () => s.storage(address,key)])
    assert.throws(call, {code:'REPLAY_READ_FAILED'});
});
test('swallowed nested missing-account failure cannot appear healthy to caller', () => {
  const s = createReplayReadSession(text);
  function nested() { try { s.code('0x'+'ff'.repeat(20)); } catch {} return true; }
  assert.equal(nested(), true);
  assert.throws(() => s.assertUsable(), {code:'REPLAY_READ_FAILED'});
});
test('malformed selector and extra read arguments also permanently fail attempt', () => {
  for (const bad of [s => s.account(address+'\n'), s => s.code(address, {}), s => s.storage(address,'0x0')]) {
    const s = createReplayReadSession(text);
    assert.throws(() => bad(s));
    assert.throws(() => s.assertUsable(), {code:'REPLAY_READ_FAILED'});
  }
});
test('fresh attempt is isolated while failed session has no reset hook', () => {
  const failed = createReplayReadSession(text), fresh = createReplayReadSession(text);
  assert.throws(() => failed.account(null));
  assert.equal(fresh.account(address).address,address);
  assert.equal(fresh.assertUsable(),undefined);
  assert.deepEqual(Object.keys(failed).sort(), ['account','assertUsable','code','storage']);
  assert.ok(Object.isFrozen(failed));
  assert.throws(() => { failed.assertUsable = () => {}; }, TypeError);
  assert.throws(() => failed.assertUsable(), {code:'REPLAY_READ_FAILED'});
});
test('construction rejects substituted reports and extra inputs', () => {
  assert.throws(() => createReplayReadSession('{}'));
  assert.throws(() => createReplayReadSession(text, {}), TypeError);
});
