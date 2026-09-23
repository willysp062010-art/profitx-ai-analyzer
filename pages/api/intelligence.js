const VERSION = "1.1.0";

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
      components?.liquidity ??
        metrics?.liquidity
    ),

    distribution: clampScore(
      components?.distribution ??
        metrics?.distribution
    ),

    maturity: clampScore(
      components?.maturity ??
        metrics?.maturity
    ),

    security: clampScore(
      security?.securityScore ??
        security?.score ??
        components?.security ??
        metrics?.security
    ),

    activity: clampScore(
      score?.activity ??
        components?.activity ??
        metrics?.activity
    ),

    volume: clampScore(
      components?.volume ??
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
  ].filter(
    (value) => value !== null
  );

  if (knownValues.length === 0) {
    return {
      state: "UNKNOWN",
      volume,
      transactions,
      buys,
      sells,
      text:
        "L'activité économique récente ne peut pas " +
        "être déterminée avec les données disponibles."
    };
  }

  const allFourKnown =
    volume !== null &&
    transactions !== null &&
    buys !== null &&
    sells !== null;

  const allZero =
    allFourKnown &&
    volume === 0 &&
    transactions === 0 &&
    buys === 0 &&
    sells === 0;

  if (allZero) {
    return {
      state: "INACTIVE",
      volume,
      transactions,
      buys,
      sells,
      text:
        "Aucune activité économique n'est détectée " +
        "sur les dernières 24 heures : volume, " +
        "transactions, achats et ventes observés " +
        "sont tous à zéro."
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
      volume,
      transactions,
      buys,
      sells,
      text:
        "Une activité économique est détectée sur " +
        "les dernières 24 heures, mais elle reste " +
        "faible au regard des valeurs observées."
    };
  }

  return {
    state: "ACTIVE",
    volume,
    transactions,
    buys,
    sells,
    text:
      "Une activité économique récente est clairement " +
      "détectée sur les dernières 24 heures."
  };
}

function findMetric(
  items,
  key
) {
  return items.find(
    (item) => item.key === key
  );
}

function joinLabels(items) {
  const labels =
    items.map(
      (item) => item.label.toLowerCase()
    );

  if (labels.length === 0) {
    return "";
  }

  if (labels.length === 1) {
    return labels[0];
  }

  if (labels.length === 2) {
    return `${labels[0]} et ${labels[1]}`;
  }

  return (
    `${labels
      .slice(0, -1)
      .join(", ")} et ` +
    labels[labels.length - 1]
  );
}

function buildSummary({
  tokenName,
  scores,
  economicState,
  strengths,
  watchPoints,
  missingData
}) {
  const name =
    tokenName || "Le token";

  const structural =
    scores.structural;

  let opening;

  if (structural === null) {
    opening =
      `${name} dispose d'une lecture structurelle ` +
      `encore partielle avec les données disponibles.`;
  } else if (structural >= 80) {
    opening =
      `${name} présente actuellement une structure ` +
      `globalement solide selon les indicateurs disponibles.`;
  } else if (structural >= 60) {
    opening =
      `${name} présente actuellement une structure ` +
      `relativement solide, malgré certains points ` +
      `qui restent à surveiller.`;
  } else if (structural >= 40) {
    opening =
      `${name} présente actuellement un profil ` +
      `structurel intermédiaire.`;
  } else {
    opening =
      `${name} présente actuellement plusieurs ` +
      `faiblesses sur les indicateurs structurels observés.`;
  }

  let strengthText = "";

  if (strengths.length > 0) {
    const mainStrengths =
      strengths.slice(0, 2);

    strengthText =
      ` Les principaux points solides observés ` +
      `concernent ${joinLabels(mainStrengths)}.`;
  }

  let marketText = "";

  if (
    economicState.state === "INACTIVE"
  ) {
    marketText =
      " La faiblesse actuelle du profil provient " +
      "notamment de l'absence d'activité de marché " +
      "sur les dernières 24 heures.";
  } else if (
    economicState.state === "LOW"
  ) {
    marketText =
      " L'activité de marché est présente, mais " +
      "reste faible sur la fenêtre des dernières " +
      "24 heures.";
  } else if (
    economicState.state === "ACTIVE"
  ) {
    marketText =
      " Une activité de marché récente est bien " +
      "présente sur les dernières 24 heures.";
  } else {
    marketText =
      " L'activité récente ne peut pas être " +
      "qualifiée complètement avec les données disponibles.";
  }

  let watchText = "";

  const nonMarketWatch =
    watchPoints.filter(
      (item) =>
        item.key !== "activity" &&
        item.key !== "volume"
    );

  if (nonMarketWatch.length > 0) {
    const mainWatch =
      nonMarketWatch.slice(0, 2);

    watchText =
      ` Un point de vigilance supplémentaire concerne ` +
      `${joinLabels(mainWatch)}.`;
  }

  let missingText = "";

  if (missingData.length > 0) {
    missingText =
      ` ${missingData.length} donnée(s) restent ` +
      `indisponibles et ne sont pas estimées.`;
  }

  return (
    opening +
    strengthText +
    marketText +
    watchText +
    missingText
  ).trim();
}

