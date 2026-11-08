import { useCallback, useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";

const REFRESH_INTERVAL = 60000;
const WATCHLIST_KEY = "profitx-watchlist-v1";

function num(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function money(value) {
  const n = num(value);
  if (n === null) return "N/D";
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(2)} Md$`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(2)} M$`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(1)} k$`;
  return `${n.toLocaleString("fr-FR", {
    maximumFractionDigits: 2,
  })} $`;
}

function price(value) {
  const n = num(value);
  if (n === null) return "N/D";
  return `${n.toLocaleString("fr-FR", {
    maximumFractionDigits: n < 0.01 ? 12 : 6,
  })} $`;
}

function integer(value) {
  const n = num(value);
  return n === null ? "N/D" : Math.round(n).toLocaleString("fr-FR");
}

function percent(value) {
  const n = num(value);
  return n === null ? "N/D" : `${n > 0 ? "+" : ""}${n.toFixed(2)} %`;
}

function age(value) {
  const n = num(value);
  if (n === null || n < 0) return "N/D";
  const minutes = Math.floor(n / 60000);
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} h`;
  return `${Math.floor(minutes / 1440)} j`;
}

function shortMint(mint) {
  if (!mint) return "N/D";
  return mint.length > 18
    ? `${mint.slice(0, 8)}...${mint.slice(-8)}`
    : mint;
}

