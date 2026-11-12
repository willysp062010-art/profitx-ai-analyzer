// A completed request is not proof that every condition could be evaluated.
export function summarizeAlertCheck(results, alerts) {
  const active = new Set(alerts.filter(alert => alert.enabled !== false).map(alert => alert.id));
  const verified = new Map();
  for (const result of Array.isArray(results) ? results : []) {
    if (active.has(result?.id) && ["watching", "triggered"].includes(result.status) &&
        typeof result.currentValue === "number" && Number.isFinite(result.currentValue)) verified.set(result.id, result);
  }
  const triggered = [...verified.values()].filter(result => result.status === "triggered").length;
  const unavailable = active.size - verified.size;
  if (!active.size) return { warning: true, message: "Aucune alerte active à vérifier. Les règles en pause ne sont pas évaluées." };
  const triggerMessage = triggered ? `${triggered} alerte(s) déclenchée(s). ` : "";
  if (unavailable) return { warning: true, message: triggerMessage + `${unavailable} condition(s) non vérifiable(s) : données absentes ou contrôle incomplet. Aucune conclusion pour ces règles.` };
  return { warning: false, message: triggerMessage || "Vérification terminée : les conditions de toutes les alertes actives ont été évaluées, aucune n'est déclenchée." };
}
