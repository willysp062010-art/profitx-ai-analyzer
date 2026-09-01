const DEFAULT_RPC =
  "https://api.mainnet-beta.solana.com";

const TOKEN_PROGRAM_ID =
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

const TOKEN_2022_PROGRAM_ID =
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

const REQUEST_TIMEOUT_MS = 10000;

/* =========================================================
   HELPERS
========================================================= */

function isValidSolanaAddress(value) {
  return (
    typeof value === "string" &&
    /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)
  );
}

function json(res, status, body) {
  res.setHeader(
    "Cache-Control",
    "no-store"
  );

  res.setHeader(
    "Content-Type",
    "application/json; charset=utf-8"
  );

  return res.status(status).json(body);
}

async function rpcCall(
  rpcUrl,
  method,
  params
) {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS
    );

  try {
    const response =
      await fetch(
        rpcUrl,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Accept:
              "application/json"
          },

          body: JSON.stringify({
            jsonrpc: "2.0",
            id: "profitx-security",
            method,
            params
          }),

          signal:
            controller.signal
        }
      );

    if (!response.ok) {
      throw new Error(
        `RPC HTTP ${response.status}`
      );
    }

    const data =
      await response.json();

    if (data?.error) {
      throw new Error(
        data.error.message ||
        "Solana RPC error"
      );
    }

    return data?.result ?? null;
  } finally {
    clearTimeout(timeout);
  }
}

/* =========================================================
   BASE64 DECODER
========================================================= */

function base64ToBytes(base64) {
  try {
    return Uint8Array.from(
      Buffer.from(
        base64,
        "base64"
      )
    );
  } catch {
    return null;
  }
}

/* =========================================================
   BASE58 ENCODER
========================================================= */

const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function bytesToBase58(bytes) {
  if (!bytes || !bytes.length) {
    return null;
  }

  let digits = [0];

  for (const byte of bytes) {
    let carry = byte;

    for (
      let i = 0;
      i < digits.length;
      i++
    ) {
      const value =
        digits[i] * 256 +
        carry;

      digits[i] =
        value % 58;

      carry =
        Math.floor(value / 58);
    }

    while (carry > 0) {
      digits.push(
        carry % 58
      );

      carry =
        Math.floor(carry / 58);
    }
  }

  let result = "";

  for (
    let i = 0;
    i < bytes.length &&
    bytes[i] === 0;
    i++
  ) {
    result += "1";
  }

  for (
    let i = digits.length - 1;
    i >= 0;
    i--
  ) {
    result +=
      BASE58_ALPHABET[
        digits[i]
      ];
  }

  return result;
}

/* =========================================================
   U64 LE
========================================================= */

function readU64LE(
  bytes,
  offset
) {
  if (
    !bytes ||
    offset + 8 > bytes.length
  ) {
    return null;
  }

  let value = 0n;

  for (
    let i = 0;
    i < 8;
    i++
  ) {
    value +=
      BigInt(
        bytes[
          offset + i
        ]
      ) <<
      (8n * BigInt(i));
  }

  return value;
}

/* =========================================================
   CLASSIC SPL TOKEN MINT
========================================================= */

function decodeClassicMint(
  bytes
) {
  /*
   * SPL Token Mint layout:
   *
   * 0      : mint authority option u32
   * 4-36   : mint authority pubkey
   * 36-44  : supply u64
   * 44     : decimals u8
   * 45     : initialized bool
   * 46-50  : freeze authority option u32
   * 50-82  : freeze authority pubkey
   */

  if (
    !bytes ||
    bytes.length < 82
  ) {
    return null;
  }

  const mintAuthorityOption =
    bytes[0] |
    (bytes[1] << 8) |
    (bytes[2] << 16) |
    (bytes[3] << 24);

  const mintAuthority =
    mintAuthorityOption !== 0
      ? bytesToBase58(
          bytes.slice(
            4,
            36
          )
        )
      : null;

  const supplyRaw =
    readU64LE(
      bytes,
      36
    );

  const decimals =
    bytes[44];

  const isInitialized =
    bytes[45] !== 0;

  const freezeAuthorityOption =
    bytes[46] |
    (bytes[47] << 8) |
    (bytes[48] << 16) |
    (bytes[49] << 24);

  const freezeAuthority =
    freezeAuthorityOption !== 0
      ? bytesToBase58(
          bytes.slice(
            50,
            82
          )
        )
      : null;

  return {
    mintAuthority,
    freezeAuthority,
    supplyRaw:
      supplyRaw !== null
        ? supplyRaw.toString()
        : null,
    decimals,
    isInitialized
  };
}

/* =========================================================
   TOKEN-2022 BASE MINT
========================================================= */

