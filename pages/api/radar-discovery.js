// Découverte précoce : données déclarées par Pump.fun, non auditées.
// Endpoint séparé pour ne pas modifier les scores du Radar existant.
const URL = "https://frontend-api-v3.pump.fun/coins?offset=0&limit=200&sort=created_timestamp&order=DESC&includeNsfw=false";
const MAX_RESULTS = 50;
const TIMEOUT_MS = 8000;
const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function isSolanaMint(value) {
  if (typeof value !== "string" || value.length < 32 || value.length > 44) return false;
  let n = 0n;
  for (const c of value) {
    const i = BASE58.indexOf(c);
    if (i < 0) return false;
    n = n * 58n + BigInt(i);
  }
  let bytes = 0;
  while (n > 0n) { bytes++; n >>= 8n; }
  return bytes + (value.match(/^1*/)?.[0].length || 0) === 32;
}

function safeText(value, limit = 120) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function timestamp(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  const ms = n < 1e12 ? n * 1000 : n;
  return ms <= Date.now() + 60000 && ms <= 8.64e15 ? new Date(ms).toISOString() : null;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Méthode non autorisée." });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(URL, {
      headers: { Accept: "application/json" },
      signal: controller.signal
    });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return res.status(503).json({
          ok: false,
          source: "pumpfun",
          status: "SOURCE_ACCESS_RESTRICTED",
          error: `Pump.fun refuse l’accès aux données depuis notre serveur (HTTP ${response.status}). Les autres sources du Radar restent indépendantes.`
        });
      }
      throw new Error("Pump.fun HTTP " + response.status);
    }
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error("Format Pump.fun inattendu");
    const seen = new Set();
    const tokens = [];
    for (const coin of data) {
      const mint = coin?.mint;
      if (!isSolanaMint(mint) || seen.has(mint) || coin?.is_banned === true || coin?.nsfw === true) continue;
      seen.add(mint);
      tokens.push({
        mint,
        name: safeText(coin?.name),
        symbol: safeText(coin?.symbol, 24),
        createdAt: timestamp(coin?.created_timestamp),
        bondingCurveComplete: coin?.complete === true,
        source: "pumpfun",
        verificationStatus: "UNVERIFIED",
        liquidityUsd: null,
        volume24hUsd: null,
        riskScore: null,
        dataQuality: "UNVERIFIED_ONCHAIN"
      });
      if (tokens.length >= MAX_RESULTS) break;
    }
    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
    return res.status(200).json({
      ok: true,
      chain: "solana",
      discovery: "pumpfun-recent-creations",
      updatedAt: new Date().toISOString(),
      count: tokens.length,
      tokens,
      note: "Échantillon des créations récentes retournées par Pump.fun, non exhaustif. Aucune liquidité, possibilité de revente ou sécurité n'est vérifiée par cet endpoint."
    });
  } catch (error) {
    console.error("[PFX RADAR DISCOVERY]", error?.message);
    return res.status(error?.name === "AbortError" ? 504 : 502).json({
      ok: false,
      error: "Découverte Pump.fun temporairement indisponible."
    });
  } finally {
    clearTimeout(timer);
  }
}
