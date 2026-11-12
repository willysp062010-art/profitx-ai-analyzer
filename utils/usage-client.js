export function usageEventId() {
  if (typeof window === "undefined" || window.location.hostname !== "profitx-ai-analyzer.vercel.app" || new URLSearchParams(window.location.search).get("usage") === "off" || /bot|crawler|spider|headless|playwright/i.test(navigator.userAgent)) return null;
  return window.crypto?.randomUUID?.() || null;
}
