const SUPABASE_URL = process.env.SUPABASE_URL;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const ALERT_EMAIL_TO = process.env.PFX_ALERTS_EMAIL_TO;
const ALERT_EMAIL_FROM = "PFX Alerts <onboarding@resend.dev>";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const MONITOR_SECRET = process.env.PFX_ALERTS_MONITOR_SECRET;

const TABLE_NAME = "pfx_alerts";
const DEXSCREENER_BASE = "https://api.dexscreener.com";

const VERSION = "1.0.0";
const REQUEST_TIMEOUT = 10000;
const MAX_TOKENS_PER_REQUEST = 30;
const MAX_ALERTS_PER_RUN = 200;

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

function send(res, status, data) {
  return res.status(status).json(data);
}

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

function cleanText(value, maxLength = 500) {
  if (typeof value !== "string") return "";

  return value.trim().slice(0, maxLength);
}

async function fetchWithTimeout(
  url,
  options = {},
  timeout = REQUEST_TIMEOUT
) {
  const controller = new AbortController();

  const timer = setTimeout(() => {
    controller.abort();
  }, timeout);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function supabaseRequest(
  path,
  options = {}
) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error(
      "Variables Supabase absentes dans l'environnement Vercel."
    );
  }

  const response = await fetchWithTimeout(
    `${SUPABASE_URL}/rest/v1/${TABLE_NAME}${path}`,
    {
      ...options,
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    }
  );

  const text = await response.text();

  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const message =
      data?.message ||
      data?.error ||
      data?.hint ||
      `Erreur Supabase HTTP ${response.status}`;

    throw new Error(message);
  }

  return data;
}

async function fetchJson(url) {
  const response = await fetchWithTimeout(
    url,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `DexScreener HTTP ${response.status}`
    );
  }

  return await response.json();
}

function chooseBestPair(
  pairs,
  tokenAddress
) {
  if (!Array.isArray(pairs)) {
    return null;
  }

  const matchingPairs = pairs.filter(
    (pair) => {
      if (pair?.chainId !== "solana") {
        return false;
      }

      const baseAddress =
        pair?.baseToken?.address || "";

      const quoteAddress =
        pair?.quoteToken?.address || "";

      return (
        baseAddress === tokenAddress ||
        quoteAddress === tokenAddress
      );
    }
  );

  if (matchingPairs.length === 0) {
    return null;
  }

  return [...matchingPairs].sort(
    (a, b) => {
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
    }
  )[0];
}

function extractMarketData(
  pair,
  tokenAddress
) {
  if (!pair) {
    return null;
  }

  const tokenIsBase =
    pair?.baseToken?.address ===
    tokenAddress;

  /*
   * DexScreener exprime normalement priceUsd
   * pour le base token.
   *
   * Les alertes PFX utilisent principalement
   * les tokens retournés comme base token.
   *
   * Si le token surveillé apparaît uniquement
   * comme quote token, on conserve les données
   * de marché disponibles mais on évite
   * d'utiliser un prix potentiellement associé
   * au mauvais côté de la paire.
   */
  const priceUsd = tokenIsBase
    ? toNumber(pair?.priceUsd)
    : null;

  const change24h = tokenIsBase
    ? toNumber(pair?.priceChange?.h24)
    : null;

  const symbol = tokenIsBase
    ? pair?.baseToken?.symbol || null
    : pair?.quoteToken?.symbol || null;

  return {
    priceUsd,

    change24h,

    liquidityUsd: toNumber(
      pair?.liquidity?.usd
    ),

    volume24hUsd: toNumber(
      pair?.volume?.h24
    ),

    dexId:
      pair?.dexId || null,

    symbol,

    pairAddress:
      pair?.pairAddress || null,
  };
}

