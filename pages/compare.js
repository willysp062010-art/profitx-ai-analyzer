import { useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";

function isNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function formatNumber(value, maximumFractionDigits = 2) {
  if (!isNumber(value)) return "N/D";

  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits,
  }).format(value);
}

function formatUsd(value) {
  if (!isNumber(value)) return "N/D";

  if (value !== 0 && Math.abs(value) < 0.0001) {
    return `$${value.toExponential(4)}`;
  }

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits:
      Math.abs(value) < 1 ? 6 : 2,
  }).format(value);
}

function formatPercent(value) {
  if (!isNumber(value)) return "N/D";
  return `${formatNumber(value, 2)} %`;
}

function formatAge(hours) {
  if (!isNumber(hours)) return "N/D";

  if (hours < 1) {
    return `${Math.max(1, Math.round(hours * 60))} min`;
  }

  if (hours < 48) {
    return `${formatNumber(hours, 1)} h`;
  }

  const days = hours / 24;

  if (days < 60) {
    return `${formatNumber(days, 1)} j`;
  }

  const months = days / 30.4375;

  if (months < 24) {
    return `${formatNumber(months, 1)} mois`;
  }

  return `${formatNumber(days / 365.25, 1)} ans`;
}

function shortMint(mint) {
  if (!mint) return "N/D";
  if (mint.length <= 14) return mint;

  return `${mint.slice(0, 7)}…${mint.slice(-7)}`;
}

function statusLabel(status) {
  const labels = {
    VALID: "Marché actif",
    GRADUATED: "Gradué",
    BONDING_CURVE: "Bonding curve",
    NO_MARKET: "Aucun marché",
  };

  return labels[status] || status || "N/D";
}

