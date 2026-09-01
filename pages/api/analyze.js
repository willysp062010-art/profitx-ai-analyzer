const DEXSCREENER_BASE =
  "https://api.dexscreener.com/latest/dex/tokens";

const PUMP_COIN_URL =
  "https://frontend-api-v3.pump.fun/coins-v2";

const PUMP_SOL_PRICE_URL =
  "https://frontend-api-v3.pump.fun/sol-price";

const DEFAULT_RPC =
  "https://api.mainnet-beta.solana.com";

const REQUEST_TIMEOUT_MS = 12000;

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

function firstNumber(...values) {
  for (const value of values) {
    const n = numberOrNull(value);

    if (n !== null) {
      return n;
    }
  }

  return null;
}

function json(res, status, body) {
  res.setHeader(
    "Cache-Control",
    "no-store"
  );

  res.setHeader(
    "Content-Type",
    "application/json; charset=utf-8"
  );

  return res.status(status).json(body);
}

function isSolanaMint(value) {
  return (
    typeof value === "string" &&
    /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(
      value
    )
  );
}

function timestampToMs(value) {
  const n = numberOrNull(value);

  if (n === null) {
    return null;
  }

  return n > 100000000000
    ? n
    : n * 1000;
}

/* =========================================================
   HTTP
========================================================= */