async function loadTokenData(addresses) {
  const tokenMap = new Map();

  for (
    let index = 0;
    index < addresses.length;
    index += MAX_TOKENS_PER_REQUEST
  ) {
    const chunk = addresses.slice(
      index,
      index + MAX_TOKENS_PER_REQUEST
    );

    const url =
      `${DEXSCREENER_BASE}` +
      `/tokens/v1/solana/` +
      chunk
        .map((address) =>
          encodeURIComponent(address)
        )
        .join(",");

    const result = await fetchJson(url);

    const pairs = Array.isArray(result)
      ? result
      : [];

    for (const address of chunk) {
      const pair = chooseBestPair(
        pairs,
        address
      );

      tokenMap.set(
        address,
        extractMarketData(
          pair,
          address
        )
      );
    }
  }

  return tokenMap;
}

function evaluateCondition(
  currentValue,
  condition,
  targetValue
) {
  if (
    currentValue === null ||
    !Number.isFinite(currentValue) ||
    !Number.isFinite(targetValue)
  ) {
    return false;
  }

  if (condition === "above") {
    return currentValue > targetValue;
  }

  if (condition === "below") {
    return currentValue < targetValue;
  }

  return false;
}

function normalizeStoredAlert(row) {
  if (!row || typeof row !== "object") {
    return null;
  }

  const tokenAddress = cleanText(
    row.token_address,
    300
  );

  const chainId = cleanText(
    row.chain_id || "solana",
    50
  ).toLowerCase();

  const metric = cleanText(
    row.metric,
    100
  );

  const condition = cleanText(
    row.condition,
    50
  ).toLowerCase();

  const targetValue =
    toNumber(row.target_value);

  if (
    !row.id ||
    !tokenAddress ||
    chainId !== "solana" ||
    !SUPPORTED_METRICS.has(metric) ||
    !SUPPORTED_CONDITIONS.has(
      condition
    ) ||
    targetValue === null
  ) {
    return null;
  }

  return {
    databaseId: row.id,
    clientId: cleanText(
      row.client_id,
      300
    ),
    alertId: cleanText(
      row.alert_id,
      300
    ),
    chainId,
    tokenAddress,
    metric,
    condition,
    targetValue,
    enabled: row.enabled !== false,
    previousStatus:
      cleanText(row.status, 100) ||
      "pending",
    previousTriggerCount:
      Number.isInteger(
        Number(row.trigger_count)
      )
        ? Math.max(
            0,
            Number(row.trigger_count)
          )
        : 0,
  };
}

async function loadActiveAlerts() {
  const rows = await supabaseRequest(
    `?enabled=eq.true` +
      `&chain_id=eq.solana` +
      `&select=*` +
      `&order=created_at.asc` +
      `&limit=${MAX_ALERTS_PER_RUN}`,
    {
      method: "GET",
    }
  );

  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .map(normalizeStoredAlert)
    .filter(Boolean);
}

async function updateAlert(
  alert,
  update
) {
  const rows = await supabaseRequest(
    `?id=eq.${encodeURIComponent(
      alert.databaseId
    )}`,
    {
      method: "PATCH",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify(update),
    }
  );

  return Array.isArray(rows)
    ? rows[0] || null
    : rows;
}

function buildEvaluation(
  alert,
  marketData,
  checkedAt
) {
  if (!marketData) {
    return {
      status: "no_market_data",
      currentValue: null,
      tokenSymbol: null,
      dexId: null,
      checkedAt,
      newlyTriggered: false,
      triggeredNow: false,
    };
  }

  const currentValue = toNumber(
    marketData[alert.metric]
  );

  if (currentValue === null) {
    return {
      status: "metric_unavailable",
      currentValue: null,
      tokenSymbol:
        marketData.symbol || null,
      dexId:
        marketData.dexId || null,
      checkedAt,
      newlyTriggered: false,
      triggeredNow: false,
    };
  }

  const triggeredNow =
    evaluateCondition(
      currentValue,
      alert.condition,
      alert.targetValue
    );

  /*
   * Une nouvelle occurrence n'est comptée
   * que lors du passage :
   *
   * watching -> triggered
   *
   * Si la condition reste vraie pendant
   * plusieurs exécutions Cron, trigger_count
   * n'augmente donc pas toutes les 5 minutes.
   */
  const newlyTriggered =
    triggeredNow &&
    alert.previousStatus !==
      "triggered";

  return {
    status: triggeredNow
      ? "triggered"
      : "watching",

    currentValue,

    tokenSymbol:
      marketData.symbol || null,

    dexId:
      marketData.dexId || null,

    checkedAt,

    newlyTriggered,

    triggeredNow,
  };
}

