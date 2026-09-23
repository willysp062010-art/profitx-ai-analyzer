const VERSION = "1.0.0";

function isNumber(value) {
  if (value === null || value === undefined || value === "") {
    return false;
  }

  return Number.isFinite(Number(value));
}

function numberOrNull(value) {
  return isNumber(value) ? Number(value) : null;
}

function clampScore(value) {
  const n = numberOrNull(value);

  if (n === null) {
    return null;
  }

  return Math.max(0, Math.min(100, n));
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueStrings(values) {
  return [
    ...new Set(
      values
        .filter(
          (value) =>
            typeof value === "string" &&
            value.trim()
        )
        .map((value) => value.trim())
    )
  ];
}

function getAnalyzerData(analyzer) {
  return {
    score: analyzer?.score || {},
    metrics: analyzer?.metrics || {},
    observed:
      analyzer?.observed ||
      analyzer?.data ||
      {},
    modules: analyzer?.modules || {},
    diagnostic: analyzer?.diagnostic || {},
    missingData: safeArray(
      analyzer?.missingData
    )
  };
}

function buildScores({
  score,
  metrics,
  modules
}) {
  const components =
    score?.components || {};

  const security =
    modules?.security || {};

  return {
    global: clampScore(
      score?.total
    ),

    structural: clampScore(
      score?.structural
    ),

    market: clampScore(
      score?.market
    ),

    liquidity: clampScore(
      components?.liquidity
    ),

    distribution: clampScore(
      components?.distribution
    ),

    maturity: clampScore(
      components?.maturity
    ),

    security: clampScore(
      security?.securityScore ??
        security?.score ??
        components?.security
    ),

    activity: clampScore(
      score?.activity ??
        metrics?.activity
    ),

    volume: clampScore(
      metrics?.volume
    )
  };
}

function metricEntries(scores) {
  return [
    {
      key: "liquidity",
      label: "Liquidité",
      value: scores.liquidity
    },
    {
      key: "distribution",
      label: "Distribution",
      value: scores.distribution
    },
    {
      key: "security",
      label: "Sécurité",
      value: scores.security
    },
    {
      key: "maturity",
      label: "Maturité",
      value: scores.maturity
    },
    {
      key: "activity",
      label: "Activité",
      value: scores.activity
    },
    {
      key: "volume",
      label: "Volume",
      value: scores.volume
    }
  ].filter(
    (item) => item.value !== null
  );
}

function buildStrengths(scores) {
  return metricEntries(scores)
    .filter(
      (item) => item.value >= 80
    )
    .sort(
      (a, b) => b.value - a.value
    )
    .map((item) => ({
      key: item.key,
      label: item.label,
      score: item.value,
      text:
        `${item.label} : indicateur solide ` +
        `selon les données actuellement disponibles ` +
        `(${Math.round(item.value)}/100).`
    }));
}

function buildWatchPoints(scores) {
  return metricEntries(scores)
    .filter(
      (item) => item.value < 60
    )
    .sort(
      (a, b) => a.value - b.value
    )
    .map((item) => ({
      key: item.key,
      label: item.label,
      score: item.value,
      text:
        `${item.label} : indicateur actuellement ` +
        `faible ou limité ` +
        `(${Math.round(item.value)}/100).`
    }));
}

function getEconomicState(observed) {
  const volume =
    numberOrNull(
      observed?.volume24hUsd
    );

  const transactions =
    numberOrNull(
      observed?.transactions24h
    );

  const buys =
    numberOrNull(
      observed?.buys24h
    );

  const sells =
    numberOrNull(
      observed?.sells24h
    );

  const knownValues = [
    volume,
    transactions,
    buys,
    sells
  ].filter((value) => value !== null);

  if (knownValues.length === 0) {
    return {
      state: "UNKNOWN",
      text:
        "L'activité économique récente ne peut pas " +
        "être déterminée avec les données disponibles."
    };
  }

  const allZero =
    knownValues.length === 4 &&
    volume === 0 &&
    transactions === 0 &&
    buys === 0 &&
    sells === 0;

  if (allZero) {
    return {
      state: "INACTIVE",
      text:
        "Aucune activité économique n'est détectée " +
        "sur les dernières 24 heures. Les valeurs " +
        "observées sont de vrais zéros et non des " +
        "données manquantes."
    };
  }

  if (
    (transactions !== null &&
      transactions <= 5) ||
    (volume !== null &&
      volume < 100)
  ) {
    return {
      state: "LOW",
      text:
        "Une activité économique récente est détectée, " +
        "mais elle reste faible sur les dernières " +
        "24 heures."
    };
  }

  return {
    state: "ACTIVE",
    text:
      "Une activité économique récente est détectée " +
      "sur les dernières 24 heures."
  };
}

function buildSummary({
  scores,
  economicState,
  missingData
}) {
  const structural =
    scores.structural;

  const market =
    scores.market;

  let structureText =
    "La structure ne peut pas être qualifiée complètement avec les données disponibles.";

  if (structural !== null) {
    if (structural >= 80) {
      structureText =
        "Les indicateurs structurels disponibles sont globalement solides.";
    } else if (structural >= 60) {
      structureText =
        "Les indicateurs structurels disponibles présentent un profil intermédiaire à solide.";
    } else if (structural >= 40) {
      structureText =
        "Les indicateurs structurels disponibles présentent un profil intermédiaire.";
    } else {
      structureText =
        "Plusieurs indicateurs structurels observés sont actuellement faibles.";
    }
  }

  let marketText = economicState.text;

  if (
    market !== null &&
    economicState.state === "UNKNOWN"
  ) {
    marketText =
      `Le score marché disponible est de ` +
      `${Math.round(market)}/100, mais les données ` +
      `d'activité détaillées sont insuffisantes ` +
      `pour compléter cette lecture.`;
  }

  let completenessText = "";

  if (missingData.length > 0) {
    completenessText =
      ` ${missingData.length} donnée(s) restent ` +
      `indisponibles et ne sont pas estimées.`;
  }

  return (
    `${structureText} ` +
    `${marketText}` +
    `${completenessText}`
  ).trim();
}

function buildConclusion({
  scores,
  economicState,
  strengths,
  watchPoints
}) {
  if (
    scores.structural !== null &&
    scores.market !== null &&
    scores.structural >= 60 &&
    scores.market < 40
  ) {
    return (
      "L'écart principal observé se situe entre une " +
      "structure relativement solide et une activité " +
      "de marché actuellement faible. Le score global " +
      "est donc limité principalement par la composante marché."
    );
  }

  if (
    scores.structural !== null &&
    scores.market !== null &&
    scores.structural < 60 &&
    scores.market >= 60
  ) {
    return (
      "L'activité de marché observée est plus solide " +
      "que la composante structurelle. Les principaux " +
      "points de vigilance proviennent donc de la structure du token."
    );
  }

  if (
    economicState.state === "INACTIVE"
  ) {
    return (
      "Le marché est actuellement inactif sur la fenêtre " +
      "observée. Cette absence d'activité récente doit être " +
      "distinguée des caractéristiques structurelles du token."
    );
  }

  if (
    strengths.length > 0 &&
    watchPoints.length > 0
  ) {
    return (
      "Le profil observé est contrasté : certains indicateurs " +
      "sont solides tandis que d'autres restent faibles ou limités."
    );
  }

  if (
    strengths.length > 0 &&
    watchPoints.length === 0
  ) {
    return (
      "Les indicateurs disponibles sont majoritairement solides, " +
      "sans supprimer les risques propres au marché des crypto-actifs."
    );
  }

  if (watchPoints.length > 0) {
    return (
      "Plusieurs indicateurs disponibles restent faibles ou limités " +
      "et expliquent une partie importante du profil actuellement observé."
    );
  }

  return (
    "La lecture reste partielle et repose uniquement sur " +
    "les données actuellement disponibles."
  );
}

function buildWarnings({
  analyzer,
  modules,
  missingData
}) {
  const security =
    modules?.security || {};

  const diagnostic =
    analyzer?.diagnostic || {};

  return uniqueStrings([
    ...safeArray(
      security?.warnings
    ),

    ...safeArray(
      diagnostic?.warnings
    ),

    ...missingData.map(
      (item) =>
        `Donnée indisponible : ${item}.`
    )
  ]);
}

function buildIntelligence(analyzer) {
  const {
    score,
    metrics,
    observed,
    modules,
    missingData
  } = getAnalyzerData(analyzer);

  const scores =
    buildScores({
      score,
      metrics,
      modules
    });

  const strengths =
    buildStrengths(scores);

  const watchPoints =
    buildWatchPoints(scores);

  const economicState =
    getEconomicState(observed);

  const summary =
    buildSummary({
      scores,
      economicState,
      missingData
    });

  const conclusion =
    buildConclusion({
      scores,
      economicState,
      strengths,
      watchPoints
    });

  const warnings =
    buildWarnings({
      analyzer,
      modules,
      missingData
    });

  return {
    ok: true,
    module: "PFX_INTELLIGENCE",
    version: VERSION,

    mint:
      analyzer?.mint || null,

    timestamp:
      new Date().toISOString(),

    source: {
      module:
        analyzer?.module ||
        "PROFITX_ANALYZER",

      analyzerVersion:
        analyzer?.version ||
        null
    },

    intelligence: {
      summary,

      economicState:
        economicState.state,

      economicReading:
        economicState.text,

      strengths,

      watchPoints,

      conclusion,

      warnings
    },

    scores,

    dataQuality: {
      missingCount:
        missingData.length,

      missingData,

      confidence:
        analyzer?.diagnostic
          ?.confidence || null
    },

    rules: {
      preservesZero: true,
      preservesMissingData: true,
      estimatesMissingValues: false,
      predictsPrice: false,
      financialAdvice: false
    },

    disclaimer:
      "PFX Intelligence explique les données calculées " +
      "par PROFITX. Il ne prédit pas le prix d'un token " +
      "et ne constitue pas un conseil financier."
  };
}

export default async function handler(
  req,
  res
) {
  res.setHeader(
    "Cache-Control",
    "no-store"
  );

  if (req.method !== "POST") {
    res.setHeader(
      "Allow",
      "POST"
    );

    return res.status(405).json({
      ok: false,
      module: "PFX_INTELLIGENCE",
      version: VERSION,
      error:
        "Méthode non autorisée. Utilisez POST."
    });
  }

  try {
    const analyzer =
      req.body?.analyzer;

    if (
      !analyzer ||
      typeof analyzer !== "object" ||
      Array.isArray(analyzer)
    ) {
      return res.status(400).json({
        ok: false,
        module: "PFX_INTELLIGENCE",
        version: VERSION,
        error:
          "Résultat Analyzer manquant ou invalide."
      });
    }

    if (
      analyzer?.ok !== true
    ) {
      return res.status(400).json({
        ok: false,
        module: "PFX_INTELLIGENCE",
        version: VERSION,
        error:
          "PFX Intelligence nécessite une analyse PROFITX valide."
      });
    }

    const result =
      buildIntelligence(analyzer);

    return res
      .status(200)
      .json(result);

  } catch (error) {
    console.error(
      "PFX Intelligence error:",
      error
    );

    return res.status(500).json({
      ok: false,
      module: "PFX_INTELLIGENCE",
      version: VERSION,
      error:
        "Erreur interne PFX Intelligence."
    });
  }
}
