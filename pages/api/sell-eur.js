// PROFITX AI — indicative EUR-denominated round-trip quote. No wallet, transaction or signature.
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const MINT = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
async function jsonFetch(url, headers, signal) {
  const r = await fetch(url, { headers, signal });
  const body = await r.json().catch(() => ({}));
  if (!r.ok || body.error || body.errorCode) throw new Error("Cotation indisponible chez le fournisseur.");
  return body;
}
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Méthode non autorisée." });
  const mint = String(req.query.mint || "").trim();
  const eur = Number(req.query.eur);
  if (!MINT.test(mint) || mint === USDC || ![10, 100, 1000].includes(eur)) {
    return res.status(400).json({ ok: false, error: "Paramètres invalides." });
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18000);
  try {
    // Frankfurter publishes ECB reference FX rates; USDC is assumed near USD, not guaranteed.
    const fx = await jsonFetch("https://api.frankfurter.dev/v1/latest?base=EUR&symbols=USD", {}, controller.signal);
    const usdPerEur = Number(fx?.rates?.USD);
    if (!(usdPerEur > 0.5 && usdPerEur < 2)) throw new Error("Taux EUR/USD indisponible.");
    const inputUsd = eur * usdPerEur;
    const usdcRaw = Math.round(inputUsd * 1e6);
    const headers = { Accept: "application/json" };
    if (process.env.JUPITER_API_KEY) headers["x-api-key"] = process.env.JUPITER_API_KEY;
    const quote = async (inputMint, outputMint, amount) => {
      const url = new URL("https://api.jup.ag/swap/v2/order");
      url.searchParams.set("inputMint", inputMint);
      url.searchParams.set("outputMint", outputMint);
      url.searchParams.set("amount", String(amount));
      return jsonFetch(url.toString(), headers, controller.signal);
    };
    // First find how many tokens ~EUR amount could buy; then independently quote their sale.
    const buy = await quote(USDC, mint, usdcRaw);
    const tokenRaw = String(buy.outAmount ?? buy.outputAmount ?? "");
    if (!/^[1-9][0-9]{0,17}$/.test(tokenRaw)) throw new Error("Aucune quantité de token cotable.");
    const sell = await quote(mint, USDC, tokenRaw);
    const returnedRaw = String(sell.outAmount ?? sell.outputAmount ?? "");
    if (!/^[0-9]+$/.test(returnedRaw)) throw new Error("Aucune sortie USDC cotable.");
    const returnedUsd = Number(returnedRaw) / 1e6;
    const returnedEur = returnedUsd / usdPerEur;
    return res.status(200).json({
      ok: true, status: "ROUTE_QUOTED", eurReference: eur,
      tokenAmountRaw: tokenRaw, usdPerEur, fxDate: fx.date ?? null,
      indicativeSaleEur: Number(returnedEur.toFixed(4)),
      indicativeDifferenceEur: Number((eur - returnedEur).toFixed(4)),
      priceImpactPct: sell.priceImpactPct ?? sell.priceImpact ?? null,
      quotedAt: new Date().toISOString(),
      note: "Deux cotations indicatives achat puis vente, et non une simulation de portefeuille ou une exécution. L'écart inclut spread/impact éventuel, pas des frais réseau exhaustifs. USDC peut s'écarter de 1 USD. Aucun slippage maximal ni succès de vente garanti."
    });
  } catch (error) {
    return res.status(200).json({ ok: true, status: "QUOTE_UNAVAILABLE", reason: error?.name === "AbortError" ? "Délai dépassé." : error?.message || "Estimation indisponible.", note: "Absence de cotation ne prouve pas une impossibilité de revente." });
  } finally {
    clearTimeout(timeout);
  }
}
