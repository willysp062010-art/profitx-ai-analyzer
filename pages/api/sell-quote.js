import { checkedQuote, quoteImpactPercent } from "../../utils/quote-validation";
import { isSolanaMint } from "../../utils/watchlist";
// PROFITX AI — read-only Solana sell quote via Jupiter Swap API v2.
// This endpoint NEVER builds, signs or submits a transaction.
const SOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Méthode non autorisée." });
  const mint = String(req.query.mint || "").trim();
  const raw = String(req.query.amount || "").trim();
  const outputMint = req.query.output === "USDC" ? USDC : SOL;
  if (!isSolanaMint(mint) || mint === SOL || mint === USDC || !/^[1-9][0-9]{0,17}$/.test(raw)) {
    return res.status(400).json({ ok: false, error: "Mint ou quantité brute invalide." });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const url = new URL("https://api.jup.ag/swap/v2/order");
    url.searchParams.set("inputMint", mint);
    url.searchParams.set("outputMint", outputMint);
    url.searchParams.set("amount", raw);
    const headers = { Accept: "application/json" };
    if (process.env.JUPITER_API_KEY) headers["x-api-key"] = process.env.JUPITER_API_KEY;
    const response = await fetch(url, { headers, signal: controller.signal });
    const quote = await response.json().catch(() => null);
    if (!response.ok || !quote || quote.error || quote.errorCode) {
      return res.status(200).json({
        ok: true, status: "QUOTE_UNAVAILABLE", executableNow: null,
        reason: "Aucune cotation exploitable disponible pour ce montant.",
        providerStatus: response.status,
        note: "Absence de cotation ne signifie pas preuve d'impossibilité de revente."
      });
    }
    const { input: inAmount, output: outAmount } = checkedQuote(quote, mint, outputMint, raw);
    return res.status(200).json({
      ok: true, status: "ROUTE_QUOTED", executableNow: null,
      inputMint: mint, outputMint, inputAmountRaw: String(inAmount),
      outputAmountRaw: String(outAmount),
      outputDecimals: outputMint === SOL ? 9 : 6,
      priceImpactPct: quoteImpactPercent(quote),
      priceImpactUnit: "percentage_points",
      router: quote.router ?? null,
      quotedAt: new Date().toISOString(),
      note: "Cotation indicative, non simulation d'exécution. La route, les frais, le slippage et la réussite peuvent changer avant signature. Aucune transaction envoyée."
    });
  } catch (error) {
    return res.status(200).json({
      ok: true, status: "QUOTE_UNAVAILABLE", executableNow: null,
      reason: error?.name === "AbortError" ? "Délai de cotation dépassé." : "Service de cotation indisponible."
    });
  } finally {
    clearTimeout(timer);
  }
}
