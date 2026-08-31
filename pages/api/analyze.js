const DEX_BASE = "https://api.dexscreener.com";
const FETCH_TIMEOUT_MS = 12000;

function json(res, status, body) {
  res.status(status).setHeader("Cache-Control", "no-store");
  return res.status(status).json(body);
}

function isSolanaMint(value) {
  return typeof value === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal
    });

    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch {}

    if (!response.ok) {
      const error = new Error(`Upstream HTTP ${response.status}`);
      error.status = response.status;
      error.body = data || text;
      throw error;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function pickPair(pairs, mint) {
  const valid = (Array.isArray(pairs) ? pairs : []).filter(
    p => p && p.chainId === "solana" && p.pairAddress
  );

  if (!valid.length) return null;

  return [...valid].sort((a, b) => {
    const al = num(a?.liquidity?.usd) || 0;
    const bl = num(b?.liquidity?.usd) || 0;
    const av = num(a?.volume?.h24) || 0;
    const bv = num(b?.volume?.h24) || 0;
    const at = a?.baseToken?.address === mint ? 1 : 0;
    const bt = b?.baseToken?.address === mint ? 1 : 0;
    return (bt - at) * 1e12 + (bl - al) * 1000 + (bv - av);
  })[0];
}

function scoreLiquidity(usd) {
  if (!finite(usd)) return null;
  if (usd <= 0) return 0;
  return Math.min(100, (Math.log10(usd + 1) / Math.log10(1000000 + 1)) * 100);
}

function scoreVolume(usd) {
  if (!finite(usd)) return null;
  if (usd <= 0) return 0;
  return Math.min(100, (Math.log10(usd + 1) / Math.log10(10000000 + 1)) * 100);
}

function scoreActivity(txns) {
  if (!txns || typeof txns !== "object") return null;
  const buys = num(txns.buys);
  const sells = num(txns.sells);
  if (!finite(buys) && !finite(sells)) return null;
  const total = (buys || 0) + (sells || 0);
  if (total <= 0) return 0;
  return Math.min(100, (Math.log10(total + 1) / Math.log10(10001)) * 100);
}

function scoreMaturity(createdAt) {
  const ms = num(createdAt);
  if (!finite(ms) || ms <= 0) return null;
  const ageDays = Math.max(0, (Date.now() - ms) / 86400000);
  return Math.min(100, (Math.log10(ageDays + 1) / Math.log10(91)) * 100);
}

function fmtUsd(value) {
  if (!finite(value)) return null;
  return value;
}

function calculateOverall(metrics) {
  const weights = {
    liquidity: 30,
    distribution: 15,
    activity: 25,
    volume: 20,
    maturity: 10
  };

  const available = Object.entries(metrics)
    .filter(([, value]) => finite(value));

  if (!available.length) return { score: null, status: "INSUFFICIENT_DATA" };

  const totalWeight = available.reduce((sum, [key]) => sum + weights[key], 0);
  const weighted = available.reduce(
    (sum, [key, value]) => sum + value * weights[key],
    0
  );

  const score = Math.round(weighted / totalWeight);
  const missing = Object.keys(weights).filter(key => !finite(metrics[key]));

  return {
    score,
    status: missing.length ? "PARTIAL_DATA" : "VALID",
    missing
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  let mint = "";
  if (req.method === "GET") {
    mint = req.query?.mint || "";
  } else {
    mint = req.body?.mint || "";
  }

  mint = String(mint).trim();

  if (!isSolanaMint(mint)) {
    return json(res, 400, {
      ok: false,
      error: "Adresse Solana invalide. Utilise l'adresse mint du token."
    });
  }

  try {
    // IMPORTANT: this is the documented DEX Screener token endpoint.
    // It returns pairs with liquidity, volume, txns and pairCreatedAt.
    const url = `${DEX_BASE}/tokens/v1/solana/${encodeURIComponent(mint)}`;
    const pairs = await fetchJson(url);

    if (!Array.isArray(pairs) || pairs.length === 0) {
      return json(res, 200, {
        ok: true,
        mint,
        status: "NO_MARKET",
        score: null,
        metrics: {
          liquidity: null,
          distribution: null,
          activity: null,
          volume: null,
          maturity: null
        },
        observed: {
          liquidityUsd: null,
          volume24hUsd: null,
          holders: null,
          activity24h: null
        },
        pair: null,
        missingData: ["liquidity", "volume24h", "activity", "maturity", "distribution"],
        message: "Aucune paire Solana exploitable trouvée sur DEX Screener."
      });
    }

    const pair = pickPair(pairs, mint);
    if (!pair) {
      return json(res, 200, {
        ok: true,
        mint,
        status: "NO_MARKET",
        score: null,
        metrics: {
          liquidity: null,
          distribution: null,
          activity: null,
          volume: null,
          maturity: null
        },
        observed: {
          liquidityUsd: null,
          volume24hUsd: null,
          holders: null,
          activity24h: null
        },
        pair: null,
        missingData: ["liquidity", "volume24h", "activity", "maturity", "distribution"]
      });
    }

    const liquidityUsd = num(pair?.liquidity?.usd);
    const volume24hUsd = num(pair?.volume?.h24);
    const txns24h = pair?.txns?.h24 || null;
    const activity24h =
      finite(num(txns24h?.buys)) || finite(num(txns24h?.sells))
        ? (num(txns24h?.buys) || 0) + (num(txns24h?.sells) || 0)
        : null;

    const maturityScore = scoreMaturity(pair?.pairCreatedAt);

    // DEX Screener does not expose a reliable holder count in this endpoint.
    // We deliberately keep distribution/holders as N/D instead of inventing data.
    const metrics = {
      liquidity: scoreLiquidity(liquidityUsd),
      distribution: null,
      activity: scoreActivity(txns24h),
      volume: scoreVolume(volume24hUsd),
      maturity: maturityScore
    };

    const overall = calculateOverall(metrics);
    const missingData = overall.missing || [];

    return json(res, 200, {
      ok: true,
      mint,
      status: overall.status,
      score: overall.score,
      metrics,
      observed: {
        liquidityUsd: fmtUsd(liquidityUsd),
        volume24hUsd: fmtUsd(volume24hUsd),
        holders: null,
        activity24h
      },
      pair: {
        address: pair.pairAddress || null,
        dex: pair.dexId || null,
        url: pair.url || null,
        baseToken: pair.baseToken || null,
        quoteToken: pair.quoteToken || null,
        priceUsd: num(pair.priceUsd),
        marketCap: num(pair.marketCap),
        fdv: num(pair.fdv),
        pairCreatedAt: num(pair.pairCreatedAt)
      },
      source: "DEX Screener",
      missingData,
      note:
        missingData.length
          ? "Le score est calculé uniquement à partir des métriques réellement disponibles. Aucune donnée manquante n'est inventée."
          : "Toutes les métriques disponibles ont été utilisées."
    });
  } catch (error) {
    console.error("PROFITX analyze error:", error);
    return json(res, 502, {
      ok: false,
      status: "UPSTREAM_ERROR",
      error:
        error?.name === "AbortError"
          ? "DEX Screener a mis trop de temps à répondre."
          : "Impossible de récupérer les données DEX Screener.",
      details: process.env.NODE_ENV === "development" ? String(error) : undefined
    });
  }
}
