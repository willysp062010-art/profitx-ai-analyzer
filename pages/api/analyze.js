const DEXSCREENER_URL =
  "https://api.dexscreener.com/latest/dex/tokens";

const PUMP_COIN_URL =
  "https://frontend-api-v3.pump.fun/coins-v2";

const PUMP_SOL_PRICE_URL =
  "https://frontend-api-v3.pump.fun/sol-price";

const DEFAULT_RPC =
  "https://api.mainnet-beta.solana.com";

const TIMEOUT = 12000;
const VERSION = "4.4.1";

/* =========================================================
   BASIC HELPERS
========================================================= */

function num(value) {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value === "boolean"
  ) {
    return null;
  }

  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clamp(value, min = 0, max = 100) {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value === "boolean"
  ) {
    return null;
  }

  const n = Number(value);

  if (!Number.isFinite(n)) {
    return null;
  }

  return Math.max(min, Math.min(max, n));
}

function firstNumber(...values) {
  for (const value of values) {
    const n = num(value);

    if (n !== null) {
      return n;
    }
  }

  return null;
}

function ageHoursFromTimestamp(value) {
  const ts = num(value);

  if (ts === null) {
    return null;
  }

  const ms =
    ts > 100000000000
      ? ts
      : ts * 1000;

  return Math.max(
    0,
    (Date.now() - ms) / 3600000
  );
}

function maturityScoreFromAge(ageHours) {
  if (ageHours === null) {
    return null;
  }

  return clamp(
    (
      Math.log10(ageHours + 1) /
      Math.log10(24 * 30 + 1)
    ) * 100
  );
}

function validMint(value) {
  return (
    typeof value === "string" &&
    /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)
  );
}

function json(res, status, body) {
  res.setHeader(
    "Cache-Control",
    "no-store"
  );

  return res
    .status(status)
    .json(body);
}

/* =========================================================
   FETCH
========================================================= */

async function fetchJson(url, options = {}) {
  const controller =
    new AbortController();

  const timer = setTimeout(
    () => controller.abort(),
    TIMEOUT
  );

  try {
    const response =
      await fetch(url, {
        ...options,

        signal:
          controller.signal,

        headers: {
          Accept:
            "application/json",

          ...(options.headers || {})
        }
      });

    const text =
      await response.text();

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
      throw new Error(
        data?.error ||
        data?.message ||
        `HTTP ${response.status}`
      );
    }

    return data;
  } finally {
    clearTimeout(timer);
  }
}

/* =========================================================
   INTERNAL MODULES
========================================================= */

function baseUrl(req) {
  const host =
    req.headers?.["x-forwarded-host"] ||
    req.headers?.host ||
    process.env.VERCEL_URL;

  if (!host) {
    return null;
  }

  const protocol =
    req.headers?.["x-forwarded-proto"] ||
    (process.env.VERCEL_URL
      ? "https"
      : "http");

  return `${protocol}://${host}`;
}

async function moduleCall(
  req,
  name,
  mint
) {
  const base =
    baseUrl(req);

  if (!base) {
    return {
      ok: false,
      error:
        "URL interne indisponible."
    };
  }

  try {
    return await fetchJson(
      `${base}/api/${name}?mint=${encodeURIComponent(
        mint
      )}`
    );
  } catch (error) {
    return {
      ok: false,
      error:
        error?.message ||
        `Erreur ${name}.`
    };
  }
}

/* =========================================================
   PUMP.FUN
========================================================= */

async function pumpData(mint) {
  const coin =
    await fetchJson(
      `${PUMP_COIN_URL}/${encodeURIComponent(
        mint
      )}`,
      {
        headers: {
          Origin:
            "https://pump.fun"
        }
      }
    );

  const data =
    coin?.data ||
    coin;

  let solPrice = null;

  try {
    const price =
      await fetchJson(
        PUMP_SOL_PRICE_URL,
        {
          headers: {
            Origin:
              "https://pump.fun"
          }
        }
      );

    const value =
      price?.data ||
      price;

    solPrice =
      firstNumber(
        value?.solPrice,
        value?.sol_price,
        value?.price,
        value?.usd
      );
  } catch {
    solPrice = null;
  }

  return {
    coin: data,
    solPrice
  };
}

