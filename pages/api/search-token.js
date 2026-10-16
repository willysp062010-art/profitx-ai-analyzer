
const SEARCH_URL = "https://api.dexscreener.com/latest/dex/search";
const TOKEN_URL = "https://api.dexscreener.com/latest/dex/tokens";
const PUMP_URL = "https://frontend-api-v3.pump.fun/coins";

const TIMEOUT_MS = 8000;
const MAX_RESULTS = 20;
const MAX_QUERY_LENGTH = 80;
const DIAGNOSTIC_VERSION = "PFX-SEARCH-20261016-V2";

const OFFICIAL_TOKENS = [
  {
    mint: "6FwDVfnnETqUe2UrxZEeLA6u7Vo5Td2Nm79z7s38pump",
    name: "PROFITX",
    symbol: "PFX"
  }
];

function isMint(value) {
  if (
    typeof value !== "string" ||
    !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)
  ) {
    return false;
  }

  const alphabet =
    "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

  let number = 0n;

  for (const char of value) {
    const index = alphabet.indexOf(char);

    if (index < 0) return false;

    number = number * 58n + BigInt(index);
  }

  let bytes = 0;

  while (number > 0n) {
    bytes++;
    number >>= 8n;
  }

  const leadingZeros = value.match(/^1*/)?.[0].length || 0;

  return bytes + leadingZeros === 32;
}

function numeric(value) {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value === "boolean"
  ) {
    return null;
  }

  const result = Number(value);

  return Number.isFinite(result) ? result : null;
}

async function fetchJSON(url) {
  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    TIMEOUT_MS
  );

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function isOfficial(mint) {
  return OFFICIAL_TOKENS.some(
    token => token.mint === mint
  );
}

function matchesQuery(token, query, mintQuery) {
  if (mintQuery) {
    return token.mint === query;
  }

  const search = query.toLowerCase();

  return (
    String(token.name || "")
      .toLowerCase()
      .includes(search) ||
    String(token.symbol || "")
      .toLowerCase()
      .includes(search)
  );
}

function addToken(tokens, token) {
  if (!isMint(token.mint)) return;

  const official = OFFICIAL_TOKENS.find(
    item => item.mint === token.mint
  );

  const candidate = {
    ...token,
    name: official?.name || token.name,
    symbol: official?.symbol || token.symbol,
    verified: Boolean(official),
    verificationStatus: official
      ? "OFFICIAL_PROJECT_MINT"
      : "UNVERIFIED"
  };

  const previous = tokens.get(token.mint);

  if (!previous) {
    tokens.set(token.mint, candidate);
    return;
  }

  const newLiquidity = candidate.liquidityUsd ?? -1;
  const oldLiquidity = previous.liquidityUsd ?? -1;

  if (newLiquidity > oldLiquidity) {
    tokens.set(token.mint, {
      ...previous,
      ...candidate
    });
  }
}

function errorMessage(result) {
  if (result.status !== "rejected") {
    return null;
  }

  const reason = result.reason;

  if (reason?.name === "AbortError") {
    return "Délai de réponse dépassé (8 secondes).";
  }

  return String(
    reason?.message ||
    reason?.name ||
    "Erreur inconnue"
  ).slice(0, 180);
}

