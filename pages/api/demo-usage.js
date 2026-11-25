import { usageRpc, usageEventIdValid, usageRequestAllowed, usageRateAllowed } from "../../utils/usage-server";

const stages = ["home_click", "demo_open", "analysis_started", "analysis_completed"];

export default async function handler(req, res) {
  res.setHeader("Allow", "GET, POST");
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      const summary = await usageRpc("pfx_demo_summary", {});
      return res.status(200).json(summary);
    }
    if (req.method !== "POST") return res.status(405).json({ ok: false });
    if (!usageRequestAllowed(req)) return res.status(403).json({ ok: false });
    const { eventId, stage } = req.body || {};
    if (!usageEventIdValid(eventId) || !stages.includes(stage)) return res.status(400).json({ ok: false });
    if (!usageRateAllowed(req)) return res.status(429).json({ ok: false });
    await usageRpc("pfx_record_demo_event", { p_event_id: eventId, p_stage: stage });
    return res.status(204).end();
  } catch {
    return res.status(503).json({ ok: false });
  }
}

export const config = { api: { bodyParser: { sizeLimit: "1kb" } } };
