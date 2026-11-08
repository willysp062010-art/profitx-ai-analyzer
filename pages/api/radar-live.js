
const LIVE_ENRICH_LIMIT = 15;
const LIVE_RETRY_MS = 10 * 60 * 1000;

function validMint(value) {
  return typeof value === "string" &&
    /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}

function metadataFor(row) {
  return row.metadata && typeof row.metadata === "object" &&
    !Array.isArray(row.metadata) ? row.metadata : {};
}

function tokenText(value) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text && text !== "N/D" && text !== "Token inconnu" ? text : null;
}

async function enrichOnRead(rows, supabaseUrl, supabaseKey) {
  const heliusKey = process.env.HELIUS_API_KEY;
  if (!heliusKey) return;

  const now = Date.now();
  const candidates = rows.filter((row) => {
    if (!validMint(row.mint) ||
        !["pending", "metadata_missing"].includes(row.analysis_status)) {
      return false;
    }
    if (tokenText(row.name) && tokenText(row.symbol)) return false;
    const metadata = metadataFor(row);
    const attempts = Number(metadata.enrichment_attempts) || 0;
    const checked = Date.parse(metadata.enrichment_checked_at);
    return attempts < 8 && (
      !Number.isFinite(checked) || now - checked >= LIVE_RETRY_MS
    );
  }).slice(0, LIVE_ENRICH_LIMIT);
  if (!candidates.length) return;

  let assets;
  try {
    const response = await fetch(
      "https://mainnet.helius-rpc.com/?api-key=" + encodeURIComponent(heliusKey),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "pfx-live-metadata",
          method: "getAssetBatch",
          params: {
            ids: candidates.map((row) => row.mint),
            options: { showFungible: true }
          }
        }),
        signal: AbortSignal.timeout(6000)
      }
    );
    if (!response.ok) throw new Error("Helius HTTP " + response.status);
    const data = await response.json();
    if (data.error || !Array.isArray(data.result)) {
      throw new Error(data.error?.message || "Invalid Helius response");
    }
    assets = new Map(
      data.result.filter((asset) => validMint(asset?.id))
        .map((asset) => [asset.id, asset])
    );
  } catch (error) {
    console.warn("PFX live enrichment lookup:", error.message);
    return;
  }

  await Promise.allSettled(candidates.map(async (row) => {
    const asset = assets.get(row.mint);
    const name = tokenText(asset?.content?.metadata?.name) || tokenText(row.name);
    const symbol = tokenText(asset?.content?.metadata?.symbol) ||
      tokenText(row.symbol);
    const complete = Boolean(name && symbol);
    const previousMetadata = metadataFor(row);
    const values = {
      metadata: {
        ...previousMetadata,
        enrichment_checked_at: new Date().toISOString(),
        enrichment_attempts:
          (Number(previousMetadata.enrichment_attempts) || 0) + 1,
        enrichment_source: "helius_das",
        enrichment_result: complete ? "success" : "metadata_missing"
      },
      analysis_status: complete ? "enriched" : "metadata_missing"
    };
    if (name) values.name = name;
    if (symbol) values.symbol = symbol;

    try {
      const response = await fetch(
        supabaseUrl + "/rest/v1/pfx_radar_tokens?id=eq." +
          encodeURIComponent(row.id),
        {
          method: "PATCH",
          headers: {
            apikey: supabaseKey,
            Authorization: "Bearer " + supabaseKey,
            "Content-Type": "application/json",
            Prefer: "return=minimal"
          },
          body: JSON.stringify(values),
          signal: AbortSignal.timeout(5000)
        }
      );
      if (!response.ok) throw new Error("Supabase HTTP " + response.status);
      if (name) row.name = name;
      if (symbol) row.symbol = symbol;
      row.analysis_status = values.analysis_status;
    } catch (error) {
      console.warn("PFX live enrichment save:", error.message);
    }
  }));
}



/**
 * DexScreener reports real on-DEX pool liquidity and market activity.
 * Newly created Pump.fun bonding-curve tokens may have no indexed DEX pair;
 * those values must remain unknown rather than treating virtual liquidity as real.
 */
async function fetchMarketPairs(rows) {
  const addresses = [...new Set(rows.map((row) => row.mint).filter(validMint))];
  const groups = [];
  for (let i = 0; i < addresses.length; i += 30) {
    groups.push(addresses.slice(i, i + 30));
  }
  const results = await Promise.allSettled(groups.map(async (group) => {
    const endpoint = "https://api.dexscreener.com/tokens/v1/solana/" +
      group.map(encodeURIComponent).join(",");
    const response = await fetch(endpoint, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5500)
    });
    if (!response.ok) throw new Error("DexScreener HTTP " + response.status);
    const pairs = await response.json();
    if (!Array.isArray(pairs)) throw new Error("Invalid DEX pair response");
    return pairs;
  }));

  const byMint = new Map();
  let successfulRequests = 0;
  for (const result of results) {
    if (result.status !== "fulfilled") {
      console.warn("PFX Radar market lookup:", result.reason?.message);
      continue;
    }
    successfulRequests++;
    for (const pair of result.value) {
      if (pair?.chainId !== "solana") continue;
      const mint = pair?.baseToken?.address;
      if (!validMint(mint) || !addresses.includes(mint)) continue;
      const liquidity = finiteNonNegative(pair?.liquidity?.usd);
      const current = byMint.get(mint);
      const currentLiquidity = finiteNonNegative(current?.liquidity?.usd);
      if (!current || (liquidity ?? -1) > (currentLiquidity ?? -1)) {
        byMint.set(mint, pair);
      }
    }
  }
  return { byMint, fetched: successfulRequests > 0 };
}

