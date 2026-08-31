const DEXSCREENER_BASE =
  "https://api.dexscreener.com/latest/dex/tokens";

const PUMP_COIN_URL =
  "https://frontend-api-v3.pump.fun/coins-v2";

const PUMP_SOL_PRICE_URL =
  "https://frontend-api-v3.pump.fun/sol-price";

const DEFAULT_RPC =
  "https://api.mainnet-beta.solana.com";

const REQUEST_TIMEOUT_MS = 12000;

function numberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clamp(value, min = 0, max = 100) {
  const n = Number(value);

  if (!Number.isFinite(n)) {
    return null;
  }

  return Math.max(min, Math.min(max, n));
}

function json(res, status, body) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  return res.status(status).json(body);
}

function isSolanaMint(value) {
  return (
    typeof value === "string" &&
    /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)
  );
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );

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

    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(
          `Réponse JSON invalide (${response.status}).`
        );
      }
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

/* =========================================================
   DEXSCREENER
   ========================================================= */

async function getDexScreenerData(mint) {
  const url =
    `${DEXSCREENER_BASE}/solana/${encodeURIComponent(mint)}`;

  const data = await fetchJson(url);

  const pairs = Array.isArray(data?.pairs)
    ? data.pairs
    : [];

  if (pairs.length === 0) {
    return {
      pair: null,
      pairs: []
    };
  }

  const solanaPairs = pairs.filter(
    (pair) => pair?.chainId === "solana"
  );

  const candidates =
    solanaPairs.length > 0
      ? solanaPairs
      : pairs;

  const sorted = [...candidates].sort((a, b) => {
    const liquidityA =
      numberOrNull(a?.liquidity?.usd) ?? 0;

    const liquidityB =
      numberOrNull(b?.liquidity?.usd) ?? 0;

    return liquidityB - liquidityA;
  });

  return {
    pair: sorted[0] || null,
    pairs: sorted
  };
}

/* =========================================================
   PUMP.FUN
   ========================================================= */

async function getPumpFunData(mint) {
  const coinUrl =
    `${PUMP_COIN_URL}/${encodeURIComponent(mint)}`;

  const coin = await fetchJson(coinUrl, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Origin: "https://pump.fun"
    }
  });

  if (!coin || typeof coin !== "object") {
    throw new Error(
      "Pump.fun n'a pas retourné de données."
    );
  }

  let solPriceUsd = null;

  try {
    const price = await fetchJson(
      PUMP_SOL_PRICE_URL,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Origin: "https://pump.fun"
        }
      }
    );

    solPriceUsd =
      numberOrNull(price?.solPrice) ??
      numberOrNull(price?.sol_price) ??
      numberOrNull(price?.usd) ??
      null;
  } catch {
    solPriceUsd = null;
  }

  return {
    coin,
    solPriceUsd
  };
}

/* =========================================================
   DEX PAIR ANALYSIS
   ========================================================= */

function analyseDexPair(pair) {
  if (!pair) {
    return null;
  }

  const liquidityUsd =
    numberOrNull(pair?.liquidity?.usd);

  const volume24hUsd =
    numberOrNull(pair?.volume?.h24);

  const buys =
    numberOrNull(pair?.txns?.h24?.buys);

  const sells =
    numberOrNull(pair?.txns?.h24?.sells);

  const transactions24h =
    buys !== null && sells !== null
      ? buys + sells
      : null;

  const priceUsd =
    numberOrNull(pair?.priceUsd);

  const marketCapUsd =
    numberOrNull(pair?.marketCap) ??
    numberOrNull(pair?.fdv);

  const pairCreatedAt =
    numberOrNull(pair?.pairCreatedAt);

  let ageHours = null;

  if (pairCreatedAt !== null) {
    ageHours = Math.max(
      0,
      (Date.now() - pairCreatedAt) / 3600000
    );
  }

  let activity = null;

  if (transactions24h !== null) {
    activity = clamp(
      Math.log10(transactions24h + 1) * 25
    );
  }

  let maturity = null;

  if (ageHours !== null) {
    maturity = clamp(
      (
        Math.log10(ageHours + 1) /
        Math.log10(24 * 30 + 1)
      ) * 100
    );
  }

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

    pairAddress:
      pair?.pairAddress ?? null,

    dexId:
      pair?.dexId ?? null,

    url:
      pair?.url ?? null,

    baseToken:
      pair?.baseToken ?? null,

    quoteToken:
      pair?.quoteToken ?? null
  };
}