function decodeToken2022Mint(
  bytes
) {
  /*
   * Token-2022 begins with the same
   * base Mint structure.
   *
   * Extensions may follow after
   * the first 82 bytes.
   */

  if (
    !bytes ||
    bytes.length < 82
  ) {
    return null;
  }

  return decodeClassicMint(
    bytes
  );
}

/* =========================================================
   ACCOUNT INFO
========================================================= */

async function getMintAccount(
  rpcUrl,
  mint
) {
  const result =
    await rpcCall(
      rpcUrl,
      "getAccountInfo",
      [
        mint,
        {
          encoding: "base64",
          commitment: "confirmed"
        }
      ]
    );

  return (
    result?.value ??
    null
  );
}

/* =========================================================
   TOKEN SUPPLY
========================================================= */

async function getTokenSupply(
  rpcUrl,
  mint
) {
  const result =
    await rpcCall(
      rpcUrl,
      "getTokenSupply",
      [
        mint,
        {
          commitment:
            "confirmed"
        }
      ]
    );

  return (
    result?.value ??
    null
  );
}

/* =========================================================
   SECURITY ANALYSIS
========================================================= */

function analyseSecurity(
  mint,
  account,
  decodedMint,
  supply
) {
  const owner =
    account?.owner ??
    null;

  let tokenProgram =
    "UNKNOWN";

  if (
    owner ===
    TOKEN_PROGRAM_ID
  ) {
    tokenProgram =
      "SPL_TOKEN";
  } else if (
    owner ===
    TOKEN_2022_PROGRAM_ID
  ) {
    tokenProgram =
      "TOKEN_2022";
  }

  const mintAuthority =
    decodedMint?.mintAuthority ??
    null;

  const freezeAuthority =
    decodedMint?.freezeAuthority ??
    null;

  const mintAuthorityRevoked =
    mintAuthority === null
      ? true
      : false;

  const freezeAuthorityRevoked =
    freezeAuthority === null
      ? true
      : false;

  const supplyRaw =
    decodedMint?.supplyRaw ??
    supply?.amount ??
    null;

  const decimals =
    decodedMint?.decimals ??
    supply?.decimals ??
    null;

  let supplyUi = null;

  if (
    supply?.uiAmountString !==
    undefined &&
    supply?.uiAmountString !==
    null
  ) {
    supplyUi =
      supply.uiAmountString;
  } else if (
    supplyRaw !== null &&
    decimals !== null
  ) {
    try {
      const raw =
        BigInt(
          supplyRaw
        );

      const divisor =
        10n **
        BigInt(decimals);

      const whole =
        raw / divisor;

      const fraction =
        raw % divisor;

      supplyUi =
        fraction === 0n
          ? whole.toString()
          : `${whole}.${fraction
              .toString()
              .padStart(
                decimals,
                "0"
              )
              .replace(/0+$/, "")}`;
    } catch {
      supplyUi = null;
    }
  }

  const checks = {
    mintAuthority: {
      status:
        mintAuthorityRevoked
          ? "PASS"
          : "WARNING",

      value:
        mintAuthority,

      message:
        mintAuthorityRevoked
          ? "Mint authority révoquée : aucune nouvelle émission via cette autorité."
          : "Une mint authority est encore active."
    },

    freezeAuthority: {
      status:
        freezeAuthorityRevoked
          ? "PASS"
          : "WARNING",

      value:
        freezeAuthority,

      message:
        freezeAuthorityRevoked
          ? "Freeze authority révoquée."
          : "Une freeze authority est encore active."
    },

    tokenProgram: {
      status:
        tokenProgram ===
        "UNKNOWN"
          ? "UNKNOWN"
          : "INFO",

      value:
        tokenProgram,

      message:
        tokenProgram ===
        "SPL_TOKEN"
          ? "Token Program SPL classique détecté."
          : tokenProgram ===
            "TOKEN_2022"
            ? "Token-2022 détecté : des extensions doivent être examinées."
            : "Programme du mint non identifié."
    },

    initialized: {
      status:
        decodedMint?.isInitialized ===
        true
          ? "PASS"
          : "WARNING",

      value:
        decodedMint?.isInitialized ??
        null,

      message:
        decodedMint?.isInitialized ===
        true
          ? "Mint correctement initialisé."
          : "Impossible de confirmer l'initialisation du mint."
    }
  };

  /*
   * Important :
   * on ne considère pas Token-2022 comme
   * dangereux automatiquement.
   *
   * Il peut contenir des extensions légitimes.
   * On analysera les extensions dans une
   * prochaine version.
   */

  const warnings =
    [];

  if (
    mintAuthority !== null
  ) {
    warnings.push(
      "MINT_AUTHORITY_ACTIVE"
    );
  }

  if (
    freezeAuthority !== null
  ) {
    warnings.push(
      "FREEZE_AUTHORITY_ACTIVE"
    );
  }

  if (
    tokenProgram ===
    "TOKEN_2022"
  ) {
    warnings.push(
      "TOKEN_2022_REQUIRES_EXTENSION_ANALYSIS"
    );
  }

  if (
    tokenProgram ===
    "UNKNOWN"
  ) {
    warnings.push(
      "UNKNOWN_TOKEN_PROGRAM"
    );
  }

  if (
    decodedMint?.isInitialized !==
    true
  ) {
    warnings.push(
      "MINT_NOT_CONFIRMED_INITIALIZED"
    );
  }

  let securityScore = 100;

  if (
    mintAuthority !== null
  ) {
    securityScore -= 35;
  }

  if (
    freezeAuthority !== null
  ) {
    securityScore -= 25;
  }

  if (
    tokenProgram ===
    "TOKEN_2022"
  ) {
    /*
     * Pas de pénalité automatique.
     * On marque seulement "à examiner".
     */
  }

  if (
    tokenProgram ===
    "UNKNOWN"
  ) {
    securityScore -= 30;
  }

  if (
    decodedMint?.isInitialized !==
    true
  ) {
    securityScore -= 30;
  }

  securityScore =
    Math.max(
      0,
      Math.min(
        100,
        securityScore
      )
    );

  let riskLevel =
    "LOW";

  if (
    securityScore < 40
  ) {
    riskLevel =
      "VERY_HIGH";
  } else if (
    securityScore < 60
  ) {
    riskLevel =
      "HIGH";
  } else if (
    securityScore < 75
  ) {
    riskLevel =
      "MODERATE";
  }

  return {
    mint,

    tokenProgram,

    tokenProgramId:
      owner,

    mintAuthority,

    freezeAuthority,

    mintAuthorityRevoked,

    freezeAuthorityRevoked,

    supplyRaw,

    supply:
      supplyUi,

    decimals,

    isInitialized:
      decodedMint?.isInitialized ??
      null,

    securityScore,

    riskLevel,

    checks,

    warnings,

    dataQuality: {
      accountInfo:
        account !== null,

      mintDecoded:
        decodedMint !== null,

      supply:
        supply !== null,

      complete:
        account !== null &&
        decodedMint !== null
    }
  };
}

