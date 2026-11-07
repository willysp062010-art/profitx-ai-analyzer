
import crypto from "node:crypto";

const TABLE = "pfx_radar_tokens";
const MAX_EVENTS = 100;

function secureEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") {
    return false;
  }

  const left = crypto.createHash("sha256").update(a).digest();
  const right = crypto.createHash("sha256").update(b).digest();

  return crypto.timingSafeEqual(left, right);
}

function validAddress(value) {
  return (
    typeof value === "string" &&
    value.length >= 32 &&
    value.length <= 44 &&
    /^[1-9A-HJ-NP-Za-km-z]+$/.test(value)
  );
}

function cleanText(value, max = 200) {
  if (typeof value !== "string") return null;
  return value.trim().slice(0, max) || null;
}

function timestampToISO(value) {
  if (!Number.isFinite(value) || value <= 0) return null;

  const date = new Date(value * 1000);
  return Number.isNaN(date.getTime())
    ? null
    : date.toISOString();
}

function extractMint(event) {
  const candidates = [];

  const tokenMint = event?.events?.tokenMint;

  if (tokenMint && typeof tokenMint === "object") {
    candidates.push(tokenMint.mint);
    candidates.push(tokenMint.tokenMint);
  }

  const tokenTransfers = Array.isArray(event?.tokenTransfers)
    ? event.tokenTransfers
    : [];

  for (const transfer of tokenTransfers) {
    if (transfer && typeof transfer === "object") {
      candidates.push(transfer.mint);
    }
  }

  const unique = [
    ...new Set(candidates.filter(validAddress))
  ];

  // Never guess between multiple token addresses.
  return unique.length === 1 ? unique[0] : null;
}

function parseEvent(event) {
  if (!event || typeof event !== "object") {
    return null;
  }

  if (event.transactionError != null) {
    return null;
  }

  const type = cleanText(event.type, 80)?.toUpperCase();
  const source = cleanText(event.source, 80)?.toUpperCase();

  // Only Pump.fun creation events.
  if (type !== "CREATE" || source !== "PUMP_FUN") {
    return null;
  }

  const mint = extractMint(event);

  if (!mint) {
    return null;
  }

  const now = new Date().toISOString();

  return {
    chain_id: "solana",
    mint,
    source: "helius",
    launch_platform: "pump.fun",
    creator_address: validAddress(event.feePayer)
      ? event.feePayer
      : null,
    creation_signature: cleanText(event.signature, 150),
    detected_at: now,
    created_onchain_at: timestampToISO(event.timestamp),
    last_seen_at: now,
    analysis_status: "pending",
    metadata: {
      helius_type: type,
      helius_source: source,
      slot: Number.isSafeInteger(event.slot)
        ? event.slot
        : null,
      classification: "pump_create_candidate",
      verified_creation: false,
      note:
        "Pump.fun CREATE candidate. Initial token creation must be independently verified."
    }
  };
}

async function saveToken(token, url, key) {
  const endpoint =
    `${url}/rest/v1/${TABLE}?on_conflict=chain_id,mint`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=ignore-duplicates,return=minimal"
    },
    body: JSON.stringify(token),
    signal: AbortSignal.timeout(8000)
  });

  if (!response.ok) {
    throw new Error(`Supabase HTTP ${response.status}`);
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Allow", "POST");

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  const expectedSecret = process.env.HELIUS_WEBHOOK_SECRET;
  const supabaseUrl = process.env.SUPABASE_URL;

  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY;

  if (!expectedSecret || !supabaseUrl || !supabaseKey) {
    return res.status(503).json({
      error: "Webhook configuration incomplete"
    });
  }

  const receivedSecret = req.headers.authorization;

  if (!secureEqual(receivedSecret, expectedSecret)) {
    return res.status(401).json({
      error: "Unauthorized"
    });
  }

  if (!Array.isArray(req.body)) {
    return res.status(400).json({
      error: "Expected an array of Helius events"
    });
  }

  if (req.body.length > MAX_EVENTS) {
    return res.status(413).json({
      error: "Too many events"
    });
  }

  const tokens = new Map();

  for (const event of req.body) {
    const token = parseEvent(event);

    if (token) {
      tokens.set(token.mint, token);
    }
  }

  let processed = 0;

  try {
    for (const token of tokens.values()) {
      await saveToken(
        token,
        supabaseUrl.replace(/\/$/, ""),
        supabaseKey
      );

      processed++;
    }

    return res.status(200).json({
      ok: true,
      received: req.body.length,
      accepted: tokens.size,
      processed
    });
  } catch (error) {
    console.error(
      "PFX Radar webhook database error:",
      error.message
    );

    return res.status(500).json({
      error: "Database write failed"
    });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "1mb"
    }
  }
};
