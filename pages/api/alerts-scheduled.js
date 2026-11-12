import monitorHandler from "./alerts-monitor";

// Private aggregate evidence only; never store tokens, rule IDs or client IDs.
async function recordRun(startedAt, status, summary, ok) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${url}/rest/v1/pfx_alert_cron_runs`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      signal: controller.signal,
      body: JSON.stringify({ started_at: new Date(startedAt).toISOString(), completed_at: new Date().toISOString(),
        http_status: status, duration_ms: Date.now() - startedAt,
        outcome: ok === true && status >= 200 && status < 300 ? "completed" : "failed", summary: summary || {} }),
    });
    if (!response.ok) throw new Error("RUN_RECORD_UNAVAILABLE");
    return true;
  } catch {
    console.warn("PFX alerts cron evidence could not be saved");
    return false;
  } finally { clearTimeout(timer); }
}

// Vercel Cron authenticates GET requests using CRON_SECRET.
// Forward only verified scheduler calls to the existing protected monitor.
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Allow", "GET");

  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  const cronSecret = process.env.CRON_SECRET;
  const monitorSecret = process.env.PFX_ALERTS_MONITOR_SECRET;
  if (!cronSecret || !monitorSecret) {
    return res.status(503).json({ ok: false, error: "SCHEDULER_NOT_CONFIGURED" });
  }

  if (req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
  }

  // No email delivery: the monitor deliberately disables shared-email notifications.
  const startedAt = Date.now();
  let summary = null;
  const originalJson = res.json;
  res.json = async function (payload) {
    if (payload?.summary && typeof payload.summary === "object") {
      summary = Object.fromEntries(["activeAlerts", "checked", "triggered", "newlyTriggered", "watching", "unavailable", "errors"]
        .filter(key => Number.isSafeInteger(payload.summary[key]) && payload.summary[key] >= 0)
        .map(key => [key, payload.summary[key]]));
    }
    await recordRun(startedAt, this.statusCode, summary, payload?.ok);
    return originalJson.call(this, payload);
  };
  let result;
  try {
    result = await monitorHandler({
    ...req,
    method: "POST",
    headers: {
      ...req.headers,
      authorization: `Bearer ${monitorSecret}`,
      "x-pfx-monitor-secret": undefined,
    },
    }, res);
  } catch (error) {
    await recordRun(startedAt, 500, summary, false);
    throw error;
  } finally {
    res.json = originalJson;
  }
  console.info("PFX alerts cron completed", {
    status: res.statusCode,
    durationMs: Date.now() - startedAt,
    ...(summary ? { summary } : {}),
  });
  return result;
}
