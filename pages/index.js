import { useState } from "react";

const DEFAULT_MINT =
  "6FwDVfnnETqUe2UrxZEeLA6u7Vo5Td2Nm79z7s38pump";

const API_ENDPOINT = "/api/analyze";

function isNumber(value) {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  );
}

function fmtPercent(value) {
  if (value == null || !isNumber(value)) return "N/D";
  return `${Math.round(Number(value))}/100`;
}

function fmtUsd(value) {
  if (value == null || !isNumber(value)) return "N/D";
  return `${Number(value).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} $`;
}

function fmtInteger(value) {
  if (value == null || !isNumber(value)) return "N/D";
  return Math.round(Number(value)).toLocaleString("fr-FR");
}

function statusClass(status) {
  const normalized = String(status || "").toUpperCase();

  if (
    normalized.includes("LOW") ||
    normalized.includes("FAIBLE") ||
    normalized.includes("ACTIVE") ||
    normalized.includes("ACTIF") ||
    normalized.includes("HEALTHY") ||
    normalized.includes("READY") ||
    normalized.includes("VERIFIED")
  ) {
    return "good";
  }

  if (
    normalized.includes("MEDIUM") ||
    normalized.includes("MOYEN") ||
    normalized.includes("WARNING") ||
    normalized.includes("ATTENTION") ||
    normalized.includes("BONDING")
  ) {
    return "warning";
  }

  if (
    normalized.includes("HIGH") ||
    normalized.includes("ÉLEVÉ") ||
    normalized.includes("CRITICAL") ||
    normalized.includes("ERROR") ||
    normalized.includes("FAILED")
  ) {
    return "danger";
  }

  return "";
}

function Card({
  title,
  value,
  subtitle,
  className = "",
}) {
  return (
    <div className={`card ${className}`}>
      <div className="card-title">{title}</div>
      <div className="card-value">{value}</div>
      {subtitle ? (
        <div className="card-subtitle">{subtitle}</div>
      ) : null}
    </div>
  );
}

