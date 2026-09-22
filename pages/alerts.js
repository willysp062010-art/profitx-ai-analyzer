import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";

const WATCHLIST_STORAGE_KEY = "profitx-watchlist-v1";
const ALERTS_STORAGE_KEY = "profitx-alerts-v1";
const CLIENT_ID_STORAGE_KEY = "profitx-alerts-client-id-v1";

const NETWORKS = {
  solana: "Solana",
  ethereum: "Ethereum",
  base: "Base",
  bsc: "BNB Chain",
};

const METRICS = [
  {
    id: "priceUsd",
    label: "Prix",
    unit: "$",
  },
  {
    id: "change24h",
    label: "Variation 24 h",
    unit: "%",
  },
  {
    id: "liquidityUsd",
    label: "Liquidité",
    unit: "$",
  },
  {
    id: "volume24hUsd",
    label: "Volume 24 h",
    unit: "$",
  },
];

const CONDITIONS = [
  {
    id: "above",
    label: "Au-dessus de",
  },
  {
    id: "below",
    label: "En dessous de",
  },
];

function loadStorage(key) {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const saved = window.localStorage.getItem(key);

    if (!saved) {
      return [];
    }

    const parsed = JSON.parse(saved);

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStorage(key, value) {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    window.localStorage.setItem(
      key,
      JSON.stringify(value)
    );

    return true;
  } catch {
    return false;
  }
}

function createClientId() {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    const existing =
      window.localStorage.getItem(
        CLIENT_ID_STORAGE_KEY
      );

    if (existing) {
      return existing;
    }

    let generated = "";

    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      generated = crypto.randomUUID();
    } else {
      generated = `pfx-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 12)}`;
    }

    window.localStorage.setItem(
      CLIENT_ID_STORAGE_KEY,
      generated
    );

    return generated;
  } catch {
    return `pfx-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 12)}`;
  }
}

function serverRowToAlert(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.alert_id,
    chainId: row.chain_id || "solana",
    tokenAddress: row.token_address || "",
    metric: row.metric || "priceUsd",
    condition: row.condition || "above",
    targetValue: Number(row.target_value),
    enabled: row.enabled !== false,
    triggered: row.status === "triggered",
    createdAt:
      row.created_at || new Date().toISOString(),
  };
}

function mergeAlerts(localAlerts, serverAlerts) {
  const merged = new Map();

  for (const alert of serverAlerts || []) {
    if (alert?.id) {
      merged.set(alert.id, alert);
    }
  }

  for (const alert of localAlerts || []) {
    if (alert?.id && !merged.has(alert.id)) {
      merged.set(alert.id, alert);
    }
  }

  return Array.from(merged.values()).sort(
    (a, b) =>
      new Date(b.createdAt || 0).getTime() -
      new Date(a.createdAt || 0).getTime()
  );
}

async function readServerAlerts(clientId) {
  const response = await fetch(
    `/api/alerts-store?clientId=${encodeURIComponent(
      clientId
    )}`
  );

  const data = await response.json();

  if (!response.ok || !data?.ok) {
    throw new Error(
      data?.message ||
        "Impossible de récupérer les alertes serveur."
    );
  }

  return (data.alerts || [])
    .map(serverRowToAlert)
    .filter(Boolean);
}

async function saveAlertToServer(
  clientId,
  alert
) {
  const response = await fetch(
    "/api/alerts-store",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        clientId,
        alert,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok || !data?.ok) {
    throw new Error(
      data?.message ||
        "Impossible d'enregistrer l'alerte sur le serveur."
    );
  }

  return data;
}

async function updateAlertOnServer(
  clientId,
  alertId,
  enabled
) {
  const response = await fetch(
    "/api/alerts-store",
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        clientId,
        alertId,
        enabled,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok || !data?.ok) {
    throw new Error(
      data?.message ||
        "Impossible de modifier l'alerte sur le serveur."
    );
  }

  return data;
}

async function deleteAlertFromServer(
  clientId,
  alertId
) {
  const response = await fetch(
    "/api/alerts-store",
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        clientId,
        alertId,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok || !data?.ok) {
    throw new Error(
      data?.message ||
        "Impossible de supprimer l'alerte du serveur."
    );
  }

  return data;
}

function shortAddress(address) {
  if (!address) {
    return "Adresse inconnue";
  }

  if (address.length <= 22) {
    return address;
  }

  return `${address.slice(
    0,
    10
  )}...${address.slice(-8)}`;
}

function getMetric(metricId) {
  return (
    METRICS.find(
      (metric) => metric.id === metricId
    ) || METRICS[0]
  );
}

function getCondition(conditionId) {
  return (
    CONDITIONS.find(
      (condition) =>
        condition.id === conditionId
    ) || CONDITIONS[0]
  );
}

