import { useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";

const DEFAULT_MINT =
  "6FwDVfnnETqUe2UrxZEeLA6u7Vo5Td2Nm79z7s38pump";
const PFX_OFFICIAL_LOGO =
  "/profitx-logo-01-pumpfun.png";
function isPfxToken(mint) {
  return String(mint || "").trim() === DEFAULT_MINT;
}
function isNumber(value) {
  return (
    value !== null &&
    value !== undefined &&
    value !== "" &&
    Number.isFinite(Number(value))
  );
}

function formatScore(value) {
  if (!isNumber(value)) return "N/D";
  return `${Math.round(Number(value))}/100`;
}

function formatUsd(value) {
  if (!isNumber(value)) return "N/D";

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(Number(value));
}

function formatNumber(value) {
  if (!isNumber(value)) return "N/D";

  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 2
  }).format(Number(value));
}

function shortMint(mint) {
  if (!mint) return "N/D";

  if (mint.length <= 18) {
    return mint;
  }

  return `${mint.slice(0, 8)}…${mint.slice(-8)}`;
}

function ScoreCard({
  label,
  value,
  primary = false
}) {
  return (
    <div
      className={
        primary
          ? "scoreCard scoreCardPrimary"
          : "scoreCard"
      }
    >
      <span>{label}</span>
      <strong>{formatScore(value)}</strong>
    </div>
  );
}

