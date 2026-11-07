
import crypto from "node:crypto";

const TABLE = "pfx_radar_tokens";
const BATCH_SIZE = 15;
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

async function getPendingTokens(url, key) {
  return supabaseRequest(
    url,
    key,
    `${TABLE}?select=id,mint,metadata,name,symbol` +
      `&analysis_status=eq.pending` +
      `&order=detected_at.asc` +
      `&limit=${BATCH_SIZE}`
  );
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
  if (!asset || typeof asset !== "object") {
    return null;
  }

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
  res.setHeader("Allow", "POST");

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY;
  const heliusKey = process.env.HELIUS_API_KEY;
  const expectedSecret = process.env.RADAR_ENRICH_SECRET;

  if (!supabaseUrl || !supabaseKey || !heliusKey || !expectedSecret) {
    return res.status(503).json({
      error: "Radar enrichment configuration incomplete"
    });
  }

  if (
    !secureEqual(
      req.headers.authorization,
      `Bearer ${expectedSecret}`
    )
  ) {
    return res.status(401).json({
      error: "Unauthorized"
    });
  }

  try {
    const pending = await getPendingTokens(
      supabaseUrl,
      supabaseKey
    );

    const tokens = (pending || []).filter(
      (token) => validAddress(token.mint)
    );

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

    for (const token of tokens) {
      const asset = byMint.get(token.mint);
      const identity = extractIdentity(asset);

      const metadata = {
        ...(token.metadata || {}),
        enrichment_source: "helius_das",
        enrichment_checked_at: new Date().toISOString()
      };

      if (!identity) {
        await updateToken(supabaseUrl, supabaseKey, token.id, {
          analysis_status: "metadata_missing",
          metadata: {
            ...metadata,
            enrichment_result: "metadata_missing"
          }
        });

        missing++;
        continue;
      }

      await updateToken(supabaseUrl, supabaseKey, token.id, {
        name: identity.name || token.name || null,
        symbol: identity.symbol || token.symbol || null,
        analysis_status: "enriched",
        metadata: {
          ...metadata,
          enrichment_result: "success",
          enriched_at: new Date().toISOString()
        }
      });

      enriched++;
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
