const DEFAULT_RPC = "https://api.mainnet-beta.solana.com";

function clamp(n, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

async function rpc(method, params) {
  const url = process.env.SOLANA_RPC_URL || DEFAULT_RPC;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params })
  });
  if (!r.ok) throw new Error("RPC Solana indisponible.");
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || "Erreur RPC.");
  return j.result;
}

async function heliusAssetsByOwner(owner) {
  if (!process.env.HELIUS_API_KEY) return null;
  const endpoint = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;
  const r = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "profitx",
      method: "getAssetsByOwner",
      params: {
        ownerAddress: owner,
        page: 1,
        limit: 1000,
        displayOptions: { showFungible: true }
      }
    })
  });
  if (!r.ok) return null;
  return r.json();
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée." });

  const mint = String(req.body?.mint || "").trim();
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,50}$/.test(mint)) {
    return res.status(400).json({ error: "Adresse mint Solana invalide." });
  }

  const missingData = [];
  let supply = null;
  let decimals = null;
  let holders = null;

  try {
    const supplyInfo = await rpc("getTokenSupply", [mint]);
    supply = Number(supplyInfo?.value?.uiAmount ?? 0);
    decimals = supplyInfo?.value?.decimals ?? null;
  } catch {
    missingData.push("supply");
  }

  // Le RPC public permet de récupérer les comptes de token, mais peut être limité.
  // On garde donc holders explicites plutôt que d'inventer une valeur.
  try {
    const accounts = await rpc("getTokenAccountsByOwner", [
      "11111111111111111111111111111111",
      { mint },
      { encoding: "jsonParsed" }
    ]);
    if (accounts?.value) holders = accounts.value.length;
  } catch {
    // Pas de valeur artificielle.
  }

  let liquidityUsd = null;
  let volume24hUsd = null;
  let activity = null;

  // Données de marché : source publique, sans clé côté client.
  try {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
    if (r.ok) {
      const j = await r.json();
      const pairs = (j.pairs || []).filter(p => p.chainId === "solana");
      if (pairs.length) {
        const pair = pairs.sort((a,b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
        liquidityUsd = pair.liquidity?.usd ?? null;
        volume24hUsd = pair.volume?.h24 ?? null;
        const tx = pair.txns?.h24;
        if (tx) activity = clamp(((tx.buys + tx.sells) / 200) * 100);
      }
    }
  } catch {
    // Données absentes = null, jamais inventées.
  }

  if (liquidityUsd == null) missingData.push("liquidity");
  if (volume24hUsd == null) missingData.push("volume24h");
  if (holders == null) missingData.push("holders");
  if (activity == null) missingData.push("activity");

  const liquidityScore = liquidityUsd == null ? null : clamp(Math.log10(Math.max(liquidityUsd, 1)) * 20);
  const volumeScore = volume24hUsd == null ? null : clamp(Math.log10(Math.max(volume24hUsd, 1)) * 20);
  const activityScore = activity;
  const distributionScore = holders == null ? null : clamp(holders * 2);
  const maturityScore = supply != null && liquidityUsd != null ? 60 : null;

  const components = {
    liquidity: liquidityScore,
    distribution: distributionScore,
    activity: activityScore,
    volume: volumeScore,
    maturity: maturityScore
  };

  const weights = { liquidity: 25, distribution: 25, activity: 20, volume: 15, maturity: 15 };
  let weighted = 0;
  let weightAvailable = 0;
  for (const [k, w] of Object.entries(weights)) {
    if (components[k] != null) {
      weighted += components[k] * w;
      weightAvailable += w;
    }
  }

  const total = weightAvailable >= 50 ? Math.round(weighted / weightAvailable) : null;
  let status = "INSUFFICIENT_DATA";
  if (total != null) {
    if (liquidityUsd != null && liquidityUsd < 5000) status = "LOW_LIQUIDITY";
    else if (liquidityUsd != null || volume24hUsd != null) status = "VALID";
    else status = "NO_MARKET";
  }

  return res.status(200).json({
    mint,
    timestamp: new Date().toISOString(),
    status,
    data: { supply, decimals, holders, liquidityUsd, volume24hUsd, activity },
    score: { total, components, weights },
    missingData
  });
}