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


function getDistributionView(holders) {
  const nested =
    holders?.distribution || {};

  const externalValues = {
    top1:
      holders?.externalTop1Percent ??
      nested?.externalTop1Percent ??
      null,

    top5:
      holders?.externalTop5Percent ??
      nested?.externalTop5Percent ??
      null,

    top10:
      holders?.externalTop10Percent ??
      nested?.externalTop10Percent ??
      null
  };

  const totalValues = {
    top1:
      holders?.totalTop1Percent ??
      nested?.totalTop1Percent ??
      null,

    top5:
      holders?.totalTop5Percent ??
      nested?.totalTop5Percent ??
      null,

    top10:
      holders?.totalTop10Percent ??
      nested?.totalTop10Percent ??
      null
  };

  const hasExternal =
    Object.values(externalValues).some(
      (value) =>
        value != null &&
        isNumber(value)
    );

  if (hasExternal) {
    return {
      mode: "external",
      label: "Concentration externe exacte",
      description:
        "Les pourcentages ci-dessous correspondent aux holders externes identifiés par l'analyse ProfitX.",
      values: externalValues
    };
  }

  const hasTotal =
    Object.values(totalValues).some(
      (value) =>
        value != null &&
        isNumber(value)
    );

  if (hasTotal) {
    return {
      mode: "total",
      label: "Concentration totale observée",
      description:
        "Les pourcentages ci-dessous correspondent à la concentration totale disponible pour ce token.",
      values: totalValues
    };
  }

  return null;
}


function buildProfitxDiagnostic({
  totalScore,
  liquidityScore,
  distributionScore,
  activityScore,
  volumeScore,
  maturityScore,
  securityScore,
  activityState,
  missingData
}) {
  const numericTotal =
    isNumber(totalScore)
      ? Number(totalScore)
      : null;

  let level = "Analyse partielle";

  let summary =
    "Le score global ne peut pas être interprété complètement avec les données actuellement disponibles.";

  if (numericTotal !== null) {
    if (numericTotal >= 90) {
      level = "Structure très solide";

      summary =
        "Les indicateurs disponibles décrivent une structure globalement très solide selon le modèle ProfitX.";
    } else if (numericTotal >= 75) {
      level = "Structure solide";

      summary =
        "Les indicateurs disponibles décrivent une structure globalement solide, avec quelques éléments qui peuvent encore réduire le score.";
    } else if (numericTotal >= 55) {
      level = "Structure intermédiaire";

      summary =
        "Le profil observé est intermédiaire : plusieurs indicateurs sont satisfaisants, mais certains points limitent encore nettement le score.";
    } else if (numericTotal >= 35) {
      level = "Structure fragile";

      summary =
        "Plusieurs indicateurs observés limitent actuellement la solidité du profil analysé.";
    } else {
      level = "Structure très fragile";

      summary =
        "Le profil présente actuellement plusieurs indicateurs faibles ou insuffisants selon le modèle ProfitX.";
    }
  }

  const metrics = [
    {
      label: "Liquidité",
      value: liquidityScore
    },
    {
      label: "Distribution",
      value: distributionScore
    },
    {
      label: "Activité",
      value: activityScore
    },
    {
      label: "Volume",
      value: volumeScore
    },
    {
      label: "Maturité",
      value: maturityScore
    },
    {
      label: "Sécurité",
      value: securityScore
    }
  ].filter(
    (item) =>
      item.value != null &&
      isNumber(item.value)
  );

  const strengths =
    metrics
      .filter(
        (item) =>
          Number(item.value) >= 80
      )
      .sort(
        (a, b) =>
          Number(b.value) -
          Number(a.value)
      );

  const watch =
    metrics
      .filter(
        (item) =>
          Number(item.value) < 60
      )
      .sort(
        (a, b) =>
          Number(a.value) -
          Number(b.value)
      );

  const intermediate =
    metrics
      .filter(
        (item) =>
          Number(item.value) >= 60 &&
          Number(item.value) < 80
      )
      .sort(
        (a, b) =>
          Number(a.value) -
          Number(b.value)
      );

  let marketMessage =
    "L'état récent du marché n'est pas disponible.";

  if (
    activityState?.label === "INACTIF"
  ) {
    marketMessage =
      "Aucun mouvement économique n'est détecté sur les dernières 24 heures. Les zéros de volume et de transactions sont traités comme de vrais zéros, pas comme des données manquantes.";
  } else if (
    activityState?.label === "FAIBLE ACTIVITÉ"
  ) {
    marketMessage =
      "Une activité récente est détectée, mais elle reste faible sur les dernières 24 heures.";
  } else if (
    activityState?.label === "ACTIF"
  ) {
    marketMessage =
      "Une activité économique récente est détectée sur les dernières 24 heures.";
  }

  return {
    level,
    summary,
    marketMessage,
    strengths,
    watch,
    intermediate,
    missingCount:
      Array.isArray(missingData)
        ? missingData.length
        : 0
  };
}


