import { directoryIdentities, identityText } from "../../utils/directory-identity";

const MAX_PAGE = 10000;
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Méthode GET requise." });
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return res.status(503).json({ ok: false, error: "Configuration indisponible." });
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const pageRaw = req.query.page ?? "1";
  const page = Number(pageRaw);
  const identified = req.query.identified === "true";
  const snapshotRaw = req.query.snapshot;
  const snapshot = typeof snapshotRaw === "string" && snapshotRaw ? new Date(snapshotRaw) : null;
  if (q.length > 64 || typeof pageRaw !== "string" || !/^[1-9]\d{0,4}$/.test(pageRaw) || page > MAX_PAGE ||
      (snapshotRaw && (!snapshot || !Number.isFinite(snapshot.getTime()) || snapshot.getTime() > Date.now() + 60000))) {
    return res.status(400).json({ ok: false, error: "Paramètres invalides." });
  }
  const size = 25;
  const params = new URLSearchParams({ select: "mint,name,symbol,launch_platform,source,detected_at,liquidity_usd,volume_24h_usd,market_cap_usd,analysis_status",
    chain_id: "eq.solana", order: "detected_at.desc,id.desc", limit: String(size), offset: String((page - 1) * size) });
  if (snapshot) params.set("detected_at", "lte." + snapshot.toISOString());
  if (identified) params.set("and", '(name.not.is.null,symbol.not.is.null,name.neq."",symbol.neq."",name.neq."Token inconnu",symbol.neq."N/D")');
  if (q) {
    // Quote PostgREST values rather than dropping Unicode or interpreting filter syntax.
    const escaped = q.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const pattern = '"*' + escaped + '*"';
    params.set("or", `(name.ilike.${pattern},symbol.ilike.${pattern},mint.ilike.${pattern})`);
  }
  try {
    const r = await fetch(url + "/rest/v1/pfx_radar_tokens?" + params, { headers: { apikey: key, Authorization: "Bearer " + key, Prefer: "count=exact" }, signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw Error("Directory database unavailable");
    const rows = await r.json();
    if (!Array.isArray(rows)) throw Error("Invalid rows");
    const countValue = Number((r.headers.get("content-range") || "").split("/")[1]);
    const count = Number.isSafeInteger(countValue) && countValue >= 0 ? countValue : null;
    const rpc = process.env.SOLANA_RPC_URL || (process.env.HELIUS_API_KEY ? "https://mainnet.helius-rpc.com/?api-key=" + encodeURIComponent(process.env.HELIUS_API_KEY) : "https://api.mainnet-beta.solana.com");
    const identities = await directoryIdentities(rows, rpc);
    const tokens = rows.map(row => {
      const identity = identities.get(row.mint);
      const name = identityText(row.name) || identity?.name;
      const symbol = identityText(row.symbol) || identity?.symbol;
      return { mint: row.mint, name: name || "Nom non récupéré", symbol: symbol || "N/D",
        platform: row.launch_platform || row.source || "N/D", detectedAt: row.detected_at,
        liquidityUsd: row.liquidity_usd ?? null, volume24hUsd: row.volume_24h_usd ?? null, marketCapUsd: row.market_cap_usd ?? null,
        status: row.analysis_status, identityStatus: name && symbol ? "metadata_present" : "metadata_unconfirmed",
        marketDataStatus: row.liquidity_usd == null && row.volume_24h_usd == null ? "not_available" : "historical_unverified" };
    });
    return res.status(200).json({ ok: true, source: "observed_sol_tokens", coverage: "partial", identifiedOnly: identified,
      page, pageSize: size, maxPage: MAX_PAGE, count, snapshot: snapshot?.toISOString() || rows[0]?.detected_at || null,
      hasMore: page < MAX_PAGE && (count === null ? rows.length === size : page * size < count), tokens });
  } catch {
    return res.status(502).json({ ok: false, error: "Répertoire temporairement indisponible." });
  }
}
export const config = { maxDuration: 30 };
