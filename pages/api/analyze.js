const DEXSCREENER_BASE =
  "https://api.dexscreener.com/latest/dex/tokens";

const PUMP_COIN_URL =
  "https://frontend-api-v3.pump.fun/coins-v2";

const PUMP_SOL_PRICE_URL =
  "https://frontend-api-v3.pump.fun/sol-price";

const PUMP_TRADES_URL =
  "https://frontend-api-v3.pump.fun/trades/all";

const PUMP_HOLDERS_URL =
  "https://advanced-api-v2.pump.fun/coins/top-holders-and-sol-balance";

const DEFAULT_RPC =
  "https://api.mainnet-beta.solana.com";

const REQUEST_TIMEOUT_MS = 10000;
const TRADE_LIMIT = 200;

/* =========================================================
   HELPERS
========================================================= */

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
  res.setHeader(
    "Content-Type",
    "application/json; charset=utf-8"
  );

  return res.status(status).json(body);
}

function isSolanaMint(value) {
  return (
    typeof value === "string" &&
    /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)
  );
}

function timestampToMs(value) {
  const n = numberOrNull(value);

  if (n === null) {
    return null;
  }

  return n > 100000000000 ? n : n * 1000;
}

function firstNumber(...values) {
  for (const value of values) {
    const n = numberOrNull(value);

    if (n !== null) {
      return n;
    }
  }

  return null;
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

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
        data?.error?.message ||
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

  if (!pairs.length) {
    return {
      pair: null,
      pairs: []
    };
  }

  const solanaPairs = pairs.filter(
    pair => pair?.chainId === "solana"
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

function analyseDexPair(pair) {
  if (!pair) {
    return null;
  }

  const liquidityUsd =
    numberOrNull(pair?.liquidity?.usd);

  const volume24hUsd =
    numberOrNull(pair?.volume?.h24);

  const buys24h =
    numberOrNull(pair?.txns?.h24?.buys);

  const sells24h =
    numberOrNull(pair?.txns?.h24?.sells);

  const transactions24h =
    buys24h !== null && sells24h !== null
      ? buys24h + sells24h
      : null;

  const priceUsd =
    numberOrNull(pair?.priceUsd);

  const marketCapUsd =
    firstNumber(
      pair?.marketCap,
      pair?.fdv
    );

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
    buys24h,
    sells24h,
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
      pair?.quoteToken ?? null,

    name:
      pair?.baseToken?.name ?? null,

    symbol:
      pair?.baseToken?.symbol ?? null
  };
}

/* =========================================================
   PUMP.FUN COIN
========================================================= */

async function getPumpFunData(mint) {
  const coinUrl =
    `${PUMP_COIN_URL}/${encodeURIComponent(mint)}`;

  const coinResponse = await fetchJson(
    coinUrl,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        Origin: "https://pump.fun"
      }
    }
  );

  const coin =
    coinResponse?.data ||
    coinResponse;

  if (!coin || typeof coin !== "object") {
    throw new Error(
      "Pump.fun n'a pas retourné les données du token."
    );
  }

  let solPriceUsd = null;

  try {
    const priceResponse =
      await fetchJson(
        PUMP_SOL_PRICE_URL,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            Origin: "https://pump.fun"
          }
        }
      );

    const price =
      priceResponse?.data ||
      priceResponse;

    solPriceUsd =
      firstNumber(
        price?.solPrice,
        price?.sol_price,
        price?.usd,
        price?.price
      );
  } catch {
    solPriceUsd = null;
  }

  return {
    coin,
    solPriceUsd
  };
}

/* =========================================================
   PUMP.FUN TRADES 24H
========================================================= */

