import monitorHandler from "./alerts-monitor";

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
  res.json = function (payload) {
    if (payload?.summary && typeof payload.summary === "object") {
      summary = Object.fromEntries(["activeAlerts", "checked", "triggered", "newlyTriggered", "watching", "unavailable", "errors"]
        .filter(key => Number.isSafeInteger(payload.summary[key]) && payload.summary[key] >= 0)
        .map(key => [key, payload.summary[key]]));
    }
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
