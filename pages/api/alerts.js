const DEXSCREENER_BASE =
  "https://api.dexscreener.com";

const VERSION = "1.0.0";
const REQUEST_TIMEOUT = 10000;
const MAX_ALERTS = 50;
const MAX_TOKENS_PER_REQUEST = 30;

const SUPPORTED_METRICS = new Set([
  "priceUsd",
  "change24h",
  "liquidityUsd",
  "volume24hUsd",
]);

const SUPPORTED_CONDITIONS = new Set([
  "above",
  "below",
]);

function toNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function normalizeAddress(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function normalizeAlert(alert, index) {
  if (!alert || typeof alert !== "object") {
    return null;
  }

  const tokenAddress = normalizeAddress(
    alert.tokenAddress
  );

  const chainId =
    typeof alert.chainId === "string"
      ? alert.chainId.trim().toLowerCase()
      : "solana";

  const metric =
    typeof alert.metric === "string"
      ? alert.metric.trim()
      : "";

  const condition =
    typeof alert.condition === "string"
      ? alert.condition.trim()
      : "";

  const targetValue = toNumber(
    alert.targetValue
  );

  if (
    !tokenAddress ||
    chainId !== "solana" ||
    !SUPPORTED_METRICS.has(metric) ||
    !SUPPORTED_CONDITIONS.has(condition) ||
    targetValue === null
  ) {
    return null;
  }

  return {
    id:
      typeof alert.id === "string" &&
      alert.id.trim()
        ? alert.id.trim()
        : `alert-${index}`,
    chainId,
    tokenAddress,
    metric,
    condition,
    targetValue,
    enabled: alert.enabled !== false,
  };
}

async function fetchJson(
  url,
  timeout = REQUEST_TIMEOUT
) {
  const controller =
    new AbortController();

  const timer = setTimeout(() => {
    controller.abort();
  }, timeout);

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
    clearTimeout(timer);
  }
}

function chooseBestPair(
  pairs,
  tokenAddress
) {
  if (!Array.isArray(pairs)) {
    return null;
  }

  const matchingPairs = pairs.filter(
    (pair) =>
      pair?.chainId === "solana" &&
      pair?.baseToken?.address ===
        tokenAddress
  );

  if (matchingPairs.length === 0) {
    return null;
  }

  return matchingPairs.sort((a, b) => {
    const liquidityA =
      toNumber(a?.liquidity?.usd) || 0;

    const liquidityB =
      toNumber(b?.liquidity?.usd) || 0;

    if (liquidityB !== liquidityA) {
      return liquidityB - liquidityA;
    }

    const volumeA =
      toNumber(a?.volume?.h24) || 0;

    const volumeB =
      toNumber(b?.volume?.h24) || 0;

    return volumeB - volumeA;
  })[0];
}

function extractMarketData(pair) {
  if (!pair) {
    return null;
  }

  return {
    priceUsd: toNumber(
      pair.priceUsd
    ),

    change24h: toNumber(
      pair?.priceChange?.h24
    ),

    liquidityUsd: toNumber(
      pair?.liquidity?.usd
    ),

    volume24hUsd: toNumber(
      pair?.volume?.h24
    ),

    pairAddress:
      pair?.pairAddress || null,

    dexId:
      pair?.dexId || null,

    symbol:
      pair?.baseToken?.symbol ||
      null,

    name:
      pair?.baseToken?.name ||
      null,
  };
}

function evaluateCondition(
  currentValue,
  condition,
  targetValue
) {
  if (
    currentValue === null ||
    !Number.isFinite(currentValue)
  ) {
    return false;
  }

  if (condition === "above") {
    return currentValue >
      targetValue;
  }

  if (condition === "below") {
    return currentValue <
      targetValue;
  }

  return false;
}

async function loadTokenData(
  addresses
) {
  const tokenMap = new Map();

  for (
    let index = 0;
    index < addresses.length;
    index += MAX_TOKENS_PER_REQUEST
  ) {
    const chunk = addresses.slice(
      index,
      index +
        MAX_TOKENS_PER_REQUEST
    );

    const url =
      `${DEXSCREENER_BASE}` +
      `/tokens/v1/solana/` +
      chunk.join(",");

    const result =
      await fetchJson(url);

    const pairs = Array.isArray(result)
      ? result
      : [];

    for (const address of chunk) {
      const bestPair =
        chooseBestPair(
          pairs,
          address
        );

      tokenMap.set(
        address,
        extractMarketData(
          bestPair
        )
      );
    }
  }

  return tokenMap;
}

