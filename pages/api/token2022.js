const DEFAULT_RPC =
  "https://api.mainnet-beta.solana.com";

const TOKEN_2022_PROGRAM_ID =
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

const REQUEST_TIMEOUT_MS = 10000;

/* =========================================================
   EXTENSION TYPES — TOKEN-2022
   Based on the official Token-2022 ExtensionType enum.
========================================================= */

const EXTENSION_TYPES = {
  0: "UNINITIALIZED",
  1: "TRANSFER_FEE_CONFIG",
  2: "TRANSFER_FEE_AMOUNT",
  3: "MINT_CLOSE_AUTHORITY",
  4: "CONFIDENTIAL_TRANSFER_MINT",
  5: "CONFIDENTIAL_TRANSFER_ACCOUNT",
  6: "DEFAULT_ACCOUNT_STATE",
  7: "IMMUTABLE_OWNER",
  8: "MEMO_TRANSFER",
  9: "NON_TRANSFERABLE",
  10: "INTEREST_BEARING_CONFIG",
  11: "CPI_GUARD",
  12: "PERMANENT_DELEGATE",
  13: "NON_TRANSFERABLE_ACCOUNT",
  14: "TRANSFER_HOOK",
  15: "TRANSFER_HOOK_ACCOUNT",
  16: "CONFIDENTIAL_TRANSFER_FEE_CONFIG",
  17: "CONFIDENTIAL_TRANSFER_FEE_AMOUNT",
  18: "METADATA_POINTER",
  19: "TOKEN_METADATA",
  20: "GROUP_POINTER",
  21: "TOKEN_GROUP",
  22: "GROUP_MEMBER_POINTER",
  23: "TOKEN_GROUP_MEMBER",
  24: "CONFIDENTIAL_MINT_BURN",
  25: "SCALED_UI_AMOUNT",
  26: "PAUSABLE",
  27: "PAUSABLE_ACCOUNT",
  28: "PERMISSIONED_BURN"
};

/*
 * Extensions which can materially affect the risk profile.
 *
 * IMPORTANT:
 * Presence does NOT automatically mean "scam".
 * It means that ProfitX must inspect the extension.
 */
const SECURITY_RELEVANT_EXTENSIONS = new Set([
  "TRANSFER_FEE_CONFIG",
  "MINT_CLOSE_AUTHORITY",
  "DEFAULT_ACCOUNT_STATE",
  "NON_TRANSFERABLE",
  "INTEREST_BEARING_CONFIG",
  "PERMANENT_DELEGATE",
  "TRANSFER_HOOK",
  "CONFIDENTIAL_TRANSFER_MINT",
  "CONFIDENTIAL_TRANSFER_FEE_CONFIG",
  "SCALED_UI_AMOUNT",
  "PAUSABLE",
  "PERMISSIONED_BURN"
]);

/* =========================================================
   HELPERS
========================================================= */

function json(res, status, body) {
  res.setHeader(
    "Cache-Control",
    "no-store"
  );

  res.setHeader(
    "Content-Type",
    "application/json; charset=utf-8"
  );

  return res
    .status(status)
    .json(body);
}

function isValidSolanaAddress(value) {
  return (
    typeof value === "string" &&
    /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(
      value
    )
  );
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
      () =>
        controller.abort(),
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
            id: "profitx-token2022",
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

    return (
      data?.result ??
      null
    );
  } finally {
    clearTimeout(timeout);
  }
}

/* =========================================================
   BASE64
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
   BASE58
========================================================= */

