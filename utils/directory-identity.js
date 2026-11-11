const TOKEN_2022 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
export function identityText(value) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text && !["N/D", "Token inconnu", "Nom non récupéré"].includes(text) ? text.slice(0, 200) : null;
}
export async function directoryIdentities(rows, rpcUrl) {
  const missing = rows.filter(row => !identityText(row.name) || !identityText(row.symbol));
  const result = new Map();
  if (!missing.length) return result;
  try {
    const response = await fetch(rpcUrl, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "pfx-directory-identity", method: "getMultipleAccounts",
        params: [missing.map(row => row.mint), { encoding: "jsonParsed", commitment: "confirmed" }] }),
      signal: AbortSignal.timeout(5000) });
    if (!response.ok) return result;
    const data = await response.json();
    if (data.error || !Array.isArray(data.result?.value) || data.result.value.length !== missing.length) return result;
    data.result.value.forEach((account, index) => {
      if (account?.owner !== TOKEN_2022 || account?.data?.parsed?.type !== "mint") return;
      const extensions = account.data.parsed.info?.extensions;
      const metadata = Array.isArray(extensions) ? extensions.find(item => item?.extension === "tokenMetadata" && item?.state?.mint === missing[index].mint)?.state : null;
      const name = identityText(metadata?.name), symbol = identityText(metadata?.symbol);
      if (name || symbol) result.set(missing[index].mint, { name, symbol });
    });
  } catch { /* Missing metadata stays unavailable; no safety conclusion. */ }
  return result;
}
