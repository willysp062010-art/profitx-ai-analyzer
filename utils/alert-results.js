const STATUSES = new Set(["triggered", "watching", "paused", "no_market_data", "metric_unavailable", "error"]);
export function alertResultFromRow(row) {
  if (!row?.alert_id || !STATUSES.has(row.status) || !validCheckTime(row.last_checked_at)) return null;
  return {
    id: row.alert_id,
    status: row.status,
    currentValue: !["triggered", "watching"].includes(row.status) || row.current_value == null || row.current_value === "" || typeof row.current_value === "boolean" || !Number.isFinite(Number(row.current_value)) ? null : Number(row.current_value),
    checkedAt: new Date(row.last_checked_at).toISOString(),
    source: "server",
    marketData: { symbol: typeof row.token_symbol === "string" ? row.token_symbol : null, dexId: typeof row.dex_id === "string" ? row.dex_id : null }
  };
}
function validCheckTime(time) {
  return typeof time === "string" && Number.isFinite(Date.parse(time));
}
export function latestAlertResult(manual, persisted) {
  if (!manual) return persisted ?? null;
  if (!persisted) return manual;
  return (Date.parse(manual.checkedAt) || 0) >= (Date.parse(persisted.checkedAt) || 0) ? manual : persisted;
}
export function isOldAlertResult(result, now = Date.now()) {
  return !validCheckTime(result?.checkedAt) || now - Date.parse(result.checkedAt) > 36 * 60 * 60 * 1000;
}

export function mergeAlertRecords(localAlerts, serverAlerts) {
  const merged = new Map();
  for (const alert of serverAlerts || []) if (alert?.id) merged.set(alert.id, alert);
  for (const local of localAlerts || []) {
    if (!local?.id) continue;
    const server = merged.get(local.id);
    if (!server) merged.set(local.id, local);
    else if (["chainId", "tokenAddress", "metric", "condition", "targetValue"].every(key => server[key] === local[key])) {
      merged.set(local.id, { ...server, lastManualEvaluation: local.lastManualEvaluation ?? null });
    }
  }
  return Array.from(merged.values()).sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
}
