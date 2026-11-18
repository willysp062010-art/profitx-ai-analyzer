import { isSolanaMint } from "../../utils/watchlist";

export default async function handler(req, res) {
  res.setHeader("Allow", "GET");
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "Méthode non autorisée." });
  const input = req.query.mints;
  if (typeof input !== "string" || input.length > 2249) {
    return res.status(400).json({ error: "Fournissez au maximum 50 mints Solana." });
  }
  const mints = [...new Set(input.split(","))];
  if (mints.length > 50 || mints.some(mint => !isSolanaMint(mint))) {
    return res.status(400).json({ error: "Liste de mints Solana invalide." });
  }

  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return res.status(503).json({ error: "Index indisponible." });

  const params = new URLSearchParams({
    select: "mint,detected_at,created_onchain_at,source",
    chain_id: "eq.solana",
    mint: "in.(" + mints.join(",") + ")",
    limit: String(mints.length)
  });
  try {
    const response = await fetch(url + "/rest/v1/pfx_radar_tokens?" + params, {
      headers: {apikey: key, Authorization: "Bearer " + key, Accept: "application/json"},
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) throw new Error("Index request failed");
    const rows = await response.json();
    if (!Array.isArray(rows) || rows.some(row => !mints.includes(row?.mint) || !Number.isFinite(Date.parse(row.detected_at)))) {
      throw new Error("Unexpected index response");
    }
    const indexed = new Map(rows.map(row => [row.mint, row]));
    return res.status(200).json({
      checkedAt: new Date().toISOString(),
      results: mints.map(mint => {
        const row = indexed.get(mint);
        return row ? {
          mint, indexed: true, detectedAt: row.detected_at,
          createdOnchainAt: row.created_onchain_at ?? null, source: row.source ?? null
        } : {mint, indexed: false};
      })
    });
  } catch {
    return res.status(502).json({ error: "Index temporairement indisponible." });
  }
}