async function getPumpTrades24h(
  mint,
  solPriceUsd
) {
  const url =
    `${PUMP_TRADES_URL}/${encodeURIComponent(mint)}` +
    `?limit=${TRADE_LIMIT}&offset=0&minimumSize=0`;

  try {
    const response =
      await fetchJson(
        url,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            Origin: "https://pump.fun",
            "User-Agent":
              "Mozilla/5.0 ProfitX-AI-Analyzer"
          }
        }
      );

    let trades = [];

    if (Array.isArray(response)) {
      trades = response;
    } else if (Array.isArray(response?.data)) {
      trades = response.data;
    } else if (Array.isArray(response?.trades)) {
      trades = response.trades;
    } else if (
      Array.isArray(response?.data?.trades)
    ) {
      trades = response.data.trades;
    }

    if (!trades.length) {
      return {
        volume24hUsd: null,
        transactions24h: null,
        buys24h: null,
        sells24h: null,
        tradeCountFetched: 0,
        tradeCoverage: "NO_TRADES"
      };
    }

    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;

    let volumeSol = 0;
    let transactions = 0;
    let buys = 0;
    let sells = 0;

    let oldestTimestamp = null;

    for (const trade of trades) {
      const timestampMs =
        timestampToMs(
          trade?.timestamp ??
          trade?.created_timestamp ??
          trade?.createdAt
        );

      if (timestampMs === null) {
        continue;
      }

      if (
        oldestTimestamp === null ||
        timestampMs < oldestTimestamp
      ) {
        oldestTimestamp = timestampMs;
      }

      if (timestampMs < dayAgo) {
        continue;
      }

      const rawSol =
        firstNumber(
          trade?.sol_amount,
          trade?.solAmount,
          trade?.amountSol
        );

      if (rawSol === null) {
        continue;
      }

      const solAmount =
        rawSol > 1000000
          ? rawSol / 1e9
          : rawSol;

      volumeSol += Math.abs(solAmount);

      transactions += 1;

      const isBuy =
        trade?.is_buy === true ||
        trade?.isBuy === true ||
        trade?.txType === "buy";

      if (isBuy) {
        buys += 1;
      } else {
        sells += 1;
      }
    }

    const volume24hUsd =
      solPriceUsd !== null
        ? volumeSol * solPriceUsd
        : null;

    let tradeCoverage = "FULL_24H_OR_LESS";

    if (
      oldestTimestamp !== null &&
      oldestTimestamp > dayAgo
    ) {
      tradeCoverage =
        trades.length >= TRADE_LIMIT
          ? "PARTIAL_LAST_200_TRADES"
          : "FULL_24H_OR_LESS";
    }

    return {
      volume24hUsd,
      transactions24h:
        transactions > 0
          ? transactions
          : null,

      buys24h:
        buys > 0
          ? buys
          : transactions > 0
            ? 0
            : null,

      sells24h:
        sells > 0
          ? sells
          : transactions > 0
            ? 0
            : null,

      tradeCountFetched:
        trades.length,

      tradeCoverage
    };
  } catch {
    return {
      volume24hUsd: null,
      transactions24h: null,
      buys24h: null,
      sells24h: null,
      tradeCountFetched: 0,
      tradeCoverage: "UNAVAILABLE"
    };
  }
}

/* =========================================================
   PUMP.FUN ANALYSIS
========================================================= */

