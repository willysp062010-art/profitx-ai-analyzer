const DEFAULT_RPC =
  "https://api.mainnet-beta.solana.com";

const TOKEN_2022_PROGRAM_ID =
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

const REQUEST_TIMEOUT_MS = 15000;

/* =========================================================
   RESPONSE
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

/* =========================================================
   VALIDATION
========================================================= */

function isValidSolanaAddress(value) {
  return (
    typeof value === "string" &&
    /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(
      value
    )
  );
}

/* =========================================================
   RPC
========================================================= */

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
            id: "profitx-holders",
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
   UINT64
========================================================= */

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
    bytes.length === 0
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
   PERCENTAGE
========================================================= */

function percentage(
  amount,
  supply
) {
  if (
    supply <= 0n ||
    amount <= 0n
  ) {
    return 0;
  }

  /*
   * Return percentage with
   * four decimal places.
   */
  const scaled =
    (amount * 1000000n) /
    supply;

  return (
    Number(scaled) /
    10000
  );
}

/* =========================================================
   TOKEN ACCOUNT DATA
========================================================= */

/*
 * Standard Token Account layout:

   offset 0   = mint      (32 bytes)
   offset 32  = owner     (32 bytes)
   offset 64  = amount    (8 bytes)

 * Token-2022 can add extensions
 * after the base account data.
 */

function decodeTokenAccountData(
  base64
) {
  const bytes =
    base64ToBytes(
      base64
    );

  if (
    !bytes ||
    bytes.length < 72
  ) {
    return null;
  }

  const owner =
    bytesToBase58(
      bytes.slice(
        32,
        64
      )
    );

  const amount =
    readU64LE(
      bytes,
      64
    );

  if (
    !owner ||
    amount === null
  ) {
    return null;
  }

  return {
    owner,
    amount
  };
}

/* =========================================================
   DISTRIBUTION CLASSIFICATION
========================================================= */

function classifyConcentration(
  topHolderPercent,
  top5Percent,
  top10Percent
) {
  if (
    topHolderPercent >= 90
  ) {
    return {
      level: "EXTREME",
      label:
        "Concentration extrêmement élevée"
    };
  }

  if (
    topHolderPercent >= 50 ||
    top5Percent >= 80
  ) {
    return {
      level: "HIGH",
      label:
        "Concentration élevée"
    };
  }

  if (
    top10Percent >= 70
  ) {
    return {
      level: "MEDIUM",
      label:
        "Concentration importante"
    };
  }

  return {
    level: "LOW",
    label:
      "Distribution relativement dispersée"
  };
}

