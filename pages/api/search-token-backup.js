
const SEARCH_URL =
  "https://api.dexscreener.com/latest/dex/search";

const TOKEN_URL =
  "https://api.dexscreener.com/latest/dex/tokens";

const TIMEOUT_MS = 8000;
const MAX_RESULTS = 20;

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

    if (index < 0) {
      return false;
    }

    number =
      number * 58n + BigInt(index);
  }

  let bytes = 0;

  while (number > 0n) {
    bytes++;
    number >>= 8n;
  }

  const leadingZeros =
    value.match(/^1*/)?.[0].length || 0;

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

  const n = Number(value);

  return Number.isFinite(n) ? n : null;
}

async function fetchPairs(url) {
  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    TIMEOUT_MS
  );

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(
        `DexScreener HTTP ${response.status}`
      );
    }

    const body = await response.json();

    return Array.isArray(body?.pairs)
      ? body.pairs
      : [];
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

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
    query.length > 80
  ) {
    return res.status(400).json({
      ok: false,
      error:
        "Recherche de 2 à 80 caractères requise."
    });
  }

  try {
    const mintQuery = isMint(query);

    const url = mintQuery
      ? `${TOKEN_URL}/${encodeURIComponent(query)}`
      : `${SEARCH_URL}?q=${encodeURIComponent(query)}`;

    const pairs = await fetchPairs(url);

    const tokens = new Map();

    for (const pair of pairs) {
      if (pair?.chainId !== "solana") {
        continue;
      }

      for (const side of [
        "baseToken",
        "quoteToken"
      ]) {
        const token = pair?.[side];

        const mint = token?.address;

        if (!isMint(mint)) {
          continue;
        }

        if (
          mintQuery &&
          mint !== query
        ) {
          continue;
        }

        if (!mintQuery) {
          const q = query.toLowerCase();

          const name = String(
            token.name || ""
          ).toLowerCase();

          const symbol = String(
            token.symbol || ""
          ).toLowerCase();

          if (
            !name.includes(q) &&
            !symbol.includes(q)
          ) {
            continue;
          }
        }

        const liquidityUsd = numeric(
          pair?.liquidity?.usd
        );

        const volume24hUsd = numeric(
          pair?.volume?.h24
        );

        const previous = tokens.get(mint);

        if (
          !previous ||
          (liquidityUsd ?? -1) >
            (previous.liquidityUsd ?? -1)
        ) {
          tokens.set(mint, {
            mint,

            name: String(
              token.name || ""
            ),

            symbol: String(
              token.symbol || ""
            ),

            liquidityUsd,

            volume24hUsd,

            dexId:
              pair?.dexId || null,

            pairAddress:
              pair?.pairAddress || null,

            url:
              pair?.url || null,

            verified: false,

            verificationStatus:
              "UNVERIFIED"
          });
        }
      }
    }

    const results = [
      ...tokens.values()
    ]
      .sort(
        (a, b) =>
          (b.liquidityUsd ?? -1) -
          (a.liquidityUsd ?? -1)
      )
      .slice(0, MAX_RESULTS);

    return res.status(200).json({
      ok: true,

      chain: "solana",

      query,

      source: "dexscreener",

      count: results.length,

      results,

      note:
        "Les résultats ne prouvent pas l'authenticité d'un token. Vérifiez son adresse mint officielle."
    });
  } catch (error) {
    return res.status(502).json({
      ok: false,

      error:
        error?.name === "AbortError"
          ? "Recherche expirée, réessayez."
          : "Service de recherche temporairement indisponible."
    });
  }
}