export default function IntelligencePage() {
  const router = useRouter();

  const [mint, setMint] =
    useState(DEFAULT_MINT);

  const [analyzer, setAnalyzer] =
    useState(null);

  const [result, setResult] =
    useState(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  async function runIntelligence() {
    const cleanMint =
      mint.trim();

    if (!cleanMint) {
      setError(
        "Saisis un mint Solana avant de lancer PFX Intelligence."
      );
      return;
    }

    setLoading(true);
    setError("");
    setAnalyzer(null);
    setResult(null);

    try {
      const analyzerResponse =
        await fetch(
          `/api/analyze?mint=${encodeURIComponent(
            cleanMint
          )}`
        );

      const analyzerData =
        await analyzerResponse.json();

      if (
        !analyzerResponse.ok ||
        analyzerData?.ok !== true
      ) {
        throw new Error(
          analyzerData?.error ||
            "Impossible d'obtenir une analyse PROFITX valide."
        );
      }

      setAnalyzer(analyzerData);

      const intelligenceResponse =
        await fetch(
          "/api/intelligence",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json"
            },
            body: JSON.stringify({
              analyzer:
                analyzerData
            })
          }
        );

      const intelligenceData =
        await intelligenceResponse.json();

      if (
        !intelligenceResponse.ok ||
        intelligenceData?.ok !== true
      ) {
        throw new Error(
          intelligenceData?.error ||
            "PFX Intelligence n'a pas pu produire sa lecture."
        );
      }

      setResult(
        intelligenceData
      );
    } catch (err) {
      setError(
        err?.message ||
          "Une erreur est survenue pendant l'analyse."
      );
    } finally {
      setLoading(false);
    }
  }

  const token =
    analyzer?.token || {};

  const observed =
    analyzer?.observed || {};

  const intelligence =
    result?.intelligence || {};

  const scores =
    result?.scores || {};

  const strengths =
    Array.isArray(
      intelligence?.strengths
    )
      ? intelligence.strengths
      : [];

  const watchPoints =
    Array.isArray(
      intelligence?.watchPoints
    )
      ? intelligence.watchPoints
      : [];

  const warnings =
    Array.isArray(
      intelligence?.warnings
    )
      ? intelligence.warnings
      : [];

  return (
    <>
      <Head>
        <title>
          PFX Intelligence | PROFITX AI
        </title>

        <meta
          name="description"
          content="PFX Intelligence transforme les données PROFITX Analyzer en lecture structurée et explicable."
        />
      </Head>

      <main className="page">
        <header className="topbar">
          <button
            className="brand"
            onClick={() =>
              router.push("/")
            }
          >
            PROFITX <span>AI</span>
          </button>

          <nav className="mainNav">
            <button
              onClick={() =>
                router.push("/")
              }
            >
              ANALYZER
            </button>

            <button
              onClick={() =>
                router.push("/radar")
              }
            >
              RADAR
            </button>

            <button
              onClick={() =>
                router.push("/compare")
              }
            >
              COMPARE
            </button>

            <button
              className="active"
              onClick={() =>
                router.push(
                  "/intelligence"
                )
              }
            >
              INTELLIGENCE
            </button>

            <button
              onClick={() =>
                router.push(
                  "/watchlist"
                )
              }
            >
              WATCHLIST
            </button>

            <button
              onClick={() =>
                router.push("/alerts")
              }
            >
              ALERTS
            </button>

            <button
              onClick={() =>
                router.push(
                  "/obtenir-pfx"
                )
              }
            >
              OBTENIR PFX
            </button>
          </nav>
        </header>

        <section className="hero">
          <div className="eyebrow">
            PFX INTELLIGENCE V1.1
          </div>

          <h1>
            Comprendre les données.
            <br />
            <span>
              Pas seulement les lire.
            </span>
          </h1>

          <p>
            PFX Intelligence utilise les
            résultats de PROFITX Analyzer
            pour produire une lecture
            structurée des forces, des
            vigilances et de l'activité
            observée d'un token Solana.
          </p>
        </section>
<section className="brandEvolution">
  <div className="brandEvolutionTitle">
    <span>IDENTITÉ PROFITX</span>
    <strong>De PFX à PROFITX AI</strong>
  </div>

  <div className="brandLogos">
    <div className="brandLogoCard historical">
      <div className="brandLogoLabel">
        IDENTITÉ ORIGINALE • PUMP.FUN
      </div>
      <img
        src="/profitx-logo-01-pumpfun.png"
        alt="Logo historique PROFITX PFX Pump.fun"
      />
      <strong>PROFITX PFX</strong>
      <span>Identité historique</span>
    </div>

    <div className="brandLogoCard">
      <div className="brandLogoLabel">
        ÉVOLUTION • AI ANALYZER
      </div>
      <img
        src="/profitx-logo-02-analyzer.png"
        alt="PROFITX AI Analyzer"
      />
      <strong>PROFITX AI ANALYZER</strong>
      <span>Deuxième génération</span>
    </div>

    <div className="brandLogoCard current">
      <div className="brandLogoLabel">
        IDENTITÉ ACTUELLE
      </div>
      <img
        src="/profitx-logo-03-current.png"
        alt="Identité actuelle PROFITX"
      />
      <strong>PROFITX AI</strong>
      <span>Identité actuelle</span>
    </div>
  </div>
</section>
        <section className="searchPanel">
          <label htmlFor="mint">
            Mint Solana
          </label>

          <div className="searchRow">
            <input
              id="mint"
              value={mint}
              onChange={(event) =>
                setMint(
                  event.target.value
                )
              }
              onKeyDown={(event) => {
                if (
                  event.key ===
                    "Enter" &&
                  !loading
                ) {
                  runIntelligence();
                }
              }}
              placeholder="Adresse du token Solana"
              spellCheck="false"
            />

            <button
              className="analyzeButton"
              onClick={
                runIntelligence
              }
              disabled={loading}
            >
              {loading
                ? "ANALYSE..."
                : "LANCER PFX INTELLIGENCE"}
            </button>
          </div>

          <div className="searchMeta">
            <span>
              Analyzer → Intelligence
            </span>

            <span>
              Aucune estimation des
              données manquantes
            </span>

            <span>
              Aucune prédiction de prix
            </span>
          </div>
        </section>

        {error && (
          <section className="errorBox">
            <strong>
              Analyse impossible
            </strong>

            <p>{error}</p>
          </section>
        )}

        {loading && (
          <section className="loadingBox">
            <div className="loader" />

            <div>
              <strong>
                PFX Intelligence travaille…
              </strong>

              <p>
                PROFITX Analyzer collecte
                les données puis le moteur
                Intelligence construit sa
                lecture.
              </p>
            </div>
          </section>
        )}

        {result && analyzer && (
          <section className="results">
            <div className="tokenHeader">
              <div className="tokenIdentity">
              {isPfxToken(analyzer?.mint) ? (
  <img
    src={PFX_OFFICIAL_LOGO}
    alt="PROFITX PFX"
    className="tokenLogo tokenLogoPfx"
  />
) : token?.imageUri ? (
  <img
    src={token.imageUri}
    alt={token?.symbol || "Token"}
    className="tokenLogo"
  />
) : (
  <div className="tokenFallback">
    {(token?.symbol || "?")
      .slice(0, 1)
      .toUpperCase()}
  </div>
)}

                <div>
                  <div className="tokenName">
                    {token?.name ||
                      "Token Solana"}
                  </div>

                  <div className="tokenMeta">
                    {token?.symbol ||
                      "N/D"}
                    {" • "}
                    {shortMint(
                      analyzer?.mint
                    )}
                  </div>
                </div>
              </div>

              <div className="statusGroup">
                <span className="statusBadge">
                  PFX INTELLIGENCE
                </span>

                <span className="sourceBadge">
                  {analyzer?.source ||
                    "ANALYZER"}
                </span>
              </div>
            </div>

            <div className="scoreGrid">
              <ScoreCard
                label="SCORE GLOBAL"
                value={
                  scores?.global
                }
                primary
              />

              <ScoreCard
                label="STRUCTURE"
                value={
                  scores?.structural
                }
              />

              <ScoreCard
                label="MARCHÉ"
                value={
                  scores?.market
                }
              />

              <ScoreCard
                label="LIQUIDITÉ"
                value={
                  scores?.liquidity
                }
              />

              <ScoreCard
                label="DISTRIBUTION"
                value={
                  scores?.distribution
                }
              />

              <ScoreCard
                label="SÉCURITÉ"
                value={
                  scores?.security
                }
              />

              <ScoreCard
                label="MATURITÉ"
                value={
                  scores?.maturity
                }
              />

              <ScoreCard
                label="ACTIVITÉ"
                value={
                  scores?.activity
                }
              />
            </div>

            <article className="intelligenceHero">
              <div className="sectionTag">
                SYNTHÈSE INTELLIGENCE
              </div>

              <h2>
                Lecture PFX
                Intelligence
              </h2>

              <p className="summary">
                {intelligence?.summary ||
                  "Lecture indisponible."}
              </p>
            </article>

            <div className="twoColumns">
              <article className="contentCard">
                <div className="cardIcon">
                  ↗
                </div>

                <div>
                  <div className="sectionTag">
                    LECTURE ÉCONOMIQUE
                  </div>

                  <h3>
                    Activité observée
                  </h3>

                  <p>
                    {intelligence
                      ?.economicReading ||
                      "N/D"}
                  </p>
                </div>
              </article>

              <article className="contentCard">
                <div className="cardIcon">
                  ◎
                </div>

                <div>
                  <div className="sectionTag">
                    DONNÉES 24 H
                  </div>

                  <h3>
                    Marché observé
                  </h3>

                  <div className="marketGrid">
                    <div>
                      <span>
                        Volume
                      </span>

                      <strong>
                        {formatUsd(
                          observed
                            ?.volume24hUsd
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Transactions
                      </span>

                      <strong>
                        {formatNumber(
                          observed
                            ?.transactions24h
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Achats
                      </span>

                      <strong>
                        {formatNumber(
                          observed
                            ?.buys24h
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Ventes
                      </span>

                      <strong>
                        {formatNumber(
                          observed
                            ?.sells24h
                        )}
                      </strong>
                    </div>
                  </div>
                </div>
              </article>
            </div>

            <div className="twoColumns">
              <article className="listCard positive">
                <div className="sectionTag">
                  POINTS SOLIDES
                </div>

                <h3>
                  Ce qui ressort
                  positivement
                </h3>

                {strengths.length >
                0 ? (
                  <div className="itemList">
                    {strengths.map(
                      (
                        item,
                        index
                      ) => (
                        <div
                          className="analysisItem"
                          key={
                            item?.key ||
                            index
                          }
                        >
                          <div className="itemScore">
                            {formatScore(
                              item?.score
                            )}
                          </div>

                          <div>
                            <strong>
                              {item?.label ||
                                "Indicateur"}
                            </strong>

                            <p>
                              {item?.text ||
                                ""}
                            </p>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <p className="emptyText">
                    Aucun indicateur
                    n'atteint actuellement
                    le seuil retenu pour
                    les points solides.
                  </p>
                )}
              </article>

              <article className="listCard watch">
                <div className="sectionTag">
                  POINTS À SURVEILLER
                </div>

                <h3>
                  Vigilances observées
                </h3>

                {watchPoints.length >
                0 ? (
                  <div className="itemList">
                    {watchPoints.map(
                      (
                        item,
                        index
                      ) => (
                        <div
                          className="analysisItem"
                          key={
                            item?.key ||
                            index
                          }
                        >
                          <div className="itemScore">
                            {formatScore(
                              item?.score
                            )}
                          </div>

                          <div>
                            <strong>
                              {item?.label ||
                                "Indicateur"}
                            </strong>

                            <p>
                              {item?.text ||
                                ""}
                            </p>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <p className="emptyText">
                    Aucun indicateur
                    n'est actuellement
                    classé dans les points
                    à surveiller.
                  </p>
                )}
              </article>
            </div>

            <article className="conclusionCard">
              <div className="sectionTag">
                CONCLUSION PFX
                INTELLIGENCE
              </div>

              <h2>
                Ce que montrent les
                données
              </h2>

              <p>
                {intelligence
                  ?.conclusion ||
                  "Conclusion indisponible."}
              </p>
            </article>

            {warnings.length > 0 && (
              <article className="warningCard">
                <div className="sectionTag">
                  INFORMATIONS
                  COMPLÉMENTAIRES
                </div>

                <h3>
                  Données à prendre en
                  compte
                </h3>

                <ul>
                  {warnings.map(
                    (
                      warning,
                      index
                    ) => (
                      <li key={index}>
                        {warning}
                      </li>
                    )
                  )}
                </ul>
              </article>
            )}

            <div className="disclaimer">
              <strong>
                PFX Intelligence
              </strong>

              <p>
                {result?.disclaimer ||
                  "Cette lecture repose uniquement sur les données disponibles et ne constitue pas un conseil financier."}
              </p>
            </div>
          </section>
        )}

        <footer>
          PROFITX AI • PFX
          Intelligence • Solana
        </footer>

        <style jsx>{`
          * {
            box-sizing: border-box;
          }

          .page {
            min-height: 100vh;
            padding: 0 28px 40px;
            background:
              radial-gradient(
                circle at 50% -10%,
                rgba(
                  0,
                  255,
                  136,
                  0.09
                ),
                transparent 32%
              ),
              #020403;
            color: #f5f7f6;
            font-family:
              Arial,
              Helvetica,
              sans-serif;
          }

          .topbar {
            width: 100%;
            max-width: 1380px;
            min-height: 88px;
            margin: 0 auto;
            display: flex;
            align-items: center;
            justify-content:
              space-between;
            gap: 30px;
            border-bottom:
              1px solid #18231d;
          }

          .brand {
            flex: 0 0 auto;
            padding: 0;
            border: 0;
            background: transparent;
            color: #ffffff;
            font-size: 25px;
            font-weight: 950;
            letter-spacing: 1px;
            cursor: pointer;
          }

          .brand span {
            color: #00ff88;
          }

          .mainNav {
            display: flex;
            align-items: center;
            justify-content:
              flex-end;
            gap: 8px;
            overflow-x: auto;
            scrollbar-width: none;
          }

          .mainNav::-webkit-scrollbar {
            display: none;
          }

          .mainNav button {
            flex: 0 0 auto;
            padding: 9px 11px;
            border: 1px solid
              transparent;
            border-radius: 8px;
            background: transparent;
            color: #8d9a93;
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 0.4px;
            cursor: pointer;
          }

          .mainNav button:hover {
            color: #ffffff;
            border-color: #26372e;
          }

          .mainNav button.active {
            border-color: #00ff88;
            background: #06130c;
            color: #00ff88;
          }

          .hero {
            width: 100%;
            max-width: 1180px;
            margin: 76px auto 0;
            text-align: center;
          }

          .eyebrow,
          .sectionTag {
            color: #00ff88;
            font-size: 11px;
            font-weight: 900;
            letter-spacing: 1.4px;
          }

          .hero h1 {
            margin: 18px 0 20px;
            font-size: clamp(
              44px,
              7vw,
              82px
            );
            line-height: 0.98;
            letter-spacing: -3px;
          }

          .hero h1 span {
            color: #8d9a93;
          }

          .hero p {
            max-width: 760px;
            margin: 0 auto;
            color: #a4afa9;
            font-size: 17px;
            line-height: 1.7;
          }
          .brandEvolution {
  width: 100%;
  max-width: 1180px;
  margin: 42px auto 0;
}

.brandEvolutionTitle {
  margin-bottom: 18px;
  text-align: center;
}

.brandEvolutionTitle span {
  display: block;
  color: #00ff88;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 1.4px;
}

.brandEvolutionTitle strong {
  display: block;
  margin-top: 7px;
  color: #ffffff;
  font-size: 20px;
  font-weight: 900;
}

.brandLogos {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.brandLogoCard {
  min-width: 0;
  padding: 14px;
  border: 1px solid #1b3025;
  border-radius: 18px;
  background: #050906;
  text-align: center;
  overflow: hidden;
}

.brandLogoCard.historical {
  border-color: rgba(0, 255, 136, 0.48);
}

.brandLogoCard.current {
  border-color: rgba(0, 255, 136, 0.7);
  box-shadow: 0 0 28px rgba(0, 255, 136, 0.08);
}

.brandLogoLabel {
  min-height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 10px;
  color: #00ff88;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.8px;
}

.brandLogoCard img {
  display: block;
  width: 100%;
  height: 230px;
  object-fit: contain;
  border-radius: 12px;
  background: #020403;
}

.brandLogoCard strong {
  display: block;
  margin-top: 13px;
  color: #ffffff;
  font-size: 14px;
  font-weight: 900;
}

.brandLogoCard > span {
  display: block;
  margin-top: 5px;
  color: #7f8d85;
  font-size: 11px;
}

          .searchPanel {
            width: 100%;
            max-width: 1180px;
            margin: 46px auto 0;
            padding: 24px;
            border: 1px solid #1b3025;
            border-radius: 18px;
            background:
              rgba(
                5,
                10,
                7,
                0.94
              );
          }

          .searchPanel label {
            display: block;
            margin-bottom: 9px;
            color: #aab5af;
            font-size: 12px;
            font-weight: 800;
          }

          .searchRow {
            display: grid;
            grid-template-columns:
              minmax(0, 1fr)
              auto;
            gap: 10px;
          }

          .searchRow input {
            min-width: 0;
            height: 52px;
            padding: 0 16px;
            border: 1px solid #2a3a31;
            border-radius: 10px;
            outline: none;
            background: #050806;
            color: #ffffff;
            font-family: monospace;
          }

          .searchRow input:focus {
            border-color: #00ff88;
          }

          .analyzeButton {
            min-height: 52px;
            padding: 0 22px;
            border: 1px solid #00ff88;
            border-radius: 10px;
            background: #00ff88;
            color: #001b0e;
            font-size: 12px;
            font-weight: 950;
            cursor: pointer;
          }

          .analyzeButton:disabled {
            opacity: 0.55;
            cursor: wait;
          }

          .searchMeta {
            display: flex;
            flex-wrap: wrap;
            gap: 8px 20px;
            margin-top: 14px;
            color: #6f7e76;
            font-size: 11px;
          }

          .searchMeta span::before {
            content: "✓ ";
            color: #00ff88;
          }

          .errorBox,
          .loadingBox {
            width: 100%;
            max-width: 1180px;
            margin: 22px auto 0;
            padding: 20px;
            border-radius: 14px;
          }

          .errorBox {
            border: 1px solid #6c2b2b;
            background: #160909;
          }

          .errorBox strong {
            color: #ff7777;
          }

          .errorBox p,
          .loadingBox p {
            margin-bottom: 0;
            color: #aeb8b2;
          }

          .loadingBox {
            display: flex;
            align-items: center;
            gap: 16px;
            border: 1px solid #1d3929;
            background: #061009;
          }

          .loader {
            width: 28px;
            height: 28px;
            flex: 0 0 auto;
            border: 3px solid #173725;
            border-top-color: #00ff88;
            border-radius: 50%;
            animation:
              spin 0.8s linear
              infinite;
          }

          @keyframes spin {
            to {
              transform:
                rotate(360deg);
            }
          }

          .results {
            width: 100%;
            max-width: 1180px;
            margin: 30px auto 0;
          }

          .tokenHeader {
            display: flex;
            align-items: center;
            justify-content:
              space-between;
            gap: 20px;
            padding: 22px;
            border: 1px solid #1b3025;
            border-radius: 18px;
            background: #050906;
          }

          .tokenIdentity {
            min-width: 0;
            display: flex;
            align-items: center;
            gap: 15px;
          }

          .tokenLogo,
.tokenFallback {
  width: 86px;
  height: 86px;
  flex: 0 0 86px;
  border: 1px solid #294034;
  border-radius: 18px;
}

.tokenLogo {
  display: block;
  object-fit: cover;
  background: #0b110d;
}

.tokenLogoPfx {
  width: 104px;
  height: 104px;
  flex-basis: 104px;
  object-fit: contain;
  padding: 4px;
  border: 1px solid rgba(0, 255, 136, 0.45);
  border-radius: 20px;
  background: #050806;
  box-shadow:
    0 0 0 1px rgba(0, 255, 136, 0.08),
    0 0 24px rgba(0, 255, 136, 0.14);
}

          .tokenFallback {
            display: flex;
            align-items: center;
            justify-content:
              center;
            background: #0b110d;
            color: #00ff88;
            font-size: 24px;
            font-weight: 900;
          }

          .tokenName {
            overflow: hidden;
            color: #ffffff;
            font-size: 24px;
            font-weight: 900;
            text-overflow:
              ellipsis;
            white-space: nowrap;
          }

          .tokenMeta {
            margin-top: 5px;
            color: #7f8d85;
            font-family: monospace;
            font-size: 12px;
          }

          .statusGroup {
            display: flex;
            flex-wrap: wrap;
            justify-content:
              flex-end;
            gap: 8px;
          }

          .statusBadge,
          .sourceBadge {
            padding: 8px 10px;
            border-radius: 999px;
            font-size: 10px;
            font-weight: 900;
          }

          .statusBadge {
            border: 1px solid #00ff88;
            background: #06130c;
            color: #00ff88;
          }

          .sourceBadge {
            border: 1px solid #26372e;
            color: #89978f;
          }

          .scoreGrid {
            display: grid;
            grid-template-columns:
              repeat(
                4,
                minmax(0, 1fr)
              );
            gap: 10px;
            margin-top: 10px;
          }

          .scoreCard {
            min-height: 112px;
            display: flex;
            flex-direction: column;
            justify-content:
              space-between;
            padding: 17px;
            border: 1px solid #1b2921;
            border-radius: 13px;
            background: #050806;
          }

          .scoreCard span {
            color: #718078;
            font-size: 10px;
            font-weight: 900;
            letter-spacing: 0.8px;
          }

          .scoreCard strong {
            color: #ffffff;
            font-size: 26px;
          }

          .scoreCardPrimary {
            border-color: #00ff88;
            background:
              linear-gradient(
                135deg,
                #07170e,
                #050806
              );
          }

          .scoreCardPrimary strong {
            color: #00ff88;
          }

          .intelligenceHero {
            margin-top: 18px;
            padding: 34px;
            border: 1px solid #00ff88;
            border-radius: 18px;
            background:
              linear-gradient(
                135deg,
                rgba(
                  0,
                  255,
                  136,
                  0.08
                ),
                rgba(
                  5,
                  9,
                  6,
                  0.97
                )
              );
          }

          .intelligenceHero h2,
          .conclusionCard h2 {
            margin: 12px 0;
            font-size: 30px;
          }

          .summary,
          .conclusionCard p {
            margin: 0;
            color: #d1dad5;
            font-size: 17px;
            line-height: 1.8;
          }

          .twoColumns {
            display: grid;
            grid-template-columns:
              repeat(
                2,
                minmax(0, 1fr)
              );
            gap: 12px;
            margin-top: 12px;
          }

          .contentCard,
          .listCard,
          .conclusionCard,
          .warningCard {
            border: 1px solid #1c2b23;
            border-radius: 16px;
            background: #050806;
          }

          .contentCard {
            display: grid;
            grid-template-columns:
              auto minmax(0, 1fr);
            gap: 15px;
            padding: 24px;
          }

          .cardIcon {
            width: 38px;
            height: 38px;
            display: flex;
            align-items: center;
            justify-content:
              center;
            border: 1px solid #00ff88;
            border-radius: 10px;
            color: #00ff88;
            font-weight: 900;
          }

          .contentCard h3,
          .listCard h3,
          .warningCard h3 {
            margin: 8px 0 10px;
            font-size: 20px;
          }

          .contentCard p {
            margin: 0;
            color: #b4beb8;
            line-height: 1.7;
          }

          .marketGrid {
            display: grid;
            grid-template-columns:
              repeat(
                2,
                minmax(0, 1fr)
              );
            gap: 9px;
          }

          .marketGrid div {
            padding: 11px;
            border: 1px solid #17251d;
            border-radius: 9px;
            background: #030503;
          }

          .marketGrid span {
            display: block;
            color: #708078;
            font-size: 10px;
            font-weight: 800;
          }

          .marketGrid strong {
            display: block;
            margin-top: 5px;
            color: #e9efec;
            font-size: 14px;
          }

          .listCard {
            padding: 25px;
          }

          .positive {
            border-top-color:
              #00ff88;
          }

          .watch {
            border-top-color:
              #a5b0aa;
          }

          .itemList {
            display: grid;
            gap: 10px;
            margin-top: 18px;
          }

          .analysisItem {
            display: grid;
            grid-template-columns:
              70px minmax(0, 1fr);
            gap: 13px;
            padding: 14px;
            border: 1px solid #19271f;
            border-radius: 11px;
            background: #030503;
          }

          .itemScore {
            display: flex;
            align-items: center;
            justify-content:
              center;
            min-height: 48px;
            border: 1px solid #254331;
            border-radius: 8px;
            color: #00ff88;
            font-size: 13px;
            font-weight: 900;
          }

          .analysisItem strong {
            color: #ffffff;
            font-size: 14px;
          }

          .analysisItem p {
            margin: 5px 0 0;
            color: #849189;
            font-size: 12px;
            line-height: 1.55;
          }

          .emptyText {
            color: #7d8a83;
            line-height: 1.6;
          }

          .conclusionCard {
            margin-top: 12px;
            padding: 30px;
          }

          .warningCard {
            margin-top: 12px;
            padding: 24px;
          }

          .warningCard ul {
            margin-bottom: 0;
            padding-left: 20px;
            color: #aab5af;
          }

          .warningCard li {
            margin: 8px 0;
            line-height: 1.5;
          }

          .disclaimer {
            margin-top: 12px;
            padding: 18px 20px;
            border: 1px solid #19261f;
            border-radius: 12px;
            background: #030503;
          }

          .disclaimer strong {
            color: #00ff88;
            font-size: 12px;
          }

          .disclaimer p {
            margin: 6px 0 0;
            color: #68766e;
            font-size: 11px;
            line-height: 1.6;
          }

          footer {
            width: 100%;
            max-width: 1180px;
            margin: 50px auto 0;
            padding-top: 22px;
            border-top: 1px solid #17211b;
            color: #536159;
            text-align: center;
            font-size: 10px;
            letter-spacing: 1px;
          }

          @media (
            max-width: 950px
          ) {
            .topbar {
              align-items:
                flex-start;
              flex-direction: column;
              padding: 20px 0;
            }

            .mainNav {
              width: 100%;
              justify-content:
                flex-start;
            }

            .scoreGrid {
              grid-template-columns:
                repeat(
                  2,
                  minmax(0, 1fr)
                );
            }

            .twoColumns {
              grid-template-columns:
                1fr;
            }
            .tokenIdentity {
  align-items: flex-start;
}

.tokenLogo,
.tokenFallback {
  width: 72px;
  height: 72px;
  flex-basis: 72px;
}

.tokenLogoPfx {
  width: 86px;
  height: 86px;
  flex-basis: 86px;
}
          }

          @media (
            max-width: 650px
          ) {
            .page {
              padding:
                0 12px 30px;
            }

            .hero {
              margin-top: 45px;
              text-align: left;
            }

            .hero h1 {
              letter-spacing:
                -2px;
            }

            .hero p {
              font-size: 15px;
            }
            .brandEvolution {
  margin-top: 30px;
}

.brandEvolutionTitle {
  text-align: left;
}

.brandLogos {
  grid-template-columns: 1fr;
  gap: 16px;
}

.brandLogoCard {
  padding: 14px;
}

.brandLogoCard img {
  height: 280px;
}

            .searchPanel {
              padding: 16px;
            }

            .searchRow {
              grid-template-columns:
                1fr;
            }

            .tokenHeader {
              align-items:
                flex-start;
              flex-direction:
                column;
            }

            .statusGroup {
              justify-content:
                flex-start;
            }

            .scoreGrid {
              grid-template-columns:
                repeat(
                  2,
                  minmax(0, 1fr)
                );
            }

            .scoreCard {
              min-height: 95px;
            }

            .intelligenceHero {
              padding: 23px;
            }

            .intelligenceHero h2,
            .conclusionCard h2 {
              font-size: 24px;
            }

            .summary,
            .conclusionCard p {
              font-size: 15px;
            }

            .contentCard {
              grid-template-columns:
                1fr;
            }

            .marketGrid {
              grid-template-columns:
                1fr 1fr;
            }

            .analysisItem {
              grid-template-columns:
                1fr;
            }

            .itemScore {
              width: fit-content;
              min-width: 70px;
              min-height: 36px;
              padding: 0 10px;
            }
          }
        `}</style>
      </main>
    </>
  );
}
