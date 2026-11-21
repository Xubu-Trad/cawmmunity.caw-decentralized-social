import assert from 'node:assert/strict';

// A research resource bound, not a protocol transaction limit. Mixed blocks
// need intra-block authority reconstruction, which this reader does not have.
export const MAX_POST_BLOCK_TRANSACTIONS = 16;

export function requirePostBlockSize(rawTransactions) {
  assert(Array.isArray(rawTransactions), 'POST_BLOCK_TRANSACTIONS');
  assert(rawTransactions.length <= MAX_POST_BLOCK_TRANSACTIONS, 'POST_BLOCK_TRANSACTION_LIMIT');
}

// Call only AFTER transaction/receipt-root and signature verification. This
// checks the admissible shape, not authenticity or execution. The caller must
// still match every event to its exact signed calldata and parent-state owner.
export function requirePostOnlyBatch(receipts, posting, topic) {
  assert(Array.isArray(receipts), 'POST_BLOCK_RECEIPTS');
  if (receipts.length <= 1) return;
  assert(receipts.length <= MAX_POST_BLOCK_TRANSACTIONS, 'POST_BLOCK_TRANSACTION_LIMIT');
  for (const receipt of receipts) {
    assert.equal(receipt.status, '0x1', 'POST_ONLY_BATCH_REQUIRED');
    assert.equal(receipt.logs.length, 1, 'POST_ONLY_BATCH_REQUIRED');
    assert.equal(receipt.logs[0].address, posting, 'POST_ONLY_BATCH_REQUIRED');
    assert.equal(receipt.logs[0].topics[0], topic, 'POST_ONLY_BATCH_REQUIRED');
  }
}