/* =========================================================
   PUMP.FUN COIN ANALYSIS
   ========================================================= */

function analysePumpCoin(
  coin,
  solPriceUsd
) {
  if (!coin) {
    return null;
  }

  const usdMarketCap =
    numberOrNull(
      coin?.usd_market_cap
    ) ??
    numberOrNull(
      coin?.usdMarketCap
    );

  const marketCapSol =
    numberOrNull(
      coin?.market_cap
    );

  let effectiveMarketCapUsd =
    usdMarketCap;

  if (
    effectiveMarketCapUsd === null &&
    marketCapSol !== null &&
    solPriceUsd !== null
  ) {
    effectiveMarketCapUsd =
      marketCapSol * solPriceUsd;
  }

  const rawVirtualSol =
    numberOrNull(
      coin?.virtual_sol_reserves
    );

  const rawVirtualToken =
    numberOrNull(
      coin?.virtual_token_reserves
    );

  const virtualSol =
    rawVirtualSol !== null
      ? rawVirtualSol / 1e9
      : null;

  const virtualToken =
    rawVirtualToken !== null
      ? rawVirtualToken / 1e6
      : null;

  let liquidityUsd = null;

  if (
    virtualSol !== null &&
    solPriceUsd !== null
  ) {
    liquidityUsd =
      virtualSol * solPriceUsd;
  }

  const createdTimestamp =
    numberOrNull(
      coin?.created_timestamp
    );

  let ageHours = null;

  if (createdTimestamp !== null) {
    const timestampMs =
      createdTimestamp > 100000000000
        ? createdTimestamp
        : createdTimestamp * 1000;

    ageHours = Math.max(
      0,
      (Date.now() - timestampMs) /
        3600000
    );
  }

  const lastTradeTimestamp =
    numberOrNull(
      coin?.last_trade_timestamp
    );

  let lastTradeAgeHours = null;

  if (lastTradeTimestamp !== null) {
    const timestampMs =
      lastTradeTimestamp > 100000000000
        ? lastTradeTimestamp
        : lastTradeTimestamp * 1000;

    lastTradeAgeHours = Math.max(
      0,
      (Date.now() - timestampMs) /
        3600000
    );
  }

  let maturity = null;

  if (ageHours !== null) {
    maturity = clamp(
      (
        Math.log10(ageHours + 1) /
        Math.log10(24 * 30 + 1)
      ) * 100
    );
  }

  let activity = null;

  if (lastTradeAgeHours !== null) {
    if (lastTradeAgeHours <= 1) {
      activity = 100;
    } else if (lastTradeAgeHours <= 6) {
      activity = 80;
    } else if (lastTradeAgeHours <= 24) {
      activity = 60;
    } else if (lastTradeAgeHours <= 72) {
      activity = 35;
    } else {
      activity = 10;
    }
  }

  let liquidityScore = null;

  if (liquidityUsd !== null) {
    liquidityScore = clamp(
      Math.log10(
        Math.max(liquidityUsd, 1)
      ) * 20
    );
  }

  return {
    liquidityUsd,

    volume24hUsd: null,

    transactions24h: null,

    buys24h: null,

    sells24h: null,

    priceUsd:
      numberOrNull(coin?.price_usd) ??
      numberOrNull(coin?.priceUsd) ??
      null,

    marketCapUsd:
      effectiveMarketCapUsd,

    pairCreatedAt:
      createdTimestamp !== null
        ? (
            createdTimestamp > 100000000000
              ? createdTimestamp
              : createdTimestamp * 1000
          )
        : null,

    ageHours,

    activity,

    maturity,

    liquidityScore,

    pumpComplete:
      coin?.complete === true,

    pumpSwapPool:
      coin?.pump_swap_pool ??
      null,

    raydiumPool:
      coin?.raydium_pool ??
      null,

    virtualSolReserves:
      virtualSol,

    virtualTokenReserves:
      virtualToken,

    creator:
      coin?.creator ??
      null,

    name:
      coin?.name ??
      null,

    symbol:
      coin?.symbol ??
      null,

    imageUri:
      coin?.image_uri ??
      null,

    description:
      coin?.description ??
      null,

    website:
      coin?.website ??
      null,

    twitter:
      coin?.twitter ??
      null,

    telegram:
      coin?.telegram ??
      null
  };
}

