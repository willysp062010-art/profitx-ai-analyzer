const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const TABLE_NAME = "pfx_alerts";

function send(res, status, data) {
  return res.status(status).json(data);
}

function cleanText(value, maxLength = 500) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function normalizeAlert(alert = {}) {
  const targetValue = Number(alert.targetValue);

  return {
    alert_id: cleanText(alert.id || alert.alertId, 300),
    chain_id: cleanText(alert.chainId || "solana", 50).toLowerCase(),
    token_address: cleanText(alert.tokenAddress, 300),
    metric: cleanText(alert.metric, 100),
    condition: cleanText(alert.condition, 50).toLowerCase(),
    target_value: targetValue,
    enabled: alert.enabled !== false,
  };
}

function validateAlert(alert) {
  if (!alert.alert_id) {
    return "alert_id manquant.";
  }

  if (!alert.token_address) {
    return "token_address manquant.";
  }

  if (!alert.metric) {
    return "metric manquante.";
  }

  if (!["above", "below"].includes(alert.condition)) {
    return "condition invalide.";
  }

  if (!Number.isFinite(alert.target_value)) {
    return "target_value invalide.";
  }

  if (alert.chain_id !== "solana") {
    return "Seule la chaîne Solana est actuellement prise en charge.";
  }

  return null;
}

async function supabaseRequest(path, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error(
      "Variables Supabase absentes dans l'environnement Vercel."
    );
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/${TABLE_NAME}${path}`,
    {
      ...options,
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    }
  );

  const text = await response.text();

  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const message =
      data?.message ||
      data?.error ||
      data?.hint ||
      `Erreur Supabase HTTP ${response.status}`;

    throw new Error(message);
  }

  return data;
}

export default async function handler(req, res) {
  try {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return send(res, 500, {
        ok: false,
        error: "SUPABASE_NOT_CONFIGURED",
        message:
          "La connexion Supabase n'est pas disponible dans les variables d'environnement.",
      });
    }

    /*
     * GET
     * Récupère les alertes persistantes d'un client.
     *
     * Exemple :
     * /api/alerts-store?clientId=xxxxxxxx
     */
    if (req.method === "GET") {
      const clientId = cleanText(req.query.clientId, 300);

      if (!clientId) {
        return send(res, 400, {
          ok: false,
          error: "CLIENT_ID_REQUIRED",
          message: "clientId est obligatoire.",
        });
      }

      const rows = await supabaseRequest(
        `?client_id=eq.${encodeURIComponent(
          clientId
        )}&select=*&order=created_at.desc`,
        {
          method: "GET",
        }
      );

      return send(res, 200, {
        ok: true,
        persistence: true,
        count: Array.isArray(rows) ? rows.length : 0,
        alerts: Array.isArray(rows) ? rows : [],
      });
    }

    /*
     * POST
     * Crée ou met à jour une alerte persistante.
     *
     * Body :
     * {
     *   clientId: "...",
     *   alert: {...}
     * }
     */
    if (req.method === "POST") {
      const clientId = cleanText(req.body?.clientId, 300);
      const alert = normalizeAlert(req.body?.alert);

      if (!clientId) {
        return send(res, 400, {
          ok: false,
          error: "CLIENT_ID_REQUIRED",
          message: "clientId est obligatoire.",
        });
      }

      const validationError = validateAlert(alert);

      if (validationError) {
        return send(res, 400, {
          ok: false,
          error: "INVALID_ALERT",
          message: validationError,
        });
      }

      const payload = {
        client_id: clientId,
        alert_id: alert.alert_id,
        chain_id: alert.chain_id,
        token_address: alert.token_address,
        metric: alert.metric,
        condition: alert.condition,
        target_value: alert.target_value,
        enabled: alert.enabled,
        updated_at: new Date().toISOString(),
      };

      const rows = await supabaseRequest(
        "?on_conflict=client_id,alert_id",
        {
          method: "POST",
          headers: {
            Prefer: "resolution=merge-duplicates,return=representation",
          },
          body: JSON.stringify(payload),
        }
      );

      return send(res, 200, {
        ok: true,
        persistence: true,
        alert: Array.isArray(rows) ? rows[0] || null : rows,
      });
    }

    /*
     * PATCH
     * Active ou met en pause une alerte existante.
     *
     * Body :
     * {
     *   clientId: "...",
     *   alertId: "...",
     *   enabled: true/false
     * }
     */
    if (req.method === "PATCH") {
      const clientId = cleanText(req.body?.clientId, 300);
      const alertId = cleanText(req.body?.alertId, 300);

      if (!clientId || !alertId) {
        return send(res, 400, {
          ok: false,
          error: "IDENTIFIERS_REQUIRED",
          message: "clientId et alertId sont obligatoires.",
        });
      }

      if (typeof req.body?.enabled !== "boolean") {
        return send(res, 400, {
          ok: false,
          error: "ENABLED_REQUIRED",
          message: "enabled doit être true ou false.",
        });
      }

      const rows = await supabaseRequest(
        `?client_id=eq.${encodeURIComponent(
          clientId
        )}&alert_id=eq.${encodeURIComponent(alertId)}`,
        {
          method: "PATCH",
          headers: {
            Prefer: "return=representation",
          },
          body: JSON.stringify({
            enabled: req.body.enabled,
            updated_at: new Date().toISOString(),
          }),
        }
      );

      return send(res, 200, {
        ok: true,
        persistence: true,
        alert: Array.isArray(rows) ? rows[0] || null : rows,
      });
    }

    /*
     * DELETE
     * Supprime définitivement une alerte.
     *
     * Body :
     * {
     *   clientId: "...",
     *   alertId: "..."
     * }
     */
    if (req.method === "DELETE") {
      const clientId = cleanText(req.body?.clientId, 300);
      const alertId = cleanText(req.body?.alertId, 300);

      if (!clientId || !alertId) {
        return send(res, 400, {
          ok: false,
          error: "IDENTIFIERS_REQUIRED",
          message: "clientId et alertId sont obligatoires.",
        });
      }

      await supabaseRequest(
        `?client_id=eq.${encodeURIComponent(
          clientId
        )}&alert_id=eq.${encodeURIComponent(alertId)}`,
        {
          method: "DELETE",
          headers: {
            Prefer: "return=minimal",
          },
        }
      );

      return send(res, 200, {
        ok: true,
        persistence: true,
        deleted: true,
        alertId,
      });
    }

    res.setHeader("Allow", ["GET", "POST", "PATCH", "DELETE"]);

    return send(res, 405, {
      ok: false,
      error: "METHOD_NOT_ALLOWED",
      message: `Méthode ${req.method} non autorisée.`,
    });
  } catch (error) {
    console.error("PFX Alerts Store error:", error);

    return send(res, 500, {
      ok: false,
      error: "PERSISTENCE_ERROR",
      message: error?.message || "Erreur inconnue du stockage PFX.",
    });
  }
}
