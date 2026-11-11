import { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import PfxPoolStatus from "../components/PfxPoolStatus";
import MarketDataNotice from "../components/MarketDataNotice";
import AnalysisQualityNotice from "../components/AnalysisQualityNotice";
import { canCompareScores } from "../utils/analysis-quality";

const OFFICIAL_PFX_MINT = "6FwDVfnnETqUe2UrxZEeLA6u7Vo5Td2Nm79z7s38pump";

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
    VALID: "Marché détecté",
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
    label: "Couverture des contrôles",
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
  if (["score", "structural", "market", "security"].includes(row.key) && !canCompareScores(a, b)) {
    return { a: false, b: false };
  }
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

  for (const result of [a, b]) {
    if (result.dataQuality?.status && result.dataQuality.status !== "COMPLETE") {
      insights.push(`${tokenSymbol(result)} : ${result.dataQuality.label.toLowerCase()}. Son score indicatif ne permet pas de conclure à sa solidité globale.`);
    }
  }

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
    if (item.key === "security" && !canCompareScores(a, b)) continue;
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
      )} affiche une valeur plus élevée pour ${item.label} (${item.format(
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
function TokenLogo({ mint, token, selected }) {
  const [resolvedLogo, setResolvedLogo] = useState("");
  const [failedImages, setFailedImages] = useState([]);
  const officialPfx = mint === OFFICIAL_PFX_MINT;
  const pfxLogo = "data:image/jpeg;base64,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";

  // Reset the logo and failed URLs when a different token is selected.
  useEffect(() => {
    setResolvedLogo("");
    setFailedImages([]);
    if (!mint || officialPfx) return;
    const controller = new AbortController();
    fetch("/api/token-logo?mint=" + encodeURIComponent(mint), { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!controller.signal.aborted && data?.mint === mint && data?.imageUri) {
          setResolvedLogo(data.imageUri);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [mint, officialPfx]);

  const candidates = officialPfx ? [pfxLogo] : [
    resolvedLogo,
    selected?.imageUri,
    token?.imageUri
  ].filter((value, index, all) => typeof value === "string" && value.length > 0 && all.indexOf(value) === index);
  const image = candidates.find((candidate) => !failedImages.includes(candidate));
  const symbol = (token?.symbol || selected?.symbol || "?").slice(0, 3).toUpperCase();

  return image ? (
    <img key={mint + image} className="tokenImage" src={image}
      alt={"Logo " + (token?.symbol || selected?.symbol || "token")}
      onError={() => setFailedImages((previous) => previous.includes(image) ? previous : [...previous, image])}
      style={{ objectFit: "cover", borderRadius: "50%", width: 56, height: 56, minWidth: 56, flex: "0 0 56px", display: "block" }}
    />
  ) : (
    <div className="tokenFallback" title="Logo non disponible auprès des sources de métadonnées"
      style={{ display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, color: "#37ff8d" }}>
      {symbol}
    </div>
  );
}

function TokenPicker({ id, label, value, onChange, selected, onSelect, disabled }) {
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [sourceNotice, setSourceNotice] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const query = value.trim();
    if (!open || selected || query.length < 2 || isSolanaMint(query)) {
      setResults([]);
      setSearching(false);
      setSearchError("");
      setSourceNotice("");
      return;
    }
    const controller = new AbortController();
    setResults([]); setSearching(true); setSearchError(""); setSourceNotice("");
    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchError("");
      try {
        const response = await fetch("/api/search-token?q=" + encodeURIComponent(query), { signal: controller.signal });
        const data = await response.json();
        if (!response.ok || data?.ok !== true) throw new Error(data?.error || "Recherche indisponible.");
        if (controller.signal.aborted) return;
        setResults(Array.isArray(data.results) ? data.results : []);
        setSourceNotice(data.pumpError || "");
      } catch (error) {
        if (!controller.signal.aborted && error.name !== "AbortError") {
          setResults([]);
          setSearchError(error.message || "Recherche indisponible.");
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [value, selected, open]);

  return (
    <div className="inputBlock" style={{ position: "relative", minWidth: 0 }}>
      <label htmlFor={id} style={{ display: "block", marginBottom: 8, color: "#2bfa88", fontSize: 12, fontWeight: 800 }}>{label}</label>
      <input
        style={{ width: "100%", minWidth: 0, boxSizing: "border-box", display: "block", background: "#07120d", border: "1px solid #23e780", borderRadius: 10, padding: "16px", color: "#fff", fontSize: 16 }}
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => { onChange(event.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={event => { if (event.key === "Escape") setOpen(false); }}
        placeholder="Nom, symbole ou adresse mint Solana"
        autoComplete="off"
        spellCheck={false}
        aria-autocomplete="list"
        aria-expanded={open && !selected && value.trim().length >= 2 && !isSolanaMint(value.trim())}
      />
      {sourceNotice && open && !selected && <p role="status" style={{ color: "#ffd18b", fontSize: 12 }}>{sourceNotice} Couverture de recherche partielle.</p>}
      {selected && (
        <div style={{ color: "#2bfa88", fontSize: 12, marginTop: 6, overflowWrap: "anywhere" }}>
          ✓ {selected.name || selected.symbol} ({selected.symbol || "?"}) — {selected.mint}
          {selected.verificationStatus === "OFFICIAL_PROJECT_MINT" ? " · Mint déclaré officiel PFX (non audité)" : " · Identité non vérifiée"}
        </div>
      )}
      {open && !selected && value.trim().length >= 2 && !isSolanaMint(value.trim()) && (
        <div role="listbox" style={{ position: "absolute", zIndex: 30, top: "100%", left: 0, right: 0, maxHeight: 300, overflowY: "auto", background: "#08140f", border: "1px solid #20e57b", borderRadius: 10, boxShadow: "0 12px 30px #000c" }}>
          {searching && <div style={{ padding: 12, color: "#c7d9cf" }}>Recherche de tokens…</div>}
          {!searching && searchError && <div style={{ padding: 12, color: "#ff9b9b" }}>{searchError}</div>}
          {!searching && !searchError && results.length === 0 && <div style={{ padding: 12, color: "#c7d9cf" }}>Aucun token trouvé. Vérifiez le symbole.</div>}
          {!searching && results.map((token) => (
            <button key={token.mint} type="button" role="option" aria-selected={false}
              onClick={() => { onSelect(token); setOpen(false); }}
              style={{ display: "block", width: "100%", padding: "10px 12px", textAlign: "left", background: "transparent", color: "#f5fff9", border: 0, borderBottom: "1px solid #254133", cursor: "pointer", overflowWrap: "anywhere" }}>
              <strong>{token.name || "Token"} ({token.symbol || "?"})</strong>
              <span style={{ display: "block", fontSize: 11, opacity: 0.8, marginTop: 3 }}>{token.mint}</span>
              <span style={{ display: "block", fontSize: 11, color: token.verificationStatus === "OFFICIAL_PROJECT_MINT" ? "#2bfa88" : "#b9c5bf" }}>
                {token.verificationStatus === "OFFICIAL_PROJECT_MINT" ? "Mint déclaré officiel par PROFITX · non audité" : "Non vérifié"} · {token.dexId || token.source || "Source non précisée"}
                {typeof token.liquidityUsd === "number" ? " · Liquidité " + formatUsd(token.liquidityUsd) : ""}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function isSolanaMint(value) {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)) return false;
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let number = 0n;
  for (const char of value) number = number * 58n + BigInt(alphabet.indexOf(char));
  let bytes = 0;
  while (number > 0n) { bytes++; number >>= 8n; }
  return bytes + (value.match(/^1*/)?.[0].length || 0) === 32;
}

export default function ComparePage() {
  const router = useRouter();

  const [mintA, setMintA] = useState("");
  const [mintB, setMintB] = useState("");
  const [selectedA, setSelectedA] = useState(null);
  const [selectedB, setSelectedB] = useState(null);

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

    const a = selectedA?.mint || mintA.trim();
    const b = selectedB?.mint || mintB.trim();

    setError("");
    setResultA(null);
    setResultB(null);

    if (!a || !b) {
      setError(
        "Renseignez les deux tokens à comparer."
      );
      return;
    }

    if ((!selectedA && !isSolanaMint(a)) || (!selectedB && !isSolanaMint(b))) {
      setError("Pour une recherche par nom ou symbole, sélectionnez le token dans les suggestions avant de comparer.");
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

  const tokenA = resultA?.mint === OFFICIAL_PFX_MINT ? { name: "PROFITX", symbol: "PFX", ...(resultA?.token || {}) } : resultA?.token || {};
  const tokenB = resultB?.mint === OFFICIAL_PFX_MINT ? { name: "PROFITX", symbol: "PFX", ...(resultB?.token || {}) } : resultB?.token || {};
  if (resultA?.mint === OFFICIAL_PFX_MINT) { tokenA.name = tokenA.name || "PROFITX"; tokenA.symbol = tokenA.symbol || "PFX"; }
  if (resultB?.mint === OFFICIAL_PFX_MINT) { tokenB.name = tokenB.name || "PROFITX"; tokenB.symbol = tokenB.symbol || "PFX"; }

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

           <nav className="mainNav">
  <button
    type="button"
    onClick={() => router.push("/")}
  >
    ANALYZER
  </button>

  <button
    type="button"
    onClick={() => router.push("/radar")}
  >
    RADAR
  </button>

  <button
    type="button"
    className="active"
    onClick={() => router.push("/compare")}
  >
    COMPARE
  </button>
<button
  type="button"
  onClick={() => router.push("/intelligence")}
>
  INTELLIGENCE
</button>
  <button
    type="button"
    onClick={() => router.push("/watchlist")}
  >
    WATCHLIST
  </button>

  <button
    type="button"
    onClick={() => router.push("/alerts")}
  >
    ALERTS
  </button>

  <button
    type="button"
    className="getPfx"
    onClick={() => router.push("/obtenir-pfx")}
  >
    OBTENIR PFX
  </button>
</nav>
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
            <TokenPicker id="mintA" label="TOKEN A" value={mintA} selected={selectedA}
              disabled={loading} onChange={(value) => { setMintA(value); setSelectedA(null); }}
              onSelect={(token) => { setMintA(token.symbol || token.name || token.mint); setSelectedA(token); }} />
            <div className="versus">VS</div>
            <TokenPicker id="mintB" label="TOKEN B" value={mintB} selected={selectedB}
              disabled={loading} onChange={(value) => { setMintB(value); setSelectedB(null); }}
              onSelect={(token) => { setMintB(token.symbol || token.name || token.mint); setSelectedB(token); }} />

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
                      <TokenLogo mint={resultA?.mint} token={tokenA} selected={selectedA} />

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
                      {resultA.dataQuality?.scoreStatus === "PROVISIONAL" && <span className="badge secondary" style={{ color: "#ffd18b" }}>SCORE INDICATIF · {resultA.dataQuality.label}</span>}
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
                      <TokenLogo mint={resultB?.mint} token={tokenB} selected={selectedB} />

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
                      {resultB.dataQuality?.scoreStatus === "PROVISIONAL" && <span className="badge secondary" style={{ color: "#ffd18b" }}>SCORE INDICATIF · {resultB.dataQuality.label}</span>}
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
                <h2>Périmètre des données comparées</h2>
                <h3>{tokenName(resultA, "Token A")}</h3>
                <AnalysisQualityNotice quality={resultA.dataQuality} />
                <MarketDataNotice market={resultA.market} />
                <h3>{tokenName(resultB, "Token B")}</h3>
                <AnalysisQualityNotice quality={resultB.dataQuality} />
                <MarketDataNotice market={resultB.market} />
              </section>
              {(resultA.mint === OFFICIAL_PFX_MINT || resultB.mint === OFFICIAL_PFX_MINT) && (
                <PfxPoolStatus analysisContext analysisVolume24hUsd={
                  (resultA.mint === OFFICIAL_PFX_MINT ? resultA : resultB).observed?.volume24hUsd ?? null
                } />
              )}

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
                    Couverture des contrôles :{" "}
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
                    Couverture des contrôles :{" "}
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

        .mainNav {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}

.mainNav button {
  padding: 10px 14px;
  border: 1px solid #35ff82;
  border-radius: 9px;
  background: rgba(53, 255, 130, 0.08);
  color: #35ff82;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.7px;
  cursor: pointer;
  transition:
    background 0.15s ease,
    color 0.15s ease;
}

.mainNav button:hover,
.mainNav button.active {
  background: rgba(53, 255, 130, 0.16);
}

.mainNav button.getPfx {
  background: #35ff82;
  color: #031007;
  font-weight: 900;
}

.mainNav button.getPfx:hover {
  background: #62ff9c;
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
