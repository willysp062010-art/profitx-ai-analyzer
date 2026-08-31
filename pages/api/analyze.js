const DEXSCREENER_BASE = "https://api.dexscreener.com/latest/dex/tokens";
const PUMP_COIN_URL = "https://frontend-api-v3.pump.fun/coins-v2";
const PUMP_SOL_PRICE_URL = "https://frontend-api-v3.pump.fun/sol-price";
const DEFAULT_RPC = "https://api.mainnet-beta.solana.com";

const REQUEST_TIMEOUT_MS = 10000;

function clamp(value, min = 0, max = 100) {
  if (!Number.isFinite(Number(value))) return null;
  return Math.max(min, Math.min(max, Number(value)));
}

function numberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(options.headers || {})
      }
    });

    const text = await response.text();
    let data = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      throw new Error(`Réponse JSON invalide (${response.status}).`);
    }

    if (!response.ok) {
      const message =
        data?.error ||
        data?.message ||
        `HTTP ${response.status}`;
      throw new Error(message);
    }

    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function solanaRpc(method, params) {
  const rpcUrl = process.env.SOLANA_RPC_URL || DEFAULT_RPC;

  return fetchJson(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "profitx-ai",
      method,
      params
    })
  });
}

/**
 * DexScreener:
 * Used first for graduated tokens / tokens with an indexed DEX pair.
 */
async function getDexScreenerData(mint) {
  const url = `${DEXSCREENER_BASE}/solana/${encodeURIComponent(mint)}`;
  const json = await fetchJson(url);
  const pairs = Array.isArray(json?.pairs) ? json.pairs : [];

  if (!pairs.length) {
    return {
      source: "dexscreener",
      pair: null,
      pairs: []
    };
  }

  // Prefer Solana pairs and then the pair with the highest USD liquidity.
  const solanaPairs = pairs.filter((pair) => pair?.chainId === "solana");
  const candidates = solanaPairs.length ? solanaPairs : pairs;

  const pair = [...candidates].sort(
    (a, b) =>
      numberOrNull(b?.liquidity?.usd) - numberOrNull(a?.liquidity?.usd)
  )[0];

  return {
    source: "dexscreener",
    pair,
    pairs: candidates
  };
}

/**
 * Pump.fun official backend endpoint.
 * IMPORTANT: this is called server-side because Pump.fun documents this
 * endpoint as CORS-protected for browser-origin requests.
 */
async function getPumpFunData(mint) {
  const coin = await fetchJson(
    `${PUMP_COIN_URL}/${encodeURIComponent(mint)}`
  );

  if (!coin || typeof coin !== "object") {
    throw new Error("Pump.fun n'a pas retourné de données.");
  }

  let solPriceUsd = null;

  try {
    const priceData = await fetchJson(PUMP_SOL_PRICE_URL);
    solPriceUsd =
      numberOrNull(priceData?.solPrice) ??
      numberOrNull(priceData?.sol_price) ??
      numberOrNull(priceData?.usd);
  } catch {
    // SOL price is optional. We do not invent it.
  }

  return {
    source: "pumpfun",
    coin,
    solPriceUsd
  };
}

function analyseDexPair(pair) {
  if (!pair) return null;

  const liquidityUsd = numberOrNull(pair?.liquidity?.usd);
  const volume24hUsd = numberOrNull(pair?.volume?.h24);

  const buys = numberOrNull(pair?.txns?.h24?.buys);
  const sells = numberOrNull(pair?.txns?.h24?.sells);

  const transactions24h =
    buys !== null && sells !== null ? buys + sells : null;

  const priceUsd = numberOrNull(pair?.priceUsd);
  const marketCapUsd =
    numberOrNull(pair?.marketCap) ??
    numberOrNull(pair?.fdv);

  const pairCreatedAt = numberOrNull(pair?.pairCreatedAt);
  const ageHours =
    pairCreatedAt !== null
      ? Math.max(0, (Date.now() - pairCreatedAt) / 3600000)
      : null;

  const activity =
    transactions24h === null
      ? null
      : clamp(Math.log10(transactions24h + 1) * 25);

  const maturity =
    ageHours === null
      ? null
      : clamp((Math.log10(ageHours + 1) / Math.log10(24 * 30 + 1)) * 100);

  return {
    liquidityUsd,
    volume24hUsd,
    transactions24h,
    buys24h: buys,
    sells24h: sells,
    priceUsd,
    marketCapUsd,
    pairCreatedAt,
    ageHours,
    activity,
    maturity,
    pairAddress: pair?.pairAddress ?? null,
    dexId: pair?.dexId ?? null
  };
}