function buildDatabaseUpdate(
  alert,
  evaluation
) {
  const update = {
    status: evaluation.status,

    current_value:
      evaluation.currentValue,

    token_symbol:
      evaluation.tokenSymbol,

    dex_id:
      evaluation.dexId,

    last_checked_at:
      evaluation.checkedAt,

    updated_at:
      evaluation.checkedAt,
  };

  if (evaluation.newlyTriggered) {
    update.last_triggered_at =
      evaluation.checkedAt;

    update.trigger_count =
      alert.previousTriggerCount + 1;
  }

  return update;
}
function getMetricLabel(metric) {
  const labels = {
    priceUsd: "Prix",
    change24h: "Variation 24 h",
    liquidityUsd: "Liquidité",
    volume24hUsd: "Volume 24 h",
  };

  return labels[metric] || metric;
}

function getConditionLabel(condition) {
  return condition === "above"
    ? "supérieur à"
    : "inférieur à";
}

function formatAlertValue(metric, value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "Indisponible";
  }

  if (metric === "change24h") {
    return `${number.toLocaleString("fr-FR", {
      maximumFractionDigits: 4,
    })} %`;
  }

  if (
    metric === "priceUsd" ||
    metric === "liquidityUsd" ||
    metric === "volume24hUsd"
  ) {
    return `${number.toLocaleString("fr-FR", {
      maximumFractionDigits: 10,
    })} $`;
  }

  return number.toLocaleString("fr-FR");
}