function timestamp(value) {
  if (!value) return null;
  const n = num(value);
  if (n !== null) {
    const ms = n < 1e11 ? n * 1000 : n;
    return Number.isFinite(ms) ? ms : null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeToken(token, index) {
  const mint =
    token?.mint ||
    token?.address ||
    token?.tokenAddress ||
    token?.baseToken?.address ||
    "";

  const detectedAt =
    token?.detectedAt ||
    token?.detected_at ||
    token?.createdOnchainAt ||
    token?.created_onchain_at ||
    null;

  const createdTime =
    timestamp(token?.createdOnchainAt) ??
    timestamp(token?.created_onchain_at) ??
    timestamp(detectedAt) ??
    timestamp(token?.pairCreatedAt);

  const liquidityObject =
    token?.liquidity && typeof token.liquidity === "object"
      ? token.liquidity.usd
      : token?.liquidity;

  const txBuys = num(token?.txns?.h24?.buys);
  const txSells = num(token?.txns?.h24?.sells);

  return {
    id: mint || `token-${index}`,
    mint,
    name: token?.name || token?.baseToken?.name || "Token inconnu",
    symbol: token?.symbol || token?.baseToken?.symbol || "N/D",
    priceUsd: num(token?.priceUsd) ?? num(token?.price),
    marketCap:
      num(token?.marketCap) ??
      num(token?.marketCapUsd) ??
      num(token?.fdv),
    liquidity:
      num(token?.liquidityUsd) ??
      num(liquidityObject),
    volume24h:
      num(token?.volume24h) ??
      num(token?.volume24hUsd) ??
      num(token?.volume?.h24),
    transactions24h:
      num(token?.transactions24h) ??
      num(token?.txns24h) ??
      (txBuys !== null || txSells !== null
        ? (txBuys || 0) + (txSells || 0)
        : null),
    buys24h: num(token?.buys24h) ?? txBuys,
    sells24h: num(token?.sells24h) ?? txSells,
    change24h:
      num(token?.change24h) ??
      num(token?.priceChange24h) ??
      num(token?.priceChange?.h24),
    score:
      num(token?.score) ??
      num(token?.radarScore) ??
      num(token?.profitxScore),
    securityScore:
      num(token?.securityScore) ??
      num(token?.security_score),
    securityChecked: token?.securityChecked === true,
    mintAuthorityEnabled: token?.mintAuthorityEnabled === true ? true :
      token?.mintAuthorityEnabled === false ? false : null,
    freezeAuthorityEnabled: token?.freezeAuthorityEnabled === true ? true :
      token?.freezeAuthorityEnabled === false ? false : null,
    concentrationChecked: token?.concentrationChecked === true,
    top1AccountPercent: num(token?.top1AccountPercent),
    top10AccountsPercent: num(token?.top10AccountsPercent),
    sellabilityEvidence: token?.sellabilityEvidence || "not_verified",
    creatorAddress: token?.creatorAddress || null,
    creatorSeenTokenCount: num(token?.creatorSeenTokenCount),
    largestTokenAccountAddress: token?.largestTokenAccountAddress || null,
    largestTokenAccountOwner: token?.largestTokenAccountOwner || null,
    largestTokenAccountFrozen: token?.largestTokenAccountFrozen === true,
    largestAuthorityAccountType: token?.largestAuthorityAccountType || null,
    tokenProgram: token?.tokenProgram || null,
    tokenExtensions: Array.isArray(token?.tokenExtensions)
      ? token.tokenExtensions.filter((item) => typeof item === "string") : null,
    utilityScore:
      num(token?.utilityScore) ??
      num(token?.utility_score),
    speculationRiskScore:
      num(token?.speculationRiskScore) ??
      num(token?.speculation_risk_score),
    detectedAt,
    createdTime,
    ageMs:
      num(token?.ageMs) ??
      (createdTime !== null
        ? Math.max(0, Date.now() - createdTime)
        : null),
    status:
      token?.status ||
      token?.analysis_status ||
      token?.marketState ||
      "OBSERVÉ",
    source: token?.source || "Solana",
  };
}

/**
 * Warning based only on observed metrics, never on inferred fraud.
 * Missing liquidity is not zero liquidity and does not prove a scam.
 */
function riskWarningFor(token) {
  if (token.largestTokenAccountFrozen === true) {
    return { level: "critical", title: "COMPTE PRINCIPAL GELE", detail: "Le compte principal est gele sur Solana. Verification necessaire avant tout achat." };
  }
  const extensions = (token.tokenExtensions || []).map((name) =>
    name.replace(/[^a-z]/gi, "").toLowerCase()
  );
  if (extensions.includes("nontransferable")) {
    return {
      level: "critical",
      title: "⚠ TRANSFERTS IMPOSSIBLES — TOKEN NON TRANSFÉRABLE",
      detail: "Le mint porte l’extension NonTransferable : les transferts classiques sont interdits. Vérifiez la possibilité de revente avant tout achat."
    };
  }
  if (extensions.includes("permanentdelegate")) {
    return {
      level: "critical",
      title: "⚠ ALERTE MAJEURE — DÉLÉGUÉ PERMANENT",
      detail: "Le mint porte l’extension PermanentDelegate. Une autorité peut effectuer des transferts ou brûler des tokens sans accord du détenteur."
    };
  }
  if (extensions.includes("transferhook") || extensions.includes("pausable")) {
    return {
      level: "critical",
      title: "⚠ CONTRÔLE DES TRANSFERTS DÉTECTÉ",
      detail: "Une extension TransferHook ou Pausable est présente. Des restrictions de transfert peuvent s’appliquer : vérifiez le programme avant tout achat."
    };
  }
  if (token.securityChecked && token.freezeAuthorityEnabled === true) {
    return {
      level: "critical",
      title: "⚠ ALERTE MAJEURE — GEL DES TOKENS POSSIBLE",
      detail: "Une autorité de gel est active sur ce mint Solana. Des comptes de tokens peuvent être gelés. Ne pas investir sans vérification approfondie."
    };
  }
  if (token.securityChecked && token.mintAuthorityEnabled === true) {
    return {
      level: "critical",
      title: "⚠ ALERTE — CRÉATION DE TOKENS POSSIBLE",
      detail: "Une autorité d'émission est toujours active. L'offre peut potentiellement augmenter. Vérifiez les risques de dilution avant tout achat."
    };
  }
  const liquidity = num(token.liquidity);
  const security = num(token.securityScore);
  if (liquidity !== null && liquidity < 1000) {
    return {
      level: "critical",
      title: "⚠ RISQUE ÉLEVÉ — LIQUIDITÉ TRÈS FAIBLE",
      detail: "Moins de 1 000 $ de liquidité observée. Revendre peut être difficile ou entraîner une perte importante. Évitez tout achat sans analyse approfondie."
    };
  }
  if (security !== null && security < 30) {
    return {
      level: "critical",
      title: "⚠ ALERTE — SCORE DE SÉCURITÉ FAIBLE",
      detail: "Un score de sécurité inférieur à 30/100 nécessite une vérification indépendante avant toute décision."
    };
  }
  // These are TOKEN ACCOUNT balances, not separate owners.
  // Bonding curves and liquidity pools may dominate concentration.
  if (token.concentrationChecked && token.top1AccountPercent >= 80) {
    return {
      level: "unknown",
      title: "⚠ CONCENTRATION À VÉRIFIER — COMPTE PRINCIPAL",
      detail: "Le plus gros compte token contient " + token.top1AccountPercent.toFixed(1) +
        " % de l'offre. Ce compte peut être un pool ou un compte technique : vérifiez son propriétaire avant tout achat."
    };
  }
  if (token.concentrationChecked && token.top10AccountsPercent >= 95) {
    return {
      level: "unknown",
      title: "⚠ CONCENTRATION À VÉRIFIER — 10 COMPTES",
      detail: "Les 10 plus gros comptes concentrent " + token.top10AccountsPercent.toFixed(1) +
        " % de l'offre. Cette observation ne suffit pas à prouver une fraude."
    };
  }
  if (liquidity === null) {
    return {
      level: "unknown",
      title: "⚠ PRUDENCE — LIQUIDITÉ NON VÉRIFIÉE",
      detail: "Aucune liquidité réelle confirmée pour ce token. Ne pas investir avant d'avoir vérifié les possibilités de revente, le contrat et la liquidité."
    };
  }
  return null;
}

function scoreColor(value) {
  const n = num(value);
  if (n === null) return "neutral";
  if (n >= 75) return "good";
  if (n >= 50) return "medium";
  return "bad";
}

export default function Radar() {
  const router = useRouter();

  const [source, setSource] = useState("live");
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const [minimumLiquidity, setMinimumLiquidity] = useState(0);

  const [watchlist, setWatchlist] = useState([]);
  const [copiedMint, setCopiedMint] = useState("");

  useEffect(() => {
    try {
      const saved = JSON.parse(
        window.localStorage.getItem(WATCHLIST_KEY) || "[]"
      );
      if (Array.isArray(saved)) setWatchlist(saved);
    } catch {
      setWatchlist([]);
    }
  }, []);

  const isInWatchlist = (mint) =>
    watchlist.some(
      (item) =>
        item.chainId === "solana" &&
        item.tokenAddress === mint
    );

  function addToWatchlist(token) {
    if (!token?.mint || isInWatchlist(token.mint)) return;

    const updated = [
      {
        id: `solana:${token.mint}`,
        chainId: "solana",
        tokenAddress: token.mint,
        addedAt: new Date().toISOString(),
      },
      ...watchlist,
    ];

    setWatchlist(updated);

    try {
      window.localStorage.setItem(
        WATCHLIST_KEY,
        JSON.stringify(updated)
      );
    } catch {}
  }

  const loadRadar = useCallback(
    async (manual = false) => {
      if (manual) setRefreshing(true);
      else setLoading(true);

      setError("");

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      try {
        const endpoint =
          source === "live" ? "/api/radar-live" : "/api/radar";

        const response = await fetch(endpoint, {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
          signal: controller.signal,
        });

        const text = await response.text();
        let result;

        try {
          result = text ? JSON.parse(text) : null;
        } catch {
          throw new Error(
            `Réponse Radar invalide (${response.status}).`
          );
        }

        if (!response.ok || result?.ok === false) {
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

        const unique = Array.from(
          new Map(normalized.map((token) => [token.mint, token])).values()
        );

        setTokens(unique);

        const updated =
          timestamp(result?.updatedAt) ??
          timestamp(result?.timestamp) ??
          Date.now();

        setLastUpdated(new Date(updated));
      } catch (err) {
        setError(
          err?.name === "AbortError"
            ? "Le Radar met trop de temps à répondre."
            : err?.message || "Impossible de charger les données."
        );
      } finally {
        clearTimeout(timeout);
        setLoading(false);
        setRefreshing(false);
      }
    },
    [source]
  );

  useEffect(() => {
    loadRadar(false);
  }, [loadRadar]);

  useEffect(() => {
    if (!autoRefresh) return;

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

      const matchesLiquidity =
        minimumLiquidity === 0 ||
        (token.liquidity !== null &&
          token.liquidity >= minimumLiquidity);

      return matchesSearch && matchesLiquidity;
    });

    const getSortValue = (token) => {
      switch (sortBy) {
        case "recent":
          return token.createdTime;
        case "score":
          return token.score;
        case "liquidity":
          return token.liquidity;
        case "volume":
          return token.volume24h;
        case "marketCap":
          return token.marketCap;
        case "change":
          return token.change24h;
        default:
          return null;
      }
    };

    return [...filtered].sort((a, b) => {
      const av = num(getSortValue(a));
      const bv = num(getSortValue(b));

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
      setTimeout(() => setCopiedMint(""), 1500);
    } catch {
      setCopiedMint("");
    }
  }

  function changeSource(nextSource) {
    if (nextSource === source) return;
    setTokens([]);
    setSource(nextSource);
    setSortBy(nextSource === "live" ? "recent" : "score");
    setMinimumLiquidity(0);
    setSearch("");
  }

  return (
    <>
      <Head>
        <title>PFX Radar V2 — PROFITX AI</title>
        <meta
          name="description"
          content="PROFITX AI Radar V2 — détection de nouveaux tokens Solana et surveillance du marché."
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
                <div className="brandSub">SOLANA INTELLIGENCE</div>
              </div>
            </div>

            <nav className="navActions">
              {[
                ["/", "ANALYZER"],
                ["/radar", "RADAR"],
                ["/compare", "COMPARE"],
                ["/intelligence", "INTELLIGENCE"],
                ["/watchlist", "WATCHLIST"],
                ["/alerts", "ALERTS"],
                ["/obtenir-pfx", "OBTENIR PFX"],
              ].map(([path, label]) => (
                <button
                  key={path}
                  type="button"
                  className={`navButton ${
                    path === "/radar" ? "activeNav" : ""
                  }`}
                  onClick={() => router.push(path)}
                >
                  {label}
                </button>
              ))}
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
                Détection de nouveaux tokens Solana via Helius,
                surveillance du marché et présélection pour analyse.
                Les données présentées ne constituent ni une prédiction
                de prix ni une recommandation d&apos;achat.
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
                    : loading
                    ? "CHARGEMENT DU RADAR"
                    : "RADAR OPÉRATIONNEL"}
                </strong>
                <span>
                  {lastUpdated
                    ? `Dernière mise à jour : ${lastUpdated.toLocaleTimeString(
                        "fr-FR"
                      )}`
                    : "En attente des données"}
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
                disabled={refreshing || loading}
                onClick={() => loadRadar(true)}
              >
                {refreshing ? "ACTUALISATION..." : "ACTUALISER"}
              </button>
            </div>
          </section>

          <section className="sourceSelector">
            <button
              type="button"
              className={source === "live" ? "sourceActive" : ""}
              onClick={() => changeSource("live")}
            >
              HELIUS · NOUVEAUX TOKENS
            </button>
            <button
              type="button"
              className={source === "market" ? "sourceActive" : ""}
              onClick={() => changeSource("market")}
            >
              RADAR MARCHÉ · EXISTANT
            </button>
            <span>
              {source === "live"
                ? "Détections Helius enregistrées dans Supabase — données non auditées"
                : "Signaux du moteur Radar historique"}
            </span>
          </section>

          <section className="riskGlobalBanner" role="note">
            <strong>⚠ ALERTE PROFITX — NE CONFONDEZ PAS DÉTECTION ET FIABILITÉ</strong>
            <p>
              Un token nouvellement détecté n'est pas audité. Un avertissement orange
              signifie que des données essentielles manquent ; un avertissement rouge
              repose sur un signal défavorable observé. Aucun de ces signaux ne prouve
              à lui seul une arnaque. Vérifiez toujours avant d'investir.
            </p>
          </section>

          <section className="controls">
            <div className="searchBox">
              <label htmlFor="radar-search">RECHERCHER</label>
              <input
                id="radar-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nom, symbole ou mint..."
                autoComplete="off"
              />
            </div>

            <div className="controlBox">
              <label htmlFor="radar-sort">CLASSER PAR</label>
              <select
                id="radar-sort"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
              >
                <option value="recent">Plus récents</option>
                <option value="score">Score PFX</option>
                <option value="liquidity">Liquidité</option>
                <option value="volume">Volume 24 h</option>
                <option value="marketCap">Market cap</option>
                <option value="change">Variation 24 h</option>
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
                  setMinimumLiquidity(Number(event.target.value))
                }
              >
                <option value={0}>Toutes</option>
                <option value={5000}>5 000 $</option>
                <option value={10000}>10 000 $</option>
                <option value={25000}>25 000 $</option>
                <option value={50000}>50 000 $</option>
                <option value={100000}>100 000 $</option>
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
                L&apos;Analyzer PROFITX reste indépendant et
                n&apos;est pas affecté.
              </p>
            </section>
          )}

          {loading ? (
            <section className="loadingPanel">
              <div className="loader" />
              <strong>INITIALISATION PFX RADAR</strong>
              <span>Récupération des signaux Solana...</span>
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
                <article className="tokenCard" key={token.id}>
                  {riskWarningFor(token) && (
                    <div
                      className={`riskWarning ${riskWarningFor(token).level}`}
                      role="note"
                      aria-label="Avertissement sur le risque du token"
                    >
                      <strong>{riskWarningFor(token).title}</strong>
                      <p>{riskWarningFor(token).detail}</p>
                    </div>
                  )}
                  <div className="cardTop">
                    <div className="rank">#{index + 1}</div>

                    <div
                      className={`scoreBadge ${scoreColor(token.score)}`}
                    >
                      <span>SCORE PFX</span>
                      <strong>
                        {token.score !== null
                          ? Math.round(token.score)
                          : "N/D"}
                      </strong>
                      <small>/100</small>
                    </div>
                  </div>

                  <div className="tokenIdentity">
                    <div className="tokenIcon">
                      {token.symbol !== "N/D"
                        ? token.symbol.slice(0, 2).toUpperCase()
                        : "?"}
                    </div>
                    <div className="tokenTitle">
                      <h2>{token.name}</h2>
                      <div>
                        {token.symbol === "N/D"
                          ? "Symbole en attente"
                          : `$${token.symbol}`}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="mintButton"
                    onClick={() => copyMint(token.mint)}
                    title="Copier le mint"
                  >
                    <span>{shortMint(token.mint)}</span>
                    <strong>
                      {copiedMint === token.mint ? "COPIÉ" : "COPIER"}
                    </strong>
                  </button>

                  <div className="metrics">
                    {[
                      ["PRIX", price(token.priceUsd)],
                      ["MARKET CAP", money(token.marketCap)],
                      ["LIQUIDITÉ", money(token.liquidity)],
                      ["VOLUME 24 H", money(token.volume24h)],
                      [
                        "TRANSACTIONS 24 H",
                        integer(token.transactions24h),
                      ],
                      ["ÂGE", age(token.ageMs)],
                    ].map(([label, value]) => (
                      <div className="metric" key={label}>
                        <span>{label}</span>
                        <strong>{value}</strong>
                      </div>
                    ))}
                  </div>

                  <div className="marketLine">
                    <div>
                      <span>VARIATION 24 H</span>
                      <strong
                        className={
                          token.change24h === null
                            ? "neutral"
                            : token.change24h > 0
                            ? "positive"
                            : token.change24h < 0
                            ? "negative"
                            : "neutral"
                        }
                      >
                        {percent(token.change24h)}
                      </strong>
                    </div>

                    <div>
                      <span>ACHATS / VENTES</span>
                      <strong>
                        {integer(token.buys24h)}
                        {" / "}
                        {integer(token.sells24h)}
                      </strong>
                    </div>
                  </div>

                  {source === "live" && (
                    <div className="onchainLine">
                      <strong>VÉRIFICATIONS ON-CHAIN</strong>
                      {token.securityChecked ? (
                        <span>
                          Émission : {token.mintAuthorityEnabled ? "AUTORISÉE ⚠" : "DÉSACTIVÉE"}
                          {" • "}
                          Gel : {token.freezeAuthorityEnabled ? "AUTORITÉ ACTIVE ⚠" : "AUTORITÉ ABSENTE"}
                        </span>
                      ) : (
                        <span>Non vérifiées — vérification Solana RPC indisponible</span>
                      )}
                      {token.concentrationChecked && (
                        <span>
                          Plus gros compte : {token.top1AccountPercent.toFixed(1)} %
                          {" • "}10 plus gros comptes : {token.top10AccountsPercent.toFixed(1)} %
                          {" (comptes tokens, propriétaires non identifiés)"}
                        </span>
                      )}
                      {token.largestTokenAccountOwner && (
                        <span>
                          Autorité du plus gros compte : {shortMint(token.largestTokenAccountOwner)}
                          {" (adresse on-chain ; pool ou personne non déterminé)"}
                          {token.largestTokenAccountFrozen ? " • COMPTE GELÉ ⚠" : ""}
                        </span>
                      )}
                      {token.largestAuthorityAccountType && (
                        <span>
                          Type de l'autorite du compte principal : {
                            token.largestAuthorityAccountType === "program_owned_account" ? "Compte appartenant a un programme" :
                            token.largestAuthorityAccountType === "executable_program" ? "Programme executable" :
                            "Compte appartenant au programme Systeme"
                          } (cela n'identifie pas a lui seul un pool ni une personne).
                        </span>
                      )}
                      {token.creatorAddress && (
                        <span>
                          Payeur du lancement : {shortMint(token.creatorAddress)}
                          {token.creatorSeenTokenCount !== null
                            ? " • " + token.creatorSeenTokenCount + " token(s) observé(s) avec cette adresse dans PFX"
                            : " • historique non disponible"}
                          {" (le payeur ne prouve pas l'identité du créateur)"}
                        </span>
                      )}
                      <span>
                        Revente : {token.sellabilityEvidence === "transfer_restriction_observed"
                          ? "RESTRICTIONS DE TRANSFERT ⚠ — VENTE NON TESTÉE"
                          : token.sellabilityEvidence === "historical_sales_observed"
                            ? "VENTES OBSERVÉES SUR UNE PAIRE (24 H) — VOTRE REVENTE NON GARANTIE"
                            : token.liquidity !== null && token.liquidity > 0
                              ? "MARCHÉ OBSERVÉ — VENTE NON TESTÉE"
                              : "NON VÉRIFIÉE"}
                      </span>
                      {token.tokenProgram === "token-2022" && (
                        <span>Token-2022 : {token.tokenExtensions?.length ? `extensions déclarées : ${token.tokenExtensions.join(", ")}. ` : ""}Extensions et restrictions supplémentaires non auditées.</span>
                      )}
                    </div>
                  )}

                  {source === "live" && (
                    <div className="analysisLine">
                      <span>ANALYSE DE SÉCURITÉ</span>
                      <strong>
                        {token.securityScore !== null
                          ? `${Math.round(token.securityScore)}/100`
                          : "EN ATTENTE"}
                      </strong>
                    </div>
                  )}

                  <div className="cardFooter">
                    <div className="tokenStatus">
                      <span>STATUT</span>
                      <strong>
                        {token.status === "pending"
                          ? "EN ATTENTE"
                          : token.status === "enriched"
                          ? "ENRICHI"
                          : token.status}
                      </strong>
                    </div>

                    <div className="cardActions">
                      <button
                        type="button"
                        className={`watchlistButton ${
                          isInWatchlist(token.mint)
                            ? "watchlistAdded"
                            : ""
                        }`}
                        disabled={isInWatchlist(token.mint)}
                        onClick={() => addToWatchlist(token)}
                      >
                        {isInWatchlist(token.mint)
                          ? "AJOUTÉ ✓"
                          : "+ WATCHLIST"}
                      </button>

                      <button
                        type="button"
                        className="analyzeButton"
                        onClick={() =>
                          router.push({
                            pathname: "/",
                            query: { mint: token.mint },
                          })
                        }
                      >
                        ANALYSER →
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </section>
          )}

          <section className="methodology">
            <div>
              <span className="methodNumber">01</span>
              <strong>DÉTECTION</strong>
              <p>
                Helius détecte de nouveaux tokens Solana et
                les enregistre dans Supabase.
              </p>
            </div>
            <div>
              <span className="methodNumber">02</span>
              <strong>ENRICHISSEMENT</strong>
              <p>
                Les informations disponibles sont complétées
                progressivement. Les valeurs absentes restent N/D.
              </p>
            </div>
            <div>
              <span className="methodNumber">03</span>
              <strong>ANALYSE</strong>
              <p>
                Chaque token peut être transmis à PROFITX AI
                Analyzer pour un examen approfondi.
              </p>
            </div>
          </section>

          <footer className="radarFooter">
            <div>
              <strong>PROFITX AI</strong>
              <span>PFX RADAR V2</span>
            </div>
            <p>
              Outil informatif. Une détection ou un score ne
              garantit ni la sécurité ni la performance d&apos;un token.
              Aucun conseil financier.
            </p>
          </footer>
        </div>
      </main>

      <style jsx>{`
        .radarPage {
          min-height: 100vh;
          background:
            radial-gradient(circle at 80% 10%, rgba(33,242,139,.08), transparent 28%),
            radial-gradient(circle at 15% 35%, rgba(89,72,255,.07), transparent 30%),
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
          box-shadow: 0 0 24px rgba(33,242,139,.08);
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
          flex-wrap: wrap;
          gap: 8px;
        }
        .navButton {
          min-height: 40px;
          padding: 0 14px;
          border: 1px solid #294138;
          border-radius: 10px;
          background: transparent;
          color: #9cb0a8;
          cursor: pointer;
          font-size: 10px;
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
          line-height: .9;
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
          border: 1px solid rgba(33,242,139,.25);
          border-radius: 50%;
        }
        .ringOne { width: 100%; height: 100%; }
        .ringTwo { width: 68%; height: 68%; }
        .ringThree { width: 36%; height: 36%; }
        .pulseLine {
          position: absolute;
          width: 100%;
          height: 1px;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(33,242,139,.6),
            transparent
          );
        }
        .lineOne { transform: rotate(45deg); }
        .lineTwo { transform: rotate(-45deg); }
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
          box-shadow: 0 0 40px rgba(33,242,139,.2);
        }
        .statusBar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 18px 20px;
          border: 1px solid #1c3128;
          border-radius: 14px;
          background: rgba(8,15,12,.8);
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
          box-shadow: 0 0 15px rgba(255,93,104,.6);
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
          background: rgba(33,242,139,.08);
          color: #21f28b;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 1px;
          cursor: pointer;
        }
        .refreshButton:disabled {
          opacity: .5;
          cursor: wait;
        }
        .sourceSelector {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 10px;
          margin-top: 18px;
          padding: 15px;
          border: 1px solid #1c3128;
          border-radius: 12px;
          background: #080d0b;
        }
        .sourceSelector button {
          min-height: 42px;
          padding: 0 16px;
          border: 1px solid #294138;
          border-radius: 9px;
          background: #0a1410;
          color: #a0b4aa;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .5px;
          cursor: pointer;
        }
        .sourceSelector button.sourceActive {
          border-color: #21f28b;
          background: rgba(33,242,139,.12);
          color: #21f28b;
        }
        .sourceSelector span {
          color: #71857d;
          font-size: 11px;
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
          border-color: rgba(255,93,104,.35);
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
          animation: spin .8s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
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
          min-width: 0;
          padding: 22px;
          border: 1px solid #1b3027;
          border-radius: 16px;
          background: linear-gradient(
            145deg,
            rgba(13,23,19,.96),
            rgba(6,10,8,.98)
          );
          transition: transform .2s ease, border-color .2s ease;
        }
        .riskGlobalBanner {
          margin: 20px 0;
          padding: 18px 22px;
          border: 2px solid #e4a84b;
          border-radius: 12px;
          background: linear-gradient(100deg, rgba(137,78,0,.25), rgba(75,36,0,.12));
          color: #ffdfa0;
        }
        .riskGlobalBanner strong {
          display: block;
          font-size: 13px;
          letter-spacing: .5px;
        }
        .riskGlobalBanner p {
          font-size: 12px;
          margin: 8px 0 0;
          line-height: 1.6;
        }
        .riskWarning {
          border: 2px solid #f0b74a;
          border-radius: 12px;
          padding: 15px 16px;
          margin-bottom: 17px;
          color: #ffe1a4;
          background: rgba(138, 82, 0, .22);
          box-shadow: inset 0 0 18px rgba(240, 183, 74, .06);
        }
        .riskWarning.critical {
          border-color: #ff5868;
          color: #ffe2e5;
          background: rgba(154, 22, 45, .26);
          box-shadow: inset 0 0 24px rgba(255, 88, 104, .08);
        }
        .riskWarning strong {
          display: block;
          font-size: 13px;
          font-weight: 950;
          letter-spacing: .6px;
          line-height: 1.4;
        }
        .riskWarning p {
          margin: 8px 0 0;
          font-size: 12px;
          line-height: 1.55;
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
        .scoreBadge.good strong { color: #21f28b; }
        .scoreBadge.medium strong { color: #ffcf5a; }
        .scoreBadge.bad strong { color: #ff7881; }
        .scoreBadge.neutral strong { color: #8b9c95; }
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
        .tokenTitle {
          min-width: 0;
        }
        .tokenTitle h2 {
          margin: 0 0 5px;
          overflow-wrap: anywhere;
          font-size: 21px;
          letter-spacing: -.5px;
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
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
          margin-top: 18px;
        }
        .metric {
          min-height: 75px;
          min-width: 0;
          padding: 12px;
          border: 1px solid #16261f;
          border-radius: 9px;
          background: rgba(4,8,6,.55);
        }
        .metric span,
        .marketLine span,
        .tokenStatus span,
        .onchainLine {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-top: 12px;
          padding: 12px;
          border: 1px solid #263d33;
          border-radius: 9px;
          background: rgba(9, 22, 15, .65);
          color: #a5b7ac;
          font-size: 11px;
          line-height: 1.5;
        }
        .onchainLine strong {
          color: #d0eadb;
          font-size: 10px;
          letter-spacing: .6px;
        }
        .analysisLine span {
          display: block;
          margin-bottom: 9px;
          color: #596d64;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 1px;
        }
        .metric strong {
          overflow-wrap: anywhere;
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
        .positive { color: #21f28b; }
        .negative { color: #ff6570; }
        .neutral { color: #93a39d; }
        .analysisLine {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-top: 8px;
          padding: 12px;
          border: 1px solid #16261f;
          border-radius: 9px;
        }
        .analysisLine span {
          margin-bottom: 0;
        }
        .analysisLine strong {
          color: #9fb6aa;
          font-size: 11px;
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
        .cardActions {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .watchlistButton {
          min-height: 42px;
          padding: 0 16px;
          border: 1px solid #21f28b;
          border-radius: 9px;
          background: transparent;
          color: #21f28b;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 1px;
          cursor: pointer;
        }
        .watchlistButton:hover:not(:disabled) {
          background: rgba(33,242,139,.08);
        }
        .watchlistAdded {
          border-color: #315244;
          background: rgba(33,242,139,.08);
          color: #7fae99;
          cursor: default;
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
          box-shadow: 0 0 25px rgba(33,242,139,.2);
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
        @media (max-width: 1100px) {
          .radarHeader {
            align-items: flex-start;
            flex-direction: column;
            padding: 20px 0;
          }
        }
        @media (max-width: 900px) {
          .radarShell {
            width: calc(100% - 28px);
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
          .statusBar,
          .cardFooter,
          .radarFooter {
            align-items: stretch;
            flex-direction: column;
          }
          .navActions,
          .statusActions {
            width: 100%;
            flex-wrap: wrap;
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
          .cardActions {
            width: 100%;
            flex-direction: column;
          }
          .watchlistButton,
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
