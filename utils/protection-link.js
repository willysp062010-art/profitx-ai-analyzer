export function inspectLink(input) {
  let url;
  try { url = new URL(input.trim()); } catch { return null; }
  if (!["http:", "https:"].includes(url.protocol)) return null;
  const signals = [];
  if (url.protocol === "http:") signals.push("Connexion HTTP sans chiffrement.");
  if (url.username || url.password) signals.push("Le lien contient des identifiants avant le véritable domaine.");
  if (url.hostname.split(".").some(label => label.startsWith("xn--"))) signals.push("Le domaine utilise des caractères internationalisés. Vérifiez son orthographe.");
  if (/^(\d+\.){3}\d+$|^\[/.test(url.hostname)) signals.push("Le lien utilise une adresse IP au lieu d’un nom de domaine.");
  if (url.port) signals.push("Le lien utilise un port inhabituel.");
  return { hostname: url.hostname, signals };
}