function analysePumpCoin(
  coin,
  solPriceUsd,
  supplyData
) {
  if (!coin) {
    return null;
  }

  const marketCapSol =
    numberOrNull(
      coin?.market_cap
    );

  let marketCapUsd =
    firstNumber(
      coin?.usd_market_cap,
      coin?.usdMarketCap
    );

  if (
    marketCapUsd === null &&
    marketCapSol !== null &&
    solPriceUsd !== null
  ) {
    marketCapUsd =
      marketCapSol * solPriceUsd;
  }

  /* -------------------------------------------------------
     RESERVES
  ------------------------------------------------------- */

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

  /* -------------------------------------------------------
     AGE
  ------------------------------------------------------- */

  const createdTimestamp =
    numberOrNull(
      coin?.created_timestamp
    );

  const createdAtMs =
    timestampToMs(
      createdTimestamp
    );

  let ageHours = null;

  if (createdAtMs !== null) {
    ageHours = Math.max(
      0,
      (Date.now() - createdAtMs) / 3600000
    );
  }

  /* -------------------------------------------------------
     LAST TRADE
  ------------------------------------------------------- */

  const lastTradeTimestamp =
    numberOrNull(
      coin?.last_trade_timestamp
    );

  const lastTradeMs =
    timestampToMs(
      lastTradeTimestamp
    );

  let lastTradeAgeHours = null;

  if (lastTradeMs !== null) {
    lastTradeAgeHours = Math.max(
      0,
      (Date.now() - lastTradeMs) / 3600000
    );
  }

  /* -------------------------------------------------------
     MATURITY
  ------------------------------------------------------- */

  let maturity = null;

  if (ageHours !== null) {
    maturity = clamp(
      (
        Math.log10(ageHours + 1) /
        Math.log10(24 * 30 + 1)
      ) * 100
    );
  }

  /* -------------------------------------------------------
     ACTIVITY
  ------------------------------------------------------- */

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

  /* -------------------------------------------------------
     PRICE
  ------------------------------------------------------- */

  let priceUsd =
    firstNumber(
      coin?.price_usd,
      coin?.priceUsd
    );

  if (
    priceUsd === null &&
    marketCapUsd !== null
  ) {
    const supply =
      firstNumber(
        supplyData?.uiAmount,
        coin?.total_supply
      );

    if (
      supply !== null &&
      supply > 0
    ) {
      priceUsd =
        marketCapUsd / supply;
    }
  }

  return {
    liquidityUsd,

    volume24hUsd: null,
    transactions24h: null,
    buys24h: null,
    sells24h: null,

    priceUsd,
    marketCapUsd,

    pairCreatedAt:
      createdAtMs,

    ageHours,

    activity,
    maturity,

    pumpComplete:
      coin?.complete === true,

    bondingCurve:
      coin?.bonding_curve ??
      null,

    associatedBondingCurve:
      coin?.associated_bonding_curve ??
      null,

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
   HOLDERS
========================================================= */

async function getPumpHolders(mint) {
  const url =
    `${PUMP_HOLDERS_URL}/${encodeURIComponent(mint)}`;

  try {
    const response =
      await fetchJson(
        url,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            Origin: "https://pump.fun",
            "User-Agent":
              "Mozilla/5.0 ProfitX-AI-Analyzer"
          }
        }
      );

    /*
     * On ne considère comme nombre fiable que les
     * champs qui représentent explicitement un total.
     *
     * On ne transforme PAS la longueur d'une liste
     * de top holders en nombre total de holders.
     */

    const directTotal =
      firstNumber(
        response?.totalHolders,
        response?.total_holders,
        response?.holderCount,
        response?.holder_count,
        response?.total,
        response?.pagination?.total,
        response?.data?.totalHolders,
        response?.data?.total_holders,
        response?.data?.holderCount,
        response?.data?.holder_count,
        response?.data?.total,
        response?.data?.pagination?.total
      );

    if (directTotal !== null) {
      return {
        holders: directTotal,
        source: "pumpfun",
        raw: response
      };
    }

    /*
     * Certains retours Pump.fun peuvent fournir une
     * structure contenant explicitement un compteur.
     */

    const candidates = [
      response?.holders,
      response?.data?.holders,
      response?.result?.holders
    ];

    for (const candidate of candidates) {
      if (!Array.isArray(candidate)) {
        continue;
      }

      const nestedTotal =
        firstNumber(
          candidate?.total,
          candidate?.pagination?.total
        );

      if (nestedTotal !== null) {
        return {
          holders: nestedTotal,
          source: "pumpfun",
          raw: response
        };
      }
    }

    return {
      holders: null,
      source: "pumpfun-top-holders-only",
      raw: response
    };
  } catch {
    return {
      holders: null,
      source: "unavailable",
      raw: null
    };
  }
}

