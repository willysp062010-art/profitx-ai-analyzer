import { usageEventId } from "./usage-client";

const storageKey = "pfx-demo-journey";

export function demoJourneyId({ restart = false, create = false } = {}) {
  const candidate = usageEventId();
  if (!candidate) return null;
  try {
    const stored = JSON.parse(sessionStorage.getItem(storageKey) || "null");
    if (!restart && stored?.id && stored.expires > Date.now()) return stored.id;
    if (!create) return null;
    sessionStorage.setItem(storageKey, JSON.stringify({ id: candidate, expires: Date.now() + 30 * 60 * 1000 }));
    return candidate;
  } catch {
    return null;
  }
}

export function recordDemoEvent(eventId, stage) {
  if (!eventId) return;
  fetch("/api/demo-usage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventId, stage }),
    keepalive: true,
  }).catch(() => {});
}
