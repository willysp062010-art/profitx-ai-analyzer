import { useCallback, useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";

const REFRESH_INTERVAL = 60_000;

function number(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatMoney(value) {
  const n = number(value);
  if (n === null) return "N/D";

  if (Math.abs(n) >= 1_000_000_000) {
    return `${(n / 1_000_000_000).toFixed(2)} Md$`;
  }

  if (Math.abs(n) >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(2)} M$`;
  }

  if (Math.abs(n) >= 1_000) {
    return `${(n / 1_000).toFixed(1)} k$`;
  }

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
}

function formatPrice(value) {
  const n = number(value);
  if (n === null) return "N/D";

  if (n >= 1) {
    return `${n.toLocaleString("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    })} $`;
  }

  if (n >= 0.01) {
    return `${n.toLocaleString("fr-FR", {
      minimumFractionDigits: 4,
      maximumFractionDigits: 8,
    })} $`;
  }

  return `${n.toLocaleString("fr-FR", {
    minimumFractionDigits: 6,
    maximumFractionDigits: 12,
  })} $`;
}

function formatInteger(value) {
  const n = number(value);
  if (n === null) return "N/D";

  return Math.round(n).toLocaleString("fr-FR");
}

function formatPercent(value) {
  const n = number(value);
  if (n === null) return "N/D";

  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)} %`;
}

function formatAge(value) {
  const n = number(value);
  if (n === null || n < 0) return "N/D";

  const minutes = Math.floor(n / 60_000);

  if (minutes < 60) {
    return `${Math.max(1, minutes)} min`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} h`;
  }

  const days = Math.floor(hours / 24);

  if (days < 30) {
    return `${days} j`;
  }

  const months = Math.floor(days / 30);

  if (months < 12) {
    return `${months} mois`;
  }

  return `${(days / 365).toFixed(1)} an`;
}

function shortMint(value) {
  if (!value || typeof value !== "string") return "N/D";
  if (value.length <= 18) return value;

  return `${value.slice(0, 8)}...${value.slice(-8)}`;
}

function scoreClass(score) {
  const n = number(score);

  if (n === null) return "neutral";
  if (n >= 75) return "high";
  if (n >= 50) return "medium";

  return "low";
}

function changeClass(value) {
  const n = number(value);

  if (n === null || n === 0) return "neutral";
  return n > 0 ? "positive" : "negative";
}

function normalizeToken(token, index) {
  const mint =
    token?.mint ||
    token?.address ||
    token?.tokenAddress ||
    token?.baseToken?.address ||
    "";

  return {
    id: mint || token?.id || `token-${index}`,
    rank: number(token?.rank) ?? index + 1,
    mint,
    name:
      token?.name ||
      token?.baseToken?.name ||
      "Token inconnu",
    symbol:
      token?.symbol ||
      token?.baseToken?.symbol ||
      "N/D",
    priceUsd:
      number(token?.priceUsd) ??
      number(token?.price),
    marketCap:
      number(token?.marketCap) ??
      number(token?.fdv),
    liquidity:
      number(token?.liquidity) ??
      number(token?.liquidityUsd) ??
      number(token?.liquidity?.usd),
    volume24h:
      number(token?.volume24h) ??
      number(token?.volume?.h24),
    transactions24h:
      number(token?.transactions24h) ??
      number(token?.txns24h) ??
      (
        number(token?.txns?.h24?.buys) !== null ||
        number(token?.txns?.h24?.sells) !== null
          ? (number(token?.txns?.h24?.buys) || 0) +
            (number(token?.txns?.h24?.sells) || 0)
          : null
      ),
    buys24h:
      number(token?.buys24h) ??
      number(token?.txns?.h24?.buys),
    sells24h:
      number(token?.sells24h) ??
      number(token?.txns?.h24?.sells),
    change24h:
      number(token?.change24h) ??
      number(token?.priceChange24h) ??
      number(token?.priceChange?.h24),
    ageMs:
      number(token?.ageMs) ??
      (
        number(token?.pairCreatedAt) !== null
          ? Math.max(0, Date.now() - number(token?.pairCreatedAt))
          : null
      ),
    score:
      number(token?.score) ??
      number(token?.radarScore) ??
      number(token?.profitxScore),
    status:
      token?.status ||
      token?.marketState ||
      "OBSERVÉ",
    source:
      token?.source ||
      "Solana",
  };
}

