export function summarizeDetectionDelay(tokens, now = Date.now()) {
  const delays = [];
  for (const token of tokens) {
    const detected = Date.parse(token.detectedAt);
    const created = token.onchainCreationTime;
    if (Number.isFinite(created) && Number.isFinite(detected) &&
        created > 0 && detected >= created && detected <= now) {
      delays.push(detected - created);
    }
  }
  delays.sort((a, b) => a - b);
  const n = delays.length;
  const middle = Math.floor(n / 2);
  const median = n === 0 ? null : n % 2 ? delays[middle] : (delays[middle - 1] + delays[middle]) / 2;
  return {
    total: tokens.length,
    measured: n,
    median,
    p90: n === 0 ? null : delays[Math.ceil(n * 0.9) - 1]
  };
}
