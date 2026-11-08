
import crypto from "node:crypto";

const TABLE = "pfx_radar_tokens";
const BATCH_SIZE = 40;
const CANDIDATE_LIMIT = 150;
const UPDATE_CONCURRENCY = 8;
const RETRY_DELAY_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const TIMEOUT_MS = 8000;

function validAddress(value) {
  return (
    typeof value === "string" &&
    value.length >= 32 &&
    value.length <= 44 &&
    /^[1-9A-HJ-NP-Za-km-z]+$/.test(value)
  );
}

function cleanText(value, max = 200) {
  return typeof value === "string"
    ? value.trim().slice(0, max) || null
    : null;
}

function secureEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") {
    return false;
  }

  const left = crypto.createHash("sha256").update(a).digest();
  const right = crypto.createHash("sha256").update(b).digest();

  return crypto.timingSafeEqual(left, right);
}

async function supabaseRequest(url, key, path, options = {}) {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Supabase HTTP ${response.status}: ${detail.slice(0, 200)}`
    );
  }

  if (response.status === 204) return null;

  const body = await response.text();
  return body ? JSON.parse(body) : null;
}

async function getPendingTokens(url, key, now) {
  async function getCandidates(status, direction, limit) {
    const params = new URLSearchParams({
      select: "id,mint,metadata,name,symbol,analysis_status,detected_at",
      chain_id: "eq.solana",
      analysis_status: "eq." + status,
      order: "detected_at." + direction + ",id." + direction,
      limit: String(limit)
    });
    return supabaseRequest(url, key, TABLE + "?" + params);
  }
  const [oldest, newest, retries] = await Promise.all([
    getCandidates("pending", "asc", CANDIDATE_LIMIT),
    getCandidates("pending", "desc", CANDIDATE_LIMIT),
    getCandidates("metadata_missing", "asc", 50)
  ]);
  const selected = new Map();
  function pick(items, max) {
    let count = 0;
    for (const token of items || []) {
      if (count >= max) break;
      if (selected.has(token.id) || !eligibleForEnrichment(token, now)) continue;
      selected.set(token.id, token);
      count++;
    }
  }
  pick(oldest, 18);
  pick(newest, 18);
  pick(retries, 4);
  if (selected.size < BATCH_SIZE) pick([...(oldest || []), ...(newest || []), ...(retries || [])], BATCH_SIZE - selected.size);
  return [...selected.values()];
}

function eligibleForEnrichment(token, now) {
  if (!validAddress(token.mint)) return false;

  const metadata = token.metadata &&
    typeof token.metadata === "object" && !Array.isArray(token.metadata)
      ? token.metadata : {};
  const attempts = Number(metadata.enrichment_attempts) || 0;
  if (attempts >= MAX_ATTEMPTS) return false;

  const lastCheckedAt = Date.parse(metadata.enrichment_checked_at);
  if (Number.isFinite(lastCheckedAt) && now - lastCheckedAt < RETRY_DELAY_MS) {
    return false;
  }
  return true;
}

async function getHeliusAssets(mints, apiKey) {
  const response = await fetch(
    `https://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "pfx-radar-enrich",
        method: "getAssetBatch",
        params: {
          ids: mints,
          options: {
            showFungible: true
          }
        }
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    }
  );

  if (!response.ok) {
    throw new Error(`Helius HTTP ${response.status}`);
  }

  const payload = await response.json();

  if (payload.error) {
    throw new Error(
      `Helius RPC: ${payload.error.message || "Unknown error"}`
    );
  }

  if (!Array.isArray(payload.result)) {
    throw new Error("Invalid Helius asset response");
  }

  return payload.result;
}

function extractIdentity(asset) {
  if (!asset || typeof asset !== "object") return null;

  const name = cleanText(asset.content?.metadata?.name);
  const symbol = cleanText(asset.content?.metadata?.symbol, 40);

  if (!name && !symbol) return null;

  return { name, symbol };
}

async function updateToken(url, key, id, data) {
  await supabaseRequest(
    url,
    key,
    `${TABLE}?id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: {
        Prefer: "return=minimal"
      },
      body: JSON.stringify(data)
    }
  );
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Allow", "GET, POST");

  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY;
  const heliusKey = process.env.HELIUS_API_KEY;
  const manualSecret = process.env.RADAR_ENRICH_SECRET;
  const cronSecret = process.env.CRON_SECRET;

  if (!supabaseUrl || !supabaseKey || !heliusKey) {
    return res.status(503).json({
      error: "Radar enrichment configuration incomplete"
    });
  }

  const authorization = req.headers.authorization;

  const authorizedManual =
    req.method === "POST" &&
    Boolean(manualSecret) &&
    secureEqual(authorization, `Bearer ${manualSecret}`);

  const authorizedCron =
    req.method === "GET" &&
    Boolean(cronSecret) &&
    secureEqual(authorization, `Bearer ${cronSecret}`);

  if (!authorizedManual && !authorizedCron) {
    return res.status(401).json({
      error: "Unauthorized"
    });
  }

  try {
    const now = Date.now();
    const tokens = await getPendingTokens(supabaseUrl, supabaseKey, now);

    if (!tokens.length) {
      return res.status(200).json({
        ok: true,
        checked: 0,
        enriched: 0,
        missing: 0,
        message: "No pending tokens"
      });
    }

    const assets = await getHeliusAssets(
      tokens.map((token) => token.mint),
      heliusKey
    );

    const byMint = new Map(
      assets
        .filter((asset) => validAddress(asset?.id))
        .map((asset) => [asset.id, asset])
    );

    let enriched = 0;
    let missing = 0;
    for (let i = 0; i < tokens.length; i += UPDATE_CONCURRENCY) {
      const chunk = tokens.slice(i, i + UPDATE_CONCURRENCY);
      const outcomes = await Promise.all(chunk.map(async token => {
        const asset = byMint.get(token.mint);
        const identity = extractIdentity(asset);
        const existingMetadata = token.metadata &&
          typeof token.metadata === "object" && !Array.isArray(token.metadata)
            ? token.metadata : {};
        const metadata = {
          ...existingMetadata,
          enrichment_source: "helius_das",
          enrichment_checked_at: new Date().toISOString(),
          enrichment_attempts: (Number(existingMetadata.enrichment_attempts) || 0) + 1
        };
        const name = identity?.name || (token.name !== "Token inconnu" ? token.name : null) || null;
        const symbol = identity?.symbol || (token.symbol !== "N/D" ? token.symbol : null) || null;
        const complete = Boolean(name && symbol);
        const patch = {
          analysis_status: complete ? "enriched" : "metadata_missing",
          metadata: {
            ...metadata,
            enrichment_result: complete ? "success" : "metadata_missing",
            ...(complete ? {enriched_at: new Date().toISOString()} : {})
          }
        };
        if (name) patch.name = name;
        if (symbol) patch.symbol = symbol;
        await updateToken(supabaseUrl, supabaseKey, token.id, patch);
        return complete;
      }));
      enriched += outcomes.filter(Boolean).length;
      missing += outcomes.filter(value => !value).length;
    }

    return res.status(200).json({
      ok: true,
      checked: tokens.length,
      enriched,
      missing
    });
  } catch (error) {
    console.error(
      "PFX Radar enrichment failed:",
      error.message
    );

    return res.status(500).json({
      error: "Radar enrichment failed"
    });
  }
}
