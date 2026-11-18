import { isSolanaMint } from "../../utils/watchlist";

import { readWalletHistory } from "../../utils/wallet-history";

const programs = [
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
];

async function readAccounts(endpoint, owner, programId, signal) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1, method: "getTokenAccountsByOwner",
      params: [owner, { programId }, { encoding: "jsonParsed", commitment: "confirmed" }]
    }),
    signal
  });
  if (!response.ok) throw new Error("RPC unavailable");
  const data = await response.json();
  if (!Array.isArray(data.result?.value)) throw new Error("Invalid RPC response");
  const delegates = [];
  for (const entry of data.result.value) {
    const info = entry.account?.data?.parsed?.info;
    if (!info || info.owner !== owner || !isSolanaMint(info.mint) || !isSolanaMint(entry.pubkey)) {
      throw new Error("Incomplete token account data");
    }
    if (info.delegate == null) continue;
    const amount = info.delegatedAmount?.amount;
    if (!isSolanaMint(info.delegate) || typeof amount !== "string" || !/^\d{1,20}$/.test(amount)) {
      throw new Error("Incomplete delegate data");
    }
    if (BigInt(amount) > 0n) delegates.push({
      account: entry.pubkey, mint: info.mint, delegate: info.delegate, amount
    });
  }
  return delegates;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Méthode non autorisée." });
  }
  const owner = req.body?.owner;
  if (typeof owner !== "string" || !isSolanaMint(owner)) {
    return res.status(400).json({ error: "Saisissez une adresse publique Solana valide." });
  }
  const endpoint = process.env.SOLANA_RPC_URL ||
    (process.env.HELIUS_API_KEY ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}` : "https://api.mainnet-beta.solana.com");
  const signal = AbortSignal.timeout(8000);
  const [results, historyResult] = await Promise.all([
    Promise.allSettled(programs.map(program => readAccounts(endpoint, owner, program, signal))),
    readWalletHistory(endpoint, owner, signal).catch(() => null)
  ]);
  if (!historyResult && results.every(result => result.status === "rejected")) {
    return res.status(503).json({ error: "Données Solana indisponibles. Réessayez dans un instant." });
  }
  const failures = results.filter(result => result.status === "rejected").length;
  const delegates = results.flatMap(result => result.status === "fulfilled" ? result.value : []);
  return res.status(200).json({ partial: failures > 0, total: delegates.length, delegates: delegates.slice(0, 100), history: historyResult });
}
export const config = { api: { bodyParser: { sizeLimit: "1kb" } } };