function confidenceLabel(level) {
  const labels = {
    HIGH: "Élevée",
    MEDIUM: "Moyenne",
    LOW: "Faible",
  };

  return labels[level] || level || "N/D";
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function tokenName(result, fallback) {
  return (
    result?.token?.name ||
    result?.token?.symbol ||
    fallback
  );
}

function tokenSymbol(result) {
  return result?.token?.symbol || "TOKEN";
}

function getValue(result, key) {
  const observed = result?.observed || {};
  const modules = result?.modules || {};

  const map = {
    score: result?.score?.total,
    structural: result?.score?.structural,
    market: result?.score?.market,
    confidence: result?.diagnostic?.confidence?.score,

    liquidity: observed.liquidityUsd,
    marketCap: observed.marketCapUsd,
    price: observed.priceUsd,
    volume24h: observed.volume24hUsd,
    transactions24h: observed.transactions24h,
    buys24h: observed.buys24h,
    sells24h: observed.sells24h,

    holders:
      modules?.holders?.uniqueOwners ??
      observed.holders,

    externalHolders:
      modules?.holders?.externalHolders,

    top1:
      modules?.holders?.externalTop1Percent ??
      modules?.holders?.totalTop1Percent,

    top10:
      modules?.holders?.externalTop10Percent ??
      modules?.holders?.totalTop10Percent,

    distribution: result?.metrics?.distribution,
    security: result?.metrics?.security,
    activity: result?.metrics?.activity,
    maturity: result?.metrics?.maturity,
    age: observed.ageHours,
  };

  return map[key];
}

const ROWS = [
  {
    key: "score",
    label: "Score PFX",
    format: (v) =>
      isNumber(v)
        ? `${formatNumber(v, 0)} / 100`
        : "N/D",
  },
  {
    key: "structural",
    label: "Score structurel",
    format: (v) =>
      isNumber(v)
        ? `${formatNumber(v, 0)} / 100`
        : "N/D",
  },
  {
    key: "market",
    label: "Score marché",
    format: (v) =>
      isNumber(v)
        ? `${formatNumber(v, 0)} / 100`
        : "N/D",
  },
  {
    key: "confidence",
    label: "Confiance des données",
    format: (v) =>
      isNumber(v)
        ? `${formatNumber(v, 0)} %`
        : "N/D",
  },
  {
    key: "liquidity",
    label: "Liquidité",
    format: formatUsd,
  },
  {
    key: "marketCap",
    label: "Market cap",
    format: formatUsd,
  },
  {
    key: "price",
    label: "Prix",
    format: formatUsd,
  },
  {
    key: "volume24h",
    label: "Volume 24 h",
    format: formatUsd,
  },
  {
    key: "transactions24h",
    label: "Transactions 24 h",
    format: (v) => formatNumber(v, 0),
  },
  {
    key: "buys24h",
    label: "Achats 24 h",
    format: (v) => formatNumber(v, 0),
  },
  {
    key: "sells24h",
    label: "Ventes 24 h",
    format: (v) => formatNumber(v, 0),
  },
  {
    key: "holders",
    label: "Détenteurs",
    format: (v) => formatNumber(v, 0),
  },
  {
    key: "externalHolders",
    label: "Détenteurs externes",
    format: (v) => formatNumber(v, 0),
  },
  {
    key: "top1",
    label: "Concentration Top 1",
    format: formatPercent,
    lowerIsBetter: true,
  },
  {
    key: "top10",
    label: "Concentration Top 10",
    format: formatPercent,
    lowerIsBetter: true,
  },
  {
    key: "distribution",
    label: "Distribution",
    format: (v) =>
      isNumber(v)
        ? `${formatNumber(v, 0)} / 100`
        : "N/D",
  },
  {
    key: "security",
    label: "Sécurité",
    format: (v) =>
      isNumber(v)
        ? `${formatNumber(v, 0)} / 100`
        : "N/D",
  },
  {
    key: "activity",
    label: "Activité",
    format: (v) =>
      isNumber(v)
        ? `${formatNumber(v, 0)} / 100`
        : "N/D",
  },
  {
    key: "maturity",
    label: "Maturité",
    format: (v) =>
      isNumber(v)
        ? `${formatNumber(v, 0)} / 100`
        : "N/D",
  },
  {
    key: "age",
    label: "Âge",
    format: formatAge,
  },
];

function comparisonState(a, b, row) {
  const va = getValue(a, row.key);
  const vb = getValue(b, row.key);

  if (!isNumber(va) || !isNumber(vb) || va === vb) {
    return {
      a: false,
      b: false,
    };
  }

  if (row.lowerIsBetter) {
    return {
      a: va < vb,
      b: vb < va,
    };
  }

  return {
    a: va > vb,
    b: vb > va,
  };
}

function buildInsights(a, b) {
  if (!a || !b) return [];

  const insights = [];

  const candidates = [
    {
      key: "liquidity",
      label: "liquidité",
      format: formatUsd,
    },
    {
      key: "volume24h",
      label: "volume sur 24 h",
      format: formatUsd,
    },
    {
      key: "transactions24h",
      label: "activité transactionnelle sur 24 h",
      format: (v) => formatNumber(v, 0),
    },
    {
      key: "holders",
      label: "nombre de détenteurs",
      format: (v) => formatNumber(v, 0),
    },
    {
      key: "security",
      label: "score de sécurité",
      format: (v) =>
        `${formatNumber(v, 0)} / 100`,
    },
    {
      key: "maturity",
      label: "maturité",
      format: (v) =>
        `${formatNumber(v, 0)} / 100`,
    },
  ];

  for (const item of candidates) {
    const va = getValue(a, item.key);
    const vb = getValue(b, item.key);

    if (!isNumber(va) || !isNumber(vb) || va === vb) {
      continue;
    }

    const higherToken = va > vb ? a : b;
    const value = va > vb ? va : vb;

    insights.push(
      `${tokenSymbol(
        higherToken
      )} présente une ${item.label} supérieure (${item.format(
        value
      )}).`
    );
  }

  const top10A = getValue(a, "top10");
  const top10B = getValue(b, "top10");

  if (
    isNumber(top10A) &&
    isNumber(top10B) &&
    top10A !== top10B
  ) {
    const lower = top10A < top10B ? a : b;
    const value = Math.min(top10A, top10B);

    insights.push(
      `${tokenSymbol(
        lower
      )} affiche une concentration Top 10 plus faible (${formatPercent(
        value
      )}).`
    );
  }

  const confidenceA =
    a?.diagnostic?.confidence?.score;

  const confidenceB =
    b?.diagnostic?.confidence?.score;

  if (
    isNumber(confidenceA) &&
    isNumber(confidenceB)
  ) {
    if (confidenceA < 60 || confidenceB < 60) {
      insights.push(
        "Au moins une analyse dispose d'un niveau de données limité : les écarts doivent être interprétés avec prudence."
      );
    }
  }

  const missingA = safeArray(a?.missingData);
  const missingB = safeArray(b?.missingData);

  if (missingA.length || missingB.length) {
    insights.push(
      "Certaines métriques sont indisponibles pour au moins un des deux tokens. PFX Compare affiche N/D plutôt que d'estimer une valeur absente."
    );
  }

  return insights.slice(0, 7);
}
export default function ComparePage() {
  const router = useRouter();

  const [mintA, setMintA] = useState("");
  const [mintB, setMintB] = useState("");

  const [resultA, setResultA] = useState(null);
  const [resultB, setResultB] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function analyzeMint(mint) {
    const response = await fetch(
      `/api/analyze?mint=${encodeURIComponent(
        mint.trim()
      )}`
    );

    let data = null;

    try {
      data = await response.json();
    } catch {
      throw new Error(
        "Réponse invalide du moteur ProfitX."
      );
    }

    if (!response.ok || data?.ok !== true) {
      throw new Error(
        data?.error ||
          "Impossible d'analyser ce token."
      );
    }

    return data;
  }

  async function compareTokens(event) {
    event?.preventDefault();

    const a = mintA.trim();
    const b = mintB.trim();

    setError("");
    setResultA(null);
    setResultB(null);

    if (!a || !b) {
      setError(
        "Renseignez les deux adresses mint à comparer."
      );
      return;
    }

    if (a === b) {
      setError(
        "Choisissez deux tokens différents."
      );
      return;
    }

    setLoading(true);

    try {
      const [aResult, bResult] =
        await Promise.all([
          analyzeMint(a),
          analyzeMint(b),
        ]);

      setResultA(aResult);
      setResultB(bResult);
    } catch (err) {
      setError(
        err?.message ||
          "La comparaison a échoué."
      );
    } finally {
      setLoading(false);
    }
  }

  const hasResults =
    Boolean(resultA) && Boolean(resultB);

  const insights = hasResults
    ? buildInsights(resultA, resultB)
    : [];

  const tokenA = resultA?.token || {};
  const tokenB = resultB?.token || {};

  return (
    <>
      <Head>
        <title>PFX Compare | PROFITX</title>

        <meta
          name="description"
          content="Comparez deux tokens Solana avec les données et scores du moteur PROFITX."
        />
      </Head>

      <main className="page">
        <div className="backgroundGlow glowOne" />
        <div className="backgroundGlow glowTwo" />

        <div className="container">
          <header className="topbar">
            <button
              className="brand"
              type="button"
              onClick={() => router.push("/")}
            >
              <span className="brandMark">
                PFX
              </span>

              <span>
                <strong>PROFITX</strong>
                <small>
                  INTELLIGENCE LAYER
                </small>
              </span>
            </button>

            <button
              className="backButton"
              type="button"
              onClick={() => router.push("/")}
            >
              ← Analyzer
            </button>
          </header>

          <section className="hero">
            <div className="eyebrow">
              PROFITX • COMPARE V1
            </div>

            <h1>
              PFX <span>Compare</span>
            </h1>

            <p>
              Comparez deux tokens avec le même moteur
              d'analyse PROFITX. Les données sont
              présentées côte à côte sans modifier les
              scores calculés par l'Analyzer.
            </p>
          </section>

          <form
            className="compareForm"
            onSubmit={compareTokens}
          >
            <div className="inputBlock">
              <label htmlFor="mintA">
                TOKEN A
              </label>

              <input
                id="mintA"
                value={mintA}
                onChange={(e) =>
                  setMintA(e.target.value)
                }
                placeholder="Adresse mint Solana du Token A"
                autoComplete="off"
                spellCheck="false"
              />
            </div>

            <div className="versus">
              VS
            </div>

            <div className="inputBlock">
              <label htmlFor="mintB">
                TOKEN B
              </label>

              <input
                id="mintB"
                value={mintB}
                onChange={(e) =>
                  setMintB(e.target.value)
                }
                placeholder="Adresse mint Solana du Token B"
                autoComplete="off"
                spellCheck="false"
              />
            </div>

            <button
              className="compareButton"
              type="submit"
              disabled={loading}
            >
              {loading
                ? "ANALYSE EN COURS..."
                : "COMPARER LES TOKENS"}
            </button>
          </form>

          {error ? (
            <div className="errorBox">
              <strong>
                Comparaison impossible
              </strong>

              <span>{error}</span>
            </div>
          ) : null}

          {loading ? (
            <section className="loadingPanel">
              <div className="scanner" />

              <strong>
                PFX Compare interroge l'Analyzer…
              </strong>

              <span>
                Analyse simultanée des deux tokens.
              </span>
            </section>
          ) : null}

          {hasResults ? (
            <>
              <section className="resultsPanel">
                <div className="tokenCards">
                  <article className="tokenCard">
                    <div className="tokenLabel">
                      TOKEN A
                    </div>

                    <div className="identity">
                      {tokenA.imageUri ? (
                        <img
                          className="tokenImage"
                          src={tokenA.imageUri}
                          alt={
                            tokenA.name ||
                            tokenA.symbol ||
                            "Token A"
                          }
                        />
                      ) : (
                        <div className="tokenFallback">
                          {(tokenA.symbol || "?")
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                      )}

                      <div className="identityText">
                        <div className="tokenName">
                          {tokenA.name || "Token"}
                        </div>

                        <div className="symbol">
                          {tokenA.symbol
                            ? `$${tokenA.symbol}`
                            : "Symbole N/D"}
                        </div>
                      </div>
                    </div>

                    <div className="mint">
                      {shortMint(resultA?.mint)}
                    </div>

                    <div className="badges">
                      <span className="badge">
                        {statusLabel(
                          resultA?.status
                        )}
                      </span>

                      <span className="badge secondary">
                        {resultA?.source ||
                          "source N/D"}
                      </span>
                    </div>
                  </article>

                  <div className="compareCenter">
                    <span>VS</span>
                    <strong>COMPARAISON</strong>
                  </div>

                  <article className="tokenCard">
                    <div className="tokenLabel">
                      TOKEN B
                    </div>

                    <div className="identity">
                      {tokenB.imageUri ? (
                        <img
                          className="tokenImage"
                          src={tokenB.imageUri}
                          alt={
                            tokenB.name ||
                            tokenB.symbol ||
                            "Token B"
                          }
                        />
                      ) : (
                        <div className="tokenFallback">
                          {(tokenB.symbol || "?")
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                      )}

                      <div className="identityText">
                        <div className="tokenName">
                          {tokenB.name || "Token"}
                        </div>

                        <div className="symbol">
                          {tokenB.symbol
                            ? `$${tokenB.symbol}`
                            : "Symbole N/D"}
                        </div>
                      </div>
                    </div>

                    <div className="mint">
                      {shortMint(resultB?.mint)}
                    </div>

                    <div className="badges">
                      <span className="badge">
                        {statusLabel(
                          resultB?.status
                        )}
                      </span>

                      <span className="badge secondary">
                        {resultB?.source ||
                          "source N/D"}
                      </span>
                    </div>
                  </article>
                </div>

                <div className="metricsTable">
                  {ROWS.map((row) => {
                    const valueA = getValue(
                      resultA,
                      row.key
                    );

                    const valueB = getValue(
                      resultB,
                      row.key
                    );

                    const state =
                      comparisonState(
                        resultA,
                        resultB,
                        row
                      );

                    return (
                      <div
                        className="metricRow"
                        key={row.key}
                      >
                        <div
                          className={`metricValue ${
                            state.a
                              ? "highlight"
                              : ""
                          }`}
                        >
                          {row.format(valueA)}
                        </div>

                        <div className="metricLabel">
                          {row.label}
                        </div>

                        <div
                          className={`metricValue ${
                            state.b
                              ? "highlight"
                              : ""
                          }`}
                        >
                          {row.format(valueB)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="reading">
                <div className="sectionTitle">
                  <span>PFX</span>{" "}
                  Lecture comparative
                </div>

                <p className="readingIntro">
                  Lecture factuelle des principaux écarts
                  observés. Une valeur supérieure n'est
                  pas automatiquement synonyme d'un
                  meilleur investissement.
                </p>

                {insights.length ? (
                  <div className="insightGrid">
                    {insights.map(
                      (insight, index) => (
                        <div
                          className="insight"
                          key={`${insight}-${index}`}
                        >
                          <span className="dot" />
                          <p>{insight}</p>
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <div className="noInsight">
                    Aucun écart exploitable
                    supplémentaire n'a été détecté
                    avec les données disponibles.
                  </div>
                )}
              </section>

              <section className="diagnostics">
                <div className="diagnosticCard">
                  <h3>
                    {tokenName(
                      resultA,
                      "Token A"
                    )}
                  </h3>

                  <div className="confidenceLine">
                    Confiance :{" "}
                    <strong>
                      {confidenceLabel(
                        resultA?.diagnostic
                          ?.confidence?.level
                      )}
                    </strong>
                  </div>

                  <p>
                    {resultA?.diagnostic
                      ?.conclusion ||
                      "Aucune conclusion disponible."}
                  </p>

                  {safeArray(
                    resultA?.diagnostic?.warnings
                  ).length ? (
                    <div className="warnings">
                      {safeArray(
                        resultA?.diagnostic
                          ?.warnings
                      ).map(
                        (warning, index) => (
                          <div
                            key={`${warning}-${index}`}
                          >
                            ⚠ {warning}
                          </div>
                        )
                      )}
                    </div>
                  ) : null}
                </div>

                <div className="diagnosticCard">
                  <h3>
                    {tokenName(
                      resultB,
                      "Token B"
                    )}
                  </h3>

                  <div className="confidenceLine">
                    Confiance :{" "}
                    <strong>
                      {confidenceLabel(
                        resultB?.diagnostic
                          ?.confidence?.level
                      )}
                    </strong>
                  </div>

                  <p>
                    {resultB?.diagnostic
                      ?.conclusion ||
                      "Aucune conclusion disponible."}
                  </p>

                  {safeArray(
                    resultB?.diagnostic?.warnings
                  ).length ? (
                    <div className="warnings">
                      {safeArray(
                        resultB?.diagnostic
                          ?.warnings
                      ).map(
                        (warning, index) => (
                          <div
                            key={`${warning}-${index}`}
                          >
                            ⚠ {warning}
                          </div>
                        )
                      )}
                    </div>
                  ) : null}
                </div>
              </section>

              <div className="disclaimer">
                PFX Compare est un outil d'analyse de
                données. Il ne constitue pas un conseil
                financier. Les données peuvent être
                incomplètes, retardées ou indisponibles.
              </div>
            </>
          ) : null}
        </div>
      </main>
      <style jsx>{`
        :global(*) {
          box-sizing: border-box;
        }

        :global(body) {
          margin: 0;
          background: #050706;
          color: #f4f7f5;
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        button,
        input {
          font: inherit;
        }

        .page {
          position: relative;
          min-height: 100vh;
          overflow: hidden;
          background:
            radial-gradient(
              circle at 50% -10%,
              rgba(42, 255, 118, 0.1),
              transparent 32%
            ),
            linear-gradient(
              180deg,
              #070a08 0%,
              #030504 100%
            );
        }

        .container {
          position: relative;
          z-index: 2;
          width: min(1240px, calc(100% - 32px));
          margin: 0 auto;
          padding-bottom: 70px;
        }

        .backgroundGlow {
          position: absolute;
          width: 420px;
          height: 420px;
          border-radius: 50%;
          filter: blur(120px);
          opacity: 0.12;
          pointer-events: none;
        }

        .glowOne {
          top: 180px;
          left: -220px;
          background: #22ff77;
        }

        .glowTwo {
          right: -250px;
          top: 600px;
          background: #9fffc1;
        }

        .topbar {
          min-height: 86px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid #18221c;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
          border: 0;
          background: transparent;
          color: white;
          cursor: pointer;
          text-align: left;
          padding: 0;
        }

        .brandMark {
          width: 48px;
          height: 48px;
          display: grid;
          place-items: center;
          border: 1px solid #35ff82;
          border-radius: 50%;
          color: #35ff82;
          font-weight: 900;
          box-shadow:
            0 0 20px rgba(53, 255, 130, 0.12);
        }

        .brand strong {
          display: block;
          letter-spacing: 0.12em;
        }

        .brand small {
          display: block;
          margin-top: 3px;
          color: #78867d;
          font-size: 9px;
          letter-spacing: 0.16em;
        }

        .backButton {
          padding: 10px 15px;
          border-radius: 9px;
          border: 1px solid #26352b;
          background: #0b100d;
          color: #b9c5bd;
          cursor: pointer;
        }

        .backButton:hover {
          border-color: #35ff82;
          color: #35ff82;
        }

        .hero {
          text-align: center;
          padding: 70px 15px 38px;
        }

        .eyebrow {
          color: #35ff82;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.22em;
        }

        .hero h1 {
          margin: 13px 0 12px;
          font-size: clamp(42px, 7vw, 76px);
          line-height: 0.95;
          letter-spacing: -0.055em;
        }

        .hero h1 span {
          color: #35ff82;
        }

        .hero p {
          max-width: 720px;
          margin: 0 auto;
          color: #8f9c94;
          line-height: 1.65;
        }

        .compareForm {
          display: grid;
          grid-template-columns:
            minmax(0, 1fr)
            54px
            minmax(0, 1fr);
          gap: 14px;
          align-items: end;
          padding: 22px;
          border: 1px solid #1c2921;
          border-radius: 18px;
          background: rgba(10, 15, 12, 0.9);
          box-shadow:
            0 20px 70px rgba(0, 0, 0, 0.3);
        }

        .inputBlock label {
          display: block;
          margin-bottom: 9px;
          color: #35ff82;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.16em;
        }

        .inputBlock input {
          width: 100%;
          height: 52px;
          padding: 0 15px;
          border: 1px solid #26352b;
          border-radius: 10px;
          outline: none;
          background: #050806;
          color: white;
        }

        .inputBlock input:focus {
          border-color: #35ff82;
          box-shadow:
            0 0 0 3px rgba(53, 255, 130, 0.08);
        }

        .inputBlock input::placeholder {
          color: #4f5c54;
        }

        .versus {
          height: 52px;
          display: grid;
          place-items: center;
          color: #526158;
          font-weight: 900;
        }

        .compareButton {
          grid-column: 1 / -1;
          height: 54px;
          margin-top: 5px;
          border: 0;
          border-radius: 10px;
          background: #35ff82;
          color: #031007;
          font-weight: 950;
          letter-spacing: 0.08em;
          cursor: pointer;
          transition:
            transform 0.15s ease,
            box-shadow 0.15s ease;
        }

        .compareButton:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow:
            0 0 30px rgba(53, 255, 130, 0.22);
        }

        .compareButton:disabled {
          cursor: wait;
          opacity: 0.65;
        }

        .errorBox {
          display: flex;
          flex-direction: column;
          gap: 5px;
          margin-top: 18px;
          padding: 16px 18px;
          border: 1px solid #633535;
          border-radius: 12px;
          background: #190b0b;
          color: #ffb1b1;
        }

        .loadingPanel {
          margin-top: 24px;
          padding: 35px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          border: 1px solid #1c2921;
          border-radius: 16px;
          background: #080c09;
          color: #9aa79f;
        }

        .loadingPanel strong {
          color: #e7ede9;
        }

        .scanner {
          width: 36px;
          height: 36px;
          margin-bottom: 7px;
          border-radius: 50%;
          border: 2px solid #24342a;
          border-top-color: #35ff82;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        /* ========================================
           NOUVELLE STRUCTURE COMPARE
           ======================================== */

        .resultsPanel {
          margin-top: 34px;
          border: 1px solid #1d2a22;
          border-radius: 18px;
          overflow: hidden;
          background: rgba(7, 11, 8, 0.95);
        }

        .tokenCards {
          display: grid;
          grid-template-columns:
            minmax(0, 1fr)
            170px
            minmax(0, 1fr);
          min-height: 205px;
          border-bottom: 1px solid #172019;
        }

        .tokenCard {
          min-width: 0;
          padding: 25px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .tokenLabel {
          margin-bottom: 15px;
          color: #35ff82;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.16em;
        }

        .identity {
          display: flex;
          align-items: center;
          gap: 14px;
          min-width: 0;
        }

        .tokenImage,
        .tokenFallback {
          display: block;
          width: 56px !important;
          height: 56px !important;
          min-width: 56px;
          max-width: 56px;
          min-height: 56px;
          max-height: 56px;
          flex: 0 0 56px;
          border: 1px solid #304137;
          border-radius: 50%;
          background: #0d1510;
          object-fit: cover;
          overflow: hidden;
        }

        .tokenFallback {
          display: grid;
          place-items: center;
          color: #35ff82;
          font-weight: 900;
        }

        .identityText {
          min-width: 0;
        }

        .tokenName {
          overflow: hidden;
          color: #f4f7f5;
          font-size: 21px;
          font-weight: 850;
          line-height: 1.15;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .symbol {
          margin-top: 4px;
          overflow: hidden;
          color: #7f8c84;
          font-size: 13px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .mint {
          margin-top: 15px;
          overflow: hidden;
          color: #66736b;
          font-family: monospace;
          font-size: 12px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .badges {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 12px;
        }

        .badge {
          padding: 5px 8px;
          border-radius: 6px;
          background: rgba(53, 255, 130, 0.08);
          color: #35ff82;
          font-size: 10px;
          font-weight: 800;
        }

        .badge.secondary {
          background: #111813;
          color: #819087;
        }

        .compareCenter {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 7px;
          border-left: 1px solid #172019;
          border-right: 1px solid #172019;
          color: #59675e;
        }

        .compareCenter span {
          color: #35ff82;
          font-size: 18px;
          font-weight: 950;
        }

        .compareCenter strong {
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.14em;
        }

        .metricsTable {
          width: 100%;
        }

        .metricRow {
          display: grid;
          grid-template-columns:
            minmax(0, 1fr)
            170px
            minmax(0, 1fr);
          border-top: 1px solid #172019;
        }

        .metricRow:first-child {
          border-top: 0;
        }

        .metricValue,
        .metricLabel {
          min-height: 58px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 10px 15px;
        }

        .metricValue {
          min-width: 0;
          color: #dce4df;
          text-align: center;
          font-size: 15px;
          font-weight: 750;
          overflow-wrap: anywhere;
          transition: background 0.15s ease;
        }

        .metricValue.highlight {
          color: #35ff82;
          background:
            linear-gradient(
              90deg,
              transparent,
              rgba(53, 255, 130, 0.055),
              transparent
            );
        }

        .metricLabel {
          border-left: 1px solid #172019;
          border-right: 1px solid #172019;
          color: #78867d;
          text-align: center;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.035em;
        }

        .reading {
          margin-top: 28px;
          padding: 26px;
          border: 1px solid #1d2a22;
          border-radius: 18px;
          background: #080c09;
        }

        .sectionTitle {
          font-size: 22px;
          font-weight: 850;
        }

        .sectionTitle span {
          color: #35ff82;
        }

        .readingIntro {
          margin: 8px 0 20px;
          color: #77857c;
          line-height: 1.6;
        }

        .insightGrid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .insight {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 14px;
          border: 1px solid #19231c;
          border-radius: 10px;
          background: #060906;
        }

        .insight p {
          margin: 0;
          color: #b5c0b9;
          font-size: 13px;
          line-height: 1.55;
        }

        .dot {
          width: 7px;
          height: 7px;
          flex: 0 0 7px;
          margin-top: 7px;
          border-radius: 50%;
          background: #35ff82;
          box-shadow:
            0 0 9px rgba(53, 255, 130, 0.5);
        }

        .noInsight {
          color: #77857c;
        }

        .diagnostics {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 14px;
          margin-top: 18px;
        }

        .diagnosticCard {
          padding: 22px;
          border: 1px solid #1b2720;
          border-radius: 15px;
          background: #080c09;
        }

        .diagnosticCard h3 {
          margin: 0 0 7px;
        }

        .confidenceLine {
          color: #748178;
          font-size: 12px;
        }

        .confidenceLine strong {
          color: #35ff82;
        }

        .diagnosticCard p {
          color: #a2aea6;
          line-height: 1.6;
        }

        .warnings {
          display: flex;
          flex-direction: column;
          gap: 7px;
          margin-top: 13px;
          color: #d7b780;
          font-size: 12px;
          line-height: 1.5;
        }

        .disclaimer {
          max-width: 850px;
          margin: 28px auto 0;
          color: #56635b;
          text-align: center;
          font-size: 11px;
          line-height: 1.6;
        }

        @media (max-width: 760px) {
          .container {
            width: min(
              calc(100% - 20px),
              1240px
            );
          }

          .topbar {
            min-height: 72px;
          }

          .brand small {
            display: none;
          }

          .hero {
            padding-top: 48px;
          }

          .hero p {
            font-size: 14px;
          }

          .compareForm {
            grid-template-columns: 1fr;
            padding: 16px;
          }

          .versus {
            height: 22px;
          }

          .compareButton {
            grid-column: auto;
          }

          .resultsPanel {
            overflow-x: auto;
          }

          .tokenCards,
          .metricsTable {
            min-width: 720px;
          }

          .tokenCards {
            grid-template-columns:
              minmax(0, 1fr)
              120px
              minmax(0, 1fr);
          }

          .metricRow {
            grid-template-columns:
              minmax(0, 1fr)
              120px
              minmax(0, 1fr);
          }

          .tokenCard {
            padding: 18px;
          }

          .tokenImage,
          .tokenFallback {
            width: 50px !important;
            height: 50px !important;
            min-width: 50px;
            max-width: 50px;
            min-height: 50px;
            max-height: 50px;
            flex-basis: 50px;
          }

          .tokenName {
            font-size: 18px;
          }

          .insightGrid,
          .diagnostics {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}