function finiteNonNegative(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

async function enrichMarketRows(rows, supabaseUrl, supabaseKey) {
  let data;
  try {
    data = await fetchMarketPairs(rows);
  } catch (error) {
    console.warn("PFX Radar market lookup:", error.message);
    return new Map();
  }
  const market = new Map();
  const changes = [];
  for (const row of rows) {
    const pair = data.byMint.get(row.mint);
    if (!pair) continue;
    const liquidityUsd = finiteNonNegative(pair?.liquidity?.usd);
    const volume24h = finiteNonNegative(pair?.volume?.h24);
    // Do not present fully diluted valuation as actual market capitalization.
    const marketCap = finiteNonNegative(pair?.marketCap);
    const priceUsd = finiteNonNegative(pair?.priceUsd);
    const values = {
      liquidityUsd, volume24h, marketCap, priceUsd,
      dexId: typeof pair.dexId === "string" ? pair.dexId : null,
      pairAddress: typeof pair.pairAddress === "string" ? pair.pairAddress : null,
      pairUrl: typeof pair.url === "string" ? pair.url : null,
      marketDataSource: "DexScreener",
      realLiquidity: liquidityUsd !== null
    };
    market.set(row.mint, values);
    const update = {};
    if (liquidityUsd !== null && Number(row.liquidity_usd) !== liquidityUsd) update.liquidity_usd = liquidityUsd;
    if (volume24h !== null && Number(row.volume_24h_usd) !== volume24h) update.volume_24h_usd = volume24h;
    if (marketCap !== null && Number(row.market_cap_usd) !== marketCap) update.market_cap_usd = marketCap;
    if (Object.keys(update).length && row.id !== undefined) changes.push({ id: row.id, update });
  }
  // Persist only verifiable values; never overwrite previous values with null.
  // A bounded write set avoids amplifying bursty Radar traffic.
  await Promise.allSettled(changes.slice(0, 12).map(async ({ id, update }) => {
    try {
      const response = await fetch(
        supabaseUrl + "/rest/v1/pfx_radar_tokens?id=eq." + encodeURIComponent(id),
        {
          method: "PATCH",
          headers: {
            apikey: supabaseKey,
            Authorization: "Bearer " + supabaseKey,
            "Content-Type": "application/json",
            Prefer: "return=minimal"
          },
          body: JSON.stringify(update),
          signal: AbortSignal.timeout(5000)
        }
      );
      if (!response.ok) throw new Error("Supabase HTTP " + response.status);
    } catch (error) {
      console.warn("PFX Radar market persist:", error.message);
    }
  }));
  return market;
}

const TABLE = "pfx_radar_tokens";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Allow", "GET");

  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Méthode non autorisée"
    });
  }

  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    return res.status(503).json({
      error: "Configuration Supabase incomplète"
    });
  }

  try {
    const params = new URLSearchParams({
      select:
        "id,mint,name,symbol,metadata,source,launch_platform," +
        "detected_at,created_onchain_at," +
        "liquidity_usd,volume_24h_usd,market_cap_usd," +
        "security_score,utility_score," +
        "speculation_risk_score,analysis_status",
      chain_id: "eq.solana",
      order: "detected_at.desc",
      limit: "100"
    });

    const response = await fetch(
      `${url}/rest/v1/${TABLE}?${params.toString()}`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          Accept: "application/json"
        },
        signal: AbortSignal.timeout(8000)
      }
    );

    if (!response.ok) {
      throw new Error(`Supabase HTTP ${response.status}`);
    }

    const rows = await response.json();
    if (!Array.isArray(rows)) throw new Error("Invalid Supabase response");

    const [identityResult, marketResult] = await Promise.allSettled([
      enrichOnRead(rows, url, key),
      enrichMarketRows(rows, url, key)
    ]);
    const liveMarkets = marketResult.status === "fulfilled" ? marketResult.value : new Map();

    const tokens = rows.map((row) => ({
      ...(liveMarkets.get(row.mint) || {}),
      mint: row.mint,
      name: tokenText(row.name) || "Token inconnu",
      symbol: tokenText(row.symbol) || "N/D",
      source: row.launch_platform || row.source,
      detectedAt: row.detected_at,
      createdOnchainAt: row.created_onchain_at,
      liquidityUsd: liveMarkets.get(row.mint)?.liquidityUsd ?? row.liquidity_usd,
      volume24h: liveMarkets.get(row.mint)?.volume24h ?? row.volume_24h_usd,
      marketCap: liveMarkets.get(row.mint)?.marketCap ?? row.market_cap_usd,
      securityScore: row.security_score,
      utilityScore: row.utility_score,
      speculationRiskScore: row.speculation_risk_score,
      status: row.analysis_status,
      score: null // Aucun score PFX global n'est calculé ici.
    }));

    return res.status(200).json({
      ok: true,
      source: "helius_supabase",
      count: tokens.length,
      updatedAt: new Date().toISOString(),
      tokens
    });
  } catch (error) {
    console.error("PFX Radar Live:", error.message);

    return res.status(500).json({
      error: "Impossible de récupérer les tokens détectés"
    });
  }
}

export const config = { maxDuration: 30 };