function formatTarget(value, metricId) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return "N/D";
  }

  if (metricId === "change24h") {
    return `${numberValue.toLocaleString(
      "fr-FR",
      {
        maximumFractionDigits: 2,
      }
    )} %`;
  }

  if (
    metricId === "liquidityUsd" ||
    metricId === "volume24hUsd"
  ) {
    return `${numberValue.toLocaleString(
      "fr-FR",
      {
        maximumFractionDigits: 2,
      }
    )} $`;
  }

  if (metricId === "priceUsd") {
    return `${numberValue.toLocaleString(
      "fr-FR",
      {
        maximumFractionDigits: 12,
      }
    )} $`;
  }

  return numberValue.toLocaleString("fr-FR");
}

export default function Alerts() {
  const router = useRouter();

  const [watchlist, setWatchlist] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const [clientId, setClientId] = useState("");

  const [selectedTokenId, setSelectedTokenId] =
    useState("");

  const [metric, setMetric] =
    useState("priceUsd");

  const [condition, setCondition] =
    useState("above");

  const [targetValue, setTargetValue] =
    useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [copiedId, setCopiedId] =
    useState("");

  const [checking, setChecking] =
    useState(false);

  const [checkedAt, setCheckedAt] =
    useState("");

  const [engineResults, setEngineResults] =
    useState({});

  const [engineError, setEngineError] =
    useState("");

  useEffect(() => {
    let cancelled = false;

    async function initializeAlerts() {
      const storedWatchlist = loadStorage(
        WATCHLIST_STORAGE_KEY
      );

      const storedAlerts = loadStorage(
        ALERTS_STORAGE_KEY
      );

      const currentClientId =
        createClientId();

      if (cancelled) {
        return;
      }

      setClientId(currentClientId);
      setWatchlist(storedWatchlist);

      if (storedWatchlist.length > 0) {
        setSelectedTokenId(
          storedWatchlist[0].id ||
            `${storedWatchlist[0].chainId}:${storedWatchlist[0].tokenAddress}`
        );
      }

      try {
        const serverAlerts =
          await readServerAlerts(
            currentClientId
          );

        if (cancelled) {
          return;
        }

        /*
         * Migration sûre :
         *
         * - Les alertes déjà présentes sur le serveur
         *   restent prioritaires.
         *
         * - Les anciennes alertes localStorage qui
         *   n'existent pas encore sur le serveur sont
         *   conservées puis envoyées vers Supabase.
         *
         * Ainsi une base serveur vide ne peut pas
         * supprimer les alertes locales existantes.
         */
        const mergedAlerts = mergeAlerts(
          storedAlerts,
          serverAlerts
        );

        setAlerts(mergedAlerts);

        const serverIds = new Set(
          serverAlerts.map(
            (alert) => alert.id
          )
        );

        const alertsToMigrate =
          storedAlerts.filter(
            (alert) =>
              alert?.id &&
              !serverIds.has(alert.id)
          );

        for (const alert of alertsToMigrate) {
          try {
            await saveAlertToServer(
              currentClientId,
              alert
            );
          } catch (migrationError) {
            console.error(
              "PFX alert migration error:",
              migrationError
            );
          }
        }
      } catch (initializationError) {
        /*
         * Si Supabase est momentanément indisponible,
         * on conserve immédiatement les données
         * locales au lieu de bloquer PFX Alerts.
         */
        console.error(
          "PFX Alerts initialization error:",
          initializationError
        );

        if (!cancelled) {
          setAlerts(storedAlerts);

          setEngineError(
            "Stockage serveur momentanément indisponible. Vos alertes locales restent accessibles."
          );
        }
      } finally {
        if (!cancelled) {
          setLoaded(true);
        }
      }
    }

    initializeAlerts();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loaded) {
      return;
    }

    saveStorage(
      ALERTS_STORAGE_KEY,
      alerts
    );
  }, [alerts, loaded]);

  const selectedToken = useMemo(() => {
    return (
      watchlist.find((item) => {
        const itemId =
          item.id ||
          `${item.chainId}:${item.tokenAddress}`;

        return itemId === selectedTokenId;
      }) || null
    );
  }, [watchlist, selectedTokenId]);

  const activeAlertsCount = useMemo(() => {
    return alerts.filter(
      (alert) => alert.enabled !== false
    ).length;
  }, [alerts]);

  function clearMessages() {
    setError("");
    setSuccess("");
  }

  async function createAlert(event) {
    event.preventDefault();
    clearMessages();

    if (!selectedToken) {
      setError(
        "Ajoutez d'abord un token à votre PFX Watchlist."
      );
      return;
    }

    const cleanAddress =
      selectedToken.tokenAddress?.trim();

    if (!cleanAddress) {
      setError(
        "L'adresse du token sélectionné est invalide."
      );
      return;
    }

    const numericTarget = Number(
      String(targetValue)
        .replace(",", ".")
        .trim()
    );

    if (!Number.isFinite(numericTarget)) {
      setError(
        "Indiquez une valeur cible valide."
      );
      return;
    }

    if (
      metric !== "change24h" &&
      numericTarget < 0
    ) {
      setError(
        "La valeur cible ne peut pas être négative pour cette donnée."
      );
      return;
    }

    const chainId =
      selectedToken.chainId || "solana";

    const duplicate = alerts.some(
      (alert) =>
        alert.chainId === chainId &&
        alert.tokenAddress === cleanAddress &&
        alert.metric === metric &&
        alert.condition === condition &&
        Number(alert.targetValue) ===
          numericTarget
    );

    if (duplicate) {
      setError(
        "Cette règle d'alerte existe déjà pour ce token."
      );
      return;
    }

    if (!clientId) {
      setError(
        "Le stockage PFX Alerts n'est pas encore initialisé."
      );
      return;
    }

    const alert = {
      id: `${chainId}:${cleanAddress}:${metric}:${condition}:${Date.now()}`,
      chainId,
      tokenAddress: cleanAddress,
      metric,
      condition,
      targetValue: numericTarget,
      enabled: true,
      triggered: false,
      createdAt: new Date().toISOString(),
    };

    /*
     * On enregistre d'abord côté serveur.
     * Si Supabase refuse l'opération, on n'affiche
     * pas une fausse alerte persistante à l'utilisateur.
     */
    try {
      await saveAlertToServer(
        clientId,
        alert
      );

      setAlerts((current) => [
        alert,
        ...current,
      ]);

      setTargetValue("");

      setSuccess(
        "Alerte enregistrée dans PFX Alerts et sauvegardée sur le serveur."
      );
    } catch (saveError) {
      setError(
        saveError?.message ||
          "Impossible d'enregistrer l'alerte sur le serveur."
      );
    }
  }

  async function toggleAlert(id) {
    clearMessages();

    const currentAlert =
      alerts.find(
        (alert) => alert.id === id
      );

    if (!currentAlert) {
      return;
    }

    if (!clientId) {
      setError(
        "Le stockage PFX Alerts n'est pas encore initialisé."
      );
      return;
    }

    const nextEnabled =
      currentAlert.enabled === false;

    try {
      await updateAlertOnServer(
        clientId,
        id,
        nextEnabled
      );

      setAlerts((current) =>
        current.map((alert) =>
          alert.id === id
            ? {
                ...alert,
                enabled: nextEnabled,
              }
            : alert
        )
      );

      setSuccess(
        nextEnabled
          ? "Alerte réactivée et synchronisée."
          : "Alerte mise en pause et synchronisée."
      );
    } catch (updateError) {
      setError(
        updateError?.message ||
          "Impossible de modifier l'alerte."
      );
    }
  }

  async function deleteAlert(id) {
    clearMessages();

    if (!clientId) {
      setError(
        "Le stockage PFX Alerts n'est pas encore initialisé."
      );
      return;
    }

    try {
      await deleteAlertFromServer(
        clientId,
        id
      );

      setAlerts((current) =>
        current.filter(
          (alert) => alert.id !== id
        )
      );

      setEngineResults((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });

      setSuccess(
        "Alerte supprimée du stockage PFX."
      );
    } catch (deleteError) {
      setError(
        deleteError?.message ||
          "Impossible de supprimer l'alerte."
      );
    }
  }

  async function copyAddress(
    id,
    address
  ) {
    if (!address) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        address
      );

      setCopiedId(id);

      window.setTimeout(() => {
        setCopiedId("");
      }, 1500);
    } catch {
      setError(
        "Impossible de copier l'adresse."
      );
    }
  }

  function analyzeToken(alert) {
    if (!alert?.tokenAddress) {
      return;
    }

    if (alert.chainId !== "solana") {
      setError(
        "L'Analyzer complet est actuellement disponible pour Solana."
      );
      return;
    }

    router.push({
      pathname: "/",
      query: {
        mint: alert.tokenAddress,
      },
    });
  }

  async function checkAlertsNow() {
    if (checking) {
      return;
    }

    clearMessages();
    setEngineError("");

    if (alerts.length === 0) {
      setEngineError(
        "Aucune alerte à vérifier."
      );
      return;
    }

    setChecking(true);

    try {
      const response = await fetch(
        "/api/alerts",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            alerts,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data?.ok) {
        throw new Error(
          data?.error ||
            "Le moteur PFX Alerts n'a pas pu effectuer la vérification."
        );
      }

      const nextResults = {};

      for (const result of data.results || []) {
        if (result?.id) {
          nextResults[result.id] =
            result;
        }
      }

      setEngineResults(nextResults);

      setCheckedAt(
        data.checkedAt ||
          new Date().toISOString()
      );

      const triggeredCount =
        data?.summary?.triggered || 0;

      if (triggeredCount > 0) {
        setSuccess(
          `${triggeredCount} alerte${
            triggeredCount > 1 ? "s" : ""
          } déclenchée${
            triggeredCount > 1 ? "s" : ""
          }.`
        );
      } else {
        setSuccess(
          "Vérification terminée. Aucune condition d'alerte n'est déclenchée."
        );
      }
    } catch (checkError) {
      setEngineError(
        checkError?.message ||
          "Impossible de contacter le PFX Alert Engine."
      );
    } finally {
      setChecking(false);
    }
  }

  return (
    <>
      <Head>
        <title>
          PFX Alerts — PROFITX AI
        </title>

        <meta
          name="description"
          content="PFX Alerts — gestion des règles de surveillance PROFITX."
        />
      </Head>

      <main className="page">
        <div className="shell">
          <header className="header">
            <div className="brand">
              <div className="brandMark">
                PFX
              </div>

              <div>
                <strong>
                  PROFITX AI
                </strong>

                <span>
                  ALERT INTELLIGENCE
                </span>
              </div>
            </div>

            <nav className="nav">
              <button
                type="button"
                onClick={() =>
                  router.push("/")
                }
              >
                ANALYZER
              </button>

              <button
                type="button"
                onClick={() =>
                  router.push("/radar")
                }
              >
                RADAR
              </button>

              <button
                type="button"
                onClick={() =>
                  router.push(
                    "/watchlist"
                  )
                }
              >
                WATCHLIST
              </button>

              <button
                type="button"
                className="activeNav"
              >
                ALERTS
              </button>
            </nav>
          </header>
            <section className="hero">
            <div className="heroText">
              <div className="eyebrow">
                PROFITX • TOKEN MONITORING
              </div>

              <h1>
                PFX <span>Alerts</span>
              </h1>

              <p>
                Créez vos règles de surveillance
                pour les tokens enregistrés dans
                votre PFX Watchlist et vérifiez
                leurs conditions avec le PFX
                Alert Engine.
              </p>

              <div className="heroActions">
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      "/watchlist"
                    )
                  }
                >
                  ← PFX WATCHLIST
                </button>

                <button
                  type="button"
                  onClick={() =>
                    router.push("/radar")
                  }
                >
                  PFX RADAR
                </button>
              </div>
            </div>

            <div className="stats">
              <div>
                <strong>
                  {alerts.length}
                </strong>
                <span>
                  ALERTES
                </span>
              </div>

              <div>
                <strong>
                  {activeAlertsCount}
                </strong>
                <span>
                  ACTIVES
                </span>
              </div>

              <div>
                <strong>
                  {watchlist.length}
                </strong>
                <span>
                  TOKENS SUIVIS
                </span>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="sectionTitle">
              <span>
                NOUVELLE RÈGLE
              </span>

              <h2>
                Créer une alerte
              </h2>

              <p>
                Sélectionnez un token de votre
                Watchlist, une donnée à surveiller
                et la valeur cible.
              </p>
            </div>

            {!loaded ? (
              <div className="empty">
                Chargement de PFX Alerts...
              </div>
            ) : watchlist.length === 0 ? (
              <div className="empty">
                <strong>
                  Votre Watchlist est vide.
                </strong>

                <p>
                  Ajoutez d&apos;abord un token
                  depuis PFX Radar ou PFX
                  Watchlist.
                </p>

                <button
                  type="button"
                  className="primary"
                  onClick={() =>
                    router.push("/radar")
                  }
                >
                  OUVRIR PFX RADAR
                </button>
              </div>
            ) : (
              <form
                className="alertForm"
                onSubmit={createAlert}
              >
                <div className="field tokenField">
                  <label htmlFor="alert-token">
                    TOKEN
                  </label>

                  <select
                    id="alert-token"
                    value={selectedTokenId}
                    onChange={(event) => {
                      setSelectedTokenId(
                        event.target.value
                      );
                      clearMessages();
                    }}
                  >
                    {watchlist.map(
                      (item, index) => {
                        const itemId =
                          item.id ||
                          `${item.chainId}:${item.tokenAddress}`;

                        return (
                          <option
                            key={
                              itemId ||
                              index
                            }
                            value={itemId}
                          >
                            {NETWORKS[
                              item.chainId
                            ] ||
                              item.chainId ||
                              "Réseau"}{" "}
                            —{" "}
                            {shortAddress(
                              item.tokenAddress
                            )}
                          </option>
                        );
                      }
                    )}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="alert-metric">
                    DONNÉE
                  </label>

                  <select
                    id="alert-metric"
                    value={metric}
                    onChange={(event) => {
                      setMetric(
                        event.target.value
                      );
                      clearMessages();
                    }}
                  >
                    {METRICS.map((item) => (
                      <option
                        key={item.id}
                        value={item.id}
                      >
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="alert-condition">
                    CONDITION
                  </label>

                  <select
                    id="alert-condition"
                    value={condition}
                    onChange={(event) => {
                      setCondition(
                        event.target.value
                      );
                      clearMessages();
                    }}
                  >
                    {CONDITIONS.map(
                      (item) => (
                        <option
                          key={item.id}
                          value={item.id}
                        >
                          {item.label}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="alert-target">
                    VALEUR CIBLE
                  </label>

                  <input
                    id="alert-target"
                    type="text"
                    inputMode="decimal"
                    value={targetValue}
                    onChange={(event) => {
                      setTargetValue(
                        event.target.value
                      );
                      clearMessages();
                    }}
                    placeholder={
                      metric ===
                      "change24h"
                        ? "Ex. 15 ou -10"
                        : "Ex. 50000"
                    }
                    autoComplete="off"
                  />
                </div>

                <button
                  type="submit"
                  className="createButton"
                >
                  + CRÉER L&apos;ALERTE
                </button>
              </form>
            )}

            {error && (
              <div className="message error">
                {error}
              </div>
            )}

            {success && (
              <div className="message success">
                {success}
              </div>
            )}

            {engineError && (
              <div className="message error">
                {engineError}
              </div>
            )}
          </section>

          <section className="panel">
            <div className="alertsHeader">
              <div className="sectionTitle">
                <span>
                  PFX ALERT ENGINE
                </span>

                <h2>
                  Mes alertes
                </h2>

                <p>
                  Vérifiez immédiatement les
                  conditions de vos alertes avec
                  les données de marché.
                </p>
              </div>

              <div className="engineControls">
                {checkedAt && (
                  <span className="lastCheck">
                    DERNIÈRE VÉRIFICATION{" "}
                    {new Date(
                      checkedAt
                    ).toLocaleTimeString(
                      "fr-FR",
                      {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      }
                    )}
                  </span>
                )}

                <button
                  type="button"
                  className="checkButton"
                  onClick={checkAlertsNow}
                  disabled={
                    checking ||
                    alerts.length === 0
                  }
                >
                  {checking
                    ? "VÉRIFICATION..."
                    : "VÉRIFIER MAINTENANT"}
                </button>

                <div className="counter">
                  <strong>
                    {alerts.length}
                  </strong>

                  <span>
                    ALERTE
                    {alerts.length > 1
                      ? "S"
                      : ""}
                  </span>
                </div>
              </div>
            </div>

            {!loaded ? (
              <div className="empty">
                Chargement...
              </div>
            ) : alerts.length === 0 ? (
              <div className="empty">
                <strong>
                  Aucune alerte enregistrée.
                </strong>

                <p>
                  Créez votre première règle de
                  surveillance ci-dessus.
                </p>
              </div>
            ) : (
              <div className="alertList">
                {alerts.map((alert) => {
                  const metricInfo =
                    getMetric(alert.metric);

                  const conditionInfo =
                    getCondition(
                      alert.condition
                    );

                  const enabled =
                    alert.enabled !== false;

                  const engineResult =
                    engineResults[
                      alert.id
                    ] || null;

                  const engineStatus =
                    !enabled
                      ? "paused"
                      : engineResult?.status ||
                        "not_checked";

                  const statusLabel =
                    engineStatus ===
                    "triggered"
                      ? "DÉCLENCHÉE"
                      : engineStatus ===
                        "watching"
                      ? "SURVEILLANCE"
                      : engineStatus ===
                        "no_market_data" ||
                        engineStatus ===
                          "metric_unavailable"
                      ? "INDISPONIBLE"
                      : engineStatus ===
                        "paused"
                      ? "PAUSE"
                      : "À VÉRIFIER";

                  return (
                    <article
                      className={`alertCard ${
                        enabled
                          ? ""
                          : "disabledCard"
                      } ${
                        engineStatus ===
                        "triggered"
                          ? "triggeredCard"
                          : ""
                      }`}
                      key={alert.id}
                    >
                      <div className="cardTop">
                        <div>
                          <span className="network">
                            {NETWORKS[
                              alert.chainId
                            ] ||
                              alert.chainId}
                          </span>

                          <h3>
                            {metricInfo.label}
                          </h3>
                        </div>

                        <div
                          className={`status ${engineStatus}`}
                        >
                          {statusLabel}
                        </div>
                      </div>

                      <button
                        type="button"
                        className="address"
                        onClick={() =>
                          copyAddress(
                            alert.id,
                            alert.tokenAddress
                          )
                        }
                      >
                        <span>
                          {shortAddress(
                            alert.tokenAddress
                          )}
                        </span>

                        <strong>
                          {copiedId ===
                          alert.id
                            ? "COPIÉ ✓"
                            : "COPIER"}
                        </strong>
                      </button>

                      <div className="rule">
                        <div>
                          <span>
                            CONDITION
                          </span>

                          <strong>
                            {
                              conditionInfo.label
                            }
                          </strong>
                        </div>

                        <div>
                          <span>
                            VALEUR CIBLE
                          </span>

                          <strong className="target">
                            {formatTarget(
                              alert.targetValue,
                              alert.metric
                            )}
                          </strong>
                        </div>
                      </div>

                      <div className="marketResult">
                        <span>
                          VALEUR ACTUELLE
                        </span>

                        <strong
                          className={
                            engineStatus ===
                            "triggered"
                              ? "triggeredValue"
                              : ""
                          }
                        >
                          {engineResult &&
                          engineResult.currentValue !==
                            null &&
                          engineResult.currentValue !==
                            undefined
                            ? formatTarget(
                                engineResult.currentValue,
                                alert.metric
                              )
                            : enabled
                            ? "—"
                            : "PAUSE"}
                        </strong>

                        {engineResult?.marketData
                          ?.symbol && (
                          <small>
                            {
                              engineResult
                                .marketData
                                .symbol
                            }
                            {engineResult
                              .marketData
                              .dexId
                              ? ` • ${engineResult.marketData.dexId}`
                              : ""}
                          </small>
                        )}
                      </div>

                      <div className="cardFooter">
                        <button
                          type="button"
                          className="secondary"
                          onClick={() =>
                            toggleAlert(
                              alert.id
                            )
                          }
                        >
                          {enabled
                            ? "METTRE EN PAUSE"
                            : "RÉACTIVER"}
                        </button>

                        <button
                          type="button"
                          className="secondary"
                          onClick={() =>
                            analyzeToken(
                              alert
                            )
                          }
                        >
                          ANALYSER →
                        </button>

                        <button
                          type="button"
                          className="delete"
                          onClick={() =>
                            deleteAlert(
                              alert.id
                            )
                          }
                          aria-label="Supprimer l'alerte"
                          title="Supprimer l'alerte"
                        >
                          ×
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="engineInfo">
            <div className="engineIcon">
              ◎
            </div>

            <div>
              <span>
                PFX ALERT ENGINE
              </span>

              <h2>
                Moteur de vérification connecté
              </h2>

              <p>
               PFX Alerts surveille automatiquement
vos règles en continu et compare leurs
valeurs cibles aux données de marché.
Lorsqu&apos;une condition est déclenchée,
une notification par e-mail est envoyée
automatiquement.
              </p>
            </div>
          </section>

          <footer className="footer">
            <div>
              <strong>
                PROFITX AI
              </strong>

              <span>
                PFX ALERTS V1
              </span>
            </div>

            <p>
              Les alertes et données PROFITX
              sont des outils informatifs. Elles
              ne constituent ni un conseil
              financier, ni une recommandation
              d&apos;achat ou de vente, ni une
              garantie de performance.
            </p>
          </footer>
        </div>
      </main>
      <style jsx>{`
        .page {
          min-height: 100vh;
          background:
            radial-gradient(
              circle at 85% 5%,
              rgba(33, 242, 139, 0.07),
              transparent 30%
            ),
            #050907;
          color: #f4f7f5;
        }

        .shell {
          width: min(
            1380px,
            calc(100% - 48px)
          );
          margin: 0 auto;
          padding-bottom: 60px;
        }

        .header {
          min-height: 92px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          border-bottom:
            1px solid #1b3027;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .brandMark {
          width: 48px;
          height: 48px;
          display: grid;
          place-items: center;
          border: 1px solid #21f28b;
          border-radius: 11px;
          color: #21f28b;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 1px;
        }

        .brand strong,
        .brand span {
          display: block;
        }

        .brand strong {
          font-size: 15px;
          letter-spacing: 2px;
        }

        .brand span {
          margin-top: 5px;
          color: #74887f;
          font-size: 9px;
          letter-spacing: 2px;
        }

        .nav {
          display: flex;
          gap: 8px;
        }

        .nav button,
        .heroActions button {
          min-height: 42px;
          padding: 0 17px;
          border: 1px solid #294138;
          border-radius: 10px;
          background: transparent;
          color: #9bada6;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 1px;
          cursor: pointer;
        }

        .nav button:hover,
        .heroActions button:hover,
        .nav .activeNav {
          border-color: #21f28b;
          color: #21f28b;
        }

        .hero {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 50px;
          padding: 75px 0 55px;
        }

        .heroText {
          max-width: 780px;
        }

        .eyebrow,
        .sectionTitle > span,
        .engineInfo > div > span {
          color: #21f28b;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 2px;
        }

        .hero h1 {
          margin: 15px 0 18px;
          font-size:
            clamp(54px, 7vw, 94px);
          line-height: 0.95;
          letter-spacing: -5px;
        }

        .hero h1 span {
          color: #21f28b;
        }

        .hero p {
          max-width: 720px;
          margin: 0;
          color: #9bada6;
          font-size: 16px;
          line-height: 1.8;
        }

        .heroActions {
          display: flex;
          gap: 9px;
          margin-top: 28px;
        }

        .stats {
          min-width: 360px;
          display: grid;
          grid-template-columns:
            repeat(3, 1fr);
          border: 1px solid #1c3329;
          border-radius: 16px;
          overflow: hidden;
          background: #08100c;
        }

        .stats div {
          padding: 24px 16px;
          text-align: center;
        }

        .stats div + div {
          border-left:
            1px solid #1c3329;
        }

        .stats strong,
        .stats span {
          display: block;
        }

        .stats strong {
          color: #21f28b;
          font-size: 30px;
        }

        .stats span {
          margin-top: 7px;
          color: #71847c;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 1px;
        }

        .panel {
          margin-top: 22px;
          padding: 30px;
          border: 1px solid #1b3027;
          border-radius: 17px;
          background:
            rgba(7, 13, 10, 0.94);
        }

        .sectionTitle h2 {
          margin: 8px 0 5px;
          font-size: 27px;
        }

        .sectionTitle p {
          margin: 0;
          color: #758980;
          font-size: 12px;
          line-height: 1.6;
        }

        .alertForm {
          display: grid;
          grid-template-columns:
            2fr 1fr 1fr 1fr auto;
          gap: 10px;
          margin-top: 25px;
          align-items: end;
        }

        .field label {
          display: block;
          margin-bottom: 8px;
          color: #657970;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 1.3px;
        }

        .field select,
        .field input {
          width: 100%;
          height: 50px;
          box-sizing: border-box;
          padding: 0 13px;
          border: 1px solid #20362c;
          border-radius: 10px;
          outline: none;
          background: #050a08;
          color: #f4f7f5;
          font-size: 12px;
        }

        .field select:focus,
        .field input:focus {
          border-color: #21f28b;
        }

        .field select option {
          background: #08100c;
        }

        .field input::placeholder {
          color: #4f6259;
        }

        .createButton,
        .primary {
          min-height: 50px;
          padding: 0 20px;
          border: 0;
          border-radius: 10px;
          background: #21f28b;
          color: #03130b;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 1px;
          cursor: pointer;
        }

        .createButton:hover,
        .primary:hover {
          box-shadow:
            0 0 25px
            rgba(33, 242, 139, 0.16);
        }

        .message {
          margin-top: 16px;
          padding: 13px 15px;
          border-radius: 9px;
          font-size: 11px;
          line-height: 1.5;
        }

        .message.error {
          border:
            1px solid
            rgba(255, 94, 105, 0.35);
          background:
            rgba(255, 94, 105, 0.06);
          color: #ff7c85;
        }

        .message.success {
          border:
            1px solid
            rgba(33, 242, 139, 0.3);
          background:
            rgba(33, 242, 139, 0.06);
          color: #21f28b;
        }

        .empty {
          margin-top: 25px;
          padding: 45px 25px;
          border: 1px dashed #22372e;
          border-radius: 13px;
          color: #788b83;
          text-align: center;
        }

        .empty strong {
          display: block;
          margin-bottom: 8px;
          color: #f4f7f5;
        }

        .empty p {
          margin: 0 0 20px;
        }

        .alertsHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
        }

        .engineControls {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          flex-wrap: wrap;
        }

        .lastCheck {
          color: #6e8178;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 1px;
        }

        .checkButton {
          min-height: 44px;
          padding: 0 18px;
          border: 1px solid #21f28b;
          border-radius: 9px;
          background:
            rgba(33, 242, 139, 0.08);
          color: #21f28b;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 1px;
          cursor: pointer;
        }

        .checkButton:hover:not(:disabled) {
          background:
            rgba(33, 242, 139, 0.14);
          box-shadow:
            0 0 22px
            rgba(33, 242, 139, 0.1);
        }

        .checkButton:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .counter {
          min-width: 90px;
          padding: 13px;
          border: 1px solid #1d4b37;
          border-radius: 11px;
          text-align: center;
        }

        .counter strong,
        .counter span {
          display: block;
        }

        .counter strong {
          color: #21f28b;
          font-size: 24px;
        }

        .counter span {
          margin-top: 4px;
          color: #74887f;
          font-size: 7px;
          font-weight: 900;
          letter-spacing: 1px;
        }

        .alertList {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 13px;
          margin-top: 25px;
        }

        .alertCard {
          padding: 20px;
          border: 1px solid #1c3329;
          border-radius: 14px;
          background:
            linear-gradient(
              145deg,
              #09110d,
              #050907
            );
          transition:
            opacity 0.2s ease,
            border-color 0.2s ease,
            box-shadow 0.2s ease;
        }

        .disabledCard {
          opacity: 0.55;
        }

        .triggeredCard {
          border-color:
            rgba(33, 242, 139, 0.75);
          box-shadow:
            0 0 26px
            rgba(33, 242, 139, 0.08);
        }

        .cardTop {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 15px;
        }

        .network {
          color: #21f28b;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        .cardTop h3 {
          margin: 7px 0 0;
          font-size: 21px;
        }

        .status {
          padding: 7px 9px;
          border-radius: 7px;
          font-size: 7px;
          font-weight: 900;
          letter-spacing: 1px;
          white-space: nowrap;
        }

        .status.triggered {
          border: 1px solid #21f28b;
          background:
            rgba(33, 242, 139, 0.12);
          color: #21f28b;
        }

        .status.watching {
          border: 1px solid #216744;
          background:
            rgba(33, 242, 139, 0.06);
          color: #21f28b;
        }

        .status.not_checked {
          border: 1px solid #385047;
          color: #91a49c;
        }

        .status.paused {
          border: 1px solid #46534e;
          color: #84958e;
        }

        .status.no_market_data,
        .status.metric_unavailable {
          border:
            1px solid
            rgba(255, 181, 71, 0.45);
          background:
            rgba(255, 181, 71, 0.05);
          color: #ffb547;
        }

        .address {
          width: 100%;
          min-height: 40px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-top: 18px;
          padding: 0 12px;
          border: 1px solid #172a21;
          border-radius: 9px;
          background: #050907;
          color: #82958d;
          cursor: pointer;
        }

        .address span {
          overflow: hidden;
          font-family: monospace;
          font-size: 10px;
          text-overflow: ellipsis;
        }

        .address strong {
          color: #21f28b;
          font-size: 7px;
          letter-spacing: 1px;
        }

        .rule {
          display: grid;
          grid-template-columns:
            1fr 1fr;
          gap: 8px;
          margin-top: 10px;
        }

        .rule > div {
          padding: 13px;
          border: 1px solid #172a21;
          border-radius: 9px;
        }

        .rule span {
          display: block;
          margin-bottom: 8px;
          color: #5e7168;
          font-size: 7px;
          font-weight: 900;
          letter-spacing: 1px;
        }

        .rule strong {
          font-size: 11px;
        }

        .rule .target {
          color: #21f28b;
        }

        .marketResult {
          margin-top: 10px;
          padding: 14px;
          border: 1px solid #1b3328;
          border-radius: 9px;
          background:
            rgba(33, 242, 139, 0.025);
        }

        .marketResult > span {
          display: block;
          margin-bottom: 7px;
          color: #60736a;
          font-size: 7px;
          font-weight: 900;
          letter-spacing: 1px;
        }

        .marketResult > strong {
          display: block;
          color: #d9e1dd;
          font-size: 16px;
        }

        .marketResult .triggeredValue {
          color: #21f28b;
        }

        .marketResult small {
          display: block;
          margin-top: 6px;
          color: #687b72;
          font-size: 8px;
          text-transform: uppercase;
        }

        .cardFooter {
          display: flex;
          gap: 8px;
          margin-top: 15px;
        }

        .secondary,
        .delete {
          min-height: 39px;
          border: 1px solid #294138;
          border-radius: 8px;
          background: transparent;
          color: #9aada5;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.8px;
          cursor: pointer;
        }

        .secondary {
          flex: 1;
          padding: 0 12px;
        }

        .secondary:hover {
          border-color: #21f28b;
          color: #21f28b;
        }

        .delete {
          width: 39px;
          flex: 0 0 39px;
          color: #ff737d;
          font-size: 20px;
        }

        .delete:hover {
          border-color: #ff5e69;
          background:
            rgba(255, 94, 105, 0.05);
        }
                .engineInfo {
          display: flex;
          align-items: center;
          gap: 20px;
          margin-top: 22px;
          padding: 26px 30px;
          border: 1px solid #1b3027;
          border-radius: 16px;
          background:
            rgba(7, 13, 10, 0.8);
        }

        .engineIcon {
          width: 58px;
          height: 58px;
          display: grid;
          place-items: center;
          flex: 0 0 58px;
          border: 1px solid #21f28b;
          border-radius: 50%;
          color: #21f28b;
          font-size: 25px;
        }

        .engineInfo h2 {
          margin: 7px 0;
          font-size: 17px;
        }

        .engineInfo p {
          margin: 0;
          color: #71847c;
          font-size: 11px;
          line-height: 1.7;
        }

        .footer {
          display: flex;
          justify-content: space-between;
          gap: 40px;
          margin-top: 40px;
          padding-top: 24px;
          border-top: 1px solid #172820;
        }

        .footer div {
          display: flex;
          gap: 12px;
          font-size: 9px;
          letter-spacing: 1px;
        }

        .footer div span {
          color: #21f28b;
        }

        .footer p {
          max-width: 700px;
          margin: 0;
          color: #566961;
          font-size: 9px;
          line-height: 1.6;
          text-align: right;
        }

        @media (max-width: 1050px) {
          .hero {
            align-items: stretch;
            flex-direction: column;
          }

          .stats {
            min-width: 0;
          }

          .alertForm {
            grid-template-columns:
              1fr 1fr;
          }

          .tokenField {
            grid-column: 1 / -1;
          }

          .createButton {
            min-height: 50px;
          }

          .alertsHeader {
            align-items: flex-start;
            flex-direction: column;
          }

          .engineControls {
            width: 100%;
            justify-content: flex-start;
          }
        }

        @media (max-width: 760px) {
          .shell {
            width:
              min(
                100% - 28px,
                1380px
              );
          }

          .header {
            align-items: stretch;
            flex-direction: column;
            padding: 18px 0;
          }

          .nav {
            display: grid;
            grid-template-columns:
              1fr 1fr;
          }

          .hero {
            padding: 50px 0 35px;
          }

          .hero h1 {
            font-size: 56px;
            letter-spacing: -3px;
          }

          .heroActions {
            flex-direction: column;
          }

          .stats {
            grid-template-columns:
              repeat(3, 1fr);
          }

          .panel {
            padding: 20px;
          }

          .alertForm {
            grid-template-columns: 1fr;
          }

          .tokenField {
            grid-column: auto;
          }

          .alertList {
            grid-template-columns: 1fr;
          }

          .engineControls {
            align-items: stretch;
            flex-direction: column;
          }

          .checkButton {
            width: 100%;
          }

          .counter {
            box-sizing: border-box;
            width: 100%;
          }

          .engineInfo {
            align-items: flex-start;
          }

          .footer {
            flex-direction: column;
          }

          .footer p {
            text-align: left;
          }
        }

        @media (max-width: 480px) {
          .stats {
            grid-template-columns: 1fr;
          }

          .stats div + div {
            border-left: 0;
            border-top:
              1px solid #1c3329;
          }

          .rule {
            grid-template-columns: 1fr;
          }

          .cardFooter {
            flex-direction: column;
          }

          .delete {
            width: 100%;
            flex-basis: 39px;
          }
        }
      `}</style>
    </>
  );
}
