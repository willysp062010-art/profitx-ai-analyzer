export const WATCHLIST_KEY = "profitx-watchlist-v1";
export const MAX_WATCHLIST_ITEMS = 1000;

export function isSolanaMint(value) {
  if (typeof value !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)) return false;
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let n = 0n;
  for (const char of value) n = n * 58n + BigInt(alphabet.indexOf(char));
  let bytes = 0;
  while (n > 0n) { bytes++; n >>= 8n; }
  return bytes + (value.match(/^1*/)?.[0].length || 0) === 32;
}

export function readWatchlist(storage) {
  const raw = storage.getItem(WATCHLIST_KEY);
  if (!raw) return [];
  const items = JSON.parse(raw);
  if (!Array.isArray(items) || items.length > MAX_WATCHLIST_ITEMS || items.some(item => !item || typeof item !== "object" || item.chainId !== "solana" || !isSolanaMint(item.tokenAddress))) {
    throw Error("La Watchlist enregistrée est illisible. Son contenu n'a pas été remplacé.");
  }
  const identities = new Set();
  return items.map(item => {
    const id = `${item.chainId}:${item.tokenAddress}`;
    if (identities.has(id)) throw Error("La Watchlist contient des doublons incohérents. Aucune donnée n’a été remplacée.");
    identities.add(id);
    // Recover legacy identifiers in memory; never rewrite storage during a read.
    return {...item, id};
  });
}

export function mergeWatchlist(current, incoming) {
  if (!Array.isArray(incoming) || incoming.length > MAX_WATCHLIST_ITEMS) throw Error("Le fichier contient trop de tokens.");
  // Validate the whole import before changing storage. No partial imports.
  const validated = incoming.map(item => {
    if (!item || (item.chainId || "solana") !== "solana" || !isSolanaMint(item.tokenAddress || item.mint)) throw Error("Le fichier doit contenir uniquement des adresses mint Solana valides.");
    const address = item.tokenAddress || item.mint;
    return { id: `solana:${address}`, chainId: "solana", tokenAddress: address,
      addedAt: typeof item.addedAt === "string" && Number.isFinite(Date.parse(item.addedAt)) ? new Date(item.addedAt).toISOString() : new Date().toISOString(),
      ...(typeof item.name === "string" ? { name: item.name.slice(0, 100) } : {}),
      ...(typeof item.symbol === "string" ? { symbol: item.symbol.slice(0, 40) } : {}) };
  });
  const existing = new Set(current.map(item => `${item.chainId}:${item.tokenAddress}`));
  const added = [];
  for (const item of validated) if (!existing.has(item.id)) { added.push(item); existing.add(item.id); }
  if (current.length + added.length > MAX_WATCHLIST_ITEMS) throw Error("Limite de 1 000 tokens atteinte. Exportez votre liste avant de la réorganiser.");
  return [...added, ...current];
}

export function parseWatchlistImport(text) {
  if (typeof text !== "string" || text.length > 256 * 1024) throw Error("Fichier trop volumineux (256 Ko maximum).");
  let data;
  try { data = JSON.parse(text); } catch { throw Error("Le fichier n'est pas un JSON valide."); }
  if (!Array.isArray(data) && data?.version !== 1) throw Error("Format de sauvegarde non pris en charge.");
  return mergeWatchlist([], Array.isArray(data) ? data : data.items);
}

export function writeWatchlist(storage, items) {
  storage.setItem(WATCHLIST_KEY, JSON.stringify(items));
}

export function makeWatchlistBackup(items) {
  return { version: 1, exportedAt: new Date().toISOString(), items: items.map(item =>
    Object.fromEntries(["id", "chainId", "tokenAddress", "addedAt", "name", "symbol"]
      .filter(key => item[key] !== undefined).map(key => [key, item[key]]))) };
}

export function watchlistIdentityLabel(item = {}) {
  if (item.chainId === "solana" && item.tokenAddress === "6FwDVfnnETqUe2UrxZEeLA6u7Vo5Td2Nm79z7s38pump") return "PROFITX (PFX)";
  const name = typeof item.name === "string" ? item.name.trim().slice(0,100) : "";
  const symbol = typeof item.symbol === "string" ? item.symbol.trim().replace(/^\$+/, "").slice(0,40) : "";
  return name ? (symbol ? `${name} · $${symbol}` : name) : symbol ? `$${symbol}` : "Identité non récupérée";
}
