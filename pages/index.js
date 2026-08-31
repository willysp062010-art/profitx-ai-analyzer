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
  if (value == null) return "N/D";

  const n = Number(value);
  if (!Number.isFinite(n)) return "N/D";

  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0
  }).format(n);
}

function fmtPercent(value) {
  if (value == null) return "N/D";

  const n = Number(value);
  if (!Number.isFinite(n)) return "N/D";

  return `${Math.round(n)}/100`;
}

function fmtDate(ms) {
  if (!ms) return "N/D";

  const date = new Date(ms);

  if (Number.isNaN(date.getTime())) return "N/D";

  return date.toLocaleString("fr-FR");
}

function statusLabel(status) {
  switch (status) {
    case "VALID":
      return "VALIDE";

    case "PARTIAL_DATA":
      return "DONNÉES PARTIELLES";

    case "GRADUATED":
      return "GRADUATED";

    case "BONDING_CURVE":
      return "BONDING CURVE";

    case "NO_MARKET":
      return "AUCUN MARCHÉ";

    default:
      return status || "N/D";
  }
}

export default function Home() {
  const [mint, setMint] = useState(DEFAULT_MINT);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function analyze() {
    const cleanMint = mint.trim();

    if (!cleanMint) {
      setError("Veuillez entrer une adresse mint Solana.");
      return;
    }

    setLoading(true);
    setError("");
    setData(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          mint: cleanMint
        })
      });

      const text = await response.text();

      let result;

      try {
        result = text ? JSON.parse(text) : null;
      } catch {
        throw new Error(
          `Le serveur a retourné une réponse invalide (${response.status}).`
        );
      }

      if (!response.ok) {
        throw new Error(
          result?.error ||
          result?.message ||
          `Erreur serveur HTTP ${response.status}.`
        );
      }

      if (!result) {
        throw new Error("Le serveur n'a retourné aucune donnée.");
      }

      setData(result);
    } catch (e) {
      console.error("ProfitX analyse error:", e);
      setError(
        e?.message ||
        "Une erreur est survenue pendant l'analyse."
      );
    } finally {
      setLoading(false);
    }
  }

  const score = data?.score || {};
  const components = score?.components || {};
  const observed = data?.data || {};
  const token = data?.token || {};
  const market = data?.market || {};

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="logo">P</span>
          PROFITX AI
        </div>

        <div className="tag">
          SOLANA TOKEN ANALYZER
        </div>
      </header>

      <section className="hero">
        <div className="eyebrow">
          DATA ENGINE • PFX ENGINE • SCORE
        </div>

        <h1>
          Analyse structurelle
          <br />
          d’un token Solana.
        </h1>

        <p className="intro">
          Un moteur conçu pour séparer les données observables,
          les signaux de risque et le score structurel.
          Pas de promesse de rendement.
        </p>

        <div className="search">
          <input
            value={mint}
            onChange={(e) => setMint(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                analyze();
              }
            }}
            placeholder="Adresse mint Solana"
            spellCheck="false"
            autoComplete="off"
          />

          <button
            onClick={analyze}
            disabled={loading || !mint.trim()}
          >
            {loading ? "Analyse..." : "Analyser"}
          </button>
        </div>

        <div className="hint">
          Les données manquantes restent explicitement signalées :
          elles ne sont pas inventées.
        </div>
      </section>

      {error && (
        <div className="error">
          {error}
        </div>
      )}

      {data && (
        <section className="results">

          <div className="scoreCard">
            <div>
              <div className="label">
                SCORE STRUCTUREL
              </div>

              <div className="score">
                {score.total == null
                  ? "N/D"
                  : score.total}
                <span>/100</span>
              </div>

              <div className={`status ${data.status || ""}`}>
                {statusLabel(data.status)}
              </div>
            </div>

            <div className="meta">
              <div>
                <span>Mint</span>
                <strong>{data.mint || "N/D"}</strong>
              </div>

              <div>
                <span>Source</span>
                <strong>
                  {data.source || "N/D"}
                </strong>
              </div>

              <div>
                <span>Horodatage</span>
                <strong>
                  {fmtDate(
                    data.timestamp
                      ? new Date(data.timestamp).getTime()
                      : null
                  )}
                </strong>
              </div>
            </div>
          </div>

          {token.name || token.symbol ? (
            <div className="panel">
              <h2>Token détecté</h2>

              <div className="pairGrid">
                <div>
                  <span>Nom</span>
                  <strong>
                    {token.name || "N/D"}
                  </strong>
                </div>

                <div>
                  <span>Symbole</span>
                  <strong>
                    {token.symbol || "N/D"}
                  </strong>
                </div>

                <div>
                  <span>Créateur</span>
                  <strong>
                    {token.creator || "N/D"}
                  </strong>
                </div>
              </div>
            </div>
          ) : null}

          <div className="metrics">
            {[
              ["liquidity", "liquidité"],
              ["distribution", "distribution"],
              ["activity", "activité"],
              ["volume", "volume"],
              ["maturity", "maturité"]
            ].map(([key, label]) => (
              <div
                className="metric"
                key={key}
              >
                <div className="label">
                  {label}
                </div>

                <strong>
                  {fmtPercent(components[key])}
                </strong>
              </div>
            ))}
          </div>

          <div className="panel">
            <h2>Données observées</h2>

            <div className="observed">

              <div>
                <span>Liquidité</span>
                <strong>
                  {fmtUsd(observed.liquidityUsd)}
                </strong>
              </div>

              <div>
                <span>Volume 24h</span>
                <strong>
                  {fmtUsd(observed.volume24hUsd)}
                </strong>
              </div>

              <div>
                <span>Transactions 24h</span>
                <strong>
                  {fmtNumber(observed.transactions24h)}
                </strong>
              </div>

              <div>
                <span>Acheteurs 24h</span>
                <strong>
                  {fmtNumber(observed.buys24h)}
                </strong>
              </div>

              <div>
                <span>Vendeurs 24h</span>
                <strong>
                  {fmtNumber(observed.sells24h)}
                </strong>
              </div>

              <div>
                <span>Holders</span>
                <strong>
                  {fmtNumber(observed.holders)}
                </strong>
              </div>

              <div>
                <span>Prix USD</span>
                <strong>
                  {fmtUsd(observed.priceUsd)}
                </strong>
              </div>

              <div>
                <span>Market Cap</span>
                <strong>
                  {fmtUsd(observed.marketCapUsd)}
                </strong>
              </div>

              <div>
                <span>Âge du marché</span>
                <strong>
                  {observed.ageHours == null
                    ? "N/D"
                    : `${observed.ageHours.toFixed(1)} h`}
                </strong>
              </div>

              <div>
                <span>Maturité</span>
                <strong>
                  {fmtPercent(observed.maturity)}
                </strong>
              </div>

            </div>

            {Array.isArray(data.missingData) &&
              data.missingData.length > 0 && (
                <div className="missing">
                  Données manquantes :{" "}
                  {data.missingData.join(", ")}
                </div>
              )}
          </div>

          <div className="panel">
            <h2>Marché détecté</h2>

            <div className="pairGrid">

              <div>
                <span>DEX</span>
                <strong>
                  {market.dexId || "N/D"}
                </strong>
              </div>

              <div>
                <span>Paire</span>
                <strong>
                  {market.pairAddress || "N/D"}
                </strong>
              </div>

              <div>
                <span>Statut Pump.fun</span>
                <strong>
                  {observed.pumpComplete == null
                    ? "N/D"
                    : observed.pumpComplete
                      ? "GRADUATED"
                      : "BONDING CURVE"}
                </strong>
              </div>

              <div>
                <span>PumpSwap Pool</span>
                <strong>
                  {observed.pumpSwapPool || "N/D"}
                </strong>
              </div>

              <div>
                <span>Raydium Pool</span>
                <strong>
                  {observed.raydiumPool || "N/D"}
                </strong>
              </div>

            </div>
          </div>

          <div className="panel">
            <h2>Réserves observées</h2>

            <div className="pairGrid">

              <div>
                <span>Réserves SOL virtuelles</span>
                <strong>
                  {observed.virtualSolReserves == null
                    ? "N/D"
                    : `${observed.virtualSolReserves.toLocaleString(
                        "fr-FR",
                        {
                          maximumFractionDigits: 4
                        }
                      )} SOL`}
                </strong>
              </div>

              <div>
                <span>Réserves tokens virtuelles</span>
                <strong>
                  {observed.virtualTokenReserves == null
                    ? "N/D"
                    : fmtNumber(
                        observed.virtualTokenReserves
                      )}
                </strong>
              </div>

              <div>
                <span>Prix SOL</span>
                <strong>
                  {fmtUsd(observed.solPriceUsd)}
                </strong>
              </div>

            </div>
          </div>

          <div className="panel">
            <h2>Diagnostic</h2>

            <div className="observed">

              <div>
                <span>DexScreener utilisé</span>
                <strong>
                  {data.diagnostics?.dexscreenerUsed
                    ? "OUI"
                    : "NON"}
                </strong>
              </div>

              <div>
                <span>Pump.fun utilisé</span>
                <strong>
                  {data.diagnostics?.pumpfunUsed
                    ? "OUI"
                    : "NON"}
                </strong>
              </div>

              <div>
                <span>Données disponibles</span>
                <strong>
                  {score.availableWeight ?? 0}%
                </strong>
              </div>

            </div>
          </div>

          {data.note && (
            <div className="note">
              {data.note}
            </div>
          )}

          <div className="disclaimer">
            Cet outil fournit une analyse
            technique/structurelle à partir des données
            disponibles. Il ne constitue pas un conseil
            financier et ne garantit aucun résultat.
          </div>

        </section>
      )}
    </main>
  );
}
