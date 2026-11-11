function dexNumber(value) {
  if (value == null || value === "" || typeof value === "boolean") return null;
  const n = Number(value); return Number.isFinite(n) ? n : null;
}

export function selectDexPair(pairs, mint) {
  // Addresses from other chains must never be treated as Solana markets.
  const matching = (Array.isArray(pairs) ? pairs : []).filter(p =>
    p?.chainId === "solana" &&
    (p?.baseToken?.address === mint || p?.quoteToken?.address === mint)
  );
  const ranked = [...matching].sort((a, b) => {
    const aBase = a?.baseToken?.address === mint;
    const bBase = b?.baseToken?.address === mint;
    if (aBase !== bBase) return aBase ? -1 : 1;
    return (dexNumber(b?.liquidity?.usd) ?? 0) - (dexNumber(a?.liquidity?.usd) ?? 0);
  });
  const pair = ranked[0] ?? null;
  // Compare distinct, funded base-token pools. Missing prices are not zeroes.
  const seen = new Set();
  const prices = matching.filter(p => {
    if (p?.baseToken?.address !== mint || !p.pairAddress || seen.has(p.pairAddress) ||
      !(dexNumber(p?.liquidity?.usd) > 0) || !(dexNumber(p.priceUsd) > 0)) return false;
    seen.add(p.pairAddress);
    return true;
  }).map(p => dexNumber(p.priceUsd)).sort((a, b) => a - b);
  let priceStatus = !pair ? "UNAVAILABLE" : pair.baseToken?.address !== mint
    ? "QUOTE_PRICE_UNAVAILABLE" : "SINGLE_SOURCE";
  if (pair?.baseToken?.address === mint && prices.length >= 3) {
    const middle = Math.floor(prices.length / 2);
    const median = prices.length % 2 ? prices[middle] : (prices[middle - 1] + prices[middle]) / 2;
    const supporting = prices.filter(p => p >= median / 3 && p <= median * 3).length;
    const selectedPrice = dexNumber(pair.priceUsd);
    if (supporting >= Math.ceil(prices.length * 2 / 3) && selectedPrice > 0 &&
      (selectedPrice > median * 10 || selectedPrice < median / 10)) {
      priceStatus = "CONFLICTING_POOL_PRICES";
    }
  }
  return { pair, priceStatus, comparedPricePools: prices.length, matchingPairCount: matching.length };
}

