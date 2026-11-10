import { useEffect, useState } from "react";
import PfxPoolStatus from "../components/PfxPoolStatus";


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
      return "AUCUN MARCHÉ DÉTECTÉ";

    case "MARKET_UNVERIFIED":
      return "MARCHÉ NON VÉRIFIÉ";

    default:
      return status || "N/D";
  }
}


function getActivityState(observed, activity) {
  const hasMarketActivityData =
    observed?.volume24hUsd != null ||
    observed?.transactions24h != null ||
    observed?.buys24h != null ||
    observed?.sells24h != null;

  if (!hasMarketActivityData) {
    return {
      label: "DONNÉES INDISPONIBLES",
      description: "Impossible de confirmer l'activité du marché sur les dernières 24 heures.",
      className: "unknown"
    };
  }

  const volume = Number(observed?.volume24hUsd ?? 0);
  const transactions = Number(observed?.transactions24h ?? 0);
  const buys = Number(observed?.buys24h ?? 0);
  const sells = Number(observed?.sells24h ?? 0);

  const allActivityMetricsAvailable =
    observed?.volume24hUsd != null &&
    observed?.transactions24h != null &&
    observed?.buys24h != null &&
    observed?.sells24h != null;

  if (
    volume === 0 &&
    transactions === 0 &&
    buys === 0 &&
    sells === 0 &&
    !allActivityMetricsAvailable
  ) {
    return {
      label: "DONNÉES INCOMPLÈTES",
      description: "Aucune activité positive observée, mais des indicateurs manquent : impossible de confirmer une inactivité totale.",
      className: "unknown"
    };
  }

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

  if (
    observed?.volume24hUsd == null ||
    observed?.transactions24h == null
  ) {
    return {
      label: "ACTIVITÉ PARTIELLEMENT MESURÉE",
      description: "Des mouvements sont observés, mais le volume ou le nombre de transactions manque : intensité non vérifiable.",
      className: "unknown"
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
    return "AUCUN MARCHÉ DÉTECTÉ";
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
    activityState?.label === "DONNÉES INCOMPLÈTES"
  ) {
    marketMessage =
      "Activité non confirmée : certains indicateurs des dernières 24 heures manquent. Aucun zéro manquant n'est interprété comme une preuve d'inactivité.";
  } else if (
    activityState?.label === "DONNÉES INDISPONIBLES"
  ) {
    marketMessage =
      "Activité du marché non vérifiée : les données des dernières 24 heures sont indisponibles, et non égales à zéro.";
  } else if (
    activityState?.label === "INACTIF"
  ) {
    marketMessage =
      "Aucun mouvement économique n'est détecté sur les dernières 24 heures. Les zéros de volume et de transactions sont traités comme de vrais zéros, pas comme des données manquantes.";
  } else if (
    activityState?.label === "ACTIVITÉ PARTIELLEMENT MESURÉE"
  ) {
    marketMessage =
      "Des mouvements récents sont détectés, mais le volume ou les transactions sur 24 heures manquent : impossible de qualifier l'intensité.";
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
const [tokenResults, setTokenResults] = useState([]);
const [tokenSearchLoading, setTokenSearchLoading] = useState(false);
const [tokenSearchError, setTokenSearchError] = useState("");
  const [data, setData] =
    useState(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [sellQuote, setSellQuote] = useState(null);
  const [sellQuoteLoading, setSellQuoteLoading] = useState(false);
  const [sellQuoteError, setSellQuoteError] = useState("");
  const [sellQuoteAmount, setSellQuoteAmount] = useState("1");
  const [eurQuote, setEurQuote] = useState(null);
  const [eurQuoteLoading, setEurQuoteLoading] = useState(false);
  const [eurQuoteError, setEurQuoteError] = useState("");

  async function testEurQuote(eur) {
    if (!data?.mint || eurQuoteLoading) return;
    setEurQuoteLoading(true);
    setEurQuote(null);
    setEurQuoteError("");
    try {
      const response = await fetch(`/api/sell-eur?mint=${encodeURIComponent(data.mint)}&eur=${eur}`);
      const result = await response.json();
      if (!response.ok || result?.ok !== true) throw new Error(result?.error || "Service indisponible.");
      setEurQuote(result);
    } catch (err) {
      setEurQuoteError(err?.message || "Estimation indisponible.");
    } finally {
      setEurQuoteLoading(false);
    }
  }

  function tokenAmountToRaw(value, decimals) {
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
      throw new Error("Décimales du token indisponibles : cotation suspendue.");
    }
    const clean = String(value).trim().replace(",", ".");
    if (!/^(?:[0-9]+)(?:\.[0-9]+)?$/.test(clean)) {
      throw new Error("Saisissez une quantité de tokens valide.");
    }
    const [whole, fraction = ""] = clean.split(".");
    if (fraction.length > decimals) {
      throw new Error(`Ce token accepte au maximum ${decimals} décimales.`);
    }
    const raw = BigInt(whole) * (10n ** BigInt(decimals)) + BigInt((fraction.padEnd(decimals, "0")) || "0");
    if (raw <= 0n || raw.toString().length > 18) {
      throw new Error("Quantité trop faible ou trop élevée pour cette cotation.");
    }
    return raw.toString();
  }

  async function testSellQuote() {
    const tokenMint = data?.mint;
    let rawAmount;
    try {
      if (!tokenMint) throw new Error("Token non analysé.");
      rawAmount = tokenAmountToRaw(sellQuoteAmount, data?.data?.decimals);
    } catch (err) {
      setSellQuoteError(err?.message || "Quantité invalide.");
      return;
    }
    setSellQuoteLoading(true);
    setSellQuote(null);
    setSellQuoteError("");
    try {
      const response = await fetch(
        `/api/sell-quote?mint=${encodeURIComponent(tokenMint)}&amount=${encodeURIComponent(rawAmount)}`
      );
      const result = await response.json();
      if (!response.ok || result?.ok !== true) {
        throw new Error(result?.error || "Cotation indisponible.");
      }
      setSellQuote(result);
    } catch (err) {
      setSellQuoteError(err?.message || "Service de cotation indisponible.");
    } finally {
      setSellQuoteLoading(false);
    }
  }

  useEffect(() => {
    const params =
      new URLSearchParams(window.location.search);

    const mintFromRadar =
      params.get("mint")?.trim();

    if (mintFromRadar) {
      setMint(mintFromRadar);
    }
  }, []);

async function searchToken(query) {
  const text = query.trim();

  setTokenResults([]);
  setTokenSearchError("");

  if (text.length < 2) return;

  setTokenSearchLoading(true);

  try {
    const response = await fetch(
      `/api/search-token?q=${encodeURIComponent(text)}`
    );

    if (!response.ok) {
      throw new Error("Recherche indisponible");
    }

    const result = await response.json();

    if (!result.ok) {
      throw new Error("Recherche impossible");
    }

    setTokenResults(result.results || []);
  } catch (err) {
    setTokenSearchError(
      "Impossible de rechercher les tokens pour le moment."
    );
  } finally {
    setTokenSearchLoading(false);
  }
}
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
    setSellQuote(null);
    setSellQuoteError("");
    setEurQuote(null);
    setEurQuoteError("");

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
    modules?.metadata?.available
      ? modules.metadata
      : token2022?.metadata?.decoded === true
        ? { ...token2022.metadata, available: true }
        : {};


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

        <a
          href="/"
          className="brand"
          style={{
            textDecoration: "none",
            color: "inherit"
          }}
        >
          <span className="logo">
            P
          </span>
          PROFITX AI
        </a>

        <nav
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            flexWrap: "wrap",
            gap: "8px"
          }}
        >
          {[
           ["ANALYZER", "/"],
["RADAR", "/radar"],
["COMPARE", "/compare"],
["INTELLIGENCE", "/intelligence"],
["WATCHLIST", "/watchlist"],
["ALERTS", "/alerts"]
          ].map(([label, href]) => (
            <a
              key={label}
              href={href}
              style={{
                padding: "10px 14px",
                border: "1px solid #00ff88",
                borderRadius: "9px",
                background: "rgba(0,255,136,0.08)",
                color: "#00ff88",
                textDecoration: "none",
                fontWeight: 800,
                fontSize: "12px",
                letterSpacing: "0.7px"
              }}
            >
              {label}
            </a>
          ))}

          <a
            href="/obtenir-pfx"
            style={{
              padding: "10px 14px",
              border: "1px solid #00ff88",
              borderRadius: "9px",
              background: "#00ff88",
              color: "#00150c",
              textDecoration: "none",
              fontWeight: 900,
              fontSize: "12px",
              letterSpacing: "0.7px"
            }}
          >
            OBTENIR PFX
          </a>
        </nav>

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
            href="/obtenir-pfx"
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
            OBTENIR PFX • GUIDE D'ACHAT
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
  href="https://www.instagram.com/pfx_profitx/"
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
  Instagram • @pfx_profitx
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
           onChange={(e) => {
  const value = e.target.value;
  setMint(value);
  setTokenResults([]);
  searchToken(value);
}}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                analyze();
              }
            }}
            placeholder="Nom, symbole ou adresse mint Solana"
            spellCheck="false"
            autoComplete="off"
          />
{tokenSearchLoading && (
  <p>Recherche des tokens Solana...</p>
)}

