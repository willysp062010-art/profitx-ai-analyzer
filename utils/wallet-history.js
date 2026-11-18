const limit = 8;
const signaturePattern = /^[1-9A-HJ-NP-Za-km-z]{64,88}$/;

async function rpc(endpoint, signal, method, params) {
  const response = await fetch(endpoint, {
    method: "POST", headers: { "Content-Type": "application/json" }, signal,
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params })
  });
  if (!response.ok) throw new Error("RPC unavailable");
  const data = await response.json();
  if (data.error || data.result == null) throw new Error("Missing RPC data");
  return data.result;
}

function outflows(transaction, owner) {
  const message = transaction.transaction?.message;
  const meta = transaction.meta;
  if (!meta || !Array.isArray(message?.instructions)) throw new Error("Incomplete transaction");
  if (meta.err) return [];
  const instructions = message.instructions.concat((meta.innerInstructions || []).flatMap(group => group.instructions));
  const movements = [];
  for (const { program, parsed } of instructions) {
    const info = parsed?.info;
    if (program === "system" && ["transfer", "transferWithSeed"].includes(parsed?.type) &&
        info?.source === owner && info.destination !== owner && Number.isSafeInteger(info.lamports) && info.lamports > 0) {
      movements.push({ asset: "SOL", amount: String(info.lamports), decimals: 9, destination: info.destination });
    }
  }
  const balances = new Map();
  for (const [rows, sign] of [[meta.preTokenBalances, 1n], [meta.postTokenBalances, -1n]]) {
    for (const row of rows || []) {
      if (row.owner !== owner) continue;
      const { amount, decimals } = row.uiTokenAmount || {};
      if (!/^\d{1,20}$/.test(amount || "") || !Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
        throw new Error("Incomplete token balance");
      }
      const previous = balances.get(row.mint)?.amount || 0n;
      balances.set(row.mint, { amount: previous + sign * BigInt(amount), decimals });
    }
  }
  for (const [asset, { amount, decimals }] of balances) {
    if (amount > 0n) movements.push({ asset, amount: String(amount), decimals });
  }
  return movements;
}

export async function readWalletHistory(endpoint, owner, signal) {
  const signatures = await rpc(endpoint, signal, "getSignaturesForAddress", [owner, { limit, commitment: "confirmed" }]);
  if (!Array.isArray(signatures) || signatures.length > limit) throw new Error("Invalid history");
  const checked = [];
  for (let offset = 0; offset < signatures.length; offset += 2) {
    const batch = await Promise.allSettled(signatures.slice(offset, offset + 2).map(async ({ signature, err, blockTime }) => {
      if (typeof signature !== "string" || !signaturePattern.test(signature)) throw new Error("Invalid signature");
      if (err) return null;
      const transaction = await rpc(endpoint, signal, "getTransaction", [signature, {
        encoding: "jsonParsed", commitment: "confirmed", maxSupportedTransactionVersion: 0
      }]);
      const movements = outflows(transaction, owner);
      return movements.length ? { signature, blockTime: Number.isSafeInteger(blockTime) && blockTime > 0 && blockTime <= 253402300799 ? blockTime : null, movements } : null;
    }));
    checked.push(...batch);
    if (signal.aborted) break;
  }
  const reviewed = checked.filter(item => item.status === "fulfilled");
  const transactions = reviewed.map(item => item.value).filter(Boolean);
  const repeatedDestinations = findRepeatedDestinations(transactions);
  return {
    reviewed: reviewed.length,
    partial: reviewed.length !== signatures.length,
    transactions, repeatedDestinations
  };
}

// Count separate confirmed transactions, never multiple instructions in the same transaction.
export function findRepeatedDestinations(transactions) {
  const byDestination = new Map();
  for (const tx of transactions) {
    if (!Number.isSafeInteger(tx.blockTime)) continue;
    const destinations = new Set(tx.movements.filter(item =>
      item.asset === "SOL" && typeof item.destination === "string" &&
      /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(item.destination)
    ).map(item => item.destination));
    for (const destination of destinations) {
      if (!byDestination.has(destination)) byDestination.set(destination, new Map());
      byDestination.get(destination).set(tx.signature, tx.blockTime);
    }
  }
  const matches = [];
  for (const [destination, entries] of byDestination) {
    const sorted = [...entries].sort((a, b) => a[1] - b[1]);
    let longest = [];
    for (let start = 0; start < sorted.length; start++) {
      const window = sorted.slice(start).filter(entry => entry[1] - sorted[start][1] <= 600);
      if (window.length > longest.length) longest = window;
    }
    if (longest.length >= 2) matches.push({ destination, signatures: longest.map(([signature]) => signature) });
  }
  return matches;
}