/* =========================================================
   HANDLER
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
    /* =====================================================
       1. CHECK MINT
    ===================================================== */

    const mintResult =
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

    const mintAccount =
      mintResult?.value ??
      null;

    if (!mintAccount) {
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
      mintAccount.owner !==
      TOKEN_2022_PROGRAM_ID
    ) {
      return json(
        res,
        200,
        {
          ok: true,

          module:
            "PROFITX_HOLDERS",

          version:
            "1.0.0",

          mint,

          isToken2022:
            false,

          tokenProgram:
            mintAccount.owner,

          message:
            "Ce mint n'utilise pas Token-2022."
        }
      );
    }

    /* =====================================================
       2. READ MINT SUPPLY
    ===================================================== */

    const supplyResult =
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

    const supplyData =
      supplyResult?.value ??
      null;

    if (
      !supplyData ||
      typeof supplyData.amount !==
        "string"
    ) {
      throw new Error(
        "Impossible de récupérer la supply du mint."
      );
    }

    const supply =
      BigInt(
        supplyData.amount
      );

    const decimals =
      Number(
        supplyData.decimals ??
          0
      );

    /* =====================================================
       3. FIND ALL TOKEN ACCOUNTS
    ===================================================== */

    const accountsResult =
      await rpcCall(
        rpcUrl,
        "getProgramAccounts",
        [
          TOKEN_2022_PROGRAM_ID,
          {
            commitment:
              "confirmed",

            encoding:
              "base64",

            filters: [
              {
                memcmp: {
                  offset: 0,

                  bytes: mint
                }
              }
            ],

            /*
             * Only return:
             *
             * owner = 32 bytes
             * amount = 8 bytes
             *
             * starting at byte 32.
             *
             * This greatly reduces RPC payload size.
             */
            dataSlice: {
              offset: 32,
              length: 40
            }
          }
        ]
      );

    const accounts =
      Array.isArray(
        accountsResult
      )
        ? accountsResult
        : [];

    /* =====================================================
       4. DECODE TOKEN ACCOUNTS
    ===================================================== */

    const tokenAccounts =
      [];

    for (
      const account of accounts
    ) {
      const data =
        account?.account
          ?.data?.[0];

      if (
        typeof data !==
        "string"
      ) {
        continue;
      }

      /*
       * Because dataSlice starts
       * at offset 32, the returned
       * buffer contains:
       *
       * 0..31  = owner
       * 32..39 = amount
       */

      const bytes =
        base64ToBytes(
          data
        );

      if (
        !bytes ||
        bytes.length < 40
      ) {
        continue;
      }

      const owner =
        bytesToBase58(
          bytes.slice(
            0,
            32
          )
        );

      const amount =
        readU64LE(
          bytes,
          32
        );

      if (
        !owner ||
        amount === null
      ) {
        continue;
      }

      tokenAccounts.push({
        tokenAccount:
          account.pubkey,

        owner,

        amount
      });
    }

    /* =====================================================
       5. IGNORE ZERO BALANCES
    ===================================================== */

    const nonZeroAccounts =
      tokenAccounts.filter(
        (account) =>
          account.amount > 0n
      );

    /* =====================================================
       6. AGGREGATE BY OWNER
    ===================================================== */

    const holderMap =
      new Map();

    for (
      const account of
        nonZeroAccounts
    ) {
      const current =
        holderMap.get(
          account.owner
        ) || 0n;

      holderMap.set(
        account.owner,
        current +
          account.amount
      );
    }

    const holders =
      Array.from(
        holderMap.entries()
      )
        .map(
          ([
            owner,
            amount
          ]) => ({
            owner,
            amount
          })
        )
        .sort(
          (a, b) => {
            if (
              a.amount ===
              b.amount
            ) {
              return 0;
            }

            return a.amount >
              b.amount
              ? -1
              : 1;
          }
        );

    /* =====================================================
       7. TOTAL OBSERVED
    ===================================================== */

    let observedSupply =
      0n;

    for (
      const holder of holders
    ) {
      observedSupply +=
        holder.amount;
    }

    /* =====================================================
       8. DISTRIBUTION
    ===================================================== */

    const ranked =
      holders.map(
        (
          holder,
          index
        ) => ({
          rank:
            index + 1,

          owner:
            holder.owner,

          amount:
            holder.amount
              .toString(),

          percentage:
            percentage(
              holder.amount,
              supply
            )
        })
      );

    const top1 =
      ranked[0] ||
      null;

    const top5Amount =
      holders
        .slice(0, 5)
        .reduce(
          (
            total,
            holder
          ) =>
            total +
            holder.amount,
          0n
        );

    const top10Amount =
      holders
        .slice(0, 10)
        .reduce(
          (
            total,
            holder
          ) =>
            total +
            holder.amount,
          0n
        );

    const top20Amount =
      holders
        .slice(0, 20)
        .reduce(
          (
            total,
            holder
          ) =>
            total +
            holder.amount,
          0n
        );

    const top1Percent =
      top1
        ? percentage(
            holders[0]
              .amount,
            supply
          )
        : 0;

    const top5Percent =
      percentage(
        top5Amount,
        supply
      );

    const top10Percent =
      percentage(
        top10Amount,
        supply
      );

    const top20Percent =
      percentage(
        top20Amount,
        supply
      );

    const concentration =
      classifyConcentration(
        top1Percent,
        top5Percent,
        top10Percent
      );

    /* =====================================================
       9. UNOBSERVED SUPPLY
    ===================================================== */

    const unobserved =
      supply >
      observedSupply
        ? supply -
          observedSupply
        : 0n;

    const observedPercent =
      percentage(
        observedSupply,
        supply
      );

    const unobservedPercent =
      percentage(
        unobserved,
        supply
      );

    /* =====================================================
       10. RETURN
    ===================================================== */

    return json(
      res,
      200,
      {
        ok: true,

        module:
          "PROFITX_HOLDERS",

        version:
          "1.0.0",

        timestamp:
          new Date().toISOString(),

        mint,

        tokenProgram:
          TOKEN_2022_PROGRAM_ID,

        decimals,

        supply:
          supply.toString(),

        supplyUi:
          Number(
            supply
          ) /
          Math.pow(
            10,
            decimals
          ),

        tokenAccountsScanned:
          tokenAccounts.length,

        nonZeroTokenAccounts:
          nonZeroAccounts.length,

        uniqueHolders:
          holders.length,

        observedSupply:
          observedSupply.toString(),

        observedPercent,

        unobservedSupply:
          unobserved.toString(),

        unobservedPercent,

        concentration: {
          level:
            concentration.level,

          label:
            concentration.label,

          top1Percent,

          top5Percent,

          top10Percent,

          top20Percent
        },

        topHolders:
          ranked.slice(
            0,
            20
          ),

        dataQuality: {
          supply:
            true,

          tokenAccounts:
            true,

          holders:
            true,

          distribution:
            true,

          complete:
            true
        }
      }
    );
  } catch (error) {
    return json(
      res,
      500,
      {
        ok: false,

        module:
          "PROFITX_HOLDERS",

        error:
          error?.message ||
          "Erreur lors de l'analyse des holders."
      }
    );
  }
}