async function fetchJson(
  url,
  options = {}
) {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS
    );

  try {
    const response =
      await fetch(
        url,
        {
          ...options,

          signal:
            controller.signal,

          headers: {
            Accept:
              "application/json",

            ...(options.headers || {})
          }
        }
      );

    const text =
      await response.text();

    let data = null;

    if (text) {
      try {
        data =
          JSON.parse(text);
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
   INTERNAL PROFITX MODULES
========================================================= */

function getBaseUrl(req) {
  const forwardedHost =
    req.headers?.["x-forwarded-host"];

  const host =
    forwardedHost ||
    req.headers?.host ||
    process.env.VERCEL_URL;

  const forwardedProto =
    req.headers?.["x-forwarded-proto"];

  const protocol =
    forwardedProto ||
    (
      process.env.VERCEL_URL
        ? "https"
        : "http"
    );

  if (!host) {
    return null;
  }

  return `${protocol}://${host}`;
}

async function callModule(
  req,
  moduleName,
  mint
) {
  const baseUrl =
    getBaseUrl(req);

  if (!baseUrl) {
    return {
      ok: false,
      error:
        "Impossible de déterminer l'URL interne de ProfitX."
    };
  }

  const url =
    `${baseUrl}/api/${moduleName}?mint=${encodeURIComponent(
      mint
    )}`;

  try {
    const result =
      await fetchJson(
        url,
        {
          method: "GET"
        }
      );

    return result || {
      ok: false,
      error:
        `Réponse vide du module ${moduleName}.`
    };
  } catch (error) {
    return {
      ok: false,

      error:
        error?.message ||
        `Erreur du module ${moduleName}.`
    };
  }
}

/* =========================================================
   DEXSCREENER
========================================================= */

async function getDexScreenerData(
  mint
) {
  const url =
    `${DEXSCREENER_BASE}/solana/${encodeURIComponent(
      mint
    )}`;

  const data =
    await fetchJson(url);

  const pairs =
    Array.isArray(data?.pairs)
      ? data.pairs
      : [];

  if (!pairs.length) {
    return {
      pair: null,
      pairs: []
    };
  }

  const solanaPairs =
    pairs.filter(
      (pair) =>
        pair?.chainId ===
        "solana"
    );

  const candidates =
    solanaPairs.length
      ? solanaPairs
      : pairs;

  const sorted =
    [...candidates].sort(
      (a, b) => {
        const liquidityA =
          numberOrNull(
            a?.liquidity?.usd
          ) ?? 0;

        const liquidityB =
          numberOrNull(
            b?.liquidity?.usd
          ) ?? 0;

        return (
          liquidityB -
          liquidityA
        );
      }
    );

  return {
    pair:
      sorted[0] || null,

    pairs:
      sorted
  };
}

function analyseDexPair(
  pair
) {
  if (!pair) {
    return null;
  }

  const liquidityUsd =
    numberOrNull(
      pair?.liquidity?.usd
    );

  const volume24hUsd =
    numberOrNull(
      pair?.volume?.h24
    );

  const buys24h =
    numberOrNull(
      pair?.txns?.h24?.buys
    );

  const sells24h =
    numberOrNull(
      pair?.txns?.h24?.sells
    );

  const transactions24h =
    buys24h !== null &&
    sells24h !== null
      ? buys24h + sells24h
      : null;

  const priceUsd =
    numberOrNull(
      pair?.priceUsd
    );

  const marketCapUsd =
    firstNumber(
      pair?.marketCap,
      pair?.fdv
    );

  const pairCreatedAt =
    numberOrNull(
      pair?.pairCreatedAt
    );

  let ageHours = null;

  if (
    pairCreatedAt !== null
  ) {
    ageHours =
      Math.max(
        0,
        (
          Date.now() -
          pairCreatedAt
        ) / 3600000
      );
  }

  let maturity = null;

  if (
    ageHours !== null
  ) {
    maturity =
      clamp(
        (
          Math.log10(
            ageHours + 1
          ) /
          Math.log10(
            24 * 30 + 1
          )
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

    maturity,

    pairAddress:
      pair?.pairAddress ??
      null,

    dexId:
      pair?.dexId ??
      null,

    url:
      pair?.url ??
      null,

    name:
      pair?.baseToken?.name ??
      null,

    symbol:
      pair?.baseToken?.symbol ??
      null
  };
}

/* =========================================================
   PUMP.FUN
========================================================= */

async function getPumpFunData(
  mint
) {
  const coinUrl =
    `${PUMP_COIN_URL}/${encodeURIComponent(
      mint
    )}`;

  const coinResponse =
    await fetchJson(
      coinUrl,
      {
        method: "GET",

        headers: {
          Accept:
            "application/json",

          Origin:
            "https://pump.fun"
        }
      }
    );

  const coin =
    coinResponse?.data ||
    coinResponse;

  if (
    !coin ||
    typeof coin !== "object"
  ) {
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
            Accept:
              "application/json",

            Origin:
              "https://pump.fun"
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
    solPriceUsd =
      null;
  }

  return {
    coin,
    solPriceUsd
  };
}

/* =========================================================
   TOKEN SUPPLY
========================================================= */

async function getTokenSupply(
  mint
) {
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

          body:
            JSON.stringify({
              jsonrpc: "2.0",

              id:
                "profitx-supply",

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
   PUMP ANALYSIS
========================================================= */

function analysePumpCoin(
  coin,
  solPriceUsd,
  supply
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
      marketCapSol *
      solPriceUsd;
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
      virtualSol *
      solPriceUsd;
  }

  const createdAtMs =
    timestampToMs(
      coin?.created_timestamp
    );

  let ageHours = null;

  if (
    createdAtMs !== null
  ) {
    ageHours =
      Math.max(
        0,
        (
          Date.now() -
          createdAtMs
        ) / 3600000
      );
  }

  const lastTradeMs =
    timestampToMs(
      coin?.last_trade_timestamp
    );

  let lastTradeAgeHours =
    null;

  if (
    lastTradeMs !== null
  ) {
    lastTradeAgeHours =
      Math.max(
        0,
        (
          Date.now() -
          lastTradeMs
        ) / 3600000
      );
  }

  let maturity = null;

  if (
    ageHours !== null
  ) {
    maturity =
      clamp(
        (
          Math.log10(
            ageHours + 1
          ) /
          Math.log10(
            24 * 30 + 1
          )
        ) * 100
      );
  }

  /*
   * IMPORTANT :
   *
   * L'activité ne vient plus de last_trade_timestamp.
   * Elle vient maintenant d'Activity V3.
   *
   * On laisse donc activity à null ici.
   */

  let priceUsd =
    firstNumber(
      coin?.price_usd,
      coin?.priceUsd
    );

  if (
    priceUsd === null &&
    marketCapUsd !== null
  ) {
    const supplyUi =
      firstNumber(
        supply?.uiAmount
      );

    if (
      supplyUi !== null &&
      supplyUi > 0
    ) {
      priceUsd =
        marketCapUsd /
        supplyUi;
    }
  }

  return {
    liquidityUsd,

    volume24hUsd:
      null,

    transactions24h:
      null,

    buys24h:
      null,

    sells24h:
      null,

    priceUsd,

    marketCapUsd,

    pairCreatedAt:
      createdAtMs,

    ageHours,

    activity:
      null,

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
   ACTIVITY NORMALIZATION
========================================================= */

function normalizeActivity(
  result
) {
  if (
    !result ||
    result.ok !== true
  ) {
    return {
      available:
        false,

      volume24hUsd:
        null,

      transactions24h:
        null,

      buys24h:
        null,

      sells24h:
        null,

      uniqueBuyers24h:
        null,

      uniqueSellers24h:
        null,

      historicalTransactions:
        null,

      historicalBuys:
        null,

      historicalSells:
        null,

      uniqueHistoricalBuyers:
        null,

      uniqueHistoricalSellers:
        null,

      status:
        "UNAVAILABLE"
    };
  }

  const last24h =
    result?.volume?.last24h;

  const observed =
    result?.volume?.observed;

  const participants =
    result?.participants;

  const activity =
    result?.activity;

  return {
    available:
      true,

    volume24hUsd:
      numberOrNull(
        last24h?.volumeUsd
      ),

    transactions24h:
      numberOrNull(
        last24h?.transactions
      ),

    buys24h:
      numberOrNull(
        last24h?.buys
      ),

    sells24h:
      numberOrNull(
        last24h?.sells
      ),

    uniqueBuyers24h:
      null,

    uniqueSellers24h:
      null,

    historicalTransactions:
      numberOrNull(
        observed?.transactions
      ),

    historicalBuys:
      numberOrNull(
        observed?.buys
      ),

    historicalSells:
      numberOrNull(
        observed?.sells
      ),

    uniqueHistoricalBuyers:
      numberOrNull(
        participants
          ?.uniqueExternalBuyers
      ),

    uniqueHistoricalSellers:
      numberOrNull(
        participants
          ?.uniqueExternalSellers
      ),

    status:
      result?.analysis
        ?.activityStatus ??
      "UNKNOWN",

    volume24hStatus:
      last24h
        ?.volumeUsdStatus ??
      "N/D",

    volume7d:
      result?.volume?.last7d ??
      null,

    observed:
      observed ??
      null,

    raw:
      result
  };
}

/* =========================================================
   DISTRIBUTION SCORE
========================================================= */

function calculateDistributionScore(
  holders
) {
  const top1 =
    numberOrNull(
      holders
        ?.distribution
        ?.externalTop1Percent
    );

  const top10 =
    numberOrNull(
      holders
        ?.distribution
        ?.externalTop10Percent
    );

  if (
    top1 === null &&
    top10 === null
  ) {
    return null;
  }

  const concentration =
    (
      (top1 ?? 0) * 0.7
    ) +
    (
      (top10 ?? 0) * 0.3
    );

  return clamp(
    100 -
    concentration
  );
}

/* =========================================================
   SECURITY SCORE
========================================================= */

function calculateSecurityScore(
  security
) {
  const value =
    numberOrNull(
      security
        ?.securityScore
    );

  return value === null
    ? null
    : clamp(value);
}

/* =========================================================
   TOKEN-2022 ADJUSTMENT
========================================================= */

function calculateToken2022Score(
  token2022
) {
  if (
    !token2022?.isToken2022
  ) {
    return 100;
  }

  const findings =
    Array.isArray(
      token2022
        ?.analysis
        ?.findings
    )
      ? token2022
          .analysis
          .findings
      : [];

  let score = 100;

  for (
    const finding of findings
  ) {
    if (
      finding?.severity ===
      "HIGH"
    ) {
      score -= 20;
    } else if (
      finding?.severity ===
      "MEDIUM"
    ) {
      score -= 10;
    }
  }

  return clamp(
    score
  );
}

/* =========================================================
   FINAL SCORE
========================================================= */

function calculateScore({
  liquidityUsd,
  distribution,
  activity,
  volume24hUsd,
  maturity,
  security
}) {
  const components = {
    liquidity: null,

    distribution:
      distribution ?? null,

    activity:
      activity ?? null,

    volume:
      null,

    maturity:
      maturity ?? null,

    security:
      security ?? null
  };

  if (
    liquidityUsd !== null &&
    liquidityUsd !== undefined
  ) {
    components.liquidity =
      clamp(
        Math.log10(
          Math.max(
            liquidityUsd,
            1
          )
        ) * 20
      );
  }

  /*
   * IMPORTANT :
   *
   * 0 $ de volume = vraie valeur.
   * Ce n'est PAS une donnée manquante.
   */

  if (
    volume24hUsd !== null &&
    volume24hUsd !== undefined
  ) {
    components.volume =
      volume24hUsd === 0
        ? 0
        : clamp(
            Math.log10(
              Math.max(
                volume24hUsd,
                1
              )
            ) * 20
          );
  }

  const weights = {
    liquidity: 20,

    distribution: 20,

    activity: 20,

    volume: 15,

    maturity: 10,

    security: 15
  };

  let weightedTotal = 0;

  let availableWeight = 0;

  for (
    const [key, weight]
      of Object.entries(
        weights
      )
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
   * Minimum 40 points de données disponibles.
   */

  if (
    availableWeight >= 40
  ) {
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
  pumpCoin,
  dexPair
) {
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

  if (dexPair) {
    return "VALID";
  }

  if (pumpCoin) {
    return "PUMP_DATA";
  }

  return "NO_MARKET";
}

/* =========================================================
   MAIN
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

  if (
    req.method === "GET"
  ) {
    mint =
      typeof req.query?.mint ===
      "string"
        ? req.query.mint.trim()
        : "";
  }

  if (
    req.method === "POST"
  ) {
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

  if (
    !isSolanaMint(mint)
  ) {
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

  let dexError = null;

  let pumpCoin = null;

  let pumpMetrics = null;

  let pumpError = null;

  let solPriceUsd = null;

  /* =====================================================
     1. DEXSCREENER
  ===================================================== */

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

  /* =====================================================
     2. SUPPLY
  ===================================================== */

  const supply =
    await getTokenSupply(
      mint
    );

  /* =====================================================
     3. PUMP.FUN
  ===================================================== */

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
      String(pumpMint) ===
        mint
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

  /* =====================================================
     4. MODULES PROFITX
  ===================================================== */

  const [
    activityResult,
    holdersResult,
    securityResult,
    token2022Result
  ] =
    await Promise.all([
      callModule(
        req,
        "activity",
        mint
      ),

      callModule(
        req,
        "holders",
        mint
      ),

      callModule(
        req,
        "security",
        mint
      ),

      callModule(
        req,
        "token2022",
        mint
      )
    ]);

  const activity =
    normalizeActivity(
      activityResult
    );

  const holders =
    holdersResult?.ok === true
      ? holdersResult
      : null;

  const security =
    securityResult?.ok === true
      ? securityResult?.security
      : null;

  const token2022 =
    token2022Result?.ok === true
      ? token2022Result
      : null;

  /* =====================================================
     5. SOURCE PRINCIPALE
  ===================================================== */

  let source = null;

  let metrics = null;

  if (dexMetrics) {
    source =
      "dexscreener";

    metrics =
      {
        ...dexMetrics
      };
  } else if (
    pumpMetrics
  ) {
    source =
      "pumpfun";

    metrics =
      {
        ...pumpMetrics
      };
  }

  /*
   * Si Pump.fun existe mais aucune paire DEX
   * n'existe encore, le token reste analysable.
   */

  if (!metrics) {
    metrics = {
      liquidityUsd:
        null,

      volume24hUsd:
        activity.volume24hUsd,

      transactions24h:
        activity.transactions24h,

      buys24h:
        activity.buys24h,

      sells24h:
        activity.sells24h,

      priceUsd:
        null,

      marketCapUsd:
        null,

      ageHours:
        null,

      maturity:
        null,

      pumpComplete:
        pumpCoin?.complete ??
        null,

      pumpSwapPool:
        pumpCoin?.pump_swap_pool ??
        null,

      raydiumPool:
        pumpCoin?.raydium_pool ??
        null,

      virtualSolReserves:
        null,

      virtualTokenReserves:
        null
    };

    source =
      pumpCoin
        ? "pumpfun"
        : null;
  }

  /* =====================================================
     6. ACTIVITY V3 = SOURCE DE VÉRITÉ
  ===================================================== */

  /*
   * Activity V3 possède la priorité sur l'ancien
   * endpoint Pump.fun trades.
   *
   * Si Activity V3 dit 0, on conserve 0.
   * On ne remplace PAS 0 par une autre valeur.
   */

  if (
    activity.available
  ) {
    metrics.volume24hUsd =
      activity.volume24hUsd;

    metrics.transactions24h =
      activity.transactions24h;

    metrics.buys24h =
      activity.buys24h;

    metrics.sells24h =
      activity.sells24h;
  } else if (
    source ===
      "dexscreener"
  ) {
    /*
     * DexScreener devient la source
     * de secours uniquement si Activity V3
     * n'est pas disponible.
     */
  }

  /* =====================================================
     7. LIQUIDITY / MARKET
  ===================================================== */

  if (
    metrics.liquidityUsd ===
      null &&
    pumpMetrics
  ) {
    metrics.liquidityUsd =
      pumpMetrics.liquidityUsd;
  }

  /*
   * Pour un token gradué, DexScreener reste
   * prioritaire pour la liquidité.
   */

  if (
    dexMetrics?.liquidityUsd !==
      null &&
    dexMetrics?.liquidityUsd !==
      undefined
  ) {
    metrics.liquidityUsd =
      dexMetrics.liquidityUsd;
  }

  /* =====================================================
     8. DISTRIBUTION
  ===================================================== */

  const distributionScore =
    calculateDistributionScore(
      holders
    );

  /* =====================================================
     9. SECURITY
  ===================================================== */

  const securityBaseScore =
    calculateSecurityScore(
      security
    );

  const token2022Score =
    calculateToken2022Score(
      token2022
    );

  let securityScore = null;

  if (
    securityBaseScore !==
      null
  ) {
    securityScore =
      (
        securityBaseScore *
        0.8
      ) +
      (
        token2022Score *
        0.2
      );
  } else if (
    token2022Score !==
      null
  ) {
    securityScore =
      token2022Score;
  }

  securityScore =
    securityScore === null
      ? null
      : clamp(
          securityScore
        );

  /* =====================================================
     10. ACTIVITY SCORE
  ===================================================== */

  let activityScore =
    null;

  if (
    activity.available
  ) {
    /*
     * Aucun mouvement 24h =
     * activité réelle = 0.
     */

    if (
      activity.transactions24h ===
        0
    ) {
      activityScore =
        0;
    } else if (
      activity.transactions24h !==
        null
    ) {
      activityScore =
        clamp(
          Math.log10(
            activity.transactions24h +
              1
          ) * 40
        );
    }
  } else if (
    dexMetrics?.transactions24h !==
      null &&
    dexMetrics?.transactions24h !==
      undefined
  ) {
    activityScore =
      clamp(
        Math.log10(
          dexMetrics.transactions24h +
            1
        ) * 40
      );
  }

  metrics.activity =
    activityScore;

  /* =====================================================
     11. MATURITY
  ===================================================== */

  if (
    metrics.maturity ===
      null &&
    pumpMetrics?.maturity !==
      null
  ) {
    metrics.maturity =
      pumpMetrics.maturity;
  }

  /* =====================================================
     12. PRICE
  ===================================================== */

  if (
    metrics.priceUsd ===
      null &&
    pumpMetrics?.priceUsd !==
      null
  ) {
    metrics.priceUsd =
      pumpMetrics.priceUsd;
  }

  /* =====================================================
     13. MARKET CAP
  ===================================================== */

  if (
    metrics.marketCapUsd ===
      null &&
    pumpMetrics?.marketCapUsd !==
      null
  ) {
    metrics.marketCapUsd =
      pumpMetrics.marketCapUsd;
  }

  /* =====================================================
     14. SCORE
  ===================================================== */

  const score =
    calculateScore({
      liquidityUsd:
        metrics.liquidityUsd,

      distribution:
        distributionScore,

      activity:
        activityScore,

      volume24hUsd:
        metrics.volume24hUsd,

      maturity:
        metrics.maturity,

      security:
        securityScore
    });

  /* =====================================================
     15. MISSING DATA
  ===================================================== */

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

  /*
   * IMPORTANT :
   *
   * 0 est une donnée disponible.
   * Seul null devient N/D.
   */

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
    metrics.transactions24h ===
      null ||
    metrics.transactions24h ===
      undefined
  ) {
    missingData.push(
      "transactions24h"
    );
  }

  if (
    holders === null
  ) {
    missingData.push(
      "holders"
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
    securityScore ===
      null
  ) {
    missingData.push(
      "security"
    );
  }

  /* =====================================================
     16. STATUS
  ===================================================== */

  const status =
    buildStatus(
      pumpCoin,
      dexPair
    );

  /* =====================================================
     17. TOKEN
  ===================================================== */

  const token = {
    name:
      dexMetrics?.name ??
      pumpMetrics?.name ??
      pumpCoin?.name ??
      null,

    symbol:
      dexMetrics?.symbol ??
      pumpMetrics?.symbol ??
      pumpCoin?.symbol ??
      null,

    imageUri:
      pumpMetrics?.imageUri ??
      pumpCoin?.image_uri ??
      null,

    description:
      pumpMetrics?.description ??
      pumpCoin?.description ??
      null,

    creator:
      pumpMetrics?.creator ??
      pumpCoin?.creator ??
      null,

    website:
      pumpMetrics?.website ??
      pumpCoin?.website ??
      null,

    twitter:
      pumpMetrics?.twitter ??
      pumpCoin?.twitter ??
      null,

    telegram:
      pumpMetrics?.telegram ??
      pumpCoin?.telegram ??
      null
  };

  /* =====================================================
     18. OBSERVED
  ===================================================== */

  const observed = {
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
      holders?.uniqueOwners ??
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
  };

  /* =====================================================
     19. DATA
  ===================================================== */

  const data = {
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
      observed.holders,

    liquidityUsd:
      observed.liquidityUsd,

    volume24hUsd:
      observed.volume24hUsd,

    activity:
      activityScore,

    transactions24h:
      observed.transactions24h,

    buys24h:
      observed.buys24h,

    sells24h:
      observed.sells24h,

    priceUsd:
      observed.priceUsd,

    marketCapUsd:
      observed.marketCapUsd,

    ageHours:
      observed.ageHours,

    pairCreatedAt:
      metrics.pairCreatedAt ??
      null,

    maturity:
      observed.maturity,

    pumpComplete:
      observed.pumpComplete,

    pumpSwapPool:
      observed.pumpSwapPool,

    raydiumPool:
      observed.raydiumPool,

    virtualSolReserves:
      observed.virtualSolReserves,

    virtualTokenReserves:
      observed.virtualTokenReserves,

    solPriceUsd:
      observed.solPriceUsd
  };

  /* =====================================================
     20. MARKET
  ===================================================== */

  const market = {
    pairAddress:
      dexMetrics?.pairAddress ??
      null,

    dexId:
      dexMetrics?.dexId ??
      null,

    url:
      dexMetrics?.url ??
      null
  };

  /* =====================================================
     21. PUMP
  ===================================================== */

  const pump =
    pumpCoin
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
            pumpMetrics
              ?.virtualSolReserves ??
            null,

          virtualTokenReserves:
            pumpMetrics
              ?.virtualTokenReserves ??
            null
        }
      : null;

  /* =====================================================
     22. MODULE SUMMARY
  ===================================================== */

  const modules = {
    activity: {
      available:
        activity.available,

      version:
        activityResult?.version ??
        null,

      status:
        activity.status,

      volume24hStatus:
        activity.volume24hStatus,

      historicalTransactions:
        activity.historicalTransactions,

      historicalBuys:
        activity.historicalBuys,

      historicalSells:
        activity.historicalSells,

      uniqueHistoricalBuyers:
        activity.uniqueHistoricalBuyers,

      uniqueHistoricalSellers:
        activity.uniqueHistoricalSellers
    },

    holders: {
      available:
        Boolean(holders),

      version:
        holdersResult?.version ??
        null,

      uniqueOwners:
        holders?.uniqueOwners ??
        null,

      externalHolders:
        holders?.externalHolders ??
        null,

      externalTop1Percent:
        holders
          ?.distribution
          ?.externalTop1Percent ??
        null,

      externalTop5Percent:
        holders
          ?.distribution
          ?.externalTop5Percent ??
        null,

      externalTop10Percent:
        holders
          ?.distribution
          ?.externalTop10Percent ??
        null
    },

    security: {
      available:
        Boolean(security),

      version:
        securityResult?.version ??
        null,

      securityScore:
        security
          ?.securityScore ??
        null,

      riskLevel:
        security?.riskLevel ??
        null,

      mintAuthority:
        security
          ?.mintAuthority ??
        null,

      freezeAuthority:
        security
          ?.freezeAuthority ??
        null,

      warnings:
        security?.warnings ??
        []
    },

    token2022: {
      available:
        Boolean(token2022),

      version:
        token2022Result?.version ??
        null,

      isToken2022:
        token2022
          ?.isToken2022 ??
        false,

      extensionCount:
        token2022
          ?.analysis
          ?.extensionCount ??
        null,

      findings:
        token2022
          ?.analysis
          ?.findings ??
        [],

      metadata:
        token2022
          ?.analysis
          ?.metadata ??
        null
    }
  };

  /* =====================================================
     23. FINAL RESPONSE
  ===================================================== */

  return json(
    res,
    200,
    {
      ok: true,

      module:
        "PROFITX_ANALYZER",

      version:
        "3.0.0",

      mint,

      timestamp:
        new Date().toISOString(),

      status,

      source,

      token,

      metrics: {
        liquidity:
          score
            .components
            .liquidity,

        distribution:
          score
            .components
            .distribution,

        activity:
          score
            .components
            .activity,

        volume:
          score
            .components
            .volume,

        maturity:
          score
            .components
            .maturity
      },

      observed,

      data,

      market,

      pair:
        dexPair
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
                dexPair
                  ?.liquidity
                  ?.usd ??
                null,

              volume24hUsd:
                dexPair
                  ?.volume
                  ?.h24 ??
                null,

              marketCapUsd:
                dexPair.marketCap ??
                dexPair.fdv ??
                null
            }
          : null,

      pump,

      modules,

      score,

      missingData,

      diagnostics: {
        requestMethod:
          req.method,

        dexscreenerUsed:
          Boolean(dexPair),

        pumpfunUsed:
          Boolean(pumpCoin),

        activityV3Used:
          activity.available,

        holdersV2Used:
          Boolean(holders),

        securityV1Used:
          Boolean(security),

        token2022V11Used:
          Boolean(token2022),

        dexscreenerError:
          dexError,

        pumpfunError:
          pumpError,

        activityError:
          activityResult?.error ??
          null,

        holdersError:
          holdersResult?.error ??
          null,

        securityError:
          securityResult?.error ??
          null,

        token2022Error:
          token2022Result?.error ??
          null
      },

      note:
        activity.available
          ? (
              activity.volume24hStatus ===
              "ZERO_ACTIVITY"
                ? "Aucun mouvement économique détecté sur les dernières 24 heures. Les valeurs 0 correspondent à une absence d'activité réelle et ne sont pas des données manquantes."
                : "Activité et volume 24h calculés prioritairement par le moteur Activity V3."
            )
          : dexPair
            ? "Activity V3 indisponible : les données de marché DexScreener sont utilisées comme secours."
            : "Données partielles : certaines sources n'ont pas fourni de données exploitables."
    }
  );
}
