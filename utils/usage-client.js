export function usageEventId() {
  if (typeof window === "undefined" || window.location.hostname !== "profitx-ai-analyzer.vercel.app" || new URLSearchParams(window.location.search).get("usage") === "off" || /bot|crawler|spider|headless|playwright/i.test(navigator.userAgent)) return null;
  return window.crypto?.randomUUID?.() || null;
}

// Event-scoped UUID only. Analytics failures must not interrupt the analysis.
export function recordAnalysisJourney(eventId, kind) {
  if (!eventId || !["started", "failed"].includes(kind)) return;
  try {
    fetch("/api/analysis-usage", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({eventId,kind}), keepalive:true})
      .catch(()=>{}).finally(()=>window.dispatchEvent(new Event("pfx-usage-updated")));
  } catch { /* Analytics are optional. */ }
}
