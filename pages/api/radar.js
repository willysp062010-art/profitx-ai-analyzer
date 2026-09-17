const DEXSCREENER_BASE = "https://api.dexscreener.com";

const PROFILE_URL =
  `${DEXSCREENER_BASE}/token-profiles/latest/v1`;

const CHAIN_ID = "solana";
const VERSION = "1.0.0";

const REQUEST_TIMEOUT = 10000;
const MAX_TOKENS = 30;
const CACHE_DURATION = 45 * 1000;

let memoryCache = {
  timestamp: 0,
  payload: null,
};

function num(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const n = Number(value);

  return Number.isFinite(n) ? n : null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value, decimals = 2) {
  const n = num(value);

  if (n === null) return null;

  const factor = 10 ** decimals;

  return Math.round(n * factor) / factor;
}

async function fetchJson(url) {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `DexScreener HTTP ${response.status}`
      );
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function uniqueSolanaProfiles(data) {
  if (!Array.isArray(data)) {
    return [];
  }

  const seen = new Set();
  const profiles = [];

  for (const profile of data) {
    if (
      !profile ||
      profile.chainId !== CHAIN_ID ||
      typeof profile.tokenAddress !== "string" ||
      !profile.tokenAddress.trim()
    ) {
      continue;
    }

    const mint = profile.tokenAddress.trim();

    if (seen.has(mint)) {
      continue;
    }

    seen.add(mint);

    profiles.push({
      mint,
      profileUrl:
        typeof profile.url === "string"
          ? profile.url
          : null,
      icon:
        typeof profile.icon === "string"
          ? profile.icon
          : null,
      description:
        typeof profile.description === "string"
          ? profile.description
          : null,
    });

    if (profiles.length >= MAX_TOKENS) {
      break;
    }
  }

  return profiles;
}

function selectBestPair(pairs, mint) {
  if (!Array.isArray(pairs)) {
    return null;
  }

  const candidates = pairs.filter((pair) => {
    return (
      pair &&
      pair.chainId === CHAIN_ID &&
      pair.baseToken &&
      pair.baseToken.address === mint
    );
  });

  if (!candidates.length) {
    return null;
  }

  candidates.sort((a, b) => {
    const liquidityA =
      num(a?.liquidity?.usd) ?? -1;

    const liquidityB =
      num(b?.liquidity?.usd) ?? -1;

    if (liquidityB !== liquidityA) {
      return liquidityB - liquidityA;
    }

    const volumeA =
      num(a?.volume?.h24) ?? -1;

    const volumeB =
      num(b?.volume?.h24) ?? -1;

    return volumeB - volumeA;
  });

  return candidates[0];
}

function liquidityPoints(liquidity) {
  const value = num(liquidity);

  if (value === null || value <= 0) return 0;
  if (value < 5_000) return 2;
  if (value < 10_000) return 5;
  if (value < 25_000) return 9;
  if (value < 50_000) return 14;
  if (value < 100_000) return 19;
  if (value < 250_000) return 24;
  if (value < 500_000) return 27;

  return 30;
}

function volumePoints(volume) {
  const value = num(volume);

  if (value === null || value <= 0) return 0;
  if (value < 5_000) return 2;
  if (value < 10_000) return 4;
  if (value < 25_000) return 7;
  if (value < 50_000) return 10;
  if (value < 100_000) return 14;
  if (value < 250_000) return 18;
  if (value < 500_000) return 22;

  return 25;
}

function transactionPoints(transactions) {
  const value = num(transactions);

  if (value === null || value <= 0) return 0;
  if (value < 20) return 2;
  if (value < 50) return 4;
  if (value < 100) return 6;
  if (value < 250) return 9;
  if (value < 500) return 12;
  if (value < 1_000) return 15;
  if (value < 2_000) return 18;

  return 20;
}

function turnoverPoints(volume, liquidity) {
  const v = num(volume);
  const l = num(liquidity);

  if (
    v === null ||
    l === null ||
    v <= 0 ||
    l <= 0
  ) {
    return 0;
  }

  const ratio = v / l;

  if (ratio < 0.05) return 1;
  if (ratio < 0.1) return 2;
  if (ratio < 0.25) return 4;
  if (ratio < 0.5) return 6;
  if (ratio < 1) return 8;

  return 10;
}