async function sendAlertEmail(
  alert,
  evaluation
) {
   if (!RESEND_API_KEY) {
    throw new Error(
      "RESEND_API_KEY n'est pas configurée."
    );
  }

  if (!ALERT_EMAIL_TO) {
    throw new Error(
      "PFX_ALERTS_EMAIL_TO n'est pas configurée."
    );
  }

  const symbol =
    evaluation.tokenSymbol ||
    "Token Solana";

  const metricLabel =
    getMetricLabel(alert.metric);

  const conditionLabel =
    getConditionLabel(
      alert.condition
    );

  const currentValue =
    formatAlertValue(
      alert.metric,
      evaluation.currentValue
    );

  const targetValue =
    formatAlertValue(
      alert.metric,
      alert.targetValue
    );

  const subject =
    `🚨 PFX Alert — ${symbol} — ${metricLabel}`;

  const html = `
    <div style="font-family:Arial,sans-serif;background:#07110d;color:#f5f7f6;padding:28px;">
      <div style="max-width:620px;margin:auto;background:#0d1813;border:1px solid #21f28b;border-radius:14px;padding:28px;">
        <div style="font-size:13px;color:#21f28b;font-weight:700;letter-spacing:1px;">
          PROFITX AI • PFX ALERTS
        </div>

        <h1 style="font-size:24px;margin:14px 0 8px;">
          🚨 Alerte déclenchée
        </h1>

        <p style="color:#b9c5bf;">
          Une condition surveillée par PFX Alerts vient d'être atteinte.
        </p>

        <div style="background:#07110d;border-radius:10px;padding:18px;margin:22px 0;">
          <p><strong>Token :</strong> ${symbol}</p>
          <p><strong>Métrique :</strong> ${metricLabel}</p>
          <p><strong>Condition :</strong> ${conditionLabel}</p>
          <p><strong>Seuil :</strong> ${targetValue}</p>
          <p><strong>Valeur actuelle :</strong> ${currentValue}</p>
          <p><strong>DEX :</strong> ${evaluation.dexId || "Indisponible"}</p>
        </div>

        <p style="font-size:12px;color:#87958e;word-break:break-all;">
          Adresse du token : ${alert.tokenAddress}
        </p>

        <p style="font-size:12px;color:#87958e;">
          Contrôle automatique PROFITX AI — PFX Alerts.
        </p>
      </div>
    </div>
  `;

  const response =
    await fetchWithTimeout(
      "https://api.resend.com/emails",
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${RESEND_API_KEY}`,
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          from: ALERT_EMAIL_FROM,
          to: [ALERT_EMAIL_TO],
          subject,
          html,
        }),
      }
    );

  const text =
    await response.text();

  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
        `Resend HTTP ${response.status}`
    );
  }

  return data;
}
function isAuthorized(req) {
  /*
   * Tant que le secret n'est pas encore
   * configuré dans Vercel, aucun appel
   * automatique n'est autorisé.
   */
  if (!MONITOR_SECRET) {
    return false;
  }

  const authorization =
    typeof req.headers.authorization ===
    "string"
      ? req.headers.authorization.trim()
      : "";

  const xMonitorSecret =
    typeof req.headers[
      "x-pfx-monitor-secret"
    ] === "string"
      ? req.headers[
          "x-pfx-monitor-secret"
        ].trim()
      : "";

  return (
    authorization ===
      `Bearer ${MONITOR_SECRET}` ||
    xMonitorSecret === MONITOR_SECRET
  );
}

export default async function handler(
  req,
  res
) {
  res.setHeader(
    "Cache-Control",
    "no-store, max-age=0"
  );

  /*
   * GET sert uniquement de contrôle
   * de santé. Il ne lance aucune alerte.
   */
  if (req.method === "GET") {
    return send(res, 200, {
      ok: true,
      service:
        "PFX Alerts Automatic Monitor",
      version: VERSION,
      status: "online",
      automaticMonitoring: true,
      configured: Boolean(
        SUPABASE_URL &&
          SUPABASE_KEY &&
          MONITOR_SECRET
      ),
      timestamp:
        new Date().toISOString(),
    });
  }

  if (req.method !== "POST") {
    res.setHeader(
      "Allow",
      "GET, POST"
    );

    return send(res, 405, {
      ok: false,
      error: "METHOD_NOT_ALLOWED",
      message:
        `Méthode ${req.method} non autorisée.`,
    });
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return send(res, 500, {
      ok: false,
      error:
        "SUPABASE_NOT_CONFIGURED",
      message:
        "La connexion Supabase n'est pas configurée.",
    });
  }

  if (!MONITOR_SECRET) {
    return send(res, 503, {
      ok: false,
      error:
        "MONITOR_SECRET_NOT_CONFIGURED",
      message:
        "Le secret du moteur automatique PFX Alerts n'est pas configuré.",
    });
  }

  if (!isAuthorized(req)) {
    return send(res, 401, {
      ok: false,
      error: "UNAUTHORIZED",
      message:
        "Appel du moteur automatique non autorisé.",
    });
  }

  const startedAt = Date.now();
  const checkedAt =
    new Date().toISOString();

  try {
    const alerts =
      await loadActiveAlerts();

    if (alerts.length === 0) {
      return send(res, 200, {
        ok: true,
        service:
          "PFX Alerts Automatic Monitor",
        version: VERSION,
        summary: {
          activeAlerts: 0,
          checked: 0,
          triggered: 0,
          newlyTriggered: 0,
          watching: 0,
          unavailable: 0,
          errors: 0,
        },
        results: [],
        checkedAt,
        durationMs:
          Date.now() - startedAt,
      });
    }

    const addresses = [
      ...new Set(
        alerts.map(
          (alert) =>
            alert.tokenAddress
        )
      ),
    ];

    const tokenData =
      await loadTokenData(
        addresses
      );

    const results = [];

    for (const alert of alerts) {
      try {
        const marketData =
          tokenData.get(
            alert.tokenAddress
          ) || null;

        const evaluation =
          buildEvaluation(
            alert,
            marketData,
            checkedAt
          );

        const update =
          buildDatabaseUpdate(
            alert,
            evaluation
          );

       await updateAlert(
  alert,
  update
);

let notificationSent = false;
let notificationError = null;

if (evaluation.newlyTriggered) {
  try {
    await sendAlertEmail(
      alert,
      evaluation
    );

    notificationSent = true;

    await updateAlert(
      alert,
      {
        last_notification_at:
          checkedAt,
        updated_at:
          checkedAt,
      }
    );
  } catch (emailError) {
    notificationError =
      emailError?.message ||
      "Erreur d'envoi de l'e-mail.";

    console.error(
      "PFX Alerts email error:",
      alert.alertId,
      emailError
    );
  }
}

results.push({
          id: alert.alertId,
          clientId: alert.clientId,
          tokenAddress:
            alert.tokenAddress,
          metric: alert.metric,
          condition:
            alert.condition,
          targetValue:
            alert.targetValue,
          status:
            evaluation.status,
          currentValue:
            evaluation.currentValue,
          symbol:
            evaluation.tokenSymbol,
          dexId:
            evaluation.dexId,
          triggered:
            evaluation.triggeredNow,
          newlyTriggered:
            evaluation.newlyTriggered,
        notificationSent,
notificationError,});
      } catch (error) {
        console.error(
          "PFX Alerts Monitor alert error:",
          alert.alertId,
          error
        );

        try {
          await updateAlert(
            alert,
            {
              status: "error",
              last_checked_at:
                checkedAt,
              updated_at:
                checkedAt,
            }
          );
        } catch (
          updateError
        ) {
          console.error(
            "PFX Alerts Monitor database error:",
            alert.alertId,
            updateError
          );
        }

        results.push({
          id: alert.alertId,
          tokenAddress:
            alert.tokenAddress,
          status: "error",
          triggered: false,
          newlyTriggered: false,
          error:
            error?.message ||
            "Erreur inconnue.",
        });
      }
    }

    const summary = {
      activeAlerts:
        alerts.length,

      checked:
        results.length,

      triggered:
        results.filter(
          (result) =>
            result.triggered
        ).length,

      newlyTriggered:
        results.filter(
          (result) =>
            result.newlyTriggered
        ).length,

      watching:
        results.filter(
          (result) =>
            result.status ===
            "watching"
        ).length,

      unavailable:
        results.filter(
          (result) =>
            result.status ===
              "no_market_data" ||
            result.status ===
              "metric_unavailable"
        ).length,

      errors:
        results.filter(
          (result) =>
            result.status ===
            "error"
        ).length,
    };

    return send(res, 200, {
      ok: true,
      service:
        "PFX Alerts Automatic Monitor",
      version: VERSION,
      summary,
      results,
      checkedAt,
      durationMs:
        Date.now() - startedAt,
    });
  } catch (error) {
    const timeout =
      error?.name ===
      "AbortError";

    console.error(
      "PFX Alerts Automatic Monitor:",
      error
    );

    return send(
      res,
      timeout ? 504 : 500,
      {
        ok: false,
        error: timeout
          ? "UPSTREAM_TIMEOUT"
          : "MONITOR_ERROR",
        message: timeout
          ? "Un service externe a dépassé le délai de réponse."
          : error?.message ||
            "Le moteur automatique PFX Alerts a rencontré une erreur.",
        checkedAt,
        durationMs:
          Date.now() -
          startedAt,
      }
    );
  }
}
