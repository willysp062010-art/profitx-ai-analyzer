const STRUCTURAL_WEIGHTS = { liquidity: 30, distribution: 30, maturity: 15, security: 25 };
const LABELS = { liquidity: "liquidité", distribution: "distribution des détenteurs", maturity: "maturité", security: "sécurité" };
const measured = value => typeof value === "number" && Number.isFinite(value);

export function assessAnalysisQuality({ components = {}, activity, volume, isToken2022 = null, extensionsScored = false, priceStatus, totalScore } = {}) {
  const missing = Object.keys(STRUCTURAL_WEIGHTS).filter(key => !measured(components[key]));
  const structuralCoverage = Object.keys(STRUCTURAL_WEIGHTS).reduce((sum, key) => sum + (measured(components[key]) ? STRUCTURAL_WEIGHTS[key] : 0), 0);
  const issues = missing.map(key => `Contrôle indisponible : ${LABELS[key]}.`);
  if (!measured(activity)) issues.push("Activité récente non suffisamment mesurée.");
  if (!measured(volume)) issues.push("Volume récent non suffisamment mesuré.");
  if (typeof isToken2022 !== "boolean") issues.push("Standard du token non confirmé.");
  if (isToken2022 === true && extensionsScored !== true) issues.push("Les extensions Token-2022 ne sont pas intégralement prises en compte dans le score de sécurité.");
  const conflicting = priceStatus === "CONFLICTING_POOL_PRICES";
  if (conflicting) issues.unshift("Prix contradictoires entre les pools consultés ; prix et capitalisation non retenus.");
  if (priceStatus === "QUOTE_PRICE_UNAVAILABLE") issues.push("Prix du token en contrepartie non vérifié.");
  const status = conflicting ? "CONFLICTING" : !measured(totalScore) ? "UNAVAILABLE" : issues.length ? "PARTIAL" : "COMPLETE";
  return {
    status,
    label: { CONFLICTING: "Données contradictoires", UNAVAILABLE: "Données insuffisantes", PARTIAL: "Analyse partielle", COMPLETE: "Contrôles disponibles" }[status],
    scoreStatus: !measured(totalScore) ? "UNAVAILABLE" : status === "COMPLETE" ? "CALCULATED" : "PROVISIONAL",
    structuralCoverage,
    missingStructural: missing,
    issues,
    note: "La couverture mesure la disponibilité des contrôles, pas la fiabilité de toutes les données ni la sécurité du token."
  };
}

export function describeStructure(structuralScore, quality) {
  if (!quality || quality.status !== "COMPLETE") {
    return {
      level: quality?.label || "Analyse partielle",
      summary: quality?.status === "CONFLICTING"
        ? "Des données se contredisent. Le score reste indicatif et ne permet pas de conclure à la solidité globale du token."
        : "Des contrôles manquent ou restent limités. Le score disponible est indicatif et ne suffit pas à conclure à la solidité globale du token."
    };
  }
  if (!measured(structuralScore)) return { level: "Données insuffisantes", summary: "Le score structurel n'est pas disponible." };
  const level = structuralScore >= 90 ? "Structure très solide" : structuralScore >= 75 ? "Structure solide" : structuralScore >= 55 ? "Structure intermédiaire" : structuralScore >= 35 ? "Structure fragile" : "Structure très fragile";
  return { level, summary: "Cette lecture porte sur les indicateurs structurels du modèle ProfitX ; elle ne constitue ni un audit ni une prévision de rendement." };
}

export function canCompareScores(a, b) {
  return a?.dataQuality?.scoreStatus === "CALCULATED" && b?.dataQuality?.scoreStatus === "CALCULATED";
}
