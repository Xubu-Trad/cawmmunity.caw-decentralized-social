import {createWitnessState} from './witness-state.mjs';

// Failure belongs to the attempt, never to a reversible execution frame.
export function createReplayReadSession(text) {
  if (arguments.length !== 1) throw new TypeError('Expected one raw witness input');
  const state = createWitnessState(text);
  let failed = false;
  function assertUsable() {
    if (failed) {
      const error = new Error('Replay read session invalidated by an earlier read failure');
      error.code = 'REPLAY_READ_FAILED';
      throw error;
    }
  }
  function read(method, args) {
    assertUsable();
    try { return state[method](...args); }
    catch (error) { failed = true; throw error; }
  }
  return Object.freeze({
    account(...args) { return read('account', args); },
    code(...args) { return read('code', args); },
    storage(...args) { return read('storage', args); },
    assertUsable,
  });
}