function agePoints(pairCreatedAt, now) {
  const created = num(pairCreatedAt);

  if (created === null || created <= 0) {
    return 0;
  }

  const ageHours =
    Math.max(0, now - created) /
    (1000 * 60 * 60);

  if (ageHours < 1) return 1;
  if (ageHours < 6) return 3;
  if (ageHours < 24) return 6;
  if (ageHours < 72) return 9;
  if (ageHours < 168) return 12;

  return 15;
}

function calculateScore({
  liquidity,
  volume24h,
  transactions24h,
  pairCreatedAt,
  now,
}) {
  const liquidityScore =
    liquidityPoints(liquidity);

  const volumeScore =
    volumePoints(volume24h);

  const transactionScore =
    transactionPoints(transactions24h);

  const turnoverScore =
    turnoverPoints(
      volume24h,
      liquidity
    );

  const maturityScore =
    agePoints(pairCreatedAt, now);

  const total =
    liquidityScore +
    volumeScore +
    transactionScore +
    turnoverScore +
    maturityScore;

  return {
    total: clamp(
      Math.round(total),
      0,
      100
    ),

    components: {
      liquidity: liquidityScore,
      volume24h: volumeScore,
      transactions24h: transactionScore,
      turnover: turnoverScore,
      maturity: maturityScore,
    },
  };
}

function getStatus(score) {
  if (score >= 75) {
    return "ACTIVITÉ ÉLEVÉE";
  }

  if (score >= 50) {
    return "ACTIVITÉ MODÉRÉE";
  }

  return "ACTIVITÉ LIMITÉE";
}

function buildToken(profile, pair, now) {
  if (!pair) {
    return null;
  }

  const buys24h =
    num(pair?.txns?.h24?.buys);

  const sells24h =
    num(pair?.txns?.h24?.sells);

  const transactions24h =
    buys24h !== null ||
    sells24h !== null
      ? (buys24h || 0) +
        (sells24h || 0)
      : null;

  const liquidity =
    num(pair?.liquidity?.usd);

  const volume24h =
    num(pair?.volume?.h24);

  const pairCreatedAt =
    num(pair?.pairCreatedAt);

  const score = calculateScore({
    liquidity,
    volume24h,
    transactions24h,
    pairCreatedAt,
    now,
  });

  const marketCap =
    num(pair?.marketCap) ??
    num(pair?.fdv);

  return {
    mint: profile.mint,

    name:
      pair?.baseToken?.name ||
      "Token inconnu",

    symbol:
      pair?.baseToken?.symbol ||
      "N/D",

    priceUsd:
      num(pair?.priceUsd),

    marketCap,

    fdv:
      num(pair?.fdv),

    liquidity,

    volume24h,

    transactions24h,

    buys24h,

    sells24h,

    change24h:
      num(pair?.priceChange?.h24),

    pairCreatedAt,

    ageMs:
      pairCreatedAt !== null
        ? Math.max(
            0,
            now - pairCreatedAt
          )
        : null,

    score: score.total,

    scoreDetails:
      score.components,

    status:
      getStatus(score.total),

    dexId:
      pair?.dexId || null,

    pairAddress:
      pair?.pairAddress || null,

    pairUrl:
      typeof pair?.url === "string"
        ? pair.url
        : null,

    icon:
      profile.icon ||
      pair?.info?.imageUrl ||
      null,

    description:
      profile.description,

    source:
      "DexScreener",
  };
}

function batch(array, size) {
  const groups = [];

  for (
    let i = 0;
    i < array.length;
    i += size
  ) {
    groups.push(
      array.slice(i, i + size)
    );
  }

  return groups;
}

