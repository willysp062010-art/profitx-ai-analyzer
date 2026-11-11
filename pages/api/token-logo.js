// Resolves a Solana token logo by its exact mint, never by a ticker/name.
const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const TIMEOUT = 4500;

async function getJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function validLogo(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch { return null; }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
  if (req.method !== "GET") return res.status(405).json({ ok: false });
  const mint = String(req.query.mint || "").trim();
  if (!MINT_RE.test(mint)) return res.status(400).json({ ok: false, error: "Mint invalide." });

  const [jupiter, dex] = await Promise.all([
    getJson("https://lite-api.jup.ag/tokens/v2/search?query=" + encodeURIComponent(mint)),
    getJson("https://api.dexscreener.com/latest/dex/tokens/" + encodeURIComponent(mint))
  ]);
  const match = Array.isArray(jupiter) ? jupiter.find((token) => token?.id === mint) : null;
  const dexPairs = Array.isArray(dex?.pairs) ? dex.pairs.filter((pair) => pair?.chainId === "solana" && pair?.baseToken?.address === mint) : [];
  const dexLogo = dexPairs.find((pair) => validLogo(pair?.info?.imageUrl))?.info?.imageUrl;
  const imageUri = validLogo(match?.icon) || validLogo(match?.logoURI) || validLogo(dexLogo);
  return res.status(200).json({ ok: true, mint, imageUri: imageUri || null, source: imageUri ? (validLogo(match?.icon) || validLogo(match?.logoURI) ? "jupiter" : "dexscreener") : null });
}
