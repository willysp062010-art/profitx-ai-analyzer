// Comptage des détections Solana enregistrées dans les dernières 72 heures.
// Une détection n'est pas une preuve de création on-chain à cette date.
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Allow", "GET");
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Méthode non autorisée." });

  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return res.status(503).json({ ok: false, error: "Source indisponible." });

  const now = Date.now();
  const since = new Date(now - 72 * 60 * 60 * 1000).toISOString();
  const params = new URLSearchParams({
    select: "id",
    chain_id: "eq.solana",
    detected_at: "gte." + since,
    limit: "1"
  });

  try {
    const response = await fetch(url + "/rest/v1/pfx_radar_tokens?" + params, {
      headers: {
        apikey: key,
        Authorization: "Bearer " + key,
        Accept: "application/json",
        Prefer: "count=exact",
        Range: "0-0"
      },
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) throw new Error("Count HTTP " + response.status);
    const range = response.headers.get("content-range") || "";
    const total = Number(range.split("/")[1]);
    if (!range.includes("/") || !Number.isSafeInteger(total) || total < 0) {
      throw new Error("Invalid count");
    }
    return res.status(200).json({
      ok: true,
      chain: "solana",
      source: "helius_supabase",
      metric: "detected_in_last_72h",
      count: total,
      since,
      until: new Date(now).toISOString(),
      note: "Nombre de tokens détectés et enregistrés dans l'index au cours des dernières 72 heures. Ce n'est pas le nombre prouvé de tokens créés sur Solana."
    });
  } catch (error) {
    console.error("[PFX RADAR 72H]", error?.message);
    return res.status(502).json({ ok: false, error: "Comptage temporairement indisponible." });
  }
}
