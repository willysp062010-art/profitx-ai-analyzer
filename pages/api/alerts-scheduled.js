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
  return monitorHandler({
    ...req,
    method: "POST",
    headers: {
      ...req.headers,
      authorization: `Bearer ${monitorSecret}`,
      "x-pfx-monitor-secret": undefined,
    },
  }, res);
}