const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function bytesToBase58(bytes) {
  if (
    !bytes ||
    !bytes.length
  ) {
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
        Math.floor(
          value / 58
        );
    }

    while (carry > 0) {
      digits.push(
        carry % 58
      );

      carry =
        Math.floor(
          carry / 58
        );
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
    let i =
      digits.length - 1;
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
   LITTLE-ENDIAN READERS
========================================================= */

function readU16LE(
  bytes,
  offset
) {
  if (
    !bytes ||
    offset + 2 >
      bytes.length
  ) {
    return null;
  }

  return (
    bytes[offset] |
    (bytes[offset + 1] << 8)
  );
}

function readU64LE(
  bytes,
  offset
) {
  if (
    !bytes ||
    offset + 8 >
      bytes.length
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
   TOKEN-2022 TLV PARSER
========================================================= */

/*
 * Token-2022 uses:

   base Mint data
   ↓
   padding up to Account::LEN
   ↓
   AccountType = Mint
   ↓
   TLV entries

   Each TLV entry:

   [2 bytes type]
   [2 bytes length]
   [N bytes value]
*/

function parseToken2022Extensions(
  bytes
) {
  if (
    !bytes ||
    bytes.length <= 165
  ) {
    return {
      detected: false,
      accountType: null,
      extensions: [],
      rawCount: 0,
      warnings: []
    };
  }

  /*
   * AccountType is located immediately
   * after the 165-byte account boundary
   * when extensions are present.
   *
   * 1 = Mint
   * 2 = Token Account
   */

  const accountType =
    bytes[165];

  if (
    accountType !== 1
  ) {
    return {
      detected: false,
      accountType,
      extensions: [],
      rawCount: 0,
      warnings: [
        "TOKEN_2022_ACCOUNT_TYPE_NOT_MINT"
      ]
    };
  }

  const extensions = [];

  let offset = 166;

  while (
    offset + 4 <=
    bytes.length
  ) {
    const type =
      readU16LE(
        bytes,
        offset
      );

    const length =
      readU16LE(
        bytes,
        offset + 2
      );

    /*
     * Type 0 is the official
     * uninitialized/padding marker.
     */
    if (
      type === null ||
      type === 0
    ) {
      break;
    }

    if (
      length === null
    ) {
      break;
    }

    const valueStart =
      offset + 4;

    const valueEnd =
      valueStart + length;

    /*
     * Never read outside the RPC buffer.
     */
    if (
      valueEnd >
      bytes.length
    ) {
      return {
        detected: true,
        accountType,
        extensions,
        rawCount:
          extensions.length,
        warnings: [
          "TOKEN_2022_TLV_TRUNCATED"
        ]
      };
    }

    const name =
      EXTENSION_TYPES[
        type
      ] ||
      `UNKNOWN_EXTENSION_${type}`;

    const value =
      bytes.slice(
        valueStart,
        valueEnd
      );

    extensions.push({
      type,
      name,
      length,
      securityRelevant:
        SECURITY_RELEVANT_EXTENSIONS.has(
          name
        ),
      value
    });

    offset =
      valueEnd;
  }

  return {
    detected: true,

    accountType,

    extensions,

    rawCount:
      extensions.length,

    warnings: []
  };
}

/* =========================================================
   EXTENSION SUMMARIES
========================================================= */

function summarizeExtension(
  extension
) {
  const {
    type,
    name,
    length,
    securityRelevant,
    value
  } = extension;

  const result = {
    type,
    name,
    length,
    securityRelevant
  };

  /*
   * Transfer Fee Config
   *
   * We expose the raw rate fields only
   * when the expected bytes exist.
   *
   * The exact economic interpretation
   * will be added after validation.
   */

  if (
    name ===
    "TRANSFER_FEE_CONFIG"
  ) {
    /*
     * Layout contains authorities,
     * basis points and maximum fee.
     *
     * We intentionally do not invent
     * a value if the layout is unexpected.
     */

    if (
      value.length >= 108
    ) {
      const olderTransferFeeBasisPoints =
        readU16LE(
          value,
          104
        );

      const olderTransferFeeMaximum =
        readU64LE(
          value,
          96
        );

      const newerTransferFeeBasisPoints =
        readU16LE(
          value,
          106
        );

      const newerTransferFeeMaximum =
        readU64LE(
          value,
          88
        );

      result.transferFee =
        {
          olderBasisPoints:
            olderTransferFeeBasisPoints,

          olderMaximum:
            olderTransferFeeMaximum !==
            null
              ? olderTransferFeeMaximum.toString()
              : null,

          newerBasisPoints:
            newerTransferFeeBasisPoints,

          newerMaximum:
            newerTransferFeeMaximum !==
            null
              ? newerTransferFeeMaximum.toString()
              : null
        };
    }
  }

  /*
   * Mint Close Authority
   *
   * Optional Pubkey.
   */
  if (
    name ===
    "MINT_CLOSE_AUTHORITY"
  ) {
    if (
      value.length >= 32
    ) {
      result.closeAuthority =
        bytesToBase58(
          value.slice(
            0,
            32
          )
        );
    } else {
      result.closeAuthority =
        null;
    }
  }

  /*
   * Permanent Delegate
   *
   * 32-byte optional pubkey.
   */
  if (
    name ===
    "PERMANENT_DELEGATE"
  ) {
    if (
      value.length >= 32
    ) {
      result.delegate =
        bytesToBase58(
          value.slice(
            0,
            32
          )
        );
    } else {
      result.delegate =
        null;
    }
  }

  /*
   * Transfer Hook
   *
   * The extension contains authorities
   * and the program address.
   *
   * We expose a candidate program address
   * only if enough bytes exist.
   */
  if (
    name ===
    "TRANSFER_HOOK"
  ) {
    if (
      value.length >= 64
    ) {
      result.transferHookProgram =
        bytesToBase58(
          value.slice(
            32,
            64
          )
        );
    }
  }

  /*
   * Default Account State
   *
   * State values:
   * 0 = Uninitialized
   * 1 = Initialized
   * 2 = Frozen
   */
  if (
    name ===
    "DEFAULT_ACCOUNT_STATE"
  ) {
    if (
      value.length >= 1
    ) {
      const state =
        value[0];

      result.defaultState =
        state === 0
          ? "UNINITIALIZED"
          : state === 1
          ? "INITIALIZED"
          : state === 2
          ? "FROZEN"
          : `UNKNOWN_${state}`;
    }
  }

  /*
   * Simple feature flags.
   */
  if (
    name ===
      "NON_TRANSFERABLE" ||
    name ===
      "PAUSABLE" ||
    name ===
      "SCALED_UI_AMOUNT" ||
    name ===
      "INTEREST_BEARING_CONFIG" ||
    name ===
      "CONFIDENTIAL_TRANSFER_MINT" ||
    name ===
      "CONFIDENTIAL_TRANSFER_FEE_CONFIG" ||
    name ===
      "PERMISSIONED_BURN"
  ) {
    result.enabled = true;
  }

  return result;
}

/* =========================================================
   SECURITY INTERPRETATION
========================================================= */

function analyseToken2022(
  mint,
  extensions
) {
  const summaries =
    extensions.map(
      summarizeExtension
    );

  const relevant =
    summaries.filter(
      (item) =>
        item.securityRelevant
    );

  const names =
    summaries.map(
      (item) =>
        item.name
    );

  const findings = [];

  /*
   * Important:
   * these are findings, NOT final score penalties.
   */

  if (
    names.includes(
      "PERMANENT_DELEGATE"
    )
  ) {
    findings.push({
      severity: "HIGH",
      code:
        "PERMANENT_DELEGATE",
      message:
        "Une Permanent Delegate est présente et doit être examinée."
    });
  }

  if (
    names.includes(
      "TRANSFER_HOOK"
    )
  ) {
    findings.push({
      severity: "MEDIUM",
      code:
        "TRANSFER_HOOK",
      message:
        "Un Transfer Hook est présent et peut modifier le comportement des transferts."
    });
  }

  if (
    names.includes(
      "TRANSFER_FEE_CONFIG"
    )
  ) {
    findings.push({
      severity: "MEDIUM",
      code:
        "TRANSFER_FEE_CONFIG",
      message:
        "Une configuration de frais de transfert est présente."
    });
  }

  if (
    names.includes(
      "MINT_CLOSE_AUTHORITY"
    )
  ) {
    findings.push({
      severity: "MEDIUM",
      code:
        "MINT_CLOSE_AUTHORITY",
      message:
        "Une Mint Close Authority est présente."
    });
  }

  if (
    names.includes(
      "DEFAULT_ACCOUNT_STATE"
    )
  ) {
    const extension =
      summaries.find(
        (item) =>
          item.name ===
          "DEFAULT_ACCOUNT_STATE"
      );

    if (
      extension?.defaultState ===
      "FROZEN"
    ) {
      findings.push({
        severity: "HIGH",
        code:
          "DEFAULT_ACCOUNT_STATE_FROZEN",
        message:
          "Les nouveaux comptes peuvent être créés dans l'état Frozen."
      });
    }
  }

  if (
    names.includes(
      "NON_TRANSFERABLE"
    )
  ) {
    findings.push({
      severity: "HIGH",
      code:
        "NON_TRANSFERABLE",
      message:
        "Le mint possède l'extension NonTransferable."
    });
  }

  if (
    names.includes(
      "PAUSABLE"
    )
  ) {
    findings.push({
      severity: "HIGH",
      code:
        "PAUSABLE",
      message:
        "Le mint possède une extension permettant la mise en pause des opérations."
    });
  }

  if (
    names.includes(
      "PERMISSIONED_BURN"
    )
  ) {
    findings.push({
      severity: "HIGH",
      code:
        "PERMISSIONED_BURN",
      message:
        "Une extension Permissioned Burn est présente."
    });
  }

  return {
    mint,

    extensionCount:
      summaries.length,

    extensions:
      summaries,

    securityRelevantExtensions:
      relevant,

    findings,

    analysisComplete:
      true,

    scoringReady:
      false
  };
}

/* =========================================================
   API
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
    const result =
      await rpcCall(
        rpcUrl,
        "getAccountInfo",
        [
          mint,
          {
            encoding:
              "base64",
            commitment:
              "confirmed"
          }
        ]
      );

    const account =
      result?.value ??
      null;

    if (!account) {
      return json(
        res,
        404,
        {
          ok: false,
          error:
            "Mint introuvable sur Solana."
        }
      );
    }

    if (
      account.owner !==
      TOKEN_2022_PROGRAM_ID
    ) {
      return json(
        res,
        200,
        {
          ok: true,

          module:
            "PROFITX_TOKEN2022",

          version:
            "1.0.0",

          mint,

          isToken2022:
            false,

          tokenProgram:
            account.owner,

          message:
            "Ce mint n'est pas contrôlé par le Token-2022 Program."
        }
      );
    }

    const bytes =
      base64ToBytes(
        account?.data?.[0]
      );

    if (!bytes) {
      return json(
        res,
        500,
        {
          ok: false,
          error:
            "Impossible de décoder les données du mint."
        }
      );
    }

    const parsed =
      parseToken2022Extensions(
        bytes
      );

    const analysis =
      analyseToken2022(
        mint,
        parsed.extensions
      );

    return json(
      res,
      200,
      {
        ok: true,

        module:
          "PROFITX_TOKEN2022",

        version:
          "1.0.0",

        timestamp:
          new Date().toISOString(),

        mint,

        isToken2022:
          true,

        accountDataLength:
          bytes.length,

        parsed,

        analysis
      }
    );
  } catch (error) {
    return json(
      res,
      500,
      {
        ok: false,

        module:
          "PROFITX_TOKEN2022",

        error:
          error?.message ||
          "Erreur lors de l'analyse Token-2022."
      }
    );
  }
}
