export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Méthode GET requise." });
  }
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  res.setHeader("Cache-Control", "no-store");
  if (!url || !key) return res.status(503).json({ ok: false, error: "Statistiques indisponibles." });
  const now = new Date();
  const since = new Date(now.getTime() - 86400000).toISOString();
  try {
    async function count(recent) {
      const params = new URLSearchParams({ select: "id", chain_id: "eq.solana", detected_at: "lte." + now.toISOString() });
      if (recent) params.set("and", `(detected_at.gte.${since})`);
      const response = await fetch(url + "/rest/v1/pfx_radar_tokens?" + params, {
        method: "HEAD", headers: { apikey: key, Authorization: "Bearer " + key, Prefer: "count=exact" }, signal: AbortSignal.timeout(8000),
      });
      const raw = (response.headers.get("content-range") || "").split("/")[1];
      if (!response.ok || !/^\d+$/.test(raw || "")) throw Error("Count unavailable");
      const value = Number(raw);
      if (!Number.isSafeInteger(value)) throw Error("Count invalid");
      return value;
    }
    const [total, detected24h] = await Promise.all([count(false), count(true)]);
    if (detected24h > total) throw Error("Inconsistent counts");
    res.setHeader("Cache-Control", "public, s-maxage=30");
    return res.status(200).json({ ok: true, total, detected24h, updatedAt: now.toISOString(), coverage: "partial" });
  } catch {
    return res.status(503).json({ ok: false, error: "Statistiques temporairement indisponibles." });
  }
}
