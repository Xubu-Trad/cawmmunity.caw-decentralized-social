import {createReplayReadSession} from './replay-read-session.mjs';

// Existing-account fields and selected slots only; no creation, code writes or trie update.
export function createReplayStorageOverlay(text) {
  if (arguments.length !== 1) throw new TypeError('Expected one raw witness input');
  const base = createReplayReadSession(text);
  let frames = [new Map()], failed = false, closed = false;
  function need(ok, code) {
    if (!ok) { const error = new Error('Storage overlay rejected: '+code); error.code='REPLAY_STORAGE_'+code; throw error; }
  }
  function assertUsable() { need(!closed,'CLOSED');need(!failed,'FAILED');base.assertUsable(); }
  function guarded(fn) {
    try { assertUsable();return fn(); }
    catch(error) { failed=true;throw error; }
  }
  function original(address,key) { return base.storage(address,key); }
  function quantity(value,digits) {
    return typeof value==='string' && value.length<=digits+2 && /^0x(?:0|[1-9a-f][0-9a-f]*)(?![\s\S])/.test(value);
  }
  return Object.freeze({
    assertUsable,
    account(address) { return guarded(() => {
      need(arguments.length===1,'ARGUMENTS');const original=base.account(address);
      return frames[frames.length-1].get('account:'+address) ?? original;
    }); },
    originalAccount(address) { return guarded(() => {
      need(arguments.length===1,'ARGUMENTS');return base.account(address);
    }); },
    putAccount(address,nonce,balance) { return guarded(() => {
      need(arguments.length===3,'ARGUMENTS');const original=base.account(address);
      need(quantity(nonce,16)&&quantity(balance,64),'ACCOUNT_VALUE');
      const top=frames[frames.length-1],id='account:'+address;
      need(top.has(id)||[...top.keys()].filter(k=>k.startsWith('account:')).length<16,'ACCOUNTS');
      top.set(id,Object.freeze({...original,nonce,balance}));
    }); },
    storage(address,key) { return guarded(() => {
      need(arguments.length===2,'ARGUMENTS');
      const value=original(address,key), id=address+':'+key;
      const top=frames[frames.length-1];return top.has(id) ? top.get(id) : value;
    }); },
    originalStorage(address,key) { return guarded(() => {
      need(arguments.length===2,'ARGUMENTS');return original(address,key);
    }); },
    putStorage(address,key,value) { return guarded(() => {
      need(arguments.length===3,'ARGUMENTS');original(address,key);
      need(typeof value==='string' && /^0x(?:0|[1-9a-f][0-9a-f]{0,63})(?![\s\S])/.test(value),'VALUE');
      const top=frames[frames.length-1], id=address+':'+key;
      need(top.has(id)||[...top.keys()].filter(k=>!k.startsWith('account:')).length<256,'SLOTS');top.set(id,value);
    }); },
    checkpoint() { return guarded(() => {
      need(arguments.length===0,'ARGUMENTS');need(frames.length<17,'DEPTH');
      frames.push(new Map(frames[frames.length-1]));
    }); },
    commit() { return guarded(() => {
      need(arguments.length===0,'ARGUMENTS');need(frames.length>1,'UNDERFLOW');
      const top=frames.pop();frames[frames.length-1]=top;
    }); },
    // Cleanup is allowed after failure, but never resets the failure marker.
    revert() {
      try { need(!closed,'CLOSED');need(arguments.length===0,'ARGUMENTS');need(frames.length>1,'UNDERFLOW');frames.pop(); }
      catch(error) { failed=true;throw error; }
    },
    discard() { frames=[];closed=true; },
  });
}