function analysePumpCoin(coin, solPriceUsd) {
  if (!coin) return null;

  const usdMarketCap =
    numberOrNull(coin?.usd_market_cap) ??
    numberOrNull(coin?.usdMarketCap);

  const marketCapSol = numberOrNull(coin?.market_cap);

  const effectiveMarketCapUsd =
    usdMarketCap ??
    (marketCapSol !== null && solPriceUsd !== null
      ? marketCapSol * solPriceUsd
      : null);

  const virtualSol =
    numberOrNull(coin?.virtual_sol_reserves) !== null
      ? numberOrNull(coin?.virtual_sol_reserves) / 1e9
      : null;

  const virtualToken =
    numberOrNull(coin?.virtual_token_reserves) !== null
      ? numberOrNull(coin?.virtual_token_reserves) / 1e6
      : null;

  // Pump.fun's official API exposes these fields for bonding-curve tokens.
  // We report virtual SOL reserves as a transparent liquidity proxy rather
  // than falsely calling it DEX liquidity.
  const liquidityUsd =
    virtualSol !== null && solPriceUsd !== null
      ? virtualSol * solPriceUsd
      : null;

  const createdTimestamp = numberOrNull(coin?.created_timestamp);
  const ageHours =
    createdTimestamp !== null
      ? Math.max(
          0,
          (Date.now() - createdTimestamp) / 1000 / 3600
        )
      : null;

  const lastTradeTimestamp = numberOrNull(coin?.last_trade_timestamp);
  const lastTradeAgeHours =
    lastTradeTimestamp !== null
      ? Math.max(
          0,
          (Date.now() - lastTradeTimestamp) / 1000 / 3600
        )
      : null;

  const maturity =
    ageHours === null
      ? null
      : clamp((Math.log10(ageHours + 1) / Math.log10(24 * 30 + 1)) * 100);

  const activity =
    lastTradeAgeHours === null
      ? null
      : lastTradeAgeHours <= 1
        ? 100
        : lastTradeAgeHours <= 6
          ? 80
          : lastTradeAgeHours <= 24
            ? 60
            : lastTradeAgeHours <= 72
              ? 35
              : 10;

  const liquidityScore =
    liquidityUsd === null
      ? null
      : clamp(Math.log10(Math.max(liquidityUsd, 1)) * 20);

  const maturityScore = maturity;

  return {
    liquidityUsd,
    volume24hUsd: null,
    transactions24h: null,
    buys24h: null,
    sells24h: null,
    priceUsd:
      numberOrNull(coin?.usd_market_cap) !== null &&
      numberOrNull(coin?.total_supply) !== null
        ? effectiveMarketCapUsd / numberOrNull(coin.total_supply)
        : null,
    marketCapUsd: effectiveMarketCapUsd,
    pairCreatedAt: createdTimestamp !== null ? createdTimestamp * 1000 : null,
    ageHours,
    activity,
    maturity: maturityScore,
    pumpComplete: coin?.complete === true,
    pumpSwapPool: coin?.pump_swap_pool || null,
    raydiumPool: coin?.raydium_pool || null,
    virtualSolReserves: virtualSol,
    virtualTokenReserves: virtualToken,
    creator: coin?.creator ?? null,
    name: coin?.name ?? null,
    symbol: coin?.symbol ?? null,
    imageUri: coin?.image_uri ?? null
  };
}