export default function Home() {
  const [mint, setMint] =
    useState(DEFAULT_MINT);

  const [data, setData] =
    useState(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");


  async function analyze() {
    const cleanMint = mint.trim();

    if (!cleanMint) {
      setError(
        "Veuillez entrer une adresse mint Solana."
      );
      return;
    }

    setLoading(true);
    setError("");
    setData(null);

    try {
      const response =
        await fetch(
          "/api/analyze",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              Accept:
                "application/json"
            },
            body:
              JSON.stringify({
                mint: cleanMint
              })
          }
        );

      const text =
        await response.text();

      let result;

      try {
        result =
          text
            ? JSON.parse(text)
            : null;
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
        throw new Error(
          "Le serveur n'a retourné aucune donnée."
        );
      }

      setData(result);

    } catch (e) {
      console.error(
        "ProfitX analyse error:",
        e
      );

      setError(
        e?.message ||
          "Une erreur est survenue pendant l'analyse."
      );

    } finally {
      setLoading(false);
    }
  }


  const score =
    data?.score || {};

  const components =
    score?.components || {};

  const observed =
    data?.data || {};

  const token =
    data?.token || {};

  const market =
    data?.market || {};

  const modules =
    data?.modules || {};

  const activity =
    modules?.activity || {};

  const holders =
    modules?.holders || {};

  const distributionView =
    getDistributionView(
      holders
    );

  const security =
    modules?.security || {};

  const token2022 =
    modules?.token2022 || {};

  const metadata =
    modules?.metadata || {};


  const activityState =
    getActivityState(
      observed,
      activity
    );

  const marketState =
    getMarketState(
      data,
      observed
    );


  const availableWeight =
    score?.availableWeight ??
    0;


  const securityScore =
    security?.securityScore ??
    security?.score ??
    components?.security ??
    null;


  const activityScore =
    score?.activity ??
    data?.metrics?.activity ??
    null;


  const distributionScore =
    components?.distribution ??
    null;


  const liquidityScore =
    components?.liquidity ??
    null;


  const volumeScore =
    data?.metrics?.volume ??
    null;


  const maturityScore =
    components?.maturity ??
    null;


  const profitxDiagnostic =
    buildProfitxDiagnostic({
      totalScore:
        score?.total,
      liquidityScore,
      distributionScore,
      activityScore,
      volumeScore,
      maturityScore,
      securityScore,
      activityState,
      missingData:
        data?.missingData
    });


  return (
    <main className="shell">

      <header className="topbar">

        <div className="brand">
          <span className="logo">
            P
          </span>
          PROFITX AI
        </div>

        <div className="tag">
          SOLANA TOKEN ANALYZER
        </div>

      </header>


      <section className="panel">

        <div className="eyebrow">
          PFX • OFFICIAL PROFITX TOKEN
        </div>

        <h2>
          PFX — le token officiel de ProfitX AI
        </h2>

        <p className="intro">
          ProfitX AI est un moteur d’analyse Solana
          en développement. PFX est le token officiel
          associé au projet. Vérifiez toujours
          l’adresse mint avant toute interaction.
        </p>

        <div className="pairGrid">

          <div>
            <span>
              Mint officiel
            </span>

            <strong>
              {shortAddress(
                DEFAULT_MINT,
                12,
                12
              )}
            </strong>
          </div>

          <div>
            <span>
              Réseau
            </span>

            <strong>
              Solana
            </strong>
          </div>

          <div>
            <span>
              Statut
            </span>

            <strong>
              PFX OFFICIEL
            </strong>
          </div>

        </div>


        <div
          style={{
            marginTop: "26px",
            marginBottom: "14px"
          }}
        >
          <a
            href={`https://pump.fun/coin/${DEFAULT_MINT}`}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              boxSizing: "border-box",
              padding: "17px 20px",
              border: "1px solid #00ff88",
              borderRadius: "12px",
              background:
                "linear-gradient(135deg, #00ff88 0%, #00d975 100%)",
              color: "#00150c",
              textDecoration: "none",
              fontWeight: 900,
              fontSize: "17px",
              letterSpacing: "0.5px",
              textAlign: "center",
              boxShadow:
                "0 0 22px rgba(0, 255, 136, 0.18)"
            }}
          >
            PUMP.FUN • VOIR / ACHETER PFX
          </a>
        </div>


        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
            marginBottom: "18px"
          }}
        >

          <a
            href="https://x.com/IVAR4019"
            target="_blank"
            rel="noreferrer"
            style={{
              padding: "11px 15px",
              border: "1px solid #00ff88",
              borderRadius: "10px",
              background: "#06100b",
              color: "#00ff88",
              textDecoration: "none",
              fontWeight: 700
            }}
          >
            X • @IVAR4019
          </a>

          <a
            href="https://www.tiktok.com/@pfx_profitx"
            target="_blank"
            rel="noreferrer"
            style={{
              padding: "11px 15px",
              border: "1px solid #00ff88",
              borderRadius: "10px",
              background: "#06100b",
              color: "#00ff88",
              textDecoration: "none",
              fontWeight: 700
            }}
          >
            TikTok • @pfx_profitx
          </a>

          <a
            href="https://www.facebook.com/profile.php?id=61591572038365"
            target="_blank"
            rel="noreferrer"
            style={{
              padding: "11px 15px",
              border: "1px solid #00ff88",
              borderRadius: "10px",
              background: "#06100b",
              color: "#00ff88",
              textDecoration: "none",
              fontWeight: 700
            }}
          >
            Facebook • PROFITX
          </a>

          <a
            href="https://www.youtube.com/@IVAR4019"
            target="_blank"
            rel="noreferrer"
            style={{
              padding: "11px 15px",
              border: "1px solid #00ff88",
              borderRadius: "10px",
              background: "#06100b",
              color: "#00ff88",
              textDecoration: "none",
              fontWeight: 700
            }}
          >
            YouTube • PROFITX Crypto
          </a>

        </div>

        <div className="hint">
          Le token PFX est spéculatif et n’accorde
          aucune garantie de rendement.
        </div>

      </section>


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
              loading ||
              !mint.trim()
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

                <span>
                  /100
                </span>
              </div>

              <div
                className={`status ${
                  data.status || ""
                }`}
              >
                {statusLabel(
                  data.status
                )}
              </div>

            </div>


            <div className="meta">

              <div>
                <span>Mint</span>

                <strong>
                  {shortAddress(
                    data.mint
                  )}
                </strong>
              </div>

              <div>
                <span>Source</span>

                <strong>
                  {data.source ||
                    "N/D"}
                </strong>
              </div>

              <div>
                <span>Horodatage</span>

                <strong>
                  {fmtDate(
                    data.timestamp
                  )}
                </strong>
              </div>

            </div>

          </div>


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
                <span>
                  Transactions 24h
                </span>

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


          {(token.name ||
            token.symbol) && (

            <div className="panel">

              <h2>
                Token détecté
              </h2>

              <div className="pairGrid">

                <div>
                  <span>Nom</span>

                  <strong>
                    {token.name ||
                      "N/D"}
                  </strong>
                </div>

                <div>
                  <span>Symbole</span>

                  <strong>
                    {token.symbol ||
                      "N/D"}
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
                <span>
                  Transactions 24h
                </span>

                <strong>
                  {fmtNumber(
                    observed.transactions24h
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Acheteurs 24h
                </span>

                <strong>
                  {fmtNumber(
                    observed.buys24h
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Vendeurs 24h
                </span>

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
                <span>
                  Market Cap
                </span>

                <strong>
                  {fmtUsd(
                    observed.marketCapUsd
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Âge du marché
                </span>

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
              data.missingData.length >
                0 && (

                <div className="missing">
                  Données manquantes :{" "}
                  {data.missingData.join(
                    ", "
                  )}
                </div>

              )}

          </div>


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
                <span>
                  Score activité
                </span>

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


          <div className="panel">

            <h2>
              Distribution des holders
            </h2>

            <div className="observed">

              <div>
                <span>
                  Holders détectés
                </span>

                <strong>
                  {fmtNumber(
                    observed.holders
                  )}
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

              {holders?.uniqueOwners !=
                null && (

                <div>
                  <span>
                    Owners uniques
                  </span>

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
                  <span>
                    Holders externes
                  </span>

                  <strong>
                    {fmtNumber(
                      holders.externalHolders
                    )}
                  </strong>
                </div>

              )}

            </div>


            {distributionView && (

              <div
                style={{
                  marginTop: "22px",
                  paddingTop: "20px",
                  borderTop:
                    "1px solid rgba(0, 255, 136, 0.12)"
                }}
              >

                <div className="label">
                  {distributionView.label}
                </div>

                <div
                  className="observed"
                  style={{
                    marginTop: "12px"
                  }}
                >

                  {distributionView.values.top1 !=
                    null &&
                    isNumber(
                      distributionView.values.top1
                    ) && (

                    <div>
                      <span>Top 1</span>

                      <strong>
                        {fmtDecimal(
                          distributionView.values.top1,
                          2
                        )}
                        %
                      </strong>
                    </div>

                  )}


                  {distributionView.values.top5 !=
                    null &&
                    isNumber(
                      distributionView.values.top5
                    ) && (

                    <div>
                      <span>Top 5</span>

                      <strong>
                        {fmtDecimal(
                          distributionView.values.top5,
                          2
                        )}
                        %
                      </strong>
                    </div>

                  )}


                  {distributionView.values.top10 !=
                    null &&
                    isNumber(
                      distributionView.values.top10
                    ) && (

                    <div>
                      <span>Top 10</span>

                      <strong>
                        {fmtDecimal(
                          distributionView.values.top10,
                          2
                        )}
                        %
                      </strong>
                    </div>

                  )}

                </div>

                <div className="hint">
                  {distributionView.description}
                </div>

              </div>

            )}

          </div>


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
                <span>
                  Statut Pump.fun
                </span>

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
                <span>
                  PumpSwap Pool
                </span>

                <strong>
                  {shortAddress(
                    observed.pumpSwapPool
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Raydium Pool
                </span>

                <strong>
                  {shortAddress(
                    observed.raydiumPool
                  )}
                </strong>
              </div>

            </div>

          </div>


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
                <span>Prix SOL</span>

                <strong>
                  {fmtUsd(
                    observed.solPriceUsd
                  )}
                </strong>
              </div>

            </div>

          </div>


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
                <span>Risque</span>

                <strong>
                  {security?.riskLevel ||
                    "N/D"}
                </strong>
              </div>

            </div>


            {Array.isArray(
              security?.warnings
            ) &&
              security.warnings.length >
                0 && (

                <div className="missing">
                  {security.warnings.join(
                    " • "
                  )}
                </div>

              )}

          </div>


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
                  <span>Extensions</span>

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

            </div>

          )}


          {metadata?.available && (

            <div className="panel">

              <h2>Métadonnées</h2>

              <div className="observed">

                <div>
                  <span>Nom</span>

                  <strong>
                    {metadata.name ||
                      token.name ||
                      "N/D"}
                  </strong>
                </div>

                <div>
                  <span>Symbole</span>

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


          <div className="panel">

            <div className="eyebrow">
              LECTURE AUTOMATIQUE • DONNÉES OBSERVÉES
            </div>

            <h2>
              Diagnostic ProfitX
            </h2>

            <div
              style={{
                marginTop: "18px",
                padding: "18px",
                border:
                  "1px solid rgba(0, 255, 136, 0.22)",
                borderRadius: "12px",
                background:
                  "rgba(0, 255, 136, 0.035)"
              }}
            >

              <span>
                Lecture du score
              </span>

              <strong
                style={{
                  display: "block",
                  marginTop: "7px",
                  fontSize: "20px"
                }}
              >
                {profitxDiagnostic.level}
              </strong>

              <p
                className="intro"
                style={{
                  marginBottom: 0
                }}
              >
                {profitxDiagnostic.summary}
              </p>

            </div>


            <div
              className="pairGrid"
              style={{
                marginTop: "18px"
              }}
            >

              <div>
                <span>
                  Score global
                </span>

                <strong>
                  {fmtPercent(
                    score?.total
                  )}
                </strong>
              </div>

              <div>
                <span>
                  État 24h
                </span>

                <strong>
                  {activityState.label}
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


            <div
              style={{
                marginTop: "22px"
              }}
            >
              <span>
                Lecture du marché
              </span>

              <p className="intro">
                {profitxDiagnostic.marketMessage}
              </p>
            </div>


            {profitxDiagnostic.strengths.length >
              0 && (

              <div
                style={{
                  marginTop: "20px"
                }}
              >
                <span>
                  Points solides
                </span>

                <div
                  className="observed"
                  style={{
                    marginTop: "10px"
                  }}
                >
                  {profitxDiagnostic.strengths.map(
                    (item) => (

                      <div
                        key={`strength-${item.label}`}
                      >
                        <span>
                          {item.label}
                        </span>

                        <strong>
                          {fmtPercent(
                            item.value
                          )}
                        </strong>
                      </div>

                    )
                  )}
                </div>
              </div>

            )}


            {profitxDiagnostic.intermediate.length >
              0 && (

              <div
                style={{
                  marginTop: "20px"
                }}
              >
                <span>
                  Indicateurs intermédiaires
                </span>

                <div
                  className="observed"
                  style={{
                    marginTop: "10px"
                  }}
                >
                  {profitxDiagnostic.intermediate.map(
                    (item) => (

                      <div
                        key={`intermediate-${item.label}`}
                      >
                        <span>
                          {item.label}
                        </span>

                        <strong>
                          {fmtPercent(
                            item.value
                          )}
                        </strong>
                      </div>

                    )
                  )}
                </div>
              </div>

            )}


            {profitxDiagnostic.watch.length >
              0 && (

              <div
                style={{
                  marginTop: "20px"
                }}
              >
                <span>
                  Points à surveiller
                </span>

                <div
                  className="observed"
                  style={{
                    marginTop: "10px"
                  }}
                >
                  {profitxDiagnostic.watch.map(
                    (item) => (

                      <div
                        key={`watch-${item.label}`}
                      >
                        <span>
                          {item.label}
                        </span>

                        <strong>
                          {fmtPercent(
                            item.value
                          )}
                        </strong>
                      </div>

                    )
                  )}
                </div>
              </div>

            )}


            {profitxDiagnostic.missingCount >
              0 && (

              <div className="missing">
                Le diagnostic est calculé uniquement
                à partir des données disponibles.{" "}
                {profitxDiagnostic.missingCount}{" "}
                donnée(s) reste(nt)
                indisponible(s).
              </div>

            )}


            <div className="hint">
              Cette lecture explique les indicateurs
              calculés par ProfitX. Elle ne constitue
              pas une recommandation d'achat ou de
              vente.
            </div>

          </div>


          {data.note && (
            <div className="note">
              {data.note}
            </div>
          )}


          <div className="disclaimer">
            Cet outil fournit une analyse technique
            et structurelle à partir de données
            observables. Il ne constitue pas un conseil
            financier et ne garantit aucun résultat.
          </div>


        </section>

      )}

    </main>
  );
}