/* =========================================================
   API HANDLER
========================================================= */

export default async function handler(
  req,
  res
) {
  if (
    req.method !== "GET" &&
    req.method !== "POST"
  ) {
    res.setHeader(
      "Allow",
      "GET, POST"
    );

    return json(
      res,
      405,
      {
        ok: false,
        error:
          "Méthode non autorisée."
      }
    );
  }

  let mint = "";

  if (
    req.method === "GET"
  ) {
    mint =
      typeof req.query?.mint ===
      "string"
        ? req.query.mint.trim()
        : "";
  }

  if (
    req.method === "POST"
  ) {
    mint =
      typeof req.body?.mint ===
      "string"
        ? req.body.mint.trim()
        : "";
  }

  if (!mint) {
    return json(
      res,
      400,
      {
        ok: false,
        error:
          "Adresse mint manquante."
      }
    );
  }

  if (
    !isValidSolanaAddress(
      mint
    )
  ) {
    return json(
      res,
      400,
      {
        ok: false,
        error:
          "Adresse mint Solana invalide."
      }
    );
  }

  const rpcUrl =
    process.env.SOLANA_RPC_URL ||
    DEFAULT_RPC;

  try {
    const account =
      await getMintAccount(
        rpcUrl,
        mint
      );

    if (!account) {
      return json(
        res,
        404,
        {
          ok: false,
          mint,
          error:
            "Mint introuvable sur Solana."
        }
      );
    }

    const supply =
      await getTokenSupply(
        rpcUrl,
        mint
      );

    const owner =
      account.owner;

    let decodedMint =
      null;

    if (
      owner ===
      TOKEN_PROGRAM_ID
    ) {
      const bytes =
        base64ToBytes(
          account?.data?.[0]
        );

      decodedMint =
        decodeClassicMint(
          bytes
        );
    } else if (
      owner ===
      TOKEN_2022_PROGRAM_ID
    ) {
      const bytes =
        base64ToBytes(
          account?.data?.[0]
        );

      decodedMint =
        decodeToken2022Mint(
          bytes
        );
    }

    const security =
      analyseSecurity(
        mint,
        account,
        decodedMint,
        supply
      );

    return json(
      res,
      200,
      {
        ok: true,

        module:
          "PROFITX_SECURITY",

        version:
          "1.0.0",

        timestamp:
          new Date().toISOString(),

        security
      }
    );
  } catch (error) {
    return json(
      res,
      500,
      {
        ok: false,

        module:
          "PROFITX_SECURITY",

        error:
          error?.message ||
          "Erreur lors de l'analyse on-chain."
      }
    );
  }
}