/* =========================================================
   TOKEN SUPPLY
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
        result?.result?.value?.amount ??
        null,

      decimals:
        numberOrNull(
          result?.result?.value?.decimals
        ),

      uiAmount:
        numberOrNull(
          result?.result?.value?.uiAmount
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
   SCORE
========================================================= */

function calculateScore(metrics) {
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
   * Distribution ne doit jamais être inventée.
   * On la calculera dans une prochaine version
   * dès qu'une source de holder count fiable est
   * disponible de façon stable.
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

  if (availableWeight >= 40) {
    total =
      Math.round(
        weightedTotal /
        availableWeight
      );
  }

  return {
    total,
    components,
    weights,
    availableWeight
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
   MAIN HANDLER
========================================================= */

export default async function handler(
  req,
  res
) {
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
      typeof req.query?.mint === "string"
        ? req.query.mint.trim()
        : "";
  }

  if (req.method === "POST") {
    mint =
      typeof req.body?.mint === "string"
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

  let dexPair = null;
  let dexMetrics = null;

  let pumpCoin = null;
  let pumpMetrics = null;

  let solPriceUsd = null;

  let dexError = null;
  let pumpError = null;

  /* =======================================================
     1. DEXSCREENER
  ======================================================= */

  try {
    const dex =
      await getDexScreenerData(
        mint
      );

    dexPair =
      dex.pair;

    if (dexPair) {
      dexMetrics =
        analyseDexPair(
          dexPair
        );
    }
  } catch (error) {
    dexError =
      error?.message ||
      "Erreur DexScreener.";
  }

  /* =======================================================
     2. SUPPLY
  ======================================================= */

  const supply =
    await getTokenSupply(
      mint
    );

  /* =======================================================
     3. PUMP.FUN
  ======================================================= */

  try {
    const pump =
      await getPumpFunData(
        mint
      );

    pumpCoin =
      pump.coin;

    solPriceUsd =
      pump.solPriceUsd;

    const pumpMint =
      pumpCoin?.mint ??
      pumpCoin?.address ??
      null;

    if (
      pumpMint &&
      String(pumpMint) === mint
    ) {
      pumpMetrics =
        analysePumpCoin(
          pumpCoin,
          solPriceUsd,
          supply
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

  /* =======================================================
     4. CHOIX DE LA SOURCE PRINCIPALE
  ======================================================= */

  let source = null;
  let metrics = null;

  if (dexMetrics) {
    source = "dexscreener";
    metrics = dexMetrics;
  } else if (pumpMetrics) {
    source = "pumpfun";
    metrics = pumpMetrics;
  }

  if (!metrics) {
    return json(
      res,
      200,
      {
        ok: true,

        mint,

        timestamp:
          new Date().toISOString(),

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
          buys24h: null,
          sells24h: null,
          holders: null,
          priceUsd: null,
          marketCapUsd: null,
          ageHours: null,
          maturity: null,
          pumpComplete:
            pumpCoin?.complete ??
            null,
          pumpSwapPool:
            pumpCoin?.pump_swap_pool ??
            null,
          raydiumPool:
            pumpCoin?.raydium_pool ??
            null,
          virtualSolReserves: null,
          virtualTokenReserves: null,
          solPriceUsd
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

          holders: null,

          liquidityUsd: null,
          volume24hUsd: null,
          transactions24h: null,
          buys24h: null,
          sells24h: null,
          priceUsd: null,
          marketCapUsd: null,
          ageHours: null,
          maturity: null,

          pumpComplete:
            pumpCoin?.complete ??
            null,

          pumpSwapPool:
            pumpCoin?.pump_swap_pool ??
            null,

          raydiumPool:
            pumpCoin?.raydium_pool ??
            null,

          virtualSolReserves: null,
          virtualTokenReserves: null,
          solPriceUsd
        },

        token: pumpCoin
          ? {
              name:
                pumpCoin?.name ??
                null,

              symbol:
                pumpCoin?.symbol ??
                null,

              creator:
                pumpCoin?.creator ??
                null
            }
          : null,

        market: {
          pairAddress: null,
          dexId: null,
          url: null
        },

        pair: null,

        pump: pumpCoin
          ? {
              complete:
                pumpCoin?.complete ??
                null,

              bondingCurve:
                pumpCoin?.bonding_curve ??
                null,

              pumpSwapPool:
                pumpCoin?.pump_swap_pool ??
                null,

              raydiumPool:
                pumpCoin?.raydium_pool ??
                null
            }
          : null,

        missingData: [
          "market",
          "liquidity",
          "volume24h",
          "activity",
          "maturity",
          "holders"
        ],

        diagnostics: {
          requestMethod:
            req.method,

          dexscreenerUsed: false,

          pumpfunUsed:
            Boolean(pumpCoin),

          dexscreenerError:
            dexError,

          pumpfunError:
            pumpError
        }
      }
    );
  }

  /* =======================================================
     5. PUMP TRADES
  ======================================================= */

  let pumpTrades = {
    volume24hUsd: null,
    transactions24h: null,
    buys24h: null,
    sells24h: null,
    tradeCountFetched: 0,
    tradeCoverage: "UNAVAILABLE"
  };

  if (pumpMetrics) {
    pumpTrades =
      await getPumpTrades24h(
        mint,
        solPriceUsd
      );
  }

  /*
   * Si DexScreener possède déjà les données 24h,
   * elles restent prioritaires pour les tokens gradués.
   *
   * Pour Pump.fun bonding curve, le flux Pump.fun
   * est prioritaire.
   */

  if (
    source === "pumpfun"
  ) {
    metrics.volume24hUsd =
      pumpTrades.volume24hUsd;

    metrics.transactions24h =
      pumpTrades.transactions24h;

    metrics.buys24h =
      pumpTrades.buys24h;

    metrics.sells24h =
      pumpTrades.sells24h;
  }

  /* =======================================================
     6. HOLDERS
  ======================================================= */

  const holderResult =
    await getPumpHolders(
      mint
    );

  const holderCount =
    holderResult.holders;

  /* =======================================================
     7. MISSING DATA
  ======================================================= */

  const missingData = [];

  if (
    metrics.liquidityUsd === null ||
    metrics.liquidityUsd === undefined
  ) {
    missingData.push(
      "liquidity"
    );
  }

  if (
    metrics.volume24hUsd === null ||
    metrics.volume24hUsd === undefined
  ) {
    missingData.push(
      "volume24h"
    );
  }

  if (
    metrics.transactions24h === null ||
    metrics.transactions24h === undefined
  ) {
    missingData.push(
      "transactions24h"
    );
  }

  if (
    metrics.activity === null ||
    metrics.activity === undefined
  ) {
    missingData.push(
      "activity"
    );
  }

  if (
    metrics.maturity === null ||
    metrics.maturity === undefined
  ) {
    missingData.push(
      "maturity"
    );
  }

  if (
    holderCount === null ||
    holderCount === undefined
  ) {
    missingData.push(
      "holders"
    );
  }

  /* =======================================================
     8. SCORE
  ======================================================= */

  const score =
    calculateScore(
      metrics
    );

  /* =======================================================
     9. STATUS
  ======================================================= */

  const status =
    buildStatus(
      source,
      metrics,
      missingData,
      pumpCoin
    );

  /* =======================================================
     10. FINAL RESPONSE
  ======================================================= */

  return json(
    res,
    200,
    {
      ok: true,

      mint,

      timestamp:
        new Date().toISOString(),

      status,

      source,

      /* ---------------------------------------------------
         TOKEN
      --------------------------------------------------- */

      token: {
        name:
          metrics?.name ??
          pumpCoin?.name ??
          null,

        symbol:
          metrics?.symbol ??
          pumpCoin?.symbol ??
          null,

        imageUri:
          metrics?.imageUri ??
          pumpCoin?.image_uri ??
          null,

        description:
          metrics?.description ??
          pumpCoin?.description ??
          null,

        creator:
          metrics?.creator ??
          pumpCoin?.creator ??
          null,

        website:
          metrics?.website ??
          pumpCoin?.website ??
          null,

        twitter:
          metrics?.twitter ??
          pumpCoin?.twitter ??
          null,

        telegram:
          metrics?.telegram ??
          pumpCoin?.telegram ??
          null
      },

      /* ---------------------------------------------------
         COMPATIBILITÉ INDEX.JS
      --------------------------------------------------- */

      metrics: {
        liquidity:
          metrics.liquidityUsd !== null
            ? clamp(
                Math.log10(
                  Math.max(
                    metrics.liquidityUsd,
                    1
                  )
                ) * 20
              )
            : null,

        distribution:
          null,

        activity:
          metrics.activity,

        volume:
          metrics.volume24hUsd !== null
            ? clamp(
                Math.log10(
                  Math.max(
                    metrics.volume24hUsd,
                    1
                  )
                ) * 20
              )
            : null,

        maturity:
          metrics.maturity
      },

      /* ---------------------------------------------------
         OBSERVED
      --------------------------------------------------- */

      observed: {
        liquidityUsd:
          metrics.liquidityUsd,

        volume24hUsd:
          metrics.volume24hUsd,

        transactions24h:
          metrics.transactions24h,

        buys24h:
          metrics.buys24h ??
          null,

        sells24h:
          metrics.sells24h ??
          null,

        holders:
          holderCount,

        priceUsd:
          metrics.priceUsd ??
          null,

        marketCapUsd:
          metrics.marketCapUsd ??
          null,

        ageHours:
          metrics.ageHours ??
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

      /* ---------------------------------------------------
         DATA
      --------------------------------------------------- */

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

      /* ---------------------------------------------------
         MARKET
      --------------------------------------------------- */

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

      /* ---------------------------------------------------
         PAIR
      --------------------------------------------------- */

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

      /* ---------------------------------------------------
         PUMP
      --------------------------------------------------- */

      pump: pumpCoin
        ? {
            complete:
              pumpCoin.complete ??
              null,

            bondingCurve:
              pumpCoin.bonding_curve ??
              null,

            associatedBondingCurve:
              pumpCoin.associated_bonding_curve ??
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

      /* ---------------------------------------------------
         SCORE
      --------------------------------------------------- */

      score,

      /* ---------------------------------------------------
         MISSING DATA
      --------------------------------------------------- */

      missingData,

      /* ---------------------------------------------------
         DIAGNOSTICS
      --------------------------------------------------- */

      diagnostics: {
        requestMethod:
          req.method,

        dexscreenerUsed:
          Boolean(dexPair),

        pumpfunUsed:
          Boolean(pumpCoin),

        pumpTradesUsed:
          Boolean(
            pumpTrades?.tradeCountFetched > 0
          ),

        pumpTradeCountFetched:
          pumpTrades?.tradeCountFetched ??
          0,

        pumpTradeCoverage:
          pumpTrades?.tradeCoverage ??
          "UNAVAILABLE",

        holdersSource:
          holderResult?.source ??
          "unavailable",

        dexscreenerError:
          dexError,

        pumpfunError:
          pumpError
      },

      /* ---------------------------------------------------
         NOTE
      --------------------------------------------------- */

      note:
        source === "pumpfun"
          ? (
              pumpTrades.tradeCoverage ===
                "PARTIAL_LAST_200_TRADES"
                ? "Volume et transactions calculés sur les 200 derniers trades disponibles. Le flux retourné ne permet pas de garantir une couverture complète des dernières 24h."
                : "Volume et transactions 24h calculés à partir du flux de trades Pump.fun disponible."
            )
          : source === "dexscreener"
            ? "Données de marché issues de DexScreener."
            : "Données partielles."
    }
  );
}
