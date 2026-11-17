import { usageRpc, usageEventIdValid, usageRequestAllowed, usageRateAllowed } from "../../utils/usage-server";
export default async function handler(req,res) {
  res.setHeader("Allow","GET, POST");
  res.setHeader("Cache-Control","no-store");
  if (!["GET","POST"].includes(req.method)) return res.status(405).json({ok:false});
  try {
    if (req.method === "POST") {
      if (!usageRequestAllowed(req)) return res.status(403).json({ok:false});
      if (!usageEventIdValid(req.body?.eventId) || !["started","failed"].includes(req.body?.kind)) return res.status(400).json({ok:false});
      if (!usageRateAllowed(req)) return res.status(429).json({ok:false});
      await usageRpc("pfx_record_analysis_funnel",{p_event_id:req.body.eventId,p_kind:req.body.kind});
      return res.status(200).json({ok:true});
    }
    const data=await usageRpc("pfx_analysis_funnel_summary",{});
    const fields=["started","completed","failed"];
    if (!data || !Number.isFinite(Date.parse(data.since)) || fields.some(key=>!Number.isSafeInteger(data[key]) || data[key]<0)) throw Error("Invalid summary");
    return res.status(200).json({ok:true,since:data.since,...Object.fromEntries(fields.map(key=>[key,data[key]]))});
  } catch { return res.status(503).json({ok:false,error:"Statistiques temporairement indisponibles."}); }
}
export const config={api:{bodyParser:{sizeLimit:"1kb"}}};
