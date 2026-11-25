import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchAnalysisResponse } from "../utils/analysis-request";
import { isSolanaMint } from "../utils/watchlist";

const MAX_READINGS = 10;
const percentage = new Intl.NumberFormat("fr-FR", {
  style: "percent", signDisplay: "exceptZero", maximumFractionDigits: 1
});
const money = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "USD" });

function readHistory(key) {
  const entries = JSON.parse(window.localStorage.getItem(key) || "[]");
  if (!Array.isArray(entries)) throw new Error("Historique local illisible.");
  return entries.filter((entry) => entry && Number.isFinite(Date.parse(entry.at)))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, MAX_READINGS);
}

function recordedLiquidity(result) {
  const pair = result.market?.pairAddress;
  const amount = result.data?.liquidityUsd;
  if (result.source !== "dexscreener" || result.market?.dexId?.toLowerCase() === "pumpfun"
    || !isSolanaMint(pair) || !Number.isFinite(amount) || amount < 0) {
    return { pair: null, amount: null };
  }
  return { pair, amount };
}

export function compareLiquidityReadings(reference, current) {
  if (!isSolanaMint(reference?.pair) || reference.pair !== current?.pair ||
    !Number.isFinite(reference.amount) || reference.amount <= 0 ||
    !Number.isFinite(current.amount) || current.amount < 0 ||
    !Number.isFinite(Date.parse(reference.at)) || Date.parse(current.at) <= Date.parse(reference.at) ||
    !Number.isFinite(Date.parse(current.at))) return null;

  const variation = (current.amount - reference.amount) / reference.amount;
  return Number.isFinite(variation) ? variation : null;
}

export default function TokenRiskHistory({ mint }) {
  const key = "pfx-risk-history-v1:" + mint;
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try { setEntries(readHistory(key)); }
    catch { setError("Impossible de lire l’historique de ce navigateur."); }
  }, [key]);

  async function record() {
    setLoading(true);
    setError("");
    try {
      const result = await fetchAnalysisResponse(mint);
      if (!Number.isFinite(Date.parse(result.timestamp))) throw new Error("Date du relevé indisponible.");
      const current = readHistory(key);
      const entry = { at: result.timestamp, ...recordedLiquidity(result) };
      const next = [entry, ...current.filter((item) => item.at !== entry.at)]
        .sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, MAX_READINGS);
      window.localStorage.setItem(key, JSON.stringify(next));
      setEntries(next);
    } catch (failure) {
      setError(failure.message || "Le relevé n’a pas pu être enregistré.");
    } finally {
      setLoading(false);
    }
  }

  const [latest, previous] = entries;
  const changes = compareLiquidityReadings(previous, latest);

  return (
    <details>
      <summary>Historique de la liquidité</summary>
      <p>Relevés à la demande. Les dix derniers relevés restent dans ce navigateur.</p>
      <button type="button" className="copyButton" disabled={loading} onClick={record}>
        {loading ? "Relevé en cours…" : "Enregistrer un relevé"}
      </button>
      {error && <p role="alert">{error}</p>}
      {entries.length > 0 && (
        <>
          <p role="status">{changes !== null
            ? `Liquidité de la même paire : ${percentage.format(changes)} depuis le relevé précédent.`
            : "Comparaison indisponible. Deux valeurs comparables sur la même paire sont nécessaires."}</p>
          {isSolanaMint(latest?.pair) && Number.isFinite(latest.amount) && latest.amount > 0 && (
            <Link className="copyButton" href={{ pathname: "/alerts", query: {
              mint, pair: latest.pair, at: latest.at, liquidity: latest.amount
            } }}>Créer une alerte de baisse</Link>
          )}
          <ul>
            {entries.map((entry) => (
              <li key={entry.at}>
                {new Date(entry.at).toLocaleString("fr-FR")} · {isSolanaMint(entry.pair) && Number.isFinite(entry.amount)
                  ? <a href={`https://dexscreener.com/solana/${entry.pair}`} target="_blank" rel="noopener noreferrer">{money.format(entry.amount)} sur DexScreener ↗</a>
                  : "Liquidité DEX indisponible"}
              </li>
            ))}
          </ul>
        </>
      )}
    </details>
  );
}
