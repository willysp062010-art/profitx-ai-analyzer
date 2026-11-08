
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
        "mint,name,symbol,source,launch_platform," +
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

    const tokens = rows.map((row) => ({
      mint: row.mint,
      name: row.name || "Token inconnu",
      symbol: row.symbol || "N/D",
      source: row.launch_platform || row.source,
      detectedAt: row.detected_at,
      createdOnchainAt: row.created_onchain_at,
      liquidityUsd: row.liquidity_usd,
      volume24h: row.volume_24h_usd,
      marketCap: row.market_cap_usd,
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
