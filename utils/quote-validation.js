const RAW = /^[0-9]{1,20}$/;
const MAX_RAW = 18446744073709551615n;
// Jupiter V2 priceImpact is in percentage points; legacy priceImpactPct is a ratio.
export function quoteImpactPercent(quote) {
  const numeric = value => ["number", "string"].includes(typeof value) && String(value).trim() !== "" && Number.isFinite(Number(value)) ? Number(value) : null;
  const modern = numeric(quote?.priceImpact);
  if (modern !== null) return modern;
  const legacy = numeric(quote?.priceImpactPct);
  return legacy !== null && Number.isFinite(legacy * 100) ? legacy * 100 : null;
}
export function checkedQuote(quote, inputMint, outputMint, amount) {
  const input = String(quote?.inAmount ?? quote?.inputAmount ?? "");
  const output = String(quote?.outAmount ?? quote?.outputAmount ?? "");
  if (quote?.inputMint !== inputMint || quote?.outputMint !== outputMint ||
    !RAW.test(input) || !RAW.test(output) || !RAW.test(String(amount)) ||
    BigInt(input) !== BigInt(amount) || BigInt(output) <= 0n || BigInt(output) > MAX_RAW) {
    throw Error("La cotation reçue ne confirme pas les tokens et le montant demandés.");
  }
  return { input, output };
}