async function fetchPairsForProfiles(
  profiles
) {
  const addresses =
    profiles.map(
      (profile) => profile.mint
    );

  const groups =
    batch(addresses, 30);

  const responses =
    await Promise.all(
      groups.map(async (group) => {
        const encoded =
          group
            .map((mint) =>
              encodeURIComponent(mint)
            )
            .join(",");

        const url =
          `${DEXSCREENER_BASE}` +
          `/tokens/v1/${CHAIN_ID}/` +
          encoded;

        const result =
          await fetchJson(url);

        return Array.isArray(result)
          ? result
          : [];
      })
    );

  return responses.flat();
}

function buildPairMap(pairs, profiles) {
  const map = new Map();

  for (const profile of profiles) {
    const best =
      selectBestPair(
        pairs,
        profile.mint
      );

    if (best) {
      map.set(
        profile.mint,
        best
      );
    }
  }

  return map;
}

function sortTokens(tokens) {
  return [...tokens].sort(
    (a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      const volumeA =
        num(a.volume24h) ?? 0;

      const volumeB =
        num(b.volume24h) ?? 0;

      if (volumeB !== volumeA) {
        return volumeB - volumeA;
      }

      const liquidityA =
        num(a.liquidity) ?? 0;

      const liquidityB =
        num(b.liquidity) ?? 0;

      return (
        liquidityB -
        liquidityA
      );
    }
  );
}

async function buildRadar() {
  const now = Date.now();

  const profileData =
    await fetchJson(
      PROFILE_URL
    );

  const profiles =
    uniqueSolanaProfiles(
      profileData
    );

  if (!profiles.length) {
    return {
      ok: true,
      version: VERSION,
      updatedAt:
        new Date(now).toISOString(),
      source:
        "DexScreener",
      discovery:
        "latest-token-profiles",
      tokens: [],
    };
  }

  const pairs =
    await fetchPairsForProfiles(
      profiles
    );

  const pairMap =
    buildPairMap(
      pairs,
      profiles
    );

  const tokens =
    profiles
      .map((profile) => {
        const pair =
          pairMap.get(
            profile.mint
          );

        return buildToken(
          profile,
          pair,
          now
        );
      })
      .filter(Boolean);

  const sorted =
    sortTokens(tokens);

  return {
    ok: true,

    version: VERSION,

    updatedAt:
      new Date(now).toISOString(),

    source:
      "DexScreener",

    chain:
      CHAIN_ID,

    discovery:
      "latest-token-profiles",

    methodology: {
      scoreMaximum: 100,

      weights: {
        liquidity: 30,
        volume24h: 25,
        transactions24h: 20,
        turnover: 10,
        maturity: 15,
      },

      priceChangeIncludedInScore:
        false,

      promotionalBoostIncludedInScore:
        false,
    },

    count:
      sorted.length,

    tokens:
      sorted,
  };
}

export default async function handler(
  req,
  res
) {
  if (req.method !== "GET") {
    res.setHeader(
      "Allow",
      "GET"
    );

    return res
      .status(405)
      .json({
        ok: false,
        error:
          "Méthode non autorisée.",
      });
  }

  try {
    const now = Date.now();

    if (
      memoryCache.payload &&
      now -
        memoryCache.timestamp <
        CACHE_DURATION
    ) {
      res.setHeader(
        "Cache-Control",
        "s-maxage=30, stale-while-revalidate=60"
      );

      return res
        .status(200)
        .json({
          ...memoryCache.payload,
          cached: true,
        });
    }

    const payload =
      await buildRadar();

    memoryCache = {
      timestamp: now,
      payload,
    };

    res.setHeader(
      "Cache-Control",
      "s-maxage=30, stale-while-revalidate=60"
    );

    return res
      .status(200)
      .json({
        ...payload,
        cached: false,
      });
  } catch (error) {
    console.error(
      "[PFX RADAR]",
      error
    );

    const isTimeout =
      error?.name ===
      "AbortError";

    return res
      .status(
        isTimeout ? 504 : 502
      )
      .json({
        ok: false,

        version: VERSION,

        error:
          isTimeout
            ? "DexScreener n'a pas répondu dans le délai prévu."
            : "Impossible de récupérer les données Radar.",

        details:
          process.env.NODE_ENV ===
          "development"
            ? error?.message
            : undefined,
      });
  }
}