/* =========================================================
   SCORE
   ========================================================= */

function calculateScore(
  metrics,
  source
) {
  const components = {
    liquidity: null,
    distribution: null,
    activity:
      metrics?.activity ??
      null,
    volume: null,
    maturity:
      metrics?.maturity ??
      null
  };

  if (
    metrics?.liquidityUsd !== null &&
    metrics?.liquidityUsd !== undefined
  ) {
    components.liquidity =
      clamp(
        Math.log10(
          Math.max(
            metrics.liquidityUsd,
            1
          )
        ) * 20
      );
  }

  if (
    metrics?.volume24hUsd !== null &&
    metrics?.volume24hUsd !== undefined
  ) {
    components.volume =
      clamp(
        Math.log10(
          Math.max(
            metrics.volume24hUsd,
            1
          )
        ) * 20
      );
  }

  /*
   * Distribution is deliberately left null.
   * We do not invent a holder/distribution score.
   */
  components.distribution = null;

  const weights = {
    liquidity: 25,
    distribution: 25,
    activity: 20,
    volume: 15,
    maturity: 15
  };

  let weightedTotal = 0;
  let availableWeight = 0;

  for (
    const [key, weight]
    of Object.entries(weights)
  ) {
    const value =
      components[key];

    if (
      value !== null &&
      Number.isFinite(value)
    ) {
      weightedTotal +=
        value * weight;

      availableWeight +=
        weight;
    }
  }

  let total = null;

  /*
   * Minimum amount of real information
   * required before displaying a score.
   */
  if (availableWeight >= 40) {
    total = Math.round(
      weightedTotal /
        availableWeight
    );
  }

  return {
    total,

    components,

    weights,

    availableWeight,

    source
  };
}

/* =========================================================
   STATUS
   ========================================================= */

function buildStatus(
  source,
  metrics,
  missingData,
  pumpCoin
) {
  if (source === "pumpfun") {
    if (
      pumpCoin?.complete === true
    ) {
      return "GRADUATED";
    }

    if (
      pumpCoin?.complete === false
    ) {
      return "BONDING_CURVE";
    }

    return "PUMP_DATA";
  }

  if (source === "dexscreener") {
    if (!metrics) {
      return "NO_MARKET";
    }

    if (
      metrics.liquidityUsd !== null ||
      metrics.volume24hUsd !== null
    ) {
      return missingData.length > 0
        ? "PARTIAL_DATA"
        : "VALID";
    }

    return "NO_MARKET";
  }

  return "INSUFFICIENT_DATA";
}

/* =========================================================
   OPTIONAL TOKEN SUPPLY VIA SOLANA RPC
   ========================================================= */

async function getTokenSupply(mint) {
  const rpcUrl =
    process.env.SOLANA_RPC_URL ||
    DEFAULT_RPC;

  try {
    const result =
      await fetchJson(
        rpcUrl,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            jsonrpc: "2.0",
            id: "profitx-supply",
            method:
              "getTokenSupply",
            params: [
              mint,
              {
                commitment:
                  "confirmed"
              }
            ]
          })
        }
      );

    return {
      amount:
        result?.result?.value
          ?.amount ??
        null,

      decimals:
        numberOrNull(
          result?.result?.value
            ?.decimals
        ),

      uiAmount:
        numberOrNull(
          result?.result?.value
            ?.uiAmount
        )
    };
  } catch {
    return {
      amount: null,
      decimals: null,
      uiAmount: null
    };
  }
}

/* =========================================================
   OPTIONAL HOLDER COUNT
   ========================================================= */

async function getHolderEstimate() {
  /*
   * A reliable holder count requires an indexed
   * token-account service.
   *
   * We deliberately return null rather than
   * inventing a holder number.
   */
  return null;
}

/* =========================================================
   MAIN API HANDLER
   ========================================================= */