{tokenSearchError && (
  <p style={{ color: "#ff7070" }}>
    {tokenSearchError}
  </p>
)}

{tokenResults.length > 0 && (
  <div style={{
    width: "100%",
    maxHeight: "280px",
    overflowY: "auto",
    background: "#101a16",
    border: "1px solid #32ff85",
    borderRadius: "8px",
    padding: "8px"
  }}>
    {tokenResults.map((token) => (
      <button
        key={token.mint}
        type="button"
        onClick={() => {
          setMint(token.mint);
          setTokenResults([]);
          setTokenSearchError("");
        }}
        style={{
          display: "block",
          width: "100%",
          textAlign: "left",
          padding: "10px",
          marginBottom: "5px",
          background: "#17251d",
          color: "#ffffff",
          border: "1px solid #344c3c",
          borderRadius: "6px",
          cursor: "pointer",
          overflowWrap: "anywhere"
        }}
      >
        <strong>{token.name} ({token.symbol})</strong>
        <div style={{ fontSize: "11px", opacity: 0.8 }}>
          {token.mint}
        </div>
        <div style={{ fontSize: "11px", color: "#ffcb66" }}>
          {token.verificationStatus === "OFFICIAL_PROJECT_MINT"
            ? "MINT DÉCLARÉ PAR PROFITX — NON AUDITÉ"
            : "MINT NON VÉRIFIÉ"}
        </div>
      </button>
    ))}
  </div>
)}
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
              {data.mint === DEFAULT_MINT ? "Activité de la paire analysée" : "État réel du marché"}
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
              {data.mint === DEFAULT_MINT && market.dexId && (
                <p>Paire suivie pour ces chiffres : {market.dexId}.</p>
              )}
              {activityState.description}
            </div>

          </div>
          {data.mint === DEFAULT_MINT && <PfxPoolStatus analysisContext />}
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
                <span>Liquidité DEX indicative</span>

                <strong>
                  {fmtUsd(
                    observed.liquidityUsd
                  )}
                </strong>
                <small style={{ display: "block", marginTop: 5, opacity: 0.8 }}>
                  {observed.liquidityUsd == null
                    ? "Liquidité non chiffrée par DexScreener pour cette paire."
                    : market?.dexId?.toLowerCase() === "pumpfun"
                      ? "Paire Pump.fun : valeur de marché indicative, pas une preuve de liquidité DEX retirable."
                      : "Valeur déclarée par DexScreener ; réserves et possibilité de revente non auditées."}
                </small>
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
            <h2>Revente du token — preuves disponibles</h2>
            <div className="observed">
              <div>
                <span>Diagnostic</span>
                <strong>
                  {data.sellability?.status === "SELLS_OBSERVED_24H"
                    ? "Ventes observées sur 24 h"
                    : data.sellability?.status === "HISTORICAL_SELLS_OBSERVED"
                      ? "Ventes historiques observées"
                      : "Revente non vérifiée"}
                </strong>
              </div>
              <div>
                <span>Ventes sur 24 h</span>
                <strong>{fmtNumber(data.sellability?.sells24h)}</strong>
              </div>
              <div>
                <span>Ventes historiques détectées</span>
                <strong>{fmtNumber(data.sellability?.historicalSells)}</strong>
              </div>
              <div>
                <span>Revente exécutable maintenant</span>
                <strong>Non vérifiée</strong>
              </div>
            </div>
            <p style={{ marginTop: "12px", opacity: 0.85, lineHeight: 1.6 }}>
              Des ventes passées ne garantissent pas qu'un détenteur puisse
              revendre aujourd'hui. Une simulation de swap actualisée reste
              nécessaire pour évaluer l'exécution, les frais et le slippage.
            </p>
            <div style={{ marginTop: "16px", display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
              <label htmlFor="sell-quote-amount">Quantité de tokens à vendre (simulation)</label>
              <input
                id="sell-quote-amount"
                aria-label="Quantité brute de tokens à coter"
                inputMode="numeric"
                value={sellQuoteAmount}
                onChange={(event) => setSellQuoteAmount(event.target.value)}
                style={{ maxWidth: "180px", padding: "8px", color: "#111" }}
              />
              <button type="button" disabled={sellQuoteLoading} onClick={testSellQuote}>
                {sellQuoteLoading ? "Cotation en cours..." : "Tester une cotation de vente vers SOL"}
              </button>
            </div>
            <p style={{ opacity: 0.8, fontSize: "0.9em" }}>
              Quantité en tokens entiers ou décimaux (ex. 1 ou 0,5). Décimales détectées : {data?.data?.decimals ?? "N/D"}.
              Conversion automatique en unités minimales. Aucun portefeuille ni aucune transaction ne sont utilisés.
            </p>
            {sellQuoteError && <p role="alert">{sellQuoteError}</p>}
            <div style={{ marginTop: "18px" }}>
              <strong>Simulation indicative par montant en euros</strong>
              <p style={{ opacity: 0.8 }}>Montant de référence : estimation des tokens achetables, puis cotation de leur revente. Ce n'est pas une garantie de récupérer ce montant.</p>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                {[10, 100, 1000].map((eur) => (
                  <button key={eur} type="button" disabled={eurQuoteLoading} onClick={() => testEurQuote(eur)}>
                    {eurQuoteLoading ? "Calcul..." : `Simuler ${eur.toLocaleString("fr-FR")} €`}
                  </button>
                ))}
              </div>
              {eurQuoteError && <p role="alert">{eurQuoteError}</p>}
              {eurQuote && (
                <div className="observed" aria-live="polite" style={{ marginTop: "12px" }}>
                  <div><span>Résultat</span><strong>{eurQuote.status === "ROUTE_QUOTED" ? "Deux routes cotées" : "Cotation indisponible"}</strong></div>
                  {eurQuote.indicativeSaleEur != null && <div><span>Revente indicative</span><strong>{new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 4 }).format(eurQuote.indicativeSaleEur)}</strong></div>}
                  {eurQuote.indicativeDifferenceEur != null && <div><span>Écart indicatif achat/revente</span><strong>{new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 4 }).format(eurQuote.indicativeDifferenceEur)}</strong></div>}
                  {eurQuote.priceImpactPct != null && <div><span>Impact prix estimé</span><strong>{Number(eurQuote.priceImpactPct).toLocaleString("fr-FR", { maximumFractionDigits: 4 })}%</strong></div>}
                  {eurQuote.reason && <div><span>Motif</span><strong>{eurQuote.reason}</strong></div>}
                  <p style={{ opacity: 0.8 }}>Taux EUR/USD de référence {eurQuote.fxDate || "non daté"}. USDC ≠ USD garanti. Frais réseau, slippage maximal et exécution non vérifiés. Aucune transaction envoyée.</p>
                </div>
              )}
            </div>
            {sellQuote && (
              <div className="observed" aria-live="polite">
                <div><span>Résultat Jupiter</span><strong>{sellQuote.status === "ROUTE_QUOTED" ? "Route cotée (indicative)" : "Cotation indisponible"}</strong></div>
                {sellQuote.outputAmountRaw != null && (
                  <div><span>Sortie SOL estimée</span><strong>{new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 9 }).format(Number(sellQuote.outputAmountRaw) / 1e9)} SOL</strong></div>
                )}
                {sellQuote.priceImpactPct != null && (
                  <div><span>Impact prix déclaré par Jupiter</span><strong>{new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 4 }).format(Number(sellQuote.priceImpactPct))}%</strong></div>
                )}
                {sellQuote.reason && <div><span>Motif</span><strong>{sellQuote.reason}</strong></div>}
                <div><span>Exécution réelle</span><strong>Non garantie / non vérifiée</strong></div>
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
                <span>Réserves SOL réelles déclarées par Pump.fun</span>

                <strong>
                  {observed.realSolReservesReported == null
                    ? "N/D"
                    : `${fmtDecimal(observed.realSolReservesReported, 4)} SOL`}
                </strong>
              </div>

              <div>
                <span>Réserves SOL lues sur le compte Solana</span>

                <strong>
                  {observed.realSolReservesOnchain == null
                    ? "N/D"
                    : `${fmtDecimal(observed.realSolReservesOnchain, 4)} SOL`}
                </strong>
                <small style={{ display: "block", marginTop: 5, opacity: 0.8 }}>
                  Compte appartenant au programme Pump.fun, adresse
                  fournie par son API et données lues via Solana RPC.
                  Association au mint non vérifiée par PDA ; aucune garantie de revente.
                  {observed.onchainCurveStatus === "PUMPFUN_API_BLOCKED"
                    ? " Lecture indisponible : Pump.fun bloque actuellement l'accès API (HTTP 403)."
                    : observed.onchainCurveStatus === "CURVE_ADDRESS_UNAVAILABLE"
                      ? " Adresse du compte non disponible ou non confirmée."
                      : observed.onchainCurveStatus === "RPC_ACCOUNT_UNVERIFIED"
                        ? " Compte non confirmé par la lecture RPC."
                        : ""}
                  {observed.onchainCurveSlot != null
                    ? ` Slot ${observed.onchainCurveSlot}.`
                    : ""}
                </small>
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
                <span>Valeur indicative SOL virtuels</span>

                <strong>
                  {fmtUsd(
                    observed.virtualSolValueUsd
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

            <p style={{ marginTop: 12, fontSize: 13, opacity: 0.8 }}>
              Les réserves SOL virtuelles et leur valorisation indicative
              ne sont pas de la liquidité DEX disponible. Les réserves
              réelles déclarées par Pump.fun proviennent de son API.
              Une lecture du compte Solana peut apparaître séparément
              si Pump.fun fournit son adresse : son propriétaire est
              vérifié, mais le PDA n'est pas dérivé indépendamment. Ces montants ne garantissent ni
              la liquidité DEX ni la revente.
              N/D signifie donnée indisponible.
            </p>

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
                  {security?.mintAuthorityRevoked === true
                    ? "RÉVOQUÉE"
                    : security?.mintAuthorityRevoked === false
                      ? "ACTIVE"
                      : "N/D — NON VÉRIFIÉE"}
                </strong>
              </div>

              <div>
                <span>
                  Freeze authority
                </span>

                <strong>
                  {security?.freezeAuthorityRevoked === true
                    ? "RÉVOQUÉE"
                    : security?.freezeAuthorityRevoked === false
                      ? "ACTIVE"
                      : "N/D — NON VÉRIFIÉE"}
                </strong>
              </div>

              <div>
                <span>Risque (contrôles disponibles)</span>

                <strong>
                  {security?.riskLevel === "LOW"
                    ? "FAIBLE — PÉRIMÈTRE LIMITÉ"
                    : security?.riskLevel === "MODERATE"
                      ? "MODÉRÉ — PÉRIMÈTRE LIMITÉ"
                      : security?.riskLevel === "HIGH"
                        ? "ÉLEVÉ — PÉRIMÈTRE LIMITÉ"
                        : security?.riskLevel === "VERY_HIGH"
                          ? "TRÈS ÉLEVÉ — PÉRIMÈTRE LIMITÉ"
                          : security?.riskLevel
                            ? "N/D — NIVEAU NON RECONNU"
                            : "N/D"}
                </strong>
              </div>

            </div>


            {security?.tokenProgram === "TOKEN_2022" && (
              <p className="intro" style={{ marginTop: "12px", fontSize: 13 }}>
                Token-2022 : le score de sécurité affiché évalue les contrôles
                disponibles, mais ne constitue pas un audit complet des extensions.
                Des mécanismes additionnels peuvent modifier les transferts ou
                les restrictions du token. Vérifiez les extensions avant toute décision.
              </p>
            )}

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
                    {token2022.isToken2022 === true
                      ? "OUI"
                      : token2022.isToken2022 === false
                        ? "NON"
                        : "N/D — NON VÉRIFIÉ"}
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
                    {token2022.analysisComplete === true
                      ? "OUI"
                      : token2022.analysisComplete === false
                        ? "NON"
                        : "N/D — NON ÉVALUÉE"}
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
                    {metadata.decoded === true
                      ? "OUI"
                      : metadata.decoded === false
                        ? "NON"
                        : "N/D — NON VÉRIFIÉ"}
                  </strong>
                </div>

                <div>
                  <span>
                    Update authority
                  </span>

                  <strong>
                    {metadata.decoded === true
                      ? metadata.updateAuthority == null
                        ? "RÉVOQUÉE"
                        : "ACTIVE"
                      : "N/D — NON VÉRIFIÉE"}
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


          <div className="panel">

            <div className="eyebrow">
              MÉTHODE PROFITX • LECTURE DU SCORE
            </div>

            <h2>
              Comment ProfitX analyse un token
            </h2>

            <p className="intro">
              ProfitX sépare la structure du token et
              l'activité récente du marché. Le score global
              combine 70% de score structurel et 30% de score
              marché lorsque ces données sont disponibles.
            </p>

            <div
              className="observed"
              style={{
                marginTop: "18px"
              }}
            >

              <div>
                <span>
                  Liquidité • 30% structure
                </span>
                <strong>
                  Profondeur financière observée
                </strong>
              </div>

              <div>
                <span>
                  Distribution • 30% structure
                </span>
                <strong>
                  Répartition des holders
                </strong>
              </div>

              <div>
                <span>
                  Maturité • 15% structure
                </span>
                <strong>
                  Ancienneté du marché
                </strong>
              </div>

              <div>
                <span>
                  Sécurité • 25% structure
                </span>
                <strong>
                  Autorités et signaux de risque
                </strong>
              </div>

              <div>
                <span>
                  Activité • 60% marché
                </span>
                <strong>
                  Transactions récentes
                </strong>
              </div>

              <div>
                <span>
                  Volume • 40% marché
                </span>
                <strong>
                  Volume économique récent
                </strong>
              </div>

            </div>

            <div
              style={{
                marginTop: "22px",
                padding: "18px",
                border: "1px solid rgba(0, 255, 136, 0.22)",
                borderRadius: "12px",
                background: "rgba(0, 255, 136, 0.035)"
              }}
            >
              <strong
                style={{
                  display: "block",
                  marginBottom: "10px"
                }}
              >
                0 réel ≠ N/D
              </strong>

              <p
                className="intro"
                style={{
                  marginBottom: 0
                }}
              >
                Une valeur 0 signifie que ProfitX a réellement
                observé zéro pour l'indicateur concerné. N/D
                signifie que la donnée est indisponible, non
                suffisamment fiable ou non exploitable. ProfitX
                ne transforme jamais une donnée manquante en zéro.
              </p>
            </div>

            <div className="hint">
              Les scores ProfitX décrivent les données observées
              au moment de l'analyse. Ils ne prédisent pas le prix
              futur d'un token et ne constituent pas une
              recommandation d'achat ou de vente.
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
