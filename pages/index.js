import { useState } from "react";

const DEFAULT_MINT =
  "6FwDVfnnETqUe2UrxZEeLA6u7Vo5Td2Nm79z7s38pump";

function isNumber(value) {
  const n = Number(value);
  return Number.isFinite(n);
}

function fmtUsd(value) {
  if (value == null || !isNumber(value)) return "N/D";

  const n = Number(value);

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: n < 1 ? 8 : 0
  }).format(n);
}

function fmtNumber(value) {
  if (value == null || !isNumber(value)) return "N/D";

  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0
  }).format(Number(value));
}

function fmtPercent(value) {
  if (value == null || !isNumber(value)) return "N/D";

  return `${Math.round(Number(value))}/100`;
}

function fmtDecimal(value, digits = 2) {
  if (value == null || !isNumber(value)) return "N/D";

  return Number(value).toLocaleString("fr-FR", {
    maximumFractionDigits: digits
  });
}

function fmtDate(value) {
  if (!value) return "N/D";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "N/D";

  return date.toLocaleString("fr-FR");
}

function shortAddress(value, start = 8, end = 8) {
  if (!value || typeof value !== "string") return "N/D";

  if (value.length <= start + end + 3) return value;

  return `${value.slice(0, start)}...${value.slice(-end)}`;
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

function getActivityState(observed, activity) {
  const volume = Number(observed?.volume24hUsd ?? 0);
  const transactions = Number(observed?.transactions24h ?? 0);
  const buys = Number(observed?.buys24h ?? 0);
  const sells = Number(observed?.sells24h ?? 0);

  if (
    volume === 0 &&
    transactions === 0 &&
    buys === 0 &&
    sells === 0
  ) {
    return {
      label: "INACTIF",
      description:
        "Aucun mouvement économique détecté sur les dernières 24 heures.",
      className: "inactive"
    };
  }

  if (transactions <= 5 || volume < 100) {
    return {
      label: "FAIBLE ACTIVITÉ",
      description:
        "Quelques mouvements sont détectés, mais l'activité reste faible.",
      className: "low"
    };
  }

  return {
    label: "ACTIF",
    description:
      "Une activité économique récente est détectée sur le marché.",
    className: "active"
  };
}

function getMarketState(data, observed) {
  if (observed?.pumpComplete === false) {
    return "BONDING CURVE";
  }

  if (observed?.pumpComplete === true) {
    return "GRADUATED";
  }

  if (data?.status === "NO_MARKET") {
    return "AUCUN MARCHÉ";
  }

  return statusLabel(data?.status);
}

function ScoreBar({ value }) {
  if (value == null || !isNumber(value)) {
    return (
      <div className="scoreBar">
        <div className="scoreBarTrack">
          <div className="scoreBarFill" style={{ width: "0%" }} />
        </div>
      </div>
    );
  }

  const safe = Math.max(0, Math.min(100, Number(value)));

  return (
    <div className="scoreBar">
      <div className="scoreBarTrack">
        <div
          className="scoreBarFill"
          style={{ width: `${safe}%` }}
        />
      </div>
    </div>
  );
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

  const modules = data?.modules || {};

  const activity = modules?.activity || {};
  const holders = modules?.holders || {};
  const security = modules?.security || {};
  const token2022 = modules?.token2022 || {};
  const metadata = modules?.metadata || {};

  const activityState = getActivityState(
    observed,
    activity
  );

  const marketState = getMarketState(
    data,
    observed
  );

  const availableWeight =
    score?.availableWeight ?? 0;

  const securityScore =
    security?.securityScore ??
    security?.score ??
    components?.security ??
    null;

  const activityScore =
    score?.activity ?? data?.metrics?.activity ?? null;

  const distributionScore =
    components?.distribution ?? null;

  const liquidityScore =
    components?.liquidity ?? null;

  const volumeScore =
    data?.metrics?.volume ?? null;

  const maturityScore =
    components?.maturity ?? null;

  return (
    <main className="shell">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <header className="topbar">

        <div className="brand">
          <span className="logo">P</span>
          PROFITX AI
        </div>

        <div className="tag">
          SOLANA TOKEN ANALYZER
        </div>

      </header>


      {/* =====================================================
          HERO
      ===================================================== */}

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
          Un moteur conçu pour séparer les données
          observables, l’activité réelle du marché,
          les signaux de risque et le score structurel.
          Pas de promesse de rendement.
        </p>

        <div className="search">

          <input
            value={mint}
            onChange={(e) =>
              setMint(e.target.value)
            }
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
            disabled={
              loading || !mint.trim()
            }
          >
            {loading
              ? "Analyse..."
              : "Analyser"}
          </button>

        </div>

        <div className="hint">
          Les données observées sont affichées telles
          quelles. Un zéro réel reste un zéro et n'est
          jamais transformé en donnée manquante.
        </div>

      </section>


      {/* =====================================================
          ERROR
      ===================================================== */}

      {error && (
        <div className="error">
          {error}
        </div>
      )}


      {/* =====================================================
          RESULTS
      ===================================================== */}

      {data && (

        <section className="results">


          {/* =================================================
              SCORE PRINCIPAL
          ================================================= */}

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

              <div
                className={`status ${
                  data.status || ""
                }`}
              >
                {statusLabel(data.status)}
              </div>

            </div>


            <div className="meta">

              <div>
                <span>Mint</span>

                <strong>
                  {shortAddress(data.mint)}
                </strong>
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
                  {fmtDate(data.timestamp)}
                </strong>
              </div>

            </div>

          </div>
          {/* =================================================
              ÉTAT DU MARCHÉ
          ================================================= */}

          <div className="panel">

            <h2>
              État réel du marché
            </h2>

            <div className="pairGrid">

              <div>
                <span>Statut</span>

                <strong>
                  {activityState.label}
                </strong>
              </div>

              <div>
                <span>Marché</span>

                <strong>
                  {marketState}
                </strong>
              </div>

              <div>
                <span>Volume 24h</span>

                <strong>
                  {fmtUsd(
                    observed.volume24hUsd
                  )}
                </strong>
              </div>

              <div>
                <span>Transactions 24h</span>

                <strong>
                  {fmtNumber(
                    observed.transactions24h
                  )}
                </strong>
              </div>

            </div>

            <div className="hint">
              {activityState.description}
            </div>

          </div>


          {/* =================================================
              TOKEN
          ================================================= */}

          {(token.name || token.symbol) && (

            <div className="panel">

              <h2>
                Token détecté
              </h2>

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
                    {shortAddress(
                      token.creator
                    )}
                  </strong>
                </div>

              </div>

              {(token.website ||
                token.twitter) && (

                <div className="hint">

                  {token.website && (
                    <>
                      Site :{" "}
                      <a
                        href={token.website}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {token.website}
                      </a>
                    </>
                  )}

                  {token.website &&
                    token.twitter && (
                      <>{" • "}</>
                    )}

                  {token.twitter && (
                    <>
                      X :{" "}
                      <a
                        href={token.twitter}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Profil X
                      </a>
                    </>
                  )}

                </div>

              )}

            </div>

          )}


          {/* =================================================
              SCORES
          ================================================= */}

          <div className="metrics">

            <div className="metric">
              <div className="label">
                LIQUIDITÉ
              </div>

              <strong>
                {fmtPercent(
                  liquidityScore
                )}
              </strong>

              <ScoreBar
                value={
                  liquidityScore
                }
              />
            </div>


            <div className="metric">
              <div className="label">
                DISTRIBUTION
              </div>

              <strong>
                {fmtPercent(
                  distributionScore
                )}
              </strong>

              <ScoreBar
                value={
                  distributionScore
                }
              />
            </div>


            <div className="metric">
              <div className="label">
                ACTIVITÉ
              </div>

              <strong>
                {fmtPercent(
                  activityScore
                )}
              </strong>

              <ScoreBar
                value={
                  activityScore
                }
              />
            </div>


            <div className="metric">
              <div className="label">
                VOLUME
              </div>

              <strong>
                {fmtPercent(
                  volumeScore
                )}
              </strong>

              <ScoreBar
                value={
                  volumeScore
                }
              />
            </div>


            <div className="metric">
              <div className="label">
                MATURITÉ
              </div>

              <strong>
                {fmtPercent(
                  maturityScore
                )}
              </strong>

              <ScoreBar
                value={
                  maturityScore
                }
              />
            </div>

          </div>


          {/* =================================================
              DONNÉES OBSERVÉES
          ================================================= */}

          <div className="panel">

            <h2>
              Données observées
            </h2>

            <div className="observed">

              <div>
                <span>Liquidité</span>

                <strong>
                  {fmtUsd(
                    observed.liquidityUsd
                  )}
                </strong>
              </div>


              <div>
                <span>Volume 24h</span>

                <strong>
                  {fmtUsd(
                    observed.volume24hUsd
                  )}
                </strong>
              </div>


              <div>
                <span>Transactions 24h</span>

                <strong>
                  {fmtNumber(
                    observed.transactions24h
                  )}
                </strong>
              </div>


              <div>
                <span>Acheteurs 24h</span>

                <strong>
                  {fmtNumber(
                    observed.buys24h
                  )}
                </strong>
              </div>


              <div>
                <span>Vendeurs 24h</span>

                <strong>
                  {fmtNumber(
                    observed.sells24h
                  )}
                </strong>
              </div>


              <div>
                <span>Holders</span>

                <strong>
                  {fmtNumber(
                    observed.holders
                  )}
                </strong>
              </div>


              <div>
                <span>Prix USD</span>

                <strong>
                  {fmtUsd(
                    observed.priceUsd
                  )}
                </strong>
              </div>


              <div>
                <span>Market Cap</span>

                <strong>
                  {fmtUsd(
                    observed.marketCapUsd
                  )}
                </strong>
              </div>


              <div>
                <span>Âge du marché</span>

                <strong>
                  {observed.ageHours == null
                    ? "N/D"
                    : `${Number(
                        observed.ageHours
                      ).toFixed(1)} h`}
                </strong>
              </div>
              <div>
                <span>Maturité</span>

                <strong>
                  {fmtPercent(
                    observed.maturity
                  )}
                </strong>
              </div>

            </div>


            {Array.isArray(
              data.missingData
            ) &&
              data.missingData.length > 0 && (

                <div className="missing">
                  Données manquantes :{" "}
                  {data.missingData.join(
                    ", "
                  )}
                </div>

              )}

          </div>


          {/* =================================================
              ACTIVITÉ
          ================================================= */}

          <div className="panel">

            <h2>
              Activité économique
            </h2>

            <div className="observed">

              <div>
                <span>État 24h</span>

                <strong>
                  {activityState.label}
                </strong>
              </div>

              <div>
                <span>Score activité</span>

                <strong>
                  {fmtPercent(
                    activityScore
                  )}
                </strong>
              </div>

              <div>
                <span>Acheteurs</span>

                <strong>
                  {fmtNumber(
                    observed.buys24h
                  )}
                </strong>
              </div>

              <div>
                <span>Vendeurs</span>

                <strong>
                  {fmtNumber(
                    observed.sells24h
                  )}
                </strong>
              </div>

              <div>
                <span>Transactions</span>

                <strong>
                  {fmtNumber(
                    observed.transactions24h
                  )}
                </strong>
              </div>

              <div>
                <span>Volume</span>

                <strong>
                  {fmtUsd(
                    observed.volume24hUsd
                  )}
                </strong>
              </div>

            </div>


            {activity?.historicalTransactions !=
              null && (

              <div className="hint">
                Activité historique observée :{" "}
                {fmtNumber(
                  activity.historicalTransactions
                )}{" "}
                transaction(s).
              </div>

            )}

          </div>


          {/* =================================================
              DISTRIBUTION / HOLDERS
          ================================================= */}

          <div className="panel">

            <h2>
              Distribution des holders
            </h2>

            <div className="observed">

              <div>
                <span>Holders détectés</span>

                <strong>
                  {fmtNumber(
                    observed.holders
                  )}
                </strong>
              </div>


              <div>
                <span>Score distribution</span>

                <strong>
                  {fmtPercent(
                    distributionScore
                  )}
                </strong>
              </div>


              {holders?.uniqueOwners !=
                null && (

                <div>
                  <span>Owners uniques</span>

                  <strong>
                    {fmtNumber(
                      holders.uniqueOwners
                    )}
                  </strong>
                </div>

              )}


              {holders?.externalHolders !=
                null && (

                <div>
                  <span>Holders externes</span>

                  <strong>
                    {fmtNumber(
                      holders.externalHolders
                    )}
                  </strong>
                </div>

              )}


              {holders?.externalTop1Percent !=
                null && (

                <div>
                  <span>Top holder externe</span>

                  <strong>
                    {fmtDecimal(
                      holders.externalTop1Percent,
                      2
                    )}
                    %
                  </strong>
                </div>

              )}

            </div>


            {holders?.concentration?.label && (

              <div className="hint">
                Concentration :{" "}
                {holders.concentration.label}
              </div>

            )}

          </div>


          {/* =================================================
              MARCHÉ
          ================================================= */}

          <div className="panel">

            <h2>
              Marché détecté
            </h2>

            <div className="pairGrid">

              <div>
                <span>DEX</span>

                <strong>
                  {market.dexId ||
                    "N/D"}
                </strong>
              </div>


              <div>
                <span>Paire</span>

                <strong>
                  {shortAddress(
                    market.pairAddress
                  )}
                </strong>
              </div>


              <div>
                <span>Statut Pump.fun</span>

                <strong>
                  {observed.pumpComplete ==
                  null
                    ? "N/D"
                    : observed.pumpComplete
                    ? "GRADUATED"
                    : "BONDING CURVE"}
                </strong>
              </div>


              <div>
                <span>PumpSwap Pool</span>

                <strong>
                  {shortAddress(
                    observed.pumpSwapPool
                  )}
                </strong>
              </div>


              <div>
                <span>Raydium Pool</span>

                <strong>
                  {shortAddress(
                    observed.raydiumPool
                  )}
                </strong>
              </div>

            </div>

          </div>


          {/* =================================================
              RÉSERVES
          ================================================= */}

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
                  {observed.virtualSolReserves ==
                  null
                    ? "N/D"
                    : `${fmtDecimal(
                        observed.virtualSolReserves,
                        4
                      )} SOL`}
                </strong>
              </div>


              <div>
                <span>
                  Réserves tokens virtuelles
                </span>

                <strong>
                  {observed.virtualTokenReserves ==
                  null
                    ? "N/D"
                    : fmtNumber(
                        observed.virtualTokenReserves
                      )}
                </strong>
              </div>


              <div>
                <span>
                  Prix SOL
                </span>

                <strong>
                  {fmtUsd(
                    observed.solPriceUsd
                  )}
                </strong>
              </div>

            </div>

          </div>


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