export default function Radar() {
  const router = useRouter();

  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("score");
  const [minimumLiquidity, setMinimumLiquidity] = useState(0);

  const [copiedMint, setCopiedMint] = useState("");

  const loadRadar = useCallback(async (manual = false) => {
    if (manual) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const controller = new AbortController();

      const timeout = setTimeout(() => {
        controller.abort();
      }, 15_000);

      const response = await fetch("/api/radar", {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const text = await response.text();

      let result = null;

      try {
        result = text ? JSON.parse(text) : null;
      } catch {
        throw new Error(
          `Réponse Radar invalide (${response.status}).`
        );
      }

      if (!response.ok) {
        throw new Error(
          result?.error ||
            result?.message ||
            `Radar indisponible (${response.status}).`
        );
      }

      const rawTokens = Array.isArray(result)
        ? result
        : Array.isArray(result?.tokens)
        ? result.tokens
        : Array.isArray(result?.data)
        ? result.data
        : [];

      const normalized = rawTokens
        .map(normalizeToken)
        .filter((token) => token.mint);

      setTokens(normalized);

      const serverTime =
        result?.updatedAt ||
        result?.timestamp ||
        Date.now();

      setLastUpdated(new Date(serverTime));
    } catch (err) {
      if (err?.name === "AbortError") {
        setError(
          "Le moteur Radar met trop de temps à répondre. Réessayez dans quelques instants."
        );
      } else {
        setError(
          err?.message ||
            "Impossible de charger les données Radar."
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadRadar(false);
  }, [loadRadar]);

  useEffect(() => {
    if (!autoRefresh) return undefined;

    const interval = setInterval(() => {
      loadRadar(true);
    }, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [autoRefresh, loadRadar]);

  const displayedTokens = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = tokens.filter((token) => {
      const matchesSearch =
        !query ||
        token.name.toLowerCase().includes(query) ||
        token.symbol.toLowerCase().includes(query) ||
        token.mint.toLowerCase().includes(query);

      const liquidity = number(token.liquidity);

      const matchesLiquidity =
        minimumLiquidity <= 0 ||
        (liquidity !== null && liquidity >= minimumLiquidity);

      return matchesSearch && matchesLiquidity;
    });

    return [...filtered].sort((a, b) => {
      const av =
        sortBy === "score"
          ? number(a.score)
          : sortBy === "liquidity"
          ? number(a.liquidity)
          : sortBy === "volume"
          ? number(a.volume24h)
          : sortBy === "marketCap"
          ? number(a.marketCap)
          : sortBy === "change"
          ? number(a.change24h)
          : null;

      const bv =
        sortBy === "score"
          ? number(b.score)
          : sortBy === "liquidity"
          ? number(b.liquidity)
          : sortBy === "volume"
          ? number(b.volume24h)
          : sortBy === "marketCap"
          ? number(b.marketCap)
          : sortBy === "change"
          ? number(b.change24h)
          : null;

      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;

      return bv - av;
    });
  }, [tokens, search, sortBy, minimumLiquidity]);

  async function copyMint(mint) {
    if (!mint) return;

    try {
      await navigator.clipboard.writeText(mint);
      setCopiedMint(mint);

      setTimeout(() => {
        setCopiedMint("");
      }, 1500);
    } catch {
      setCopiedMint("");
    }
  }

  function analyzeToken(mint) {
    if (!mint) return;

    router.push({
      pathname: "/",
      query: {
        mint,
      },
    });
  }

  return (
    <>
      <Head>
        <title>PFX Radar — PROFITX AI</title>
        <meta
          name="description"
          content="PFX Radar — surveillance et présélection de tokens Solana par PROFITX AI."
        />
        <meta name="robots" content="index,follow" />
      </Head>

      <main className="radarPage">
        <div className="radarShell">
          <header className="radarHeader">
            <div className="brandBlock">
              <div className="brandMark">PFX</div>

              <div>
                <div className="brandName">PROFITX AI</div>
                <div className="brandSub">
                  SOLANA INTELLIGENCE
                </div>
              </div>
            </div>

            <nav className="navActions">
              <button
                type="button"
                className="navButton"
                onClick={() => router.push("/")}
              >
                ANALYZER
              </button>

              <button
                type="button"
                className="navButton activeNav"
              >
                RADAR
              </button>
            </nav>
          </header>

          <section className="hero">
            <div className="heroCopy">
              <div className="eyebrow">
                PROFITX INTELLIGENCE MODULE
              </div>

              <h1>
                PFX <span>RADAR</span>
              </h1>

              <p>
                Détection et présélection de tokens Solana à
                examiner. Les données affichées sont des signaux
                observables et ne constituent ni une prédiction de
                prix ni une recommandation d&apos;achat.
              </p>
            </div>

            <div className="radarPulse" aria-hidden="true">
              <div className="pulseRing ringOne" />
              <div className="pulseRing ringTwo" />
              <div className="pulseRing ringThree" />
              <div className="pulseLine lineOne" />
              <div className="pulseLine lineTwo" />
              <div className="pulseCore">PFX</div>
            </div>
          </section>

          <section className="statusBar">
            <div className="statusLeft">
              <span
                className={`statusDot ${
                  error ? "statusError" : "statusOnline"
                }`}
              />

              <div>
                <strong>
                  {error
                    ? "RADAR TEMPORAIREMENT INDISPONIBLE"
                    : "RADAR OPÉRATIONNEL"}
                </strong>

                <span>
                  {lastUpdated
                    ? `Dernière mise à jour : ${lastUpdated.toLocaleTimeString(
                        "fr-FR",
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        }
                      )}`
                    : "En attente des données du moteur Radar"}
                </span>
              </div>
            </div>

            <div className="statusActions">
              <label className="autoRefresh">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(event) =>
                    setAutoRefresh(event.target.checked)
                  }
                />
                Auto 60 s
              </label>

              <button
                type="button"
                className="refreshButton"
                disabled={refreshing}
                onClick={() => loadRadar(true)}
              >
                {refreshing
                  ? "ACTUALISATION..."
                  : "ACTUALISER"}
              </button>
            </div>
          </section>

          <section className="controls">
            <div className="searchBox">
              <label htmlFor="radar-search">
                RECHERCHER
              </label>

              <input
                id="radar-search"
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Nom, symbole ou mint..."
                autoComplete="off"
              />
            </div>

            <div className="controlBox">
              <label htmlFor="radar-sort">
                CLASSER PAR
              </label>

              <select
                id="radar-sort"
                value={sortBy}
                onChange={(event) =>
                  setSortBy(event.target.value)
                }
              >
                <option value="score">
                  Score PFX
                </option>
                <option value="liquidity">
                  Liquidité
                </option>
                <option value="volume">
                  Volume 24 h
                </option>
                <option value="marketCap">
                  Market cap
                </option>
                <option value="change">
                  Variation 24 h
                </option>
              </select>
            </div>

            <div className="controlBox">
              <label htmlFor="radar-liquidity">
                LIQUIDITÉ MIN.
              </label>

              <select
                id="radar-liquidity"
                value={minimumLiquidity}
                onChange={(event) =>
                  setMinimumLiquidity(
                    Number(event.target.value)
                  )
                }
              >
                <option value={0}>Toutes</option>
                <option value={5000}>
                  5 000 $
                </option>
                <option value={10000}>
                  10 000 $
                </option>
                <option value={25000}>
                  25 000 $
                </option>
                <option value={50000}>
                  50 000 $
                </option>
                <option value={100000}>
                  100 000 $
                </option>
              </select>
            </div>

            <div className="resultCounter">
              <span>TOKENS AFFICHÉS</span>
              <strong>{displayedTokens.length}</strong>
            </div>
          </section>

          {error && (
            <section className="message errorMessage">
              <strong>MOTEUR RADAR</strong>
              <p>{error}</p>
              <p>
                L&apos;Analyzer PROFITX existant reste
                indépendant et n&apos;est pas affecté.
              </p>
            </section>
          )}

          {loading ? (
            <section className="loadingPanel">
              <div className="loader" />
              <strong>INITIALISATION PFX RADAR</strong>
              <span>
                Récupération des signaux Solana...
              </span>
            </section>
          ) : !error && displayedTokens.length === 0 ? (
            <section className="emptyPanel">
              <div className="emptyIcon">◎</div>
              <strong>AUCUN TOKEN À AFFICHER</strong>
              <p>
                Aucun résultat ne correspond actuellement aux
                critères sélectionnés.
              </p>
            </section>
          ) : (
            <section className="tokenGrid">
              {displayedTokens.map((token, index) => (
                <article
                  className="tokenCard"
                  key={token.id}
                >
                  <div className="cardTop">
                    <div className="rank">
                      #{index + 1}
                    </div>

                    <div
                      className={`scoreBadge ${scoreClass(
                        token.score
                      )}`}
                    >
                      <span>SCORE PFX</span>
                      <strong>
                        {number(token.score) !== null
                          ? Math.round(token.score)
                          : "N/D"}
                      </strong>
                      <small>/100</small>
                    </div>
                  </div>

                  <div className="tokenIdentity">
                    <div className="tokenIcon">
                      {token.symbol !== "N/D"
                        ? token.symbol
                            .slice(0, 2)
                            .toUpperCase()
                        : "?"}
                    </div>

                    <div className="tokenTitle">
                      <h2>{token.name}</h2>
                      <div>
                        ${token.symbol}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="mintButton"
                    onClick={() =>
                      copyMint(token.mint)
                    }
                    title="Copier le mint"
                  >
                    <span>
                      {shortMint(token.mint)}
                    </span>

                    <strong>
                      {copiedMint === token.mint
                        ? "COPIÉ"
                        : "COPIER"}
                    </strong>
                  </button>

                  <div className="metrics">
                    <div className="metric">
                      <span>PRIX</span>
                      <strong>
                        {formatPrice(token.priceUsd)}
                      </strong>
                    </div>

                    <div className="metric">
                      <span>MARKET CAP</span>
                      <strong>
                        {formatMoney(token.marketCap)}
                      </strong>
                    </div>

                    <div className="metric">
                      <span>LIQUIDITÉ</span>
                      <strong>
                        {formatMoney(token.liquidity)}
                      </strong>
                    </div>

                    <div className="metric">
                      <span>VOLUME 24 H</span>
                      <strong>
                        {formatMoney(token.volume24h)}
                      </strong>
                    </div>

                    <div className="metric">
                      <span>TRANSACTIONS 24 H</span>
                      <strong>
                        {formatInteger(
                          token.transactions24h
                        )}
                      </strong>
                    </div>

                    <div className="metric">
                      <span>ÂGE</span>
                      <strong>
                        {formatAge(token.ageMs)}
                      </strong>
                    </div>
                  </div>

                  <div className="marketLine">
                    <div>
                      <span>VARIATION 24 H</span>
                      <strong
                        className={changeClass(
                          token.change24h
                        )}
                      >
                        {formatPercent(
                          token.change24h
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>ACHATS / VENTES</span>
                      <strong>
                        {formatInteger(token.buys24h)}
                        {" / "}
                        {formatInteger(token.sells24h)}
                      </strong>
                    </div>
                  </div>

                  <div className="cardFooter">
                    <div className="tokenStatus">
                      <span>STATUT</span>
                      <strong>{token.status}</strong>
                    </div>

                    <button
                      type="button"
                      className="analyzeButton"
                      onClick={() =>
                        analyzeToken(token.mint)
                      }
                    >
                      ANALYSER →
                    </button>
                  </div>
                </article>
              ))}
            </section>
          )}

          <section className="methodology">
            <div>
              <span className="methodNumber">01</span>
              <strong>OBSERVATION</strong>
              <p>
                Radar collecte uniquement des données
                disponibles et observables.
              </p>
            </div>

            <div>
              <span className="methodNumber">02</span>
              <strong>PRÉSÉLECTION</strong>
              <p>
                Le score sert à organiser les résultats selon
                plusieurs signaux mesurables.
              </p>
            </div>

            <div>
              <span className="methodNumber">03</span>
              <strong>ANALYSE</strong>
              <p>
                Un token repéré peut ensuite être envoyé vers
                PROFITX AI Analyzer pour une analyse détaillée.
              </p>
            </div>
          </section>

          <footer className="radarFooter">
            <div>
              <strong>PROFITX AI</strong>
              <span>PFX RADAR V1</span>
            </div>

            <p>
              Outil informatif. Les scores et données ne
              constituent pas un conseil financier, une garantie
              de performance ou une prédiction de prix.
            </p>
          </footer>
        </div>
      </main>

      <style jsx>{`
        .radarPage {
          min-height: 100vh;
          background:
            radial-gradient(
              circle at 80% 10%,
              rgba(33, 242, 139, 0.08),
              transparent 28%
            ),
            radial-gradient(
              circle at 15% 35%,
              rgba(89, 72, 255, 0.07),
              transparent 30%
            ),
            #050807;
          color: #f4f7f5;
        }

        .radarShell {
          width: min(1380px, calc(100% - 48px));
          margin: 0 auto;
          padding-bottom: 60px;
        }

        .radarHeader {
          min-height: 92px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          border-bottom: 1px solid #1d3028;
        }

        .brandBlock {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .brandMark {
          width: 46px;
          height: 46px;
          display: grid;
          place-items: center;
          border: 1px solid #21f28b;
          border-radius: 10px;
          color: #21f28b;
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 1px;
          box-shadow:
            inset 0 0 20px rgba(33, 242, 139, 0.05),
            0 0 24px rgba(33, 242, 139, 0.06);
        }

        .brandName {
          font-size: 15px;
          font-weight: 900;
          letter-spacing: 2px;
        }

        .brandSub {
          margin-top: 5px;
          color: #789087;
          font-size: 10px;
          letter-spacing: 2px;
        }

        .navActions {
          display: flex;
          gap: 8px;
        }

        .navButton {
          min-height: 40px;
          padding: 0 18px;
          border: 1px solid #294138;
          border-radius: 10px;
          background: transparent;
          color: #9cb0a8;
          cursor: pointer;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1px;
        }

        .navButton:hover,
        .activeNav {
          border-color: #21f28b;
          color: #21f28b;
        }

        .hero {
          min-height: 410px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 60px;
          padding: 65px 0;
          overflow: hidden;
        }

        .heroCopy {
          position: relative;
          z-index: 2;
          max-width: 780px;
        }

        .eyebrow {
          color: #21f28b;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 3px;
        }

        .hero h1 {
          margin: 18px 0 20px;
          font-size: clamp(58px, 8vw, 118px);
          line-height: 0.9;
          letter-spacing: -7px;
        }

        .hero h1 span {
          color: #21f28b;
        }

        .hero p {
          max-width: 720px;
          margin: 0;
          color: #9aaba4;
          font-size: 15px;
          line-height: 1.8;
        }

        .radarPulse {
          position: relative;
          flex: 0 0 300px;
          width: 300px;
          height: 300px;
          display: grid;
          place-items: center;
        }

        .pulseRing {
          position: absolute;
          border: 1px solid rgba(33, 242, 139, 0.25);
          border-radius: 50%;
        }

        .ringOne {
          width: 100%;
          height: 100%;
        }

        .ringTwo {
          width: 68%;
          height: 68%;
        }

        .ringThree {
          width: 36%;
          height: 36%;
        }

        .pulseLine {
          position: absolute;
          width: 100%;
          height: 1px;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(33, 242, 139, 0.6),
            transparent
          );
        }

        .lineOne {
          transform: rotate(45deg);
        }

        .lineTwo {
          transform: rotate(-45deg);
        }

        .pulseCore {
          position: relative;
          z-index: 2;
          width: 76px;
          height: 76px;
          display: grid;
          place-items: center;
          border: 1px solid #21f28b;
          border-radius: 50%;
          background: #07100c;
          color: #21f28b;
          font-weight: 900;
          box-shadow:
            0 0 40px rgba(33, 242, 139, 0.2),
            inset 0 0 25px rgba(33, 242, 139, 0.08);
        }

        .statusBar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 18px 20px;
          border: 1px solid #1c3128;
          border-radius: 14px;
          background: rgba(8, 15, 12, 0.8);
        }

        .statusLeft {
          display: flex;
          align-items: center;
          gap: 13px;
        }

        .statusLeft strong,
        .statusLeft span {
          display: block;
        }

        .statusLeft strong {
          font-size: 11px;
          letter-spacing: 1px;
        }

        .statusLeft span {
          margin-top: 5px;
          color: #71857d;
          font-size: 11px;
        }

        .statusDot {
          width: 9px;
          height: 9px;
          flex: 0 0 9px;
          border-radius: 50%;
        }

        .statusOnline {
          background: #21f28b;
          box-shadow: 0 0 15px #21f28b;
        }

        .statusError {
          background: #ff5d68;
          box-shadow: 0 0 15px rgba(255, 93, 104, 0.6);
        }

        .statusActions {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .autoRefresh {
          display: flex;
          align-items: center;
          gap: 7px;
          color: #82958d;
          font-size: 11px;
          cursor: pointer;
        }

        .autoRefresh input {
          accent-color: #21f28b;
        }

        .refreshButton {
          min-height: 40px;
          padding: 0 18px;
          border: 1px solid #21f28b;
          border-radius: 9px;
          background: rgba(33, 242, 139, 0.08);
          color: #21f28b;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 1px;
          cursor: pointer;
        }

        .refreshButton:disabled {
          opacity: 0.5;
          cursor: wait;
        }

        .controls {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 160px;
          gap: 12px;
          margin: 18px 0 24px;
        }

        .searchBox,
        .controlBox,
        .resultCounter {
          min-height: 82px;
          padding: 14px 16px;
          border: 1px solid #182a23;
          border-radius: 12px;
          background: #080d0b;
        }

        .searchBox label,
        .controlBox label,
        .resultCounter span {
          display: block;
          margin-bottom: 8px;
          color: #60746c;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 1.5px;
        }

        .searchBox input,
        .controlBox select {
          width: 100%;
          height: 36px;
          border: 0;
          outline: 0;
          background: transparent;
          color: #f4f7f5;
          font-size: 13px;
        }

        .searchBox input::placeholder {
          color: #44554e;
        }

        .controlBox select {
          cursor: pointer;
        }

        .controlBox option {
          background: #0b110e;
          color: #fff;
        }

        .resultCounter {
          display: flex;
          flex-direction: column;
          justify-content: center;
          text-align: right;
        }

        .resultCounter strong {
          color: #21f28b;
          font-size: 27px;
        }

        .message,
        .loadingPanel,
        .emptyPanel {
          margin: 25px 0;
          padding: 50px 30px;
          border: 1px solid #1d3028;
          border-radius: 16px;
          background: #080d0b;
          text-align: center;
        }

        .errorMessage {
          border-color: rgba(255, 93, 104, 0.35);
        }

        .errorMessage strong {
          color: #ff7881;
          letter-spacing: 2px;
        }

        .errorMessage p,
        .emptyPanel p {
          color: #81938c;
          line-height: 1.7;
        }

        .loadingPanel {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          color: #82958d;
        }

        .loadingPanel strong {
          color: #f4f7f5;
          letter-spacing: 2px;
        }

        .loader {
          width: 38px;
          height: 38px;
          margin-bottom: 10px;
          border: 2px solid #1b3328;
          border-top-color: #21f28b;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .emptyIcon {
          margin-bottom: 12px;
          color: #21f28b;
          font-size: 40px;
        }

        .tokenGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        .tokenCard {
          padding: 22px;
          border: 1px solid #1b3027;
          border-radius: 16px;
          background:
            linear-gradient(
              145deg,
              rgba(13, 23, 19, 0.96),
              rgba(6, 10, 8, 0.98)
            );
          transition:
            transform 0.2s ease,
            border-color 0.2s ease;
        }

        .tokenCard:hover {
          transform: translateY(-2px);
          border-color: #315244;
        }

        .cardTop {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
        }

        .rank {
          color: #52665e;
          font-size: 12px;
          font-weight: 900;
        }

        .scoreBadge {
          display: flex;
          align-items: baseline;
          gap: 5px;
          padding: 8px 10px;
          border: 1px solid #283b34;
          border-radius: 9px;
        }

        .scoreBadge span {
          margin-right: 5px;
          color: #6f817a;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 1px;
        }

        .scoreBadge strong {
          font-size: 22px;
        }

        .scoreBadge small {
          color: #61736c;
          font-size: 9px;
        }

        .scoreBadge.high strong {
          color: #21f28b;
        }

        .scoreBadge.medium strong {
          color: #ffcf5a;
        }

        .scoreBadge.low strong {
          color: #ff7881;
        }

        .scoreBadge.neutral strong {
          color: #8b9c95;
        }

        .tokenIdentity {
          display: flex;
          align-items: center;
          gap: 14px;
          margin: 22px 0 14px;
        }

        .tokenIcon {
          width: 48px;
          height: 48px;
          display: grid;
          place-items: center;
          flex: 0 0 48px;
          border: 1px solid #29483b;
          border-radius: 12px;
          background: #0c1612;
          color: #21f28b;
          font-size: 12px;
          font-weight: 900;
        }

        .tokenTitle h2 {
          margin: 0 0 5px;
          font-size: 21px;
          letter-spacing: -0.5px;
        }

        .tokenTitle div {
          color: #758880;
          font-size: 11px;
          font-weight: 800;
        }

        .mintButton {
          width: 100%;
          min-height: 38px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 0 12px;
          border: 1px solid #172820;
          border-radius: 9px;
          background: #060a08;
          color: #778a82;
          cursor: pointer;
        }

        .mintButton span {
          overflow: hidden;
          font-family: monospace;
          font-size: 11px;
          text-overflow: ellipsis;
        }

        .mintButton strong {
          color: #21f28b;
          font-size: 8px;
          letter-spacing: 1px;
        }

        .metrics {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin-top: 18px;
        }

        .metric {
          min-height: 75px;
          padding: 12px;
          border: 1px solid #16261f;
          border-radius: 9px;
          background: rgba(4, 8, 6, 0.55);
        }

        .metric span,
        .marketLine span,
        .tokenStatus span {
          display: block;
          margin-bottom: 9px;
          color: #596d64;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 1px;
        }

        .metric strong {
          font-size: 13px;
        }

        .marketLine {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-top: 8px;
        }

        .marketLine > div {
          padding: 12px;
          border: 1px solid #16261f;
          border-radius: 9px;
        }

        .marketLine strong {
          font-size: 12px;
        }

        .positive {
          color: #21f28b;
        }

        .negative {
          color: #ff6570;
        }

        .neutral {
          color: #93a39d;
        }

        .cardFooter {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          margin-top: 18px;
          padding-top: 17px;
          border-top: 1px solid #172820;
        }

        .tokenStatus strong {
          font-size: 10px;
          letter-spacing: 1px;
        }

        .analyzeButton {
          min-height: 42px;
          padding: 0 20px;
          border: 0;
          border-radius: 9px;
          background: #21f28b;
          color: #03130b;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 1px;
          cursor: pointer;
        }

        .analyzeButton:hover {
          box-shadow: 0 0 25px rgba(33, 242, 139, 0.2);
        }

        .methodology {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1px;
          margin-top: 50px;
          border: 1px solid #1a2c24;
          border-radius: 15px;
          overflow: hidden;
          background: #1a2c24;
        }

        .methodology > div {
          padding: 25px;
          background: #080d0b;
        }

        .methodNumber {
          display: block;
          margin-bottom: 20px;
          color: #21f28b;
          font-size: 10px;
          font-weight: 900;
        }

        .methodology strong {
          font-size: 11px;
          letter-spacing: 1.5px;
        }

        .methodology p {
          margin: 10px 0 0;
          color: #72857d;
          font-size: 11px;
          line-height: 1.7;
        }

        .radarFooter {
          display: flex;
          justify-content: space-between;
          gap: 40px;
          margin-top: 45px;
          padding-top: 25px;
          border-top: 1px solid #172820;
        }

        .radarFooter div {
          display: flex;
          gap: 12px;
          font-size: 10px;
          letter-spacing: 1px;
        }

        .radarFooter div span {
          color: #21f28b;
        }

        .radarFooter p {
          max-width: 700px;
          margin: 0;
          color: #566961;
          font-size: 10px;
          line-height: 1.6;
          text-align: right;
        }

        @media (max-width: 900px) {
          .radarShell {
            width: min(100% - 28px, 1380px);
          }

          .hero {
            min-height: auto;
            padding: 70px 0;
          }

          .radarPulse {
            display: none;
          }

          .hero h1 {
            letter-spacing: -4px;
          }

          .controls {
            grid-template-columns: 1fr 1fr;
          }

          .searchBox {
            grid-column: 1 / -1;
          }

          .tokenGrid {
            grid-template-columns: 1fr;
          }

          .methodology {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 620px) {
          .radarHeader,
          .statusBar,
          .cardFooter,
          .radarFooter {
            align-items: stretch;
            flex-direction: column;
          }

          .radarHeader {
            padding: 18px 0;
          }

          .navActions,
          .statusActions {
            width: 100%;
          }

          .navButton,
          .refreshButton {
            flex: 1;
          }

          .hero {
            padding: 55px 0;
          }

          .hero h1 {
            font-size: 58px;
            letter-spacing: -4px;
          }

          .controls {
            grid-template-columns: 1fr;
          }

          .searchBox {
            grid-column: auto;
          }

          .resultCounter {
            text-align: left;
          }

          .metrics {
            grid-template-columns: 1fr 1fr;
          }

          .marketLine {
            grid-template-columns: 1fr;
          }

          .analyzeButton {
            width: 100%;
          }

          .radarFooter p {
            text-align: left;
          }
        }
      `}</style>
    </>
  );
}
