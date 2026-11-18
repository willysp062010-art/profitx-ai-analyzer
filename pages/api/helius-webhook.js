
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

const TOKEN_PROGRAMS = new Set([
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
]);

export function verifiedMints(result) {
  const instructions = result?.transaction?.message?.instructions;
  if (!result?.meta || result.meta.err !== null || !Array.isArray(instructions)) return [];
  const inner = (result.meta.innerInstructions || []).flatMap(group => group.instructions);
  return [...new Set([...instructions, ...inner].filter(instruction =>
    TOKEN_PROGRAMS.has(instruction?.programId) &&
    ["initializeMint", "initializeMint2"].includes(instruction?.parsed?.type)
  ).map(instruction => instruction.parsed.info?.mint).filter(validAddress))];
}

async function verifyCreation(event, endpoint, signal) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1, method: "getTransaction",
      params: [event.signature, { encoding: "jsonParsed", commitment: "confirmed", maxSupportedTransactionVersion: 1 }]
    }),
    signal
  });
  if (!response.ok) throw new Error("Solana RPC unavailable");
  const { result, error } = await response.json();
  if (error || !result?.meta || !Array.isArray(result.transaction?.message?.instructions) ||
      result.transaction.signatures?.[0] !== event.signature) {
    throw new Error("Solana transaction unavailable");
  }
  return verifiedMints(result).map(mint => ({
    chain_id: "solana",
    mint,
    source: "helius",
    launch_platform: null,
    creator_address: null,
    creation_signature: event.signature,
    detected_at: event.receivedAt,
    created_onchain_at: timestampToISO(result.blockTime),
    last_seen_at: event.receivedAt,
    analysis_status: "pending",
    metadata: {
      helius_type: "CREATE",
      slot: Number.isSafeInteger(result.slot) ? result.slot : null,
      classification: "solana_mint_initialized",
      verified_creation: true
    }
  }));
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

  const receivedAt = new Date().toISOString();
  const candidates = new Map();
  for (const event of req.body) {
    if (event?.transactionError != null || cleanText(event?.type, 80)?.toUpperCase() !== "CREATE" ||
        cleanText(event?.source, 80)?.toUpperCase() === "PUMP_FUN" ||
        typeof event?.signature !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(event.signature)) continue;
    candidates.set(event.signature, { signature: event.signature, receivedAt });
  }

  const rpc = process.env.SOLANA_RPC_URL || (process.env.HELIUS_API_KEY
    ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
    : "https://api.mainnet-beta.solana.com");
  const verificationSignal = AbortSignal.timeout(6000);
  const verificationQueue = [...candidates.values()];
  let verificationCursor = 0;
  let verificationFailed = 0;
  await Promise.all(Array.from({ length: Math.min(4, verificationQueue.length) }, async () => {
    while (verificationCursor < verificationQueue.length && !verificationSignal.aborted) {
      try {
        for (const token of await verifyCreation(verificationQueue[verificationCursor++], rpc, verificationSignal)) {
          tokens.set(token.mint, token);
        }
      } catch {
        verificationFailed++;
      }
    }
  }));
  verificationFailed += verificationQueue.length - verificationCursor;

  // Bounded concurrency prevents a full 100-event batch from exceeding
  // the serverless execution window while avoiding a Supabase request burst.
  const queue = [...tokens.values()];
  const concurrency = Math.min(8, queue.length);
  let cursor = 0;
  let processed = 0;
  let failed = 0;

  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (cursor < queue.length) {
      const token = queue[cursor++];
      try {
        await saveToken(token, supabaseUrl.replace(/\/$/, ""), supabaseKey);
        processed++;
      } catch (error) {
        failed++;
        console.error("PFX Radar webhook database error:", error.message);
      }
    }
  }));

  // Non-2xx lets Helius retry the batch; ignore-duplicates makes retries safe.
  if (failed > 0 || verificationFailed > 0) {
    return res.status(500).json({
      error: "Some events could not be processed",
      verificationFailed,
      received: req.body.length,
      accepted: tokens.size,
      processed,
      failed
    });
  }

  return res.status(200).json({
    ok: true,
    received: req.body.length,
    accepted: tokens.size,
    processed
  });
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "1mb"
    }
  }
};
