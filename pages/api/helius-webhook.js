
import crypto from "node:crypto";

const TABLE = "pfx_radar_tokens";
const MAX_EVENTS = 100;
const MAX_BODY_BYTES = 1024 * 1024;

function secureEqual(a, b) {
  if (!a || !b) return false;

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
  return typeof value === "string"
    ? value.trim().slice(0, max) || null
    : null;
}

function timestampToISO(value) {
  if (!Number.isFinite(value) || value <= 0) return null;

  const date = new Date(value * 1000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function extractMint(event) {
  const candidates = [];

  const tokenMint = event.events?.tokenMint;
  if (tokenMint && typeof tokenMint === "object") {
    candidates.push(tokenMint.mint, tokenMint.tokenMint);
  }

  if (Array.isArray(event.tokenTransfers)) {
    for (const transfer of event.tokenTransfers) {
      candidates.push(transfer?.mint);
    }
  }

  // On ne déduit jamais un mint depuis une adresse
  // quelconque présente dans les instructions.
  const unique = [...new Set(candidates.filter(validAddress))];

  // Plusieurs mints possibles : ne pas inventer lequel
  // correspond à la création.
  return unique.length === 1 ? unique[0] : null;
}

function parseEvent(event) {
  if (!event || typeof event !== "object") return null;
  if (event.transactionError != null) return null;

  // TOKEN_MINT ne garantit pas à lui seul qu'un
  // nouveau token Pump.fun vient d'être créé.
  if (event.type !== "TOKEN_MINT") return null;

  const mint = extractMint(event);
  if (!mint) return null;

  const source = cleanText(event.source, 80) || "UNKNOWN";
  const isPump = source.toUpperCase() === "PUMP_FUN";

  return {
    chain_id: "solana",
    mint,
    source: "helius",
    launch_platform: isPump ? "pump.fun" : null,
    creator_address: validAddress(event.feePayer)
      ? event.feePayer
      : null,
    creation_signature: cleanText(event.signature, 150),
    created_onchain_at: timestampToISO(event.timestamp),
    last_seen_at: new Date().toISOString(),
    analysis_status: "pending",
    metadata: {
      helius_type: event.type,
      helius_source: source,
      slot: Number.isSafeInteger(event.slot) ? event.slot : null,
      classification: "mint_event_unverified",
      note: "La création initiale du token reste à confirmer."
    }
  };
}

async function saveToken(token, url, key) {
  // L'unicité (chain_id, mint) empêche les doublons.
  // Ne pas écraser les analyses existantes.
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
    const detail = await response.text();
    throw new Error(
      `Supabase HTTP ${response.status}: ${detail.slice(0, 300)}`
    );
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Allow", "POST");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const expectedSecret = process.env.HELIUS_WEBHOOK_SECRET;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!expectedSecret || !supabaseUrl || !supabaseKey) {
    return res.status(503).json({
      error: "Webhook configuration incomplete"
    });
  }

  const receivedSecret = req.headers.authorization;

  if (
    typeof receivedSecret !== "string" ||
    !secureEqual(receivedSecret, expectedSecret)
  ) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const events = req.body;

  if (!Array.isArray(events)) {
    return res.status(400).json({
      error: "Expected an array of Helius events"
    });
  }

  if (events.length > MAX_EVENTS) {
    return res.status(413).json({ error: "Too many events" });
  }

  const tokens = new Map();

  for (const event of events) {
    const token = parseEvent(event);
    if (token) tokens.set(token.mint, token);
  }

  let saved = 0;

  try {
    for (const token of tokens.values()) {
      await saveToken(token, supabaseUrl.replace(/\/$/, ""), supabaseKey);
      saved++;
    }

    return res.status(200).json({
      ok: true,
      received: events.length,
      accepted: tokens.size,
      processed: saved
    });
  } catch (error) {
    console.error("Helius webhook processing failed:", error.message);

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