function calculateScore(metrics, source) {
  const components = {
    liquidity: null,
    distribution: null,
    activity: metrics?.activity ?? null,
    volume: null,
    maturity: metrics?.maturity ?? null
  };

  if (metrics?.liquidityUsd !== null && metrics?.liquidityUsd !== undefined) {
    components.liquidity = clamp(
      Math.log10(Math.max(metrics.liquidityUsd, 1)) * 20
    );
  }

  if (
    metrics?.volume24hUsd !== null &&
    metrics?.volume24hUsd !== undefined
  ) {
    components.volume = clamp(
      Math.log10(Math.max(metrics.volume24hUsd, 1)) * 20
    );
  } else if (source === "pumpfun") {
    // No artificial volume score for Pump.fun bonding-curve tokens.
    components.volume = null;
  }

  // Distribution cannot be responsibly inferred from the APIs used here.
  components.distribution = null;

  const weights = {
    liquidity: 25,
    distribution: 25,
    activity: 20,
    volume: 15,
    maturity: 15
  };

  let weighted = 0;
  let availableWeight = 0;

  for (const [key, weight] of Object.entries(weights)) {
    const value = components[key];
    if (value !== null && Number.isFinite(value)) {
      weighted += value * weight;
      availableWeight += weight;
    }
  }

  const total =
    availableWeight >= 40
      ? Math.round(weighted / availableWeight)
      : null;

  return {
    total,
    components,
    weights,
    availableWeight
  };
}

async function getHolderEstimate(mint) {
  // A real holder count requires indexed token-account data.
  // Do not pretend that getTokenAccountsByOwner with the system address
  // is a holder counter. Return null until an indexed source is configured.
  if (!process.env.HELIUS_API_KEY) return null;

  try {
    const url =
      `https://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(
        process.env.HELIUS_API_KEY
      )}`;

    const response = await fetchJson(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "profitx-holders",
        method: "getTokenAccounts",
        params: {
          mint,
          limit: 1
        }
      })
    });

    // Helius may return pagination metadata depending on API version.
    // We only use an explicit total if supplied by the endpoint.
    const total =
      numberOrNull(response?.result?.total) ??
      numberOrNull(response?.result?.pagination?.total);

    return total;
  } catch {
    return null;
  }
}