export default async function handler(req, res) {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate"
  );

  res.setHeader("X-PROFITX-Search-Version", DIAGNOSTIC_VERSION);

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");

    return res.status(405).json({
      ok: false,
      error: "Méthode non autorisée."
    });
  }

  const raw = req.query?.q;

  if (typeof raw !== "string") {
    return res.status(400).json({
      ok: false,
      error: "Paramètre q requis."
    });
  }

  const query = raw.trim();

  if (
    query.length < 2 ||
    query.length > MAX_QUERY_LENGTH
  ) {
    return res.status(400).json({
      ok: false,
      error: "Recherche de 2 à 80 caractères requise."
    });
  }

  const mintQuery = isMint(query);

  const dexURL = mintQuery
    ? `${TOKEN_URL}/${encodeURIComponent(query)}`
    : `${SEARCH_URL}?q=${encodeURIComponent(query)}`;

  const pumpURL =
    `${PUMP_URL}?offset=0&limit=200` +
    "&sort=created_timestamp&order=DESC&includeNsfw=false";

  const [dexResponse, pumpResponse] =
    await Promise.allSettled([
      fetchJSON(dexURL),
      fetchJSON(pumpURL)
    ]);

  const dexAvailable =
    dexResponse.status === "fulfilled";

  const pumpAvailable =
    pumpResponse.status === "fulfilled" &&
    Array.isArray(pumpResponse.value);

  const dexError = errorMessage(dexResponse);

  const pumpError = pumpAvailable
    ? null
    : pumpResponse.status === "rejected"
      ? errorMessage(pumpResponse)
      : "Format de réponse Pump.fun inattendu.";

  if (dexError) {
    console.error("[PROFITX] DexScreener :", dexError);
  }

  if (pumpError) {
    console.error("[PROFITX] Pump.fun :", pumpError);
  }

  const tokens = new Map();

  // 1. Tokens officiels PROFITX
  for (const official of OFFICIAL_TOKENS) {
    if (matchesQuery(official, query, mintQuery)) {
      addToken(tokens, {
        ...official,
        liquidityUsd: null,
        volume24hUsd: null,
        dexId: null,
        pairAddress: null,
        url: null,
        source: "official"
      });
    }
  }

  // 2. Recherche DexScreener
  if (dexAvailable) {
    const pairs = Array.isArray(dexResponse.value?.pairs)
      ? dexResponse.value.pairs
      : [];

    for (const pair of pairs) {
      if (pair?.chainId !== "solana") continue;

      for (const side of ["baseToken", "quoteToken"]) {
        const token = pair?.[side];
        const mint = token?.address;

        if (!isMint(mint)) continue;

        const candidate = {
          mint,
          name: String(token?.name || ""),
          symbol: String(token?.symbol || "")
        };

        if (!matchesQuery(candidate, query, mintQuery)) {
          continue;
        }

        addToken(tokens, {
          ...candidate,
          liquidityUsd: numeric(pair?.liquidity?.usd),
          volume24hUsd: numeric(pair?.volume?.h24),
          dexId: pair?.dexId || null,
          pairAddress: pair?.pairAddress || null,
          url: pair?.url || null,
          source: "dexscreener"
        });
      }
    }
  }

  // 3. Recherche parmi les tokens récents Pump.fun
  if (pumpAvailable) {
    for (const coin of pumpResponse.value) {
      if (
        coin?.is_banned === true ||
        coin?.nsfw === true
      ) {
        continue;
      }

      const candidate = {
        mint: coin?.mint,
        name: String(coin?.name || ""),
        symbol: String(coin?.symbol || "")
      };

      if (!isMint(candidate.mint)) continue;

      if (!matchesQuery(candidate, query, mintQuery)) {
        continue;
      }

      addToken(tokens, {
        ...candidate,
        liquidityUsd: null,
        volume24hUsd: null,
        dexId: null,
        pairAddress: null,
        url: null,
        source: "pumpfun",
        bondingCurveComplete: coin?.complete === true,
        createdTimestamp: numeric(
          coin?.created_timestamp
        )
      });
    }
  }

  // 4. Priorité au mint officiel puis à la liquidité
  const results = [...tokens.values()]
    .sort((a, b) => {
      const officialDifference =
        Number(isOfficial(b.mint)) -
        Number(isOfficial(a.mint));

      if (officialDifference !== 0) {
        return officialDifference;
      }

      return (
        (b.liquidityUsd ?? -1) -
        (a.liquidityUsd ?? -1)
      );
    })
    .slice(0, MAX_RESULTS);

  if (
    !dexAvailable &&
    !pumpAvailable &&
    results.length === 0
  ) {
    return res.status(502).json({
      ok: false,
      diagnosticVersion: DIAGNOSTIC_VERSION,
      dexError,
      pumpError,
      error: "Services de recherche temporairement indisponibles."
    });
  }

  return res.status(200).json({
    ok: true,
    diagnosticVersion: DIAGNOSTIC_VERSION,
    chain: "solana",
    query,
    source: "dexscreener+pumpfun",
    sources: {
      dexscreener: dexAvailable,
      pumpfun: pumpAvailable
    },
    dexError,
    pumpError,
    count: results.length,
    results,
    note:
      "Le statut OFFICIAL_PROJECT_MINT identifie le mint déclaré par PROFITX, pas un audit indépendant. Les autres tokens restent non vérifiés."
  });
}