function Section({
  title,
  children,
}) {
  return (
    <section className="section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Row({
  label,
  value,
}) {
  return (
    <div className="row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function App() {
  const [mint, setMint] = useState(DEFAULT_MINT);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function analyze() {
    const cleanMint = String(mint || "").trim();

    if (!cleanMint) {
      setError("Veuillez entrer une adresse de token.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mint: cleanMint,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            data?.message ||
            `Erreur HTTP ${response.status}`
        );
      }

      if (!data) {
        throw new Error("Réponse vide de l'API.");
      }

      setResult(data);
    } catch (err) {
      setError(
        err?.message ||
          "Une erreur est survenue pendant l'analyse."
      );
    } finally {
      setLoading(false);
    }
  }

  const data = result || {};
  const score = data?.score || {};
  const components = score?.components || {};
  const metrics = data?.metrics || {};
  const token = data?.token || {};
  const marketData = data?.market || {};
  const security = data?.security || {};
  const holders = data?.holders || {};
  const distribution = holders?.distribution || {};
  const activity = data?.activity || {};
  const diagnostics = data?.diagnostics || {};

  const structuralScore =
    score?.structural ?? null;

  const totalScore =
    score?.total ?? null;

  const marketScore =
    score?.market ?? null;

  const activityScore =
    score?.activity ?? null;

  const distributionScore =
    components?.distribution ?? null;

  const liquidityScore =
    components?.liquidity ?? null;

  const volumeScore =
    score?.volume ?? null;

  const maturityScore =
    components?.maturity ?? null;

  const securityScore =
    components?.security ?? null;

  const observedLiquidity =
    metrics?.liquidityUsd ??
    marketData?.liquidityUsd ??
    data?.liquidityUsd ??
    null;

  const observedVolume =
    metrics?.volumeUsd ??
    activity?.volumeUsd ??
    marketData?.volume24hUsd ??
    data?.volume24hUsd ??
    null;

  const transactions =
    activity?.transactions ??
    activity?.transactions24h ??
    marketData?.transactions24h ??
    data?.transactions24h ??
    null;

  const buyers =
    activity?.buyers ??
    activity?.buyers24h ??
    marketData?.buyers24h ??
    null;

  const sellers =
    activity?.sellers ??
    activity?.sellers24h ??
    marketData?.sellers24h ??
    null;

  const marketStatus =
    activity?.marketStatus ??
    marketData?.status ??
    data?.marketStatus ??
    "N/D";

  const activityStatus =
    activity?.activityStatus ??
    activity?.status ??
    data?.activityStatus ??
    "N/D";

  const tokenName =
    token?.name ??
    data?.name ??
    "N/D";

  const tokenSymbol =
    token?.symbol ??
    data?.symbol ??
    "N/D";

  const source =
    data?.source ??
    token?.source ??
    "N/D";

  const mintAddress =
    data?.mint ??
    token?.mint ??
    mint;

  const securityRisk =
    security?.risk ??
    security?.riskLevel ??
    data?.risk ??
    "N/D";

  const mintRevoked =
    security?.mintRevoked ??
    security?.mintAuthorityRevoked ??
    null;

  const freezeRevoked =
    security?.freezeRevoked ??
    security?.freezeAuthorityRevoked ??
    null;

  const token2022 =
    security?.token2022 ??
    token?.token2022 ??
    null;

  const extensions =
    security?.extensions ??
    token?.extensions ??
    [];

  const holdersCount =
    holders?.holders ??
    holders?.holderCount ??
    holders?.totalHolders ??
    null;

  const uniqueOwners =
    holders?.uniqueOwners ??
    holders?.ownersUniques ??
    null;

  const externalHolders =
    holders?.externalHolders ??
    null;

  const externalTop1Percent =
    distribution?.externalTop1Percent ??
    null;

  const externalTop10Percent =
    distribution?.externalTop10Percent ??
    null;

  const liquidityStatus =
    marketData?.liquidityStatus ??
    metrics?.liquidityStatus ??
    "N/D";

  const maturityStatus =
    data?.maturityStatus ??
    metrics?.maturityStatus ??
    "N/D";

  const dataAvailability =
    diagnostics?.dataAvailability ??
    data?.dataAvailability ??
    null;

  const dexScreener =
    diagnostics?.dexScreener ??
    diagnostics?.dexscreener ??
    null;

  const pumpFun =
    diagnostics?.pumpFun ??
    diagnostics?.pumpfun ??
    null;

  const activityAvailable =
    diagnostics?.activity ??
    null;

  const holdersAvailable =
    diagnostics?.holders ??
    null;

  const securityAvailable =
    diagnostics?.security ??
    null;

  const completeAnalysis =
    diagnostics?.completeAnalysis ??
    data?.completeAnalysis ??
    null;

  const scoreAvailable =
    totalScore != null;

  return (
    <main className="app">
      <style>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background: #05070a;
          color: #f4f7f8;
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        .app {
          width: 100%;
          max-width: 1180px;
          margin: 0 auto;
          padding: 32px 20px 60px;
        }

        .hero {
          display: flex;
          flex-direction: column;
          gap: 18px;
          margin-bottom: 28px;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .logo {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #10151b;
          border: 1px solid #202831;
          font-weight: 900;
          font-size: 18px;
          letter-spacing: 1px;
        }

        .brand h1 {
          margin: 0;
          font-size: 28px;
          line-height: 1;
          letter-spacing: -0.5px;
        }

        .brand p {
          margin: 6px 0 0;
          color: #8f9aa5;
          font-size: 13px;
        }

        .search {
          display: flex;
          gap: 10px;
          width: 100%;
        }

        .search input {
          flex: 1;
          min-width: 0;
          height: 48px;
          border-radius: 12px;
          border: 1px solid #26313b;
          background: #0b1015;
          color: #fff;
          padding: 0 15px;
          outline: none;
          font-family: monospace;
          font-size: 14px;
        }

        .search input:focus {
          border-color: #5c6874;
        }

        .search button {
          height: 48px;
          padding: 0 22px;
          border: 0;
          border-radius: 12px;
          background: #d9ff3f;
          color: #05070a;
          font-weight: 900;
          cursor: pointer;
        }

        .search button:disabled {
          opacity: .55;
          cursor: wait;
        }

        .error {
          padding: 14px 16px;
          border-radius: 12px;
          border: 1px solid #56262c;
          background: #1b0d10;
          color: #ff9ba4;
          margin-bottom: 20px;
        }

        .grid {
          display: grid;
          grid-template-columns:
            repeat(5, minmax(0, 1fr));
          gap: 12px;
        }

        .card {
          min-width: 0;
          border: 1px solid #1d252d;
          background: #0a0e13;
          border-radius: 14px;
          padding: 16px;
        }

        .card-title {
          color: #7f8a95;
          text-transform: uppercase;
          letter-spacing: .8px;
          font-size: 10px;
          font-weight: 800;
        }

        .card-value {
          margin-top: 9px;
          font-size: 25px;
          font-weight: 900;
          letter-spacing: -.5px;
        }

        .card-subtitle {
          margin-top: 6px;
          color: #7f8a95;
          font-size: 11px;
        }

        .score-main {
          grid-column: span 2;
          background: #0d1318;
        }

        .score-main .card-value {
          font-size: 42px;
        }

        .section {
          margin-top: 22px;
          border: 1px solid #1d252d;
          background: #080c11;
          border-radius: 16px;
          padding: 20px;
        }

        .section h2 {
          margin: 0 0 16px;
          font-size: 16px;
          letter-spacing: .2px;
        }

        .rows {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 1px 28px;
        }

        .row {
          min-height: 42px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          border-bottom: 1px solid #151b21;
          color: #9aa4ad;
          font-size: 13px;
        }

        .row strong {
          color: #f3f5f7;
          text-align: right;
        }

        .pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 28px;
          padding: 0 10px;
          border-radius: 999px;
          border: 1px solid #29323b;
          background: #0d1217;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .4px;
        }

        .pill.good {
          border-color: #34421b;
          color: #d9ff3f;
        }

        .pill.warning {
          border-color: #4d4120;
          color: #f0d36b;
        }

        .pill.danger {
          border-color: #51262b;
          color: #ff8e98;
        }

        .mono {
          font-family: monospace;
          word-break: break-all;
        }

        .diagnostic-grid {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
          gap: 10px;
        }

        .diagnostic {
          border: 1px solid #1c242c;
          border-radius: 12px;
          padding: 13px;
          background: #0b1015;
        }

        .diagnostic-label {
          color: #7f8a95;
          font-size: 10px;
          text-transform: uppercase;
          font-weight: 800;
        }

        .diagnostic-value {
          margin-top: 7px;
          font-size: 14px;
          font-weight: 800;
        }

        .empty {
          border: 1px dashed #28313a;
          border-radius: 14px;
          padding: 30px;
          text-align: center;
          color: #77828d;
          margin-top: 20px;
        }

        @media (max-width: 900px) {
          .grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .score-main {
            grid-column: span 2;
          }

          .rows {
            grid-template-columns: 1fr;
          }

          .diagnostic-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 600px) {
          .app {
            padding: 20px 12px 40px;
          }

          .search {
            flex-direction: column;
          }

          .search button {
            width: 100%;
          }

          .grid {
            grid-template-columns: 1fr;
          }

          .score-main {
            grid-column: span 1;
          }

          .diagnostic-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="hero">
        <div className="brand">
          <div className="logo">PFX</div>
          <div>
            <h1>PROFITX AI</h1>
            <p>Token intelligence & risk analysis</p>
          </div>
        </div>

        <div className="search">
          <input
            value={mint}
            onChange={(event) =>
              setMint(event.target.value)
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                analyze();
              }
            }}
            placeholder="Adresse du token Solana"
            spellCheck={false}
          />

          <button
            type="button"
            onClick={analyze}
            disabled={loading}
          >
            {loading ? "ANALYSE..." : "ANALYSER"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="error">
          {error}
        </div>
      ) : null}

      {!result && !loading ? (
        <div className="empty">
          Entrez une adresse de token Solana puis lancez
          l'analyse.
        </div>
      ) : null}

      {loading ? (
        <div className="empty">
          Analyse du token en cours...
        </div>
      ) : null}

      {result ? (
        <>
          <div className="grid">
            <Card
              title="Score global"
              value={
                scoreAvailable
                  ? fmtPercent(totalScore)
                  : "N/D"
              }
              subtitle={
                source !== "N/D"
                  ? `Source : ${source}`
                  : undefined
              }
              className="score-main"
            />

            <Card
              title="Structure"
              value={fmtPercent(structuralScore)}
            />

            <Card
              title="Marché"
              value={fmtPercent(marketScore)}
            />

            <Card
              title="Liquidité"
              value={fmtPercent(liquidityScore)}
            />

            <Card
              title="Distribution"
              value={fmtPercent(distributionScore)}
            />

            <Card
              title="Activité"
              value={fmtPercent(activityScore)}
            />

            <Card
              title="Volume"
              value={fmtPercent(volumeScore)}
            />

            <Card
              title="Maturité"
              value={fmtPercent(maturityScore)}
            />

            <Card
              title="Sécurité"
              value={fmtPercent(securityScore)}
            />
          </div>

          <Section title="Token">
            <div className="rows">
              <Row
                label="Nom"
                value={tokenName}
              />

              <Row
                label="Symbole"
                value={tokenSymbol}
              />

              <Row
                label="Source"
                value={source}
              />

              <Row
                label="Statut marché"
                value={
                  <span
                    className={`pill ${statusClass(
                      marketStatus
                    )}`}
                  >
                    {marketStatus}
                  </span>
                }
              />

              <Row
                label="Adresse"
                value={
                  <span className="mono">
                    {mintAddress}
                  </span>
                }
              />

              <Row
                label="Token-2022"
                value={
                  token2022 == null
                    ? "N/D"
                    : token2022
                    ? "OUI"
                    : "NON"
                }
              />
            </div>
          </Section>

          <Section title="Marché & activité">
            <div className="rows">
              <Row
                label="Liquidité observée"
                value={fmtUsd(observedLiquidity)}
              />

              <Row
                label="Volume 24h"
                value={fmtUsd(observedVolume)}
              />

              <Row
                label="Transactions 24h"
                value={fmtInteger(transactions)}
              />

              <Row
                label="Acheteurs 24h"
                value={fmtInteger(buyers)}
              />

              <Row
                label="Vendeurs 24h"
                value={fmtInteger(sellers)}
              />

              <Row
                label="État activité"
                value={
                  <span
                    className={`pill ${statusClass(
                      activityStatus
                    )}`}
                  >
                    {activityStatus}
                  </span>
                }
              />
            </div>
          </Section>

          <Section title="Distribution">
            <div className="rows">
              <Row
                label="Holders"
                value={fmtInteger(holdersCount)}
              />

              <Row
                label="Owners uniques"
                value={fmtInteger(uniqueOwners)}
              />

              <Row
                label="Holders externes"
                value={fmtInteger(externalHolders)}
              />

              <Row
                label="Top holder externe"
                value={
                  externalTop1Percent == null
                    ? "N/D"
                    : `${Number(
                        externalTop1Percent
                      ).toFixed(2)} %`
                }
              />

              <Row
                label="Top 10 externes"
                value={
                  externalTop10Percent == null
                    ? "N/D"
                    : `${Number(
                        externalTop10Percent
                      ).toFixed(2)} %`
                }
              />
            </div>
          </Section>

          <Section title="Sécurité">
            <div className="rows">
              <Row
                label="Score sécurité"
                value={fmtPercent(securityScore)}
              />

              <Row
                label="Risque"
                value={
                  <span
                    className={`pill ${statusClass(
                      securityRisk
                    )}`}
                  >
                    {securityRisk}
                  </span>
                }
              />

              <Row
                label="Mint authority"
                value={
                  mintRevoked == null
                    ? "N/D"
                    : mintRevoked
                    ? "RÉVOQUÉE"
                    : "ACTIVE"
                }
              />

              <Row
                label="Freeze authority"
                value={
                  freezeRevoked == null
                    ? "N/D"
                    : freezeRevoked
                    ? "RÉVOQUÉE"
                    : "ACTIVE"
                }
              />

              <Row
                label="Extensions"
                value={
                  Array.isArray(extensions)
                    ? extensions.length
                    : "N/D"
                }
              />

              <Row
                label="Analyse complète"
                value={
                  completeAnalysis == null
                    ? "N/D"
                    : completeAnalysis
                    ? "OUI"
                    : "NON"
                }
              />
            </div>
          </Section>

          <Section title="Diagnostic des données">
            <div className="diagnostic-grid">
              <div className="diagnostic">
                <div className="diagnostic-label">
                  DexScreener
                </div>
                <div className="diagnostic-value">
                  {dexScreener == null
                    ? "N/D"
                    : dexScreener
                    ? "OUI"
                    : "NON"}
                </div>
              </div>

              <div className="diagnostic">
                <div className="diagnostic-label">
                  Pump.fun
                </div>
                <div className="diagnostic-value">
                  {pumpFun == null
                    ? "N/D"
                    : pumpFun
                    ? "OUI"
                    : "NON"}
                </div>
              </div>

              <div className="diagnostic">
                <div className="diagnostic-label">
                  Activité
                </div>
                <div className="diagnostic-value">
                  {activityAvailable == null
                    ? "N/D"
                    : activityAvailable
                    ? "OUI"
                    : "NON"}
                </div>
              </div>

              <div className="diagnostic">
                <div className="diagnostic-label">
                  Holders
                </div>
                <div className="diagnostic-value">
                  {holdersAvailable == null
                    ? "N/D"
                    : holdersAvailable
                    ? "OUI"
                    : "NON"}
                </div>
              </div>
            </div>

            {dataAvailability != null ? (
              <div
                style={{
                  marginTop: "14px",
                  color: "#7f8a95",
                  fontSize: "12px",
                }}
              >
                Disponibilité des données :{" "}
                <strong
                  style={{ color: "#f4f7f8" }}
                >
                  {typeof dataAvailability ===
                  "number"
                    ? `${Math.round(
                        dataAvailability
                      )}%`
                    : String(dataAvailability)}
                </strong>
              </div>
            ) : null}
          </Section>
          {/* =================================================
              MARCHÉ / LIQUIDITÉ
          ================================================= */}

          <div className="panel">

            <h2>
              Marché & liquidité
            </h2>

            <div className="observed">

              <div>
                <span>
                  Statut marché
                </span>

                <strong>
                  {marketStatus}
                </strong>
              </div>


              <div>
                <span>
                  Liquidité observée
                </span>

                <strong>
                  {fmtUsd(observedLiquidity)}
                </strong>
              </div>


              <div>
                <span>
                  Score liquidité
                </span>

                <strong>
                  {fmtPercent(
                    liquidityScore
                  )}
                </strong>
              </div>


              <div>
                <span>
                  Volume 24h
                </span>

                <strong>
                  {fmtUsd(observedVolume)}
                </strong>
              </div>


              <div>
                <span>
                  Score volume
                </span>

                <strong>
                  {fmtPercent(volumeScore)}
                </strong>
              </div>


              <div>
                <span>
                  Transactions 24h
                </span>

                <strong>
                  {fmtInteger(transactions)}
                </strong>
              </div>


              <div>
                <span>
                  Acheteurs 24h
                </span>

                <strong>
                  {fmtInteger(buyers)}
                </strong>
              </div>


              <div>
                <span>
                  Vendeurs 24h
                </span>

                <strong>
                  {fmtInteger(sellers)}
                </strong>
              </div>


              <div>
                <span>
                  Activité économique
                </span>

                <strong>
                  {activityStatus}
                </strong>
              </div>

            </div>

          </div>


          {/* =================================================
              HOLDERS / DISTRIBUTION
          ================================================= */}

          <div className="panel">

            <h2>
              Distribution
            </h2>

            <div className="observed">

              <div>
                <span>
                  Holders
                </span>

                <strong>
                  {fmtNumber(
                    holders?.count ??
                      holders?.holders ??
                      holders?.totalHolders
                  )}
                </strong>
              </div>


              <div>
                <span>
                  Owners uniques
                </span>

                <strong>
                  {fmtNumber(
                    holders?.uniqueOwners
                  )}
                </strong>
              </div>


              <div>
                <span>
                  Holders externes
                </span>

                <strong>
                  {fmtNumber(
                    holders?.externalHolders
                  )}
                </strong>
              </div>


              <div>
                <span>
                  Top holder externe
                </span>

                <strong>
                  {distribution
                    ?.externalTop1Percent ==
                  null
                    ? "N/D"
                    : `${Number(
                        distribution.externalTop1Percent
                      ).toFixed(2)} %`}
                </strong>
              </div>


              <div>
                <span>
                  Top 10 externes
                </span>

                <strong>
                  {distribution
                    ?.externalTop10Percent ==
                  null
                    ? "N/D"
                    : `${Number(
                        distribution.externalTop10Percent
                      ).toFixed(2)} %`}
                </strong>
              </div>


              <div>
                <span>
                  Score distribution
                </span>

                <strong>
                  {fmtPercent(
                    distributionScore
                  )}
                </strong>
              </div>

            </div>

          </div>


          {/* =================================================
              MATURITÉ
          ================================================= */}

          <div className="panel">

            <h2>
              Maturité
            </h2>

            <div className="observed">

              <div>
                <span>
                  Score maturité
                </span>

                <strong>
                  {fmtPercent(
                    maturityScore
                  )}
                </strong>
              </div>


              <div>
                <span>
                  Statut maturité
                </span>

                <strong>
                  {maturityStatus}
                </strong>
              </div>


              <div>
                <span>
                  Analyse complète
                </span>

                <strong>
                  {completeAnalysis == null
                    ? "N/D"
                    : completeAnalysis
                    ? "OUI"
                    : "NON"}
                </strong>
              </div>

            </div>

          </div>


          {/* =================================================
              OBSERVATIONS
          ================================================= */}

          {data.observed && (

            <div className="panel">

              <h2>
                Données observées
              </h2>

              <div className="observed">

                <div>
                  <span>
                    Source marché
                  </span>

                  <strong>
                    {data.observed.source ||
                      source ||
                      "N/D"}
                  </strong>
                </div>


                <div>
                  <span>
                    Prix token
                  </span>

                  <strong>
                    {fmtUsd(
                      data.observed.priceUsd
                    )}
                  </strong>
                </div>


                <div>
                  <span>
                    Market Cap
                  </span>

                  <strong>
                    {fmtUsd(
                      data.observed.marketCapUsd
                    )}
                  </strong>
                </div>


                <div>
                  <span>
                    Liquidité USD
                  </span>

                  <strong>
                    {fmtUsd(
                      data.observed.liquidityUsd
                    )}
                  </strong>
                </div>


                <div>
                  <span>
                    Volume 24h
                  </span>

                  <strong>
                    {fmtUsd(
                      data.observed.volume24hUsd
                    )}
                  </strong>
                </div>


                <div>
                  <span>
                    Transactions 24h
                  </span>

                  <strong>
                    {fmtNumber(
                      data.observed.transactions24h
                    )}
                  </strong>
                </div>


                <div>
                  <span>
                    Acheteurs 24h
                  </span>

                  <strong>
                    {fmtNumber(
                      data.observed.buyers24h
                    )}
                  </strong>
                </div>


                <div>
                  <span>
                    Vendeurs 24h
                  </span>

                  <strong>
                    {fmtNumber(
                      data.observed.sellers24h
                    )}
                  </strong>
                </div>


                <div>
                  <span>
                    Statut Pump.fun
                  </span>

                  <strong>
                    {data.observed
                      .pumpComplete ==
                    null
                      ? "N/D"
                      : data.observed
                          .pumpComplete
                      ? "GRADUATED"
                      : "BONDING CURVE"}
                  </strong>
                </div>


                <div>
                  <span>
                    PumpSwap Pool
                  </span>

                  <strong>
                    {shortAddress(
                      data.observed
                        .pumpSwapPool
                    )}
                  </strong>
                </div>


                <div>
                  <span>
                    Raydium Pool
                  </span>

                  <strong>
                    {shortAddress(
                      data.observed
                        .raydiumPool
                    )}
                  </strong>
                </div>

              </div>

            </div>

          )}


          {/* =================================================
              RÉSERVES
          ================================================= */}

          {data.observed && (

            <div className="panel">

              <h2>
                Réserves observées
              </h2>

              <div className="pairGrid">

                <div>
                  <span>
                    Réserves SOL virtuelles
                  </span>

                  <strong>
                    {data.observed
                      .virtualSolReserves ==
                    null
                      ? "N/D"
                      : `${fmtDecimal(
                          data.observed
                            .virtualSolReserves,
                          4
                        )} SOL`}
                  </strong>
                </div>


                <div>
                  <span>
                    Réserves tokens virtuelles
                  </span>

                  <strong>
                    {data.observed
                      .virtualTokenReserves ==
                    null
                      ? "N/D"
                      : fmtNumber(
                          data.observed
                            .virtualTokenReserves
                        )}
                  </strong>
                </div>


                <div>
                  <span>
                    Prix SOL
                  </span>

                  <strong>
                    {fmtUsd(
                      data.observed
                        .solPriceUsd
                    )}
                  </strong>
                </div>

              </div>

            </div>

          )}


          {/* =================================================
              SÉCURITÉ
          ================================================= */}

          <div className="panel">

            <h2>
              Sécurité
            </h2>

            <div className="observed">

              <div>
                <span>
                  Score sécurité
                </span>

                <strong>
                  {fmtPercent(
                    securityScore
                  )}
                </strong>
              </div>


              <div>
                <span>
                  Mint authority
                </span>

                <strong>
                  {security?.mintAuthority ==
                  null
                    ? "RÉVOQUÉE"
                    : "ACTIVE"}
                </strong>
              </div>


              <div>
                <span>
                  Freeze authority
                </span>

                <strong>
                  {security?.freezeAuthority ==
                  null
                    ? "RÉVOQUÉE"
                    : "ACTIVE"}
                </strong>
              </div>


              <div>
                <span>
                  Risque
                </span>

                <strong>
                  {security?.riskLevel ||
                    "N/D"}
                </strong>
              </div>

            </div>


            {Array.isArray(
              security?.warnings
            ) &&
              security.warnings.length > 0 && (

                <div className="missing">
                  {security.warnings.join(
                    " • "
                  )}
                </div>

              )}

          </div>


          {/* =================================================
              TOKEN 2022
          ================================================= */}

          {token2022?.available && (

            <div className="panel">

              <h2>
                Token-2022
              </h2>

              <div className="observed">

                <div>
                  <span>
                    Token-2022 détecté
                  </span>

                  <strong>
                    {token2022.isToken2022
                      ? "OUI"
                      : "NON"}
                  </strong>
                </div>


                <div>
                  <span>
                    Extensions
                  </span>

                  <strong>
                    {fmtNumber(
                      token2022.extensionCount
                    )}
                  </strong>
                </div>


                <div>
                  <span>
                    Analyse complète
                  </span>

                  <strong>
                    {token2022.analysisComplete
                      ? "OUI"
                      : "NON"}
                  </strong>
                </div>

              </div>


              {Array.isArray(
                token2022.findings
              ) &&
                token2022.findings.length > 0 && (

                  <div className="hint">

                    {token2022.findings.map(
                      (finding, index) => (

                        <div key={index}>
                          {finding?.message ||
                            finding?.code ||
                            "Information Token-2022"}
                        </div>

                      )
                    )}

                  </div>

                )}

            </div>

          )}


          {/* =================================================
              METADATA
          ================================================= */}

          {metadata?.available && (

            <div className="panel">

              <h2>
                Métadonnées
              </h2>

              <div className="observed">

                <div>
                  <span>
                    Nom
                  </span>

                  <strong>
                    {metadata.name ||
                      token.name ||
                      "N/D"}
                  </strong>
                </div>


                <div>
                  <span>
                    Symbole
                  </span>

                  <strong>
                    {metadata.symbol ||
                      token.symbol ||
                      "N/D"}
                  </strong>
                </div>


                <div>
                  <span>
                    Metadata décodée
                  </span>

                  <strong>
                    {metadata.decoded
                      ? "OUI"
                      : "NON"}
                  </strong>
                </div>


                <div>
                  <span>
                    Update authority
                  </span>

                  <strong>
                    {metadata.updateAuthority ==
                    null
                      ? "RÉVOQUÉE"
                      : "ACTIVE"}
                  </strong>
                </div>

              </div>

            </div>

          )}


          {/* =================================================
              DIAGNOSTIC
          ================================================= */}

          <div className="panel">

            <h2>
              Diagnostic du moteur
            </h2>

            <div className="observed">

              <div>
                <span>
                  DexScreener utilisé
                </span>

                <strong>
                  {data.diagnostics
                    ?.dexscreenerUsed
                    ? "OUI"
                    : "NON"}
                </strong>
              </div>


              <div>
                <span>
                  Pump.fun utilisé
                </span>

                <strong>
                  {data.diagnostics
                    ?.pumpfunUsed
                    ? "OUI"
                    : "NON"}
                </strong>
              </div>


              <div>
                <span>
                  Activité utilisée
                </span>

                <strong>
                  {data.diagnostics
                    ?.activityV3Used
                    ? "OUI"
                    : "NON"}
                </strong>
              </div>


              <div>
                <span>
                  Holders utilisés
                </span>

                <strong>
                  {data.diagnostics
                    ?.holdersV2Used
                    ? "OUI"
                    : "NON"}
                </strong>
              </div>


              <div>
                <span>
                  Sécurité utilisée
                </span>

                <strong>
                  {data.diagnostics
                    ?.securityV1Used
                    ? "OUI"
                    : "NON"}
                </strong>
              </div>


              <div>
                <span>
                  Données disponibles
                </span>

                <strong>
                  {availableWeight}%
                </strong>
              </div>

            </div>

          </div>


          {/* =================================================
              NOTE AUTOMATIQUE
          ================================================= */}

          <div className="panel">

            <h2>
              Diagnostic ProfitX
            </h2>

            <p className="intro">

              {activityState.label ===
              "INACTIF"
                ? "ProfitX ne détecte actuellement aucun mouvement économique sur les dernières 24 heures. Les valeurs nulles de volume et de transactions correspondent à une absence d'activité observée et non à des données manquantes."
                : activityState.label ===
                  "FAIBLE ACTIVITÉ"
                ? "ProfitX détecte une activité récente mais encore faible. Les données observées doivent être interprétées avec prudence tant que le marché n'a pas développé une activité plus importante."
                : "ProfitX détecte une activité économique récente. Les données de volume, transactions, acheteurs et vendeurs peuvent être utilisées pour compléter l'analyse structurelle."}

            </p>

          </div>


          {/* =================================================
              NOTE BACKEND
          ================================================= */}

          {data.note && (

            <div className="note">
              {data.note}
            </div>

          )}


          {/* =================================================
              DISCLAIMER
          ================================================= */}

          <div className="disclaimer">

            Cet outil fournit une analyse
            technique et structurelle à partir
            de données observables. Il ne constitue
            pas un conseil financier et ne garantit
            aucun résultat.

          </div>


        </section>

      )}

    </main>
  );
}
