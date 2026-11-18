const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const test = require('node:test');

const source = readFileSync(new URL('../utils/wallet-history.js', `file://${__filename}`), 'utf8');
const destination = 'So11111111111111111111111111111111111111112';
const transaction = (signature, blockTime, asset = 'SOL') => ({
  signature, blockTime, movements: [{ destination, asset }, { destination, asset }]
});

test('groups distinct SOL transactions within ten minutes and ignores undated and token movements', async () => {
  const { findRepeatedDestinations } = await import('data:text/javascript,' + encodeURIComponent(source));
  assert.deepEqual(findRepeatedDestinations([
    transaction('second', 700), transaction('first', 100), transaction('first', 100),
    transaction('later', 1400), transaction('undated', null), transaction('token', 450, 'SPL')
  ]), [{ destination, signatures: ['first', 'second'] }]);
  assert.deepEqual(findRepeatedDestinations([transaction('first', 100), transaction('later', 701)]), []);
});
