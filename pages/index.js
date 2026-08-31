import { useState } from "react";

const DEFAULT_MINT = "6FwDVfnnETqUe2UrxZEeLA6u7Vo5Td2Nm79z7s38pump";

function fmtUsd(value) {
  if (value == null) return "N/D";
  const n = Number(value);
  if (!Number.isFinite(n)) return "N/D";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: n < 1 ? 6 : 0
  }).format(n);
}

function fmtNumber(value) {
  if (value == null || !Number.isFinite(Number(value))) return "N/D";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Number(value));
}

function fmtDate(ms) {
  if (!ms) return "N/D";
  return new Date(ms).toLocaleString("fr-FR");
}

export default function Home() {
  const [mint, setMint] = useState(DEFAULT_MINT);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function analyze() {
    setLoading(true);
    setError("");
    setData(null);

    try {
      const response = await fetch(`/api/analyze?mint=${encodeURIComponent(mint.trim())}`, {
        headers: { Accept: "application/json" }
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Analyse impossible.");
      }
      setData(result);
    } catch (e) {
      setError(e.message || "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }

  const score = data?.score;
  const metric = data?.metrics || {};

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand"><span className="logo">P</span> PROFITX AI</div>
        <div className="tag">SOLANA TOKEN ANALYZER</div>
      </header>

      <section className="hero">
        <div className="eyebrow">DATA ENGINE • PFX ENGINE • SCORE</div>
        <h1>Analyse structurelle<br />d’un token Solana.</h1>
        <p className="intro">
          Un moteur conçu pour séparer les données observables, les signaux de risque
          et le score structurel. Pas de promesse de rendement.
        </p>

        <div className="search">
          <input
            value={mint}
            onChange={e => setMint(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") analyze(); }}
            placeholder="Adresse mint Solana"
            spellCheck="false"
          />
          <button onClick={analyze} disabled={loading || !mint.trim()}>
            {loading ? "Analyse..." : "Analyser"}
          </button>
        </div>

        <div className="hint">
          Les données manquantes restent explicitement signalées : elles ne sont pas inventées.
        </div>
      </section>

      {error && <div className="error">{error}</div>}

      {data && (
        <section className="results">
          <div className="scoreCard">
            <div>
              <div className="label">SCORE STRUCTUREL</div>
              <div className="score">{score == null ? "N/D" : score}<span>/100</span></div>
              <div className={`status ${data.status}`}>{data.status}</div>
            </div>
            <div className="meta">
              <div><span>Mint</span><strong>{data.mint}</strong></div>
              <div><span>Horodatage</span><strong>{new Date().toLocaleString("fr-FR")}</strong></div>
            </div>
          </div>

          <div className="metrics">
            {[
              ["liquidity", "liquidité"],
              ["distribution", "distribution"],
              ["activity", "activité"],
              ["volume", "volume"],
              ["maturity", "maturité"]
            ].map(([key, label]) => (
              <div className="metric" key={key}>
                <div className="label">{label}</div>
                <strong>{metric[key] == null ? "N/D" : `${Math.round(metric[key])}/100`}</strong>
              </div>
            ))}
          </div>

          <div className="panel">
            <h2>Données observées</h2>
            <div className="observed">
              <div><span>Liquidité</span><strong>{fmtUsd(data.observed?.liquidityUsd)}</strong></div>
              <div><span>Volume 24h</span><strong>{fmtUsd(data.observed?.volume24hUsd)}</strong></div>
              <div><span>Transactions 24h</span><strong>{fmtNumber(data.observed?.activity24h)}</strong></div>
              <div><span>Holders</span><strong>{data.observed?.holders == null ? "N/D" : fmtNumber(data.observed.holders)}</strong></div>
            </div>
            {data.missingData?.length > 0 && (
              <div className="missing">
                Données manquantes : {data.missingData.join(", ")}
              </div>
            )}
          </div>

          {data.pair && (
            <div className="panel">
              <h2>Paire principale détectée</h2>
              <div className="pairGrid">
                <div><span>DEX</span><strong>{data.pair.dex || "N/D"}</strong></div>
                <div><span>Prix USD</span><strong>{data.pair.priceUsd == null ? "N/D" : `$${data.pair.priceUsd}`}</strong></div>
                <div><span>Market Cap</span><strong>{fmtUsd(data.pair.marketCap)}</strong></div>
                <div><span>FDV</span><strong>{fmtUsd(data.pair.fdv)}</strong></div>
                <div><span>Création paire</span><strong>{fmtDate(data.pair.pairCreatedAt)}</strong></div>
              </div>
              {data.pair.url && (
                <a className="dexLink" href={data.pair.url} target="_blank" rel="noreferrer">
                  Ouvrir la paire sur DEX Screener ↗
                </a>
              )}
            </div>
          )}

          <div className="note">{data.note}</div>
          <div className="disclaimer">
            Cet outil fournit une analyse technique/structurelle à partir des données disponibles.
            Il ne constitue pas un conseil financier et ne garantit aucun résultat.
          </div>
        </section>
      )}
    </main>
  );
}