function buildEconomicReading(
  economicState
) {
  const {
    state,
    volume,
    transactions,
    buys,
    sells
  } = economicState;

  if (state === "UNKNOWN") {
    return (
      "Les données disponibles ne permettent pas " +
      "de déterminer précisément l'activité économique " +
      "des dernières 24 heures."
    );
  }

  if (state === "INACTIVE") {
    return (
      "Sur les dernières 24 heures, l'Analyzer observe " +
      "0 $ de volume, 0 transaction, 0 achat et 0 vente. " +
      "Il s'agit de valeurs observées à zéro et non " +
      "de données remplacées ou estimées."
    );
  }

  const parts = [];

  if (volume !== null) {
    parts.push(
      `${formatCompactUsd(volume)} de volume`
    );
  }

  if (transactions !== null) {
    parts.push(
      `${formatCompactNumber(transactions)} transaction${
        transactions === 1 ? "" : "s"
      }`
    );
  }

  if (buys !== null) {
    parts.push(
      `${formatCompactNumber(buys)} achat${
        buys === 1 ? "" : "s"
      }`
    );
  }

  if (sells !== null) {
    parts.push(
      `${formatCompactNumber(sells)} vente${
        sells === 1 ? "" : "s"
      }`
    );
  }

  const details =
    parts.length > 0
      ? parts.join(", ")
      : "des données d'activité partielles";

  if (state === "LOW") {
    return (
      `Sur les dernières 24 heures, l'Analyzer observe ` +
      `${details}. L'activité existe, mais reste faible ` +
      `sur la fenêtre observée.`
    );
  }

  return (
    `Sur les dernières 24 heures, l'Analyzer observe ` +
    `${details}. Ces données confirment une activité ` +
    `de marché récente sur la fenêtre observée.`
  );
}

function formatCompactNumber(value) {
  if (!isNumber(value)) {
    return "N/D";
  }

  return new Intl.NumberFormat(
    "fr-FR",
    {
      maximumFractionDigits: 2
    }
  ).format(Number(value));
}

function formatCompactUsd(value) {
  if (!isNumber(value)) {
    return "N/D";
  }

  return new Intl.NumberFormat(
    "fr-FR",
    {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2
    }
  ).format(Number(value));
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
      "structure relativement solide et une composante " +
      "marché faible. Le score global est donc principalement " +
      "limité par les indicateurs de marché actuellement observés."
    );
  }

  if (
    scores.structural !== null &&
    scores.market !== null &&
    scores.structural < 60 &&
    scores.market >= 60
  ) {
    return (
      "La composante marché observée est plus solide " +
      "que la composante structurelle. Les principaux " +
      "points de vigilance proviennent donc actuellement " +
      "des indicateurs structurels."
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
      "Les indicateurs actuellement disponibles sont " +
      "majoritairement solides. Cette lecture décrit les " +
      "données observées et ne constitue pas une prévision."
    );
  }

  if (watchPoints.length > 0) {
    return (
      "Plusieurs indicateurs disponibles restent faibles " +
      "ou limités et expliquent une partie importante du " +
      "profil actuellement observé."
    );
  }

  return (
    "La lecture reste partielle et repose uniquement " +
    "sur les données actuellement disponibles."
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

  const name =
    analyzer?.token?.name ||
    analyzer?.token?.symbol ||
    null;

  const summary =
    buildSummary({
      tokenName: name,
      scores,
      economicState,
      strengths,
      watchPoints,
      missingData
    });

  const economicReading =
    buildEconomicReading(
      economicState
    );

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

    token: {
      name:
        analyzer?.token?.name ||
        null,

      symbol:
        analyzer?.token?.symbol ||
        null
    },

    intelligence: {
      summary,

      economicState:
        economicState.state,

      economicReading,

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
