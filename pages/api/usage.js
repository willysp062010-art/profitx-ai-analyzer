import { usageRpc, usageEventIdValid, usageRequestAllowed, usageRateAllowed } from "../../utils/usage-server";
export default async function handler(req,res) {
  res.setHeader("Allow","GET, POST");
  res.setHeader("Cache-Control","no-store");
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ok:false,error:"Méthode non autorisée."});
  if (req.method === "POST") {
    if (!usageRequestAllowed(req)) return res.status(403).json({ok:false,error:"Comptage réservé au site de production."});
    if (!usageEventIdValid(req.body?.eventId) || req.body?.kind !== "visit") return res.status(400).json({ok:false,error:"Événement invalide."});
    if (!usageRateAllowed(req)) return res.status(429).json({ok:false,error:"Trop de requêtes."});
    try { await usageRpc("pfx_record_usage",{p_event_id:req.body.eventId,p_kind:"visit"}); return res.status(200).json({ok:true}); }
    catch { return res.status(503).json({ok:false,error:"Statistiques temporairement indisponibles."}); }
  }
  try {
    const data=await usageRpc("pfx_usage_summary",{});
    if (!data || !Number.isFinite(Date.parse(data.since)) || ["visits","analyses","todayVisits","todayAnalyses"].some(key=>!Number.isSafeInteger(data[key]) || data[key]<0)) throw Error("Invalid summary");
    return res.status(200).json({ok:true,visits:data.visits,analyses:data.analyses,todayVisits:data.todayVisits,todayAnalyses:data.todayAnalyses,since:data.since,timezone:"Europe/Paris",updatedAt:new Date().toISOString()});
  } catch { return res.status(503).json({ok:false,error:"Statistiques temporairement indisponibles."}); }
}
export const config={api:{bodyParser:{sizeLimit:"1kb"}}};
