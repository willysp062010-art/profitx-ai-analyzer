export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ok:false,error:"GET required"});
  const url=process.env.SUPABASE_URL?.replace(/\/$/,"");
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if(!url||!key) return res.status(503).json({ok:false,error:"Configuration indisponible"});
  const q=typeof req.query.q==="string"?req.query.q.trim():"";
  const page=Number(req.query.page||1);
  const identified=req.query.identified==="true";
  if(q.length>64||!Number.isInteger(page)||page<1||page>400) return res.status(400).json({ok:false,error:"Parametres invalides"});
  const clean=q.replace(/[^A-Za-z0-9À-ÿ ._-]/g,"").trim();
  if(q&&clean.length<2) return res.status(200).json({ok:true,tokens:[],count:0,page,hasMore:false});
  const size=25;
  const params=new URLSearchParams({select:"mint,name,symbol,launch_platform,source,detected_at,liquidity_usd,volume_24h_usd,market_cap_usd,analysis_status",chain_id:"eq.solana",order:"detected_at.desc",limit:String(size),offset:String((page-1)*size)});
  if(identified) params.set("analysis_status","eq.enriched");
  if(clean) params.set("or","(name.ilike.*"+clean+"*,symbol.ilike.*"+clean+"*,mint.ilike.*"+clean+"*)");
  try {
    const r=await fetch(url+"/rest/v1/pfx_radar_tokens?"+params.toString(),{headers:{apikey:key,Authorization:"Bearer "+key,Prefer:"count=exact"},signal:AbortSignal.timeout(10000)});
    if(!r.ok) throw Error("Supabase HTTP "+r.status);
    const rows=await r.json();
    if(!Array.isArray(rows)) throw Error("invalid rows");
    const countValue=Number((r.headers.get("content-range")||"").split("/")[1]);
    const count=Number.isSafeInteger(countValue)&&countValue>=0?countValue:null;
    return res.status(200).json({ok:true,source:"observed_sol_tokens",coverage:"partial",identifiedOnly:identified,page,pageSize:size,count,hasMore:count===null?rows.length===size:page*size<count,tokens:rows.map(x=>({mint:x.mint,name:x.name||"Token inconnu",symbol:x.symbol||"N/D",platform:x.launch_platform||x.source||"N/D",detectedAt:x.detected_at,liquidityUsd:x.liquidity_usd,volume24hUsd:x.volume_24h_usd,marketCapUsd:x.market_cap_usd,status:x.analysis_status,identityStatus:x.analysis_status==="enriched"?"metadata_present":"metadata_unconfirmed",marketDataStatus:x.liquidity_usd===null&&x.volume_24h_usd===null?"not_available":"partial"}))});
  } catch(e) {console.error("directory",e.message);return res.status(502).json({ok:false,error:"Repertoire temporairement indisponible"});}
}