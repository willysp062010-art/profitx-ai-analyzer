export function quoteAge(quotedAt, now = Date.now()) {
  const time = typeof quotedAt === "string" ? Date.parse(quotedAt) : NaN;
  if (!Number.isFinite(time) || time > now + 5000) return null;
  return Math.max(0, Math.floor((now - time) / 1000));
}

export function checkedFxReference(fx, now = Date.now()) {
  const raw = fx?.rates?.USD;
  const rate = (typeof raw === "number" || typeof raw === "string" && raw.trim()) ? Number(raw) : NaN;
  const date = fx?.date;
  const time = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? Date.parse(date + "T00:00:00Z") : NaN;
  const today = Math.floor(now / 86400000) * 86400000;
  if (!Number.isFinite(rate) || rate <= 0.5 || rate >= 2 || !Number.isFinite(time) ||
      new Date(time).toISOString().slice(0,10) !== date || time > today || today - time > 7 * 86400000) {
    throw Error("Taux EUR/USD non daté, ancien ou invalide.");
  }
  return { rate, date };
}