/* =========================================================
   TOKEN SUPPLY
========================================================= */

async function tokenSupply(mint) {
  const rpc =
    process.env.SOLANA_RPC_URL ||
    DEFAULT_RPC;

  try {
    const result =
      await fetchJson(
        rpc,
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

    const value =
      result?.result?.value;

    return {
      amount:
        value?.amount ??
        null,

      decimals:
        num(value?.decimals),

      uiAmount:
        num(value?.uiAmount)
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
   DEXSCREENER
========================================================= */

async function dexData(mint) {
  try {
    const result =
      await fetchJson(
        `${DEXSCREENER_URL}/${encodeURIComponent(
          mint
        )}`
      );

    const pairs =
      Array.isArray(result?.pairs)
        ? result.pairs
        : [];

    if (!pairs.length) {
      return {
        pair: null,
        error: null
      };
    }

    const solana =
      pairs.filter(
        p =>
          p?.chainId ===
          "solana"
      );

    const list =
      solana.length
        ? solana
        : pairs;

    list.sort(
      (a, b) =>
        (num(
          b?.liquidity?.usd
        ) || 0) -
        (num(
          a?.liquidity?.usd
        ) || 0)
    );

    return {
      pair:
        list[0] || null,

      error: null
    };
  } catch (error) {
    return {
      pair: null,

      error:
        error?.message ||
        "DexScreener indisponible."
    };
  }
}

/* =========================================================
   PUMP METRICS
========================================================= */

function pumpMetrics(
  coin,
  solPrice,
  supply
) {
  if (!coin) {
    return null;
  }

  const marketCapSol =
    num(coin?.market_cap);

  let marketCapUsd =
    firstNumber(
      coin?.usd_market_cap,
      coin?.usdMarketCap
    );

  if (
    marketCapUsd === null &&
    marketCapSol !== null &&
    solPrice !== null
  ) {
    marketCapUsd =
      marketCapSol *
      solPrice;
  }

  const virtualSolRaw =
    num(
      coin?.virtual_sol_reserves
    );

  const virtualTokenRaw =
    num(
      coin?.virtual_token_reserves
    );

  const virtualSol =
    virtualSolRaw !== null
      ? virtualSolRaw / 1e9
      : null;

  const virtualToken =
    virtualTokenRaw !== null
      ? virtualTokenRaw / 1e6
      : null;

  let liquidityUsd = null;

  if (
    virtualSol !== null &&
    solPrice !== null
  ) {
    liquidityUsd =
      virtualSol *
      solPrice;
  }

  let priceUsd =
    firstNumber(
      coin?.price_usd,
      coin?.priceUsd
    );

  if (
    priceUsd === null &&
    marketCapUsd !== null &&
    supply?.uiAmount > 0
  ) {
    priceUsd =
      marketCapUsd /
      supply.uiAmount;
  }

  const ageHours =
    ageHoursFromTimestamp(
      coin?.created_timestamp
    );

  const maturity =
    maturityScoreFromAge(
      ageHours
    );

  return {
    liquidityUsd,

    marketCapUsd,

    priceUsd,

    ageHours,

    maturity,

    complete:
      coin?.complete ??
      null,

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

    virtualSol,

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
   DEX METRICS
========================================================= */

function dexMetrics(pair) {
  if (!pair) {
    return null;
  }

  const buys =
    num(
      pair?.txns?.h24?.buys
    );

  const sells =
    num(
      pair?.txns?.h24?.sells
    );

  return {
    liquidityUsd:
      num(
        pair?.liquidity?.usd
      ),

    volume24hUsd:
      num(
        pair?.volume?.h24
      ),

    buys24h:
      buys,

    sells24h:
      sells,

    transactions24h:
      buys !== null &&
      sells !== null
        ? buys + sells
        : null,

    priceUsd:
      num(pair?.priceUsd),

    marketCapUsd:
      firstNumber(
        pair?.marketCap,
        pair?.fdv
      ),

    pairCreatedAt:
      num(pair?.pairCreatedAt),

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
   ACTIVITY
========================================================= */

function normalizeActivity(result) {
  if (
    !result ||
    result.ok !== true
  ) {
    return {
      available: false,

      volume24hUsd: null,

      transactions24h: null,

      buys24h: null,

      sells24h: null,

      historicalTransactions: null,

      historicalBuys: null,

      historicalSells: null,

      uniqueBuyers: null,

      uniqueSellers: null,

      status:
        "UNAVAILABLE",

      volumeStatus:
        "N/D"
    };
  }

  const day =
    result?.volume?.last24h;

  const observed =
    result?.volume?.observed;

  const participants =
    result?.participants;

  return {
    available: true,

    volume24hUsd:
      num(day?.volumeUsd),

    transactions24h:
      num(day?.transactions),

    buys24h:
      num(day?.buys),

    sells24h:
      num(day?.sells),

    historicalTransactions:
      num(
        observed?.transactions
      ),

    historicalBuys:
      num(
        observed?.buys
      ),

    historicalSells:
      num(
        observed?.sells
      ),

    uniqueBuyers:
      num(
        participants
          ?.uniqueExternalBuyers
      ),

    uniqueSellers:
      num(
        participants
          ?.uniqueExternalSellers
      ),

    status:
      result?.analysis
        ?.activityStatus ??
      "UNKNOWN",

    volumeStatus:
      day?.volumeUsdStatus ??
      "N/D",

    volume7d:
      result?.volume?.last7d ??
      null
  };
}

/* =========================================================
   SCORES
========================================================= */

function liquidityScore(value) {
  if (value === null) {
    return null;
  }

  return clamp(
    Math.log10(
      Math.max(value, 1)
    ) * 20
  );
}

function activityScore(
  activity,
  fallbackTransactions = null
) {
  const transactions =
    firstNumber(
      activity?.transactions24h,
      fallbackTransactions
    );

  if (transactions === null) {
    return null;
  }

  if (transactions === 0) {
    return 0;
  }

  return clamp(
    Math.log10(
      transactions + 1
    ) * 40
  );
}

function volumeScore(value) {
  if (value === null) {
    return null;
  }

  if (value === 0) {
    return 0;
  }

  return clamp(
    Math.log10(
      Math.max(value, 1)
    ) * 20
  );
}

/* =========================================================
   DISTRIBUTION SCORE
========================================================= */

function distributionScore(holders) {
  const top1 =
    num(
      holders
        ?.distribution
        ?.externalTop1Percent
    );

  const top10 =
    num(
      holders
        ?.distribution
        ?.externalTop10Percent
    );

  const externalHolders =
    num(
      holders?.externalHolders
    );

  const uniqueOwners =
    num(
      holders?.uniqueOwners
    );

  if (
    externalHolders === null &&
    uniqueOwners === null &&
    top1 === null &&
    top10 === null
  ) {
    return null;
  }

  let holderScore = 100;

  if (
    externalHolders !== null
  ) {
    if (externalHolders <= 1) {
      holderScore = 0;
    } else if (externalHolders <= 2) {
      holderScore = 15;
    } else if (externalHolders <= 5) {
      holderScore = 30;
    } else if (externalHolders <= 10) {
      holderScore = 45;
    } else if (externalHolders <= 20) {
      holderScore = 60;
    } else if (externalHolders <= 50) {
      holderScore = 75;
    } else if (externalHolders <= 100) {
      holderScore = 85;
    } else {
      holderScore = 100;
    }
  } else if (
    uniqueOwners !== null
  ) {
    if (uniqueOwners <= 1) {
      holderScore = 0;
    } else if (uniqueOwners <= 3) {
      holderScore = 20;
    } else if (uniqueOwners <= 10) {
      holderScore = 40;
    } else if (uniqueOwners <= 25) {
      holderScore = 60;
    } else if (uniqueOwners <= 50) {
      holderScore = 75;
    } else if (uniqueOwners <= 100) {
      holderScore = 85;
    } else {
      holderScore = 100;
    }
  }

  let concentrationScore = null;

  if (
    top1 !== null ||
    top10 !== null
  ) {
    let concentration = 0;
    let concentrationWeight = 0;

    if (top1 !== null) {
      concentration +=
        top1 * 0.7;

      concentrationWeight +=
        0.7;
    }

    if (top10 !== null) {
      concentration +=
        top10 * 0.3;

      concentrationWeight +=
        0.3;
    }

    concentrationScore =
      concentrationWeight > 0
        ? clamp(
            100 -
              concentration /
                concentrationWeight
          )
        : null;
  }

  if (
    concentrationScore !== null
  ) {
    return Math.round(
      holderScore * 0.6 +
      concentrationScore * 0.4
    );
  }

  return holderScore;
}

function securityScore(security) {
  return clamp(
    num(
      security?.securityScore
    )
  );
}

function token2022Score(
  token2022
) {
  if (!token2022) {
    return null;
  }

  if (
    token2022.isToken2022 !== true
  ) {
    return 100;
  }

  const findings =
    Array.isArray(
      token2022
        ?.analysis
        ?.findings
    )
      ? token2022.analysis.findings
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
    }

    if (
      finding?.severity ===
      "MEDIUM"
    ) {
      score -= 10;
    }
  }

  return clamp(score);
}

/* =========================================================
   STRUCTURAL SCORE
========================================================= */

function structuralScore({
  liquidity,
  distribution,
  maturity,
  security
}) {
  const components = {
    liquidity,
    distribution,
    maturity,
    security
  };

  const weights = {
    liquidity: 30,
    distribution: 30,
    maturity: 15,
    security: 25
  };

  let weightedTotal = 0;
  let availableWeight = 0;

  for (
    const key of Object.keys(
      weights
    )
  ) {
    if (
      components[key] !== null &&
      Number.isFinite(
        components[key]
      )
    ) {
      weightedTotal +=
        components[key] *
        weights[key];

      availableWeight +=
        weights[key];
    }
  }

  return {
    total:
      availableWeight >= 40
        ? Math.round(
            weightedTotal / 100
          )
        : null,

    components,

    availableWeight
  };
}

/* =========================================================
   MARKET SCORE
========================================================= */

function marketScore({
  activity,
  volume
}) {
  let total = 0;
  let weight = 0;

  if (activity !== null) {
    total +=
      activity * 0.6;

    weight += 0.6;
  }

  if (volume !== null) {
    total +=
      volume * 0.4;

    weight += 0.4;
  }

  return weight > 0
    ? Math.round(
        total / weight
      )
    : null;
}

/* =========================================================
   CONFIDENCE
========================================================= */

function confidenceScore({
  liquidity,
  volume24h,
  transactions24h,
  maturity,
  distribution,
  security,
  token2022
}) {
  const tokenStandardAvailable =
    token2022 !== null &&
    token2022?.isToken2022 !==
      undefined &&
    token2022?.isToken2022 !==
      null;

  const checks = [
    liquidity !== null,

    volume24h !== null ||
      transactions24h !== null,

    maturity !== null,

    distribution !== null,

    security !== null,

    tokenStandardAvailable
  ];

  const points =
    checks.filter(Boolean).length;

  return Math.round(
    (points / checks.length) *
      100
  );
}

/* =========================================================
   DIAGNOSTIC
========================================================= */

function diagnostic({
  activity,
  holders,
  status,
  structural,
  market,
  confidence,
  distribution
}) {
  const warnings = [];
  const positives = [];

  if (
    activity.transactions24h ===
      0 &&
    activity.volume24hUsd ===
      0
  ) {
    warnings.push(
      "Aucune activité économique détectée sur 24h."
    );
  }

  if (
    activity.uniqueBuyers === 0
  ) {
    warnings.push(
      "Aucun acheteur externe détecté récemment."
    );
  }

  const holderCount =
    num(
      holders?.uniqueOwners
    );

  const externalHolderCount =
    num(
      holders?.externalHolders
    );

  if (
    holderCount !== null &&
    holderCount <= 3
  ) {
    warnings.push(
      "Nombre de détenteurs très faible."
    );
  }

  if (
    externalHolderCount !== null &&
    externalHolderCount <= 3
  ) {
    warnings.push(
      "Nombre de détenteurs externes très faible."
    );
  }

  if (
    structural.total !== null &&
    structural.total >= 70 &&
    distribution !== null
  ) {
    positives.push(
      "Structure globalement solide selon les données disponibles."
    );
  } else if (
    structural.total !== null &&
    structural.total >= 70
  ) {
    positives.push(
      "Les indicateurs structurels disponibles sont favorables, mais l'analyse reste partielle."
    );
  }

  if (
    distribution === null
  ) {
    warnings.push(
      "Distribution des détenteurs indisponible."
    );
  }

  if (
    status ===
    "BONDING_CURVE"
  ) {
    warnings.push(
      "Le token est encore sur la bonding curve."
    );
  }

  let state =
    "UNKNOWN";

  let conclusion =
    "Les données disponibles ne permettent pas encore une conclusion complète.";

  if (
    activity.transactions24h ===
      0 &&
    activity.volume24hUsd ===
      0
  ) {
    state =
      "INACTIVE";

    conclusion =
      "Le marché est actuellement inactif. ProfitX observe une structure analysable mais aucun mouvement économique récent.";
  } else if (
    market !== null &&
    market < 25
  ) {
    state =
      "LOW_ACTIVITY";

    conclusion =
      "Une activité existe, mais elle reste faible.";
  } else if (
    market !== null
  ) {
    state =
      "ACTIVE";

    conclusion =
      "Une activité économique réelle est détectée.";
  }

  return {
    version:
      VERSION,

    marketState:
      state,

    confidence: {
      score:
        confidence,

      level:
        confidence >= 85
          ? "HIGH"
          : confidence >= 60
            ? "MEDIUM"
            : "LOW"
    },

    structuralScore:
      structural.total,

    marketScore:
      market,

    positives,

    warnings,

    conclusion
  };
}

/* =========================================================
   HANDLER
========================================================= */

export default async function handler(
  req,
  res
) {
  if (
    req.method !== "GET" &&
    req.method !== "POST"
  ) {
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

  const mint =
    req.method === "GET"
      ? String(
          req.query?.mint || ""
        ).trim()
      : String(
          req.body?.mint || ""
        ).trim();

  if (!validMint(mint)) {
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

  let pump = null;
  let pumpError = null;

  try {
    pump =
      await pumpData(mint);
  } catch (error) {
    pumpError =
      error?.message ||
      "Pump.fun indisponible.";
  }

  const supply =
    await tokenSupply(mint);

  const dex =
    await dexData(mint);

  const [
    activityResult,
    holdersResult,
    securityResult,
    token2022Result
  ] =
    await Promise.all([
      moduleCall(
        req,
        "activity",
        mint
      ),

      moduleCall(
        req,
        "holders",
        mint
      ),

      moduleCall(
        req,
        "security",
        mint
      ),

      moduleCall(
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
      ? securityResult.security
      : null;

  const token2022 =
    token2022Result?.ok === true
      ? token2022Result
      : null;

  const pMetrics =
    pumpMetrics(
      pump?.coin,
      pump?.solPrice,
      supply
    );

  const dMetrics =
    dexMetrics(
      dex?.pair
    );

  const dexAgeHours =
    ageHoursFromTimestamp(
      dMetrics?.pairCreatedAt
    );

  const dexMaturity =
    maturityScoreFromAge(
      dexAgeHours
    );

  const metrics =
    dMetrics
      ? {
          ...dMetrics,

          liquidityUsd:
            dMetrics.liquidityUsd ??
            pMetrics?.liquidityUsd,

          maturity:
            pMetrics?.maturity ??
            dexMaturity,

          ageHours:
            pMetrics?.ageHours ??
            dexAgeHours
        }
      : {
          liquidityUsd:
            pMetrics?.liquidityUsd ??
            null,

          volume24hUsd:
            null,

          transactions24h:
            null,

          buys24h:
            null,

          sells24h:
            null,

          priceUsd:
            pMetrics?.priceUsd ??
            null,

          marketCapUsd:
            pMetrics?.marketCapUsd ??
            null,

          ageHours:
            pMetrics?.ageHours ??
            null,

          maturity:
            pMetrics?.maturity ??
            null
        };

  if (
    activity.available
  ) {
    if (
      activity.volume24hUsd !==
      null
    ) {
      metrics.volume24hUsd =
        activity.volume24hUsd;
    }

    if (
      activity.transactions24h !==
      null
    ) {
      metrics.transactions24h =
        activity.transactions24h;
    }

    if (
      activity.buys24h !==
      null
    ) {
      metrics.buys24h =
        activity.buys24h;
    }

    if (
      activity.sells24h !==
      null
    ) {
      metrics.sells24h =
        activity.sells24h;
    }
  }

  const liquidity =
    num(
      metrics.liquidityUsd
    );

  const distribution =
    distributionScore(
      holders
    );

  const baseSecurity =
    securityScore(
      security
    );

  const extensionSecurity =
    token2022Score(
      token2022
    );

  let securityFinal = null;

  if (
    baseSecurity !== null &&
    extensionSecurity !== null
  ) {
    securityFinal =
      clamp(
        baseSecurity * 0.8 +
        extensionSecurity * 0.2
      );
  } else if (
    baseSecurity !== null
  ) {
    securityFinal =
      baseSecurity;
  }

  const activityValue =
    activityScore(
      activity,
      metrics.transactions24h
    );

  const volumeValue =
    volumeScore(
      metrics.volume24hUsd
    );

  const maturity =
    num(
      metrics.maturity
    );

  const structural =
    structuralScore({
      liquidity:
        liquidityScore(
          liquidity
        ),

      distribution,

      maturity,

      security:
        securityFinal
    });

  const market =
    marketScore({
      activity:
        activityValue,

      volume:
        volumeValue
    });

  let globalScore = null;

  if (
    structural.total !== null &&
    market !== null
  ) {
    globalScore =
      Math.round(
        structural.total *
          0.7 +
        market *
          0.3
      );
  } else {
    globalScore =
      structural.total;
  }

  const holdersAvailable =
    Boolean(holders) &&
    (
      num(
        holders?.uniqueOwners
      ) !== null ||
      num(
        holders?.externalHolders
      ) !== null ||
      num(
        holders
          ?.distribution
          ?.externalTop1Percent
      ) !== null ||
      num(
        holders
          ?.distribution
          ?.externalTop10Percent
      ) !== null
    );

  const activityModuleUsable =
    activity.available &&
    (
      activity.volume24hUsd !==
        null ||
      activity.transactions24h !==
        null ||
      activity.historicalTransactions !==
        null ||
      activity.uniqueBuyers !==
        null ||
      activity.uniqueSellers !==
        null
    );

  const hasDexMarket =
    Boolean(dMetrics) &&
    (
      num(
        dMetrics?.liquidityUsd
      ) !== null ||
      num(
        dMetrics?.volume24hUsd
      ) !== null ||
      num(
        dMetrics?.priceUsd
      ) !== null
    );

  const hasPumpReserveData =
    num(
      pump?.coin
        ?.virtual_sol_reserves
    ) !== null ||
    num(
      pump?.coin
        ?.virtual_token_reserves
    ) !== null;

  const hasPumpPoolData =
    Boolean(
      pump?.coin
        ?.pump_swap_pool
    ) ||
    Boolean(
      pump?.coin
        ?.raydium_pool
    );

  const pumpMarketDetected =
    hasPumpReserveData ||
    hasPumpPoolData;

  const hasRealPumpBondingCurve =
    pump?.coin?.complete ===
      false &&
    hasPumpReserveData &&
    !hasDexMarket;

  const hasRealPumpGraduation =
    pump?.coin?.complete ===
      true &&
    pumpMarketDetected;

  const status =
    hasRealPumpGraduation
      ? "GRADUATED"
      : hasRealPumpBondingCurve
        ? "BONDING_CURVE"
        : hasDexMarket
          ? "VALID"
          : "NO_MARKET";

  const confidence =
    confidenceScore({
      liquidity,

      volume24h:
        num(
          metrics.volume24hUsd
        ),

      transactions24h:
        num(
          metrics.transactions24h
        ),

      maturity,

      distribution,

      security:
        securityFinal,

      token2022
    });

  const diag =
    diagnostic({
      activity,

      holders,

      status,

      structural,

      market,

      confidence,

      distribution
    });

  const missingData = [];

  if (
    liquidity === null
  ) {
    missingData.push(
      "liquidity"
    );
  }

  if (
    metrics.volume24hUsd ===
      null
  ) {
    missingData.push(
      "volume24h"
    );
  }

  if (
    metrics.transactions24h ===
      null
  ) {
    missingData.push(
      "transactions24h"
    );
  }

  if (
    !holdersAvailable
  ) {
    missingData.push(
      "holders"
    );
  }

  if (
    distribution === null
  ) {
    missingData.push(
      "distribution"
    );
  }

  if (
    maturity === null
  ) {
    missingData.push(
      "maturity"
    );
  }

  if (
    securityFinal === null
  ) {
    missingData.push(
      "security"
    );
  }

  const coin =
    pump?.coin;

  const token = {
    name:
      dMetrics?.name ??
      pMetrics?.name ??
      coin?.name ??
      null,

    symbol:
      dMetrics?.symbol ??
      pMetrics?.symbol ??
      coin?.symbol ??
      null,

    imageUri:
      pMetrics?.imageUri ??
      null,

    description:
      pMetrics?.description ??
      null,

    creator:
      pMetrics?.creator ??
      coin?.creator ??
      null,

    website:
      pMetrics?.website ??
      null,

    twitter:
      pMetrics?.twitter ??
      null,

    telegram:
      pMetrics?.telegram ??
      null
  };

  const observed = {
    liquidityUsd:
      liquidity,

    volume24hUsd:
      metrics.volume24hUsd,

    transactions24h:
      metrics.transactions24h,

    buys24h:
      metrics.buys24h,

    sells24h:
      metrics.sells24h,

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

    maturity,

    pumpComplete:
      pumpMarketDetected
        ? coin?.complete ??
          null
        : null,

    pumpSwapPool:
      pumpMarketDetected
        ? coin?.pump_swap_pool ??
          null
        : null,

    raydiumPool:
      pumpMarketDetected
        ? coin?.raydium_pool ??
          null
        : null,

    virtualSolReserves:
      pumpMarketDetected
        ? pMetrics?.virtualSol ??
          null
        : null,

    virtualTokenReserves:
      pumpMarketDetected
        ? pMetrics?.virtualToken ??
          null
        : null,

    solPriceUsd:
      pumpMarketDetected
        ? pump?.solPrice ??
          null
        : null
  };

  const data = {
    supply:
      supply.uiAmount,

    supplyRaw:
      supply.amount,

    decimals:
      supply.decimals,

    holders:
      observed.holders,

    liquidityUsd:
      observed.liquidityUsd,

    volume24hUsd:
      observed.volume24hUsd,

    activity:
      activityValue,

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

  const modules = {
    activity: {
      available:
        activityModuleUsable,

      version:
        activityResult?.version ??
        null,

      status:
        activity.status,

      volume24hStatus:
        activity.volumeStatus,

      historicalTransactions:
        activity.historicalTransactions,

      historicalBuys:
        activity.historicalBuys,

      historicalSells:
        activity.historicalSells,

      uniqueHistoricalBuyers:
        activity.uniqueBuyers,

      uniqueHistoricalSellers:
        activity.uniqueSellers
    },

    holders: {
      available:
        holdersAvailable,

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
        security?.securityScore ??
        null,

      riskLevel:
        security?.riskLevel ??
        null,

      mintAuthority:
        security?.mintAuthority ??
        null,

      freezeAuthority:
        security?.freezeAuthority ??
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
        token2022?.isToken2022 ??
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

  return json(
    res,
    200,
    {
      ok: true,

      module:
        "PROFITX_ANALYZER",

      version:
        VERSION,

      mint,

      timestamp:
        new Date()
          .toISOString(),

      status,

      source:
        hasDexMarket
          ? "dexscreener"
          : pumpMarketDetected
            ? "pumpfun"
            : null,

      token,

      metrics: {
        liquidity:
          structural
            .components
            .liquidity,

        distribution:
          structural
            .components
            .distribution,

        activity:
          activityValue,

        volume:
          volumeValue,

        maturity,

        security:
          securityFinal
      },

      observed,

      data,

      market: {
        pairAddress:
          dMetrics?.pairAddress ??
          null,

        dexId:
          dMetrics?.dexId ??
          null,

        url:
          dMetrics?.url ??
          null
      },

      pair:
        dex?.pair
          ? {
              address:
                dex.pair
                  .pairAddress ??
                null,

              dexId:
                dex.pair
                  .dexId ??
                null,

              url:
                dex.pair
                  .url ??
                null,

              priceUsd:
                dex.pair
                  .priceUsd ??
                null,

              liquidityUsd:
                dex.pair
                  ?.liquidity
                  ?.usd ??
                null,

              volume24hUsd:
                dex.pair
                  ?.volume
                  ?.h24 ??
                null,

              marketCapUsd:
                dex.pair
                  ?.marketCap ??
                dex.pair?.fdv ??
                null
            }
          : null,

      pump:
        pumpMarketDetected
          ? {
              complete:
                coin?.complete ??
                null,

              bondingCurve:
                coin?.bonding_curve ??
                null,

              associatedBondingCurve:
                coin
                  ?.associated_bonding_curve ??
                null,

              pumpSwapPool:
                coin?.pump_swap_pool ??
                null,

              raydiumPool:
                coin?.raydium_pool ??
                null,

              virtualSolReserves:
                pMetrics
                  ?.virtualSol ??
                null,

              virtualTokenReserves:
                pMetrics
                  ?.virtualToken ??
                null
            }
          : null,

      modules,

      score: {
        total:
          globalScore,

        structural:
          structural.total,

        market,

        activity:
          activityValue,

        components:
          structural.components,

        weights: {
          structural: 70,
          market: 30
        },

        availableWeight:
          structural
            .availableWeight
      },

      diagnostic:
        diag,

      missingData,

      diagnostics: {
        dexscreenerUsed:
          hasDexMarket,

        pumpfunUsed:
          pumpMarketDetected,

        activityV3Used:
          activityModuleUsable,

        holdersV2Used:
          holdersAvailable,

        securityV1Used:
          Boolean(security),

        token2022V11Used:
          Boolean(token2022),

        dexscreenerError:
          dex?.error ??
          null,

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
        activity.available &&
        activity.volumeStatus ===
          "ZERO_ACTIVITY"
          ? "Aucun mouvement économique détecté sur les dernières 24 heures. Les valeurs 0 correspondent à une absence d'activité réelle."
          : `Analyse ProfitX ${VERSION} basée prioritairement sur les données on-chain et les modules ProfitX.`
    }
  );
}