function buildStatus(source, metrics, missingData, pumpCoin) {
  if (source === "pumpfun") {
    if (pumpCoin?.complete === true) return "GRADUATED";
    if (pumpCoin?.complete === false) return "BONDING_CURVE";
    return "PUMP_DATA";
  }

  if (source === "dexscreener") {
    if (!metrics) return "NO_MARKET";
    if (
      metrics.liquidityUsd !== null ||
      metrics.volume24hUsd !== null
    ) {
      return missingData.length ? "PARTIAL_DATA" : "VALID";
    }
    return "NO_MARKET";
  }

  return "INSUFFICIENT_DATA";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      error: "Méthode non autorisée."
    });
  }

  const mint = String(req.body?.mint || "").trim();

  // Base58-looking Solana public key. We intentionally validate shape only
  // here; Solana RPC/Pump.fun remains the authority for whether it exists.
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) {
    return res.status(400).json({
      error: "Adresse mint Solana invalide."
    });
  }

  const missingData = [];
  let source = null;
  let metrics = null;
  let pumpCoin = null;
  let solPriceUsd = null;
  let dexPair = null;
  let holderCount = null;
  let dexError = null;
  let pumpError = null;

  // 1) Try DEX Screener first.
  try {
    const dex = await getDexScreenerData(mint);

    if (dex.pair) {
      source = "dexscreener";
      dexPair = dex.pair;
      metrics = analyseDexPair(dex.pair);
    }
  } catch (error) {
    dexError = error?.message || "Erreur DexScreener.";
  }

  // 2) If no DEX pair, use Pump.fun's server-side API.
  if (!metrics) {
    try {
      const pump = await getPumpFunData(mint);
      pumpCoin = pump.coin;
      solPriceUsd = pump.solPriceUsd;

      // Only accept a Pump.fun response that actually identifies the token.
      if (
        pumpCoin?.mint &&
        String(pumpCoin.mint) === mint
      ) {
        source = "pumpfun";
        metrics = analysePumpCoin(
          pumpCoin,
          solPriceUsd
        );
      } else {
        pumpError = "Pump.fun n'a pas confirmé ce mint.";
      }
    } catch (error) {
      pumpError = error?.message || "Erreur Pump.fun.";
    }
  }

  if (!metrics) {
    return res.status(200).json({
      mint,
      timestamp: new Date().toISOString(),
      status: "NO_MARKET",
      source: null,
      data: {
        supply: null,
        decimals: null,
        holders: null,
        liquidityUsd: null,
        volume24hUsd: null,
        activity: null,
        transactions24h: null,
        priceUsd: null,
        marketCapUsd: null
      },
      score: {
        total: null,
        components: {
          liquidity: null,
          distribution: null,
          activity: null,
          volume: null,
          maturity: null
        },
        weights: {
          liquidity: 25,
          distribution: 25,
          activity: 20,
          volume: 15,
          maturity: 15
        },
        availableWeight: 0
      },
      missingData: [
        "market",
        "liquidity",
        "volume24h",
        "activity",
        "maturity"
      ],
      diagnostics: {
        dexscreener: dexError,
        pumpfun: pumpError
      }
    });
  }

  // Holder data is optional and never fabricated.
  holderCount = await getHolderEstimate(mint);

  if (metrics.liquidityUsd === null) {
    missingData.push("liquidity");
  }

  if (metrics.volume24hUsd === null) {
    missingData.push("volume24h");
  }

  if (metrics.activity === null) {
    missingData.push("activity");
  }

  if (metrics.maturity === null) {
    missingData.push("maturity");
  }

  if (holderCount === null) {
    missingData.push("holders");
  }

  const score = calculateScore(metrics, source);

  if (score.total === null) {
    missingData.push("score");
  }

  const status = buildStatus(
    source,
    metrics,
    missingData,
    pumpCoin
  );

  return res.status(200).json({
    mint,
    timestamp: new Date().toISOString(),
    status,
    source,

    token: {
      name: metrics.name ?? null,
      symbol: metrics.symbol ?? null,
      imageUri: metrics.imageUri ?? null,
      creator: metrics.creator ?? null
    },

    data: {
      supply: pumpCoin
        ? numberOrNull(pumpCoin.total_supply)
        : null,
      decimals: pumpCoin
        ? numberOrNull(pumpCoin.decimals)
        : null,

      holders: holderCount,

      liquidityUsd: metrics.liquidityUsd,
      volume24hUsd: metrics.volume24hUsd,
      activity: metrics.activity,
      transactions24h: metrics.transactions24h,

      buys24h: metrics.buys24h,
      sells24h: metrics.sells24h,

      priceUsd: metrics.priceUsd,
      marketCapUsd: metrics.marketCapUsd,

      ageHours: metrics.ageHours,
      pairCreatedAt: metrics.pairCreatedAt,
      maturity: metrics.maturity,

      pumpComplete:
        metrics.pumpComplete ??
        pumpCoin?.complete ??
        null,

      pumpSwapPool:
        metrics.pumpSwapPool ??
        pumpCoin?.pump_swap_pool ??
        null,

      raydiumPool:
        metrics.raydiumPool ??
        pumpCoin?.raydium_pool ??
        null,

      virtualSolReserves:
        metrics.virtualSolReserves ?? null,

      virtualTokenReserves:
        metrics.virtualTokenReserves ?? null,

      solPriceUsd: metrics.solPriceUsd ?? null,
    },

    market: {
      pairAddress: metrics.pairAddress ?? null,
      dexId: metrics.dexId ?? null
    },

    score,

    missingData,

    diagnostics: {
      dexscreenerUsed: source === "dexscreener",
      pumpfunUsed: source === "pumpfun"
    }
  });
}