export default async function handler(
  req,
  res
) {
  /*
   * IMPORTANT:
   *
   * The current index.js sends GET:
   *
   * /api/analyze?mint=...
   *
   * We therefore accept GET.
   *
   * POST is also accepted for future use.
   */
  if (
    req.method !== "GET" &&
    req.method !== "POST"
  ) {
    res.setHeader(
      "Allow",
      "GET, POST"
    );

    return json(
      res,
      405,
      {
        ok: false,
        error:
          "Méthode non autorisée."
      }
    );
  }

  let mint = "";

  if (req.method === "GET") {
    mint =
      typeof req.query?.mint ===
      "string"
        ? req.query.mint.trim()
        : "";
  }

  if (req.method === "POST") {
    mint =
      typeof req.body?.mint ===
      "string"
        ? req.body.mint.trim()
        : "";
  }

  if (!mint) {
    return json(
      res,
      400,
      {
        ok: false,
        error:
          "Adresse mint Solana manquante."
      }
    );
  }

  if (!isSolanaMint(mint)) {
    return json(
      res,
      400,
      {
        ok: false,
        error:
          "Adresse mint Solana invalide."
      }
    );
  }

  let source = null;

  let metrics = null;

  let pumpCoin = null;

  let solPriceUsd = null;

  let dexPair = null;

  let dexError = null;

  let pumpError = null;

  /*
   * -------------------------------------------------------
   * 1. DEXSCREENER
   * -------------------------------------------------------
   */

  try {
    const dex =
      await getDexScreenerData(
        mint
      );

    if (dex.pair) {
      source = "dexscreener";

      dexPair =
        dex.pair;

      metrics =
        analyseDexPair(
          dex.pair
        );
    }
  } catch (error) {
    dexError =
      error?.message ||
      "Erreur DexScreener.";
  }

  /*
   * -------------------------------------------------------
   * 2. PUMP.FUN
   * -------------------------------------------------------
   *
   * Used when DexScreener does not yet have
   * an indexed market.
   */

  if (!metrics) {
    try {
      const pump =
        await getPumpFunData(
          mint
        );

      pumpCoin =
        pump.coin;

      solPriceUsd =
        pump.solPriceUsd;

      /*
       * Security check:
       * Pump.fun must confirm the exact mint.
       */

      if (
        pumpCoin?.mint &&
        String(
          pumpCoin.mint
        ) === mint
      ) {
        source = "pumpfun";

        metrics =
          analysePumpCoin(
            pumpCoin,
            solPriceUsd
          );
      } else {
        pumpError =
          "Pump.fun n'a pas confirmé ce mint.";
      }
    } catch (error) {
      pumpError =
        error?.message ||
        "Erreur Pump.fun.";
    }
  }

  /*
   * -------------------------------------------------------
   * 3. NO MARKET
   * -------------------------------------------------------
   */

  if (!metrics) {
    return json(
      res,
      200,
      {
        ok: true,

        mint,

        timestamp:
          new Date()
            .toISOString(),

        status:
          "NO_MARKET",

        source: null,

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
          transactions24h: null,
          holders: null
        },

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

        token: null,

        market: {
          pairAddress: null,
          dexId: null
        },

        missingData: [
          "market",
          "liquidity",
          "volume24h",
          "activity",
          "maturity"
        ],

        diagnostics: {
          dexscreenerUsed: false,
          pumpfunUsed: false,

          dexscreenerError:
            dexError,

          pumpfunError:
            pumpError
        }
      }
    );
  }

  /*
   * -------------------------------------------------------
   * 4. TOKEN SUPPLY
   * -------------------------------------------------------
   */

  const supply =
    await getTokenSupply(
      mint
    );

  /*
   * -------------------------------------------------------
   * 5. HOLDERS
   * -------------------------------------------------------
   */

  const holderCount =
    await getHolderEstimate(
      mint
    );

  /*
   * -------------------------------------------------------
   * 6. MISSING DATA
   * -------------------------------------------------------
   */

  const missingData = [];

  if (
    metrics.liquidityUsd ===
      null ||
    metrics.liquidityUsd ===
      undefined
  ) {
    missingData.push(
      "liquidity"
    );
  }

  if (
    metrics.volume24hUsd ===
      null ||
    metrics.volume24hUsd ===
      undefined
  ) {
    missingData.push(
      "volume24h"
    );
  }

  if (
    metrics.activity ===
      null ||
    metrics.activity ===
      undefined
  ) {
    missingData.push(
      "activity"
    );
  }

  if (
    metrics.maturity ===
      null ||
    metrics.maturity ===
      undefined
  ) {
    missingData.push(
      "maturity"
    );
  }

  if (
    holderCount ===
      null ||
    holderCount ===
      undefined
  ) {
    missingData.push(
      "holders"
    );
  }

  /*
   * -------------------------------------------------------
   * 7. SCORE
   * -------------------------------------------------------
   */

  const score =
    calculateScore(
      metrics,
      source
    );

  if (
    score.total === null
  ) {
    missingData.push(
      "score"
    );
  }

  /*
   * -------------------------------------------------------
   * 8. STATUS
   * -------------------------------------------------------
   */

  const status =
    buildStatus(
      source,
      metrics,
      missingData,
      pumpCoin
    );

  /*
   * -------------------------------------------------------
   * 9. FINAL RESPONSE
   * -------------------------------------------------------
   */

  return json(
    res,
    200,
    {
      ok: true,

      mint,

      timestamp:
        new Date()
          .toISOString(),

      status,

      source,

      token: {
        name:
          metrics.name ??
          pumpCoin?.name ??
          null,

        symbol:
          metrics.symbol ??
          pumpCoin?.symbol ??
          null,

        imageUri:
          metrics.imageUri ??
          pumpCoin?.image_uri ??
          null,

        description:
          metrics.description ??
          pumpCoin?.description ??
          null,

        creator:
          metrics.creator ??
          pumpCoin?.creator ??
          null,

        website:
          metrics.website ??
          pumpCoin?.website ??
          null,

        twitter:
          metrics.twitter ??
          pumpCoin?.twitter ??
          null,

        telegram:
          metrics.telegram ??
          pumpCoin?.telegram ??
          null
      },

      /*
       * Compatible avec l'ancienne interface.
       */

      metrics: {
        liquidity:
          metrics.liquidityUsd,

        distribution:
          holderCount !== null
            ? null
            : null,

        activity:
          metrics.activity,

        volume:
          metrics.volume24hUsd,

        maturity:
          metrics.maturity
      },

      observed: {
        liquidityUsd:
          metrics.liquidityUsd,

        volume24hUsd:
          metrics.volume24hUsd,

        transactions24h:
          metrics.transactions24h,

        holders:
          holderCount
      },

      data: {
        supply:
          supply.uiAmount ??
          null,

        supplyRaw:
          supply.amount ??
          null,

        decimals:
          supply.decimals ??
          null,

        holders:
          holderCount,

        liquidityUsd:
          metrics.liquidityUsd,

        volume24hUsd:
          metrics.volume24hUsd,

        activity:
          metrics.activity,

        transactions24h:
          metrics.transactions24h,

        buys24h:
          metrics.buys24h ??
          null,

        sells24h:
          metrics.sells24h ??
          null,

        priceUsd:
          metrics.priceUsd ??
          null,

        marketCapUsd:
          metrics.marketCapUsd ??
          null,

        ageHours:
          metrics.ageHours ??
          null,

        pairCreatedAt:
          metrics.pairCreatedAt ??
          null,

        maturity:
          metrics.maturity ??
          null,

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
          metrics.virtualSolReserves ??
          null,

        virtualTokenReserves:
          metrics.virtualTokenReserves ??
          null,

        solPriceUsd:
          solPriceUsd ??
          null
      },

      market: {
        pairAddress:
          metrics.pairAddress ??
          null,

        dexId:
          metrics.dexId ??
          null,

        url:
          metrics.url ??
          null
      },

      pair: dexPair
        ? {
            address:
              dexPair.pairAddress ??
              null,

            dexId:
              dexPair.dexId ??
              null,

            url:
              dexPair.url ??
              null,

            priceUsd:
              dexPair.priceUsd ??
              null,

            liquidityUsd:
              dexPair.liquidity?.usd ??
              null,

            volume24hUsd:
              dexPair.volume?.h24 ??
              null,

            marketCapUsd:
              dexPair.marketCap ??
              dexPair.fdv ??
              null
          }
        : null,

      pump: pumpCoin
        ? {
            complete:
              pumpCoin.complete ??
              null,

            bondingCurve:
              pumpCoin.bonding_curve ??
              null,

            pumpSwapPool:
              pumpCoin.pump_swap_pool ??
              null,

            raydiumPool:
              pumpCoin.raydium_pool ??
              null,

            virtualSolReserves:
              metrics.virtualSolReserves ??
              null,

            virtualTokenReserves:
              metrics.virtualTokenReserves ??
              null
          }
        : null,

      score,

      missingData,

      diagnostics: {
        requestMethod:
          req.method,

        dexscreenerUsed:
          source ===
          "dexscreener",

        pumpfunUsed:
          source ===
          "pumpfun",

        dexscreenerError:
          dexError,

        pumpfunError:
          pumpError
      }
    }
  );
}
