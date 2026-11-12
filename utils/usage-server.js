import { createHash } from "crypto";
export const USAGE_ORIGIN = "https://profitx-ai-analyzer.vercel.app";
export const usageEventIdValid = value => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const buckets = new Map();
export function usageRequestAllowed(req) {
  return process.env.VERCEL_ENV === "production" && req.headers?.origin === USAGE_ORIGIN &&
    req.headers?.host === "profitx-ai-analyzer.vercel.app" && !/bot|crawler|spider|headless|playwright/i.test(req.headers?.["user-agent"] || "");
}
export function usageRateAllowed(req) {
  const minute = Math.floor(Date.now()/60000);
  const key = createHash("sha256").update((process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "") + String(req.headers?.["x-forwarded-for"] || "unknown").split(",")[0]).digest("hex");
  if (buckets.size > 10000) buckets.clear();
  const old = buckets.get(key); const count = old?.minute === minute ? old.count+1 : 1;
  buckets.set(key,{minute,count}); return count <= 60;
}
export async function usageRpc(name, body) {
  const url=process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw Error("Usage unavailable");
  const result=await fetch(url+"/rest/v1/rpc/"+name,{method:"POST",headers:{apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify(body),signal:AbortSignal.timeout(1500)});
  if (!result.ok) throw Error("Usage unavailable");
  return result.json();
}
export async function recordAnalysisUsage(req) {
  const id=req.headers?.["x-pfx-usage-event"];
  if (req.method !== "POST" || !usageRequestAllowed(req) || !usageEventIdValid(id) || !usageRateAllowed(req)) return;
  try { await usageRpc("pfx_record_usage",{p_event_id:id,p_kind:"analysis"}); }
  catch { /* Usage measurement must never prevent an analysis. */ }
}
