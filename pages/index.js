import Head from "next/head";
import { useState } from "react";

const DEFAULT_MINT = "6FwDVfnnETqUe2UrxZEeLA6u7Vo5Td2Nm79z7s38pump";

export default function Home() {
  const [mint, setMint] = useState(DEFAULT_MINT);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function analyze(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const r = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mint: mint.trim() })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Analyse impossible.");
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const score = result?.score?.total;
  const status = result?.status;

  return (
    <>
      <Head>
        <title>PROFITX AI Analyzer</title>
        <meta name="description" content="PROFITX AI — Solana token structure analyzer." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="page">
        <nav className="nav">
          <div className="brand"><span className="mark">P</span> PROFITX AI</div>
          <span className="badge">SOLANA TOKEN ANALYZER</span>
        </nav>

        <section className="hero">
          <p className="eyebrow">DATA ENGINE • PFX ENGINE • SCORE</p>
          <h1>Analyse structurelle d’un token Solana.</h1>
          <p className="lead">
            Un moteur conçu pour séparer les données observables, les signaux de risque
            et le score structurel. Pas de promesse de rendement.
          </p>

          <form onSubmit={analyze} className="search">
            <input
              value={mint}
              onChange={(e) => setMint(e.target.value)}
              placeholder="Adresse mint Solana"
              aria-label="Adresse mint Solana"
              spellCheck="false"
            />
            <button disabled={loading || !mint.trim()}>
              {loading ? "Analyse…" : "Analyser"}
            </button>
          </form>

          <p className="hint">
            Les données manquantes restent explicitement signalées : elles ne sont pas inventées.
          </p>
        </section>

        {error && <div className="error">{error}</div>}

        {result && (
          <section className="results">
            <div className="scoreCard">
              <div>
                <p className="label">SCORE STRUCTUREL</p>
                <div className="score">{score ?? "—"}<small>/100</small></div>
                <p className="status">{status}</p>
              </div>
              <div className="meta">
                <div><span>Mint</span><code>{result.mint}</code></div>
                <div><span>Horodatage</span><strong>{new Date(result.timestamp).toLocaleString("fr-FR")}</strong></div>
              </div>
            </div>

            <div className="grid">
              {Object.entries(result.score?.components || {}).map(([key, value]) => (
                <article className="card" key={key}>
                  <p className="label">{key}</p>
                  <strong>{value == null ? "N/D" : `${value}/100`}</strong>
                </article>
              ))}
            </div>

            <div className="panel">
              <h2>Données observées</h2>
              <div className="dataGrid">
                <div><span>Liquidité</span><strong>{result.data?.liquidityUsd == null ? "N/D" : `$${Number(result.data.liquidityUsd).toLocaleString("en-US")}`}</strong></div>
                <div><span>Volume 24h</span><strong>{result.data?.volume24hUsd == null ? "N/D" : `$${Number(result.data.volume24hUsd).toLocaleString("en-US")}`}</strong></div>
                <div><span>Holders</span><strong>{result.data?.holders == null ? "N/D" : result.data.holders}</strong></div>
                <div><span>Activité</span><strong>{result.data?.activity == null ? "N/D" : `${result.data.activity}/100`}</strong></div>
              </div>
              {result.missingData?.length > 0 && (
                <p className="missing">Données manquantes : {result.missingData.join(", ")}</p>
              )}
            </div>

            <p className="disclaimer">
              Cet outil fournit une analyse technique/structurelle à partir des données disponibles.
              Il ne constitue pas un conseil financier et ne garantit aucun résultat.
            </p>
          </section>
        )}
      </main>
    </>
  );
}