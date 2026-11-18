export function inspectLink(input) {
  if (typeof input !== "string") return null;
  const source = input.trim();
  if (!/^https?:\/\//i.test(source)) return null;
  let url;
  try { url = new URL(source); } catch { return null; }
  if (!["http:", "https:"].includes(url.protocol)) return null;
  const signals = [];
  if (/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/u.test(source)) {
    signals.push("Le lien contient des caractères invisibles ou des marques qui peuvent changer le sens de lecture.");
  }
  const authority = source.slice(source.indexOf("://") + 3).split(/[/?#]/u, 1)[0];
  if (authority.includes("\\") || /%[0-9a-f]{2}/i.test(authority)) {
    signals.push("Le domaine saisi contient des séparateurs ou des caractères encodés. Vérifiez le domaine réel affiché ci-dessous.");
  }
  if (url.protocol === "http:") signals.push("Connexion HTTP sans chiffrement.");
  if (url.username || url.password) signals.push("Le lien contient des identifiants avant le véritable domaine.");
  if (url.hostname.split(".").some(label => label.startsWith("xn--"))) signals.push("Le domaine utilise des caractères internationalisés. Vérifiez son orthographe.");
  if (/^(\d+\.){3}\d+$|^\[/.test(url.hostname)) signals.push("Le lien utilise une adresse IP au lieu d’un nom de domaine.");
  if (url.port) signals.push("Le lien utilise un port inhabituel.");
  return { hostname: url.hostname, signals };
}