function buildResult(
  alert,
  marketData
) {
  if (!alert.enabled) {
    return {
      ...alert,
      status: "paused",
      triggered: false,
      currentValue: null,
      marketData: null,
    };
  }

  if (!marketData) {
    return {
      ...alert,
      status: "no_market_data",
      triggered: false,
      currentValue: null,
      marketData: null,
    };
  }

  const currentValue =
    toNumber(
      marketData[
        alert.metric
      ]
    );

  if (currentValue === null) {
    return {
      ...alert,
      status: "metric_unavailable",
      triggered: false,
      currentValue: null,
      marketData,
    };
  }

  const triggered =
    evaluateCondition(
      currentValue,
      alert.condition,
      alert.targetValue
    );

  return {
    ...alert,
    status: triggered
      ? "triggered"
      : "watching",
    triggered,
    currentValue,
    marketData,
  };
}

export default async function handler(
  req,
  res
) {
  res.setHeader(
    "Cache-Control",
    "no-store, max-age=0"
  );

  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      service:
        "PFX Alert Engine",
      version: VERSION,
      status: "online",
      supportedChains: [
        "solana",
      ],
      supportedMetrics: [
        "priceUsd",
        "change24h",
        "liquidityUsd",
        "volume24hUsd",
      ],
      supportedConditions: [
        "above",
        "below",
      ],
      persistence: false,
      automaticMonitoring: false,
      timestamp:
        new Date().toISOString(),
    });
  }

  if (req.method !== "POST") {
    res.setHeader(
      "Allow",
      "GET, POST"
    );

    return res.status(405).json({
      ok: false,
      error:
        "Méthode non autorisée.",
    });
  }

  try {
    const rawAlerts =
      Array.isArray(req.body)
        ? req.body
        : Array.isArray(
            req.body?.alerts
          )
        ? req.body.alerts
        : [];

    if (rawAlerts.length === 0) {
      return res.status(400).json({
        ok: false,
        error:
          "Aucune alerte à vérifier.",
      });
    }

    if (
      rawAlerts.length >
      MAX_ALERTS
    ) {
      return res.status(400).json({
        ok: false,
        error:
          `Maximum ${MAX_ALERTS} alertes par requête.`,
      });
    }

    const alerts = rawAlerts
      .map(normalizeAlert)
      .filter(Boolean);

    if (alerts.length === 0) {
      return res.status(400).json({
        ok: false,
        error:
          "Aucune alerte valide.",
      });
    }

    const activeAlerts =
      alerts.filter(
        (alert) =>
          alert.enabled
      );

    const addresses = [
      ...new Set(
        activeAlerts.map(
          (alert) =>
            alert.tokenAddress
        )
      ),
    ];

    let tokenData =
      new Map();

    if (addresses.length > 0) {
      tokenData =
        await loadTokenData(
          addresses
        );
    }

    const results =
      alerts.map((alert) => {
        const marketData =
          alert.enabled
            ? tokenData.get(
                alert.tokenAddress
              ) || null
            : null;

        return buildResult(
          alert,
          marketData
        );
      });

    const triggered =
      results.filter(
        (result) =>
          result.triggered
      );

    const watching =
      results.filter(
        (result) =>
          result.status ===
          "watching"
      );

    const paused =
      results.filter(
        (result) =>
          result.status ===
          "paused"
      );

    const unavailable =
      results.filter(
        (result) =>
          result.status ===
            "no_market_data" ||
          result.status ===
            "metric_unavailable"
      );

    return res.status(200).json({
      ok: true,
      service:
        "PFX Alert Engine",
      version: VERSION,

      summary: {
        received:
          rawAlerts.length,
        valid:
          alerts.length,
        triggered:
          triggered.length,
        watching:
          watching.length,
        paused:
          paused.length,
        unavailable:
          unavailable.length,
      },

      results,

      checkedAt:
        new Date().toISOString(),
    });
  } catch (error) {
    const timeout =
      error?.name ===
      "AbortError";

    console.error(
      "PFX Alert Engine:",
      error
    );

    return res
      .status(
        timeout ? 504 : 500
      )
      .json({
        ok: false,
        error: timeout
          ? "Le fournisseur de données a dépassé le délai de réponse."
          : "Le moteur PFX Alerts n'a pas pu effectuer la vérification.",
        checkedAt:
          new Date().toISOString(),
      });
  }
}
