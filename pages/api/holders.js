const DEFAULT_RPC =
  "https://api.mainnet-beta.solana.com";

const PUMP_COIN_URL =
  "https://frontend-api-v3.pump.fun/coins-v2";

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
            id: "profitx-holders-v2",
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
   PUMP.FUN API
========================================================= */

async function getPumpCoin(
  mint
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
        `${PUMP_COIN_URL}/${encodeURIComponent(
          mint
        )}`,

        {
          method: "GET",

          headers: {
            Accept:
              "application/json"
          },

          signal:
            controller.signal
        }
      );

    if (!response.ok) {
      return {
        ok: false,

        status:
          response.status,

        data: null
      };
    }

    const data =
      await response.json();

    return {
      ok: true,

      status:
        response.status,

      data
    };
  } catch {
    return {
      ok: false,

      status: null,

      data: null
    };
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

  const scaled =
    (amount * 1000000n) /
    supply;

  return (
    Number(scaled) /
    10000
  );
}

/* =========================================================
   NORMALIZE ADDRESS
========================================================= */

function normalizeAddress(
  value
) {
  if (
    typeof value !==
    "string"
  ) {
    return null;
  }

  const trimmed =
    value.trim();

  return isValidSolanaAddress(
    trimmed
  )
    ? trimmed
    : null;
}

/* =========================================================
   ADDRESS COLLECTION
========================================================= */

function collectAddresses(
  object,
  keys
) {
  const result =
    new Set();

  if (
    !object ||
    typeof object !==
      "object"
  ) {
    return result;
  }

  for (
    const key of keys
  ) {
    const value =
      object[key];

    const address =
      normalizeAddress(
        value
      );

    if (address) {
      result.add(
        address
      );
    }
  }

  return result;
}

/* =========================================================
   PUMP DATA NORMALIZATION
========================================================= */

function normalizePumpData(
  raw,
  mint
) {
  /*
   * The Pump API has changed fields
   * over time. We deliberately inspect
   * several known names and only keep
   * valid Solana addresses.
   */

  const data =
    raw &&
    typeof raw ===
      "object"
      ? raw
      : {};

  const bondingCurve =
    collectAddresses(
      data,
      [
        "bonding_curve",
        "bondingCurve"
      ]
    );

  const associatedBondingCurve =
    collectAddresses(
      data,
      [
        "associated_bonding_curve",
        "associatedBondingCurve"
      ]
    );

  const creator =
    collectAddresses(
      data,
      [
        "creator",
        "creator_address",
        "creatorAddress"
      ]
    );

  const pumpSwapPool =
    collectAddresses(
      data,
      [
        "pump_swap_pool",
        "pumpSwapPool",
        "pool",
        "pool_address",
        "poolAddress"
      ]
    );

  const raydiumPool =
    collectAddresses(
      data,
      [
        "raydium_pool",
        "raydiumPool",
        "raydium_pool_address"
      ]
    );

  const complete =
    typeof data.complete ===
    "boolean"
      ? data.complete
      : null;

  return {
    mint,

    bondingCurve:
      Array.from(
        bondingCurve
      ),

    associatedBondingCurve:
      Array.from(
        associatedBondingCurve
      ),

    creator:
      Array.from(
        creator
      ),

    pumpSwapPool:
      Array.from(
        pumpSwapPool
      ),

    raydiumPool:
      Array.from(
        raydiumPool
      ),

    complete,

    sourceFields: {
      bondingCurve:
        data.bonding_curve ??
        data.bondingCurve ??
        null,

      associatedBondingCurve:
        data.associated_bonding_curve ??
        data.associatedBondingCurve ??
        null,

      creator:
        data.creator ??
        data.creator_address ??
        data.creatorAddress ??
        null,

      pumpSwapPool:
        data.pump_swap_pool ??
        data.pumpSwapPool ??
        data.pool ??
        null,

      raydiumPool:
        data.raydium_pool ??
        data.raydiumPool ??
        null,

      complete:
        data.complete ??
        null
    }
  };
}

/* =========================================================
   CLASSIFICATION
========================================================= */

function classifyAccount({
  tokenAccount,
  owner,
  pump
}) {
  /*
   * 1. Associated bonding curve
   *
   * This is normally the most precise
   * identification because it is the
   * actual token account address.
   */

  if (
    pump.associatedBondingCurve.includes(
      tokenAccount
    )
  ) {
    return {
      category:
        "BONDING_CURVE",

      confidence:
        "HIGH",

      reason:
        "Token account identifié comme Associated Bonding Curve Pump.fun."
    };
  }

  /*
   * 2. Bonding curve account
   *
   * Depending on Pump.fun/API representation,
   * the bonding curve may appear either as
   * the token account or its owner.
   */

  if (
    pump.bondingCurve.includes(
      tokenAccount
    ) ||
    pump.bondingCurve.includes(
      owner
    )
  ) {
    return {
      category:
        "BONDING_CURVE",

      confidence:
        "HIGH",

      reason:
        "Adresse identifiée comme Bonding Curve Pump.fun."
    };
  }

  /*
   * 3. PumpSwap
   */

  if (
    pump.pumpSwapPool.includes(
      tokenAccount
    ) ||
    pump.pumpSwapPool.includes(
      owner
    )
  ) {
    return {
      category:
        "PUMPSWAP_POOL",

      confidence:
        "HIGH",

      reason:
        "Adresse identifiée comme pool PumpSwap."
    };
  }

  /*
   * 4. Raydium
   */

  if (
    pump.raydiumPool.includes(
      tokenAccount
    ) ||
    pump.raydiumPool.includes(
      owner
    )
  ) {
    return {
      category:
        "RAYDIUM_POOL",

      confidence:
        "HIGH",

      reason:
        "Adresse identifiée comme pool Raydium."
    };
  }

  /*
   * 5. Creator
   */

  if (
    pump.creator.includes(
      owner
    )
  ) {
    return {
      category:
        "CREATOR",

      confidence:
        "HIGH",

      reason:
        "Owner du token account correspond au créateur Pump.fun."
    };
  }

  /*
   * 6. External holder
   */

  return {
    category:
      "EXTERNAL_HOLDER",

    confidence:
      "MEDIUM",

    reason:
      "Adresse non identifiée comme réserve, pool ou créateur."
  };
}

/* =========================================================
   CATEGORY AGGREGATION
========================================================= */

function aggregateCategories(
  accounts,
  supply
) {
  const categories =
    new Map();

  for (
    const account of accounts
  ) {
    const current =
      categories.get(
        account.category
      ) || {
        category:
          account.category,

        amount:
          0n,

        tokenAccounts:
          0,

        owners:
          new Set()
      };

    current.amount +=
      account.amount;

    current.tokenAccounts +=
      1;

    current.owners.add(
      account.owner
    );

    categories.set(
      account.category,
      current
    );
  }

  return Array.from(
    categories.values()
  )
    .map(
      (item) => ({
        category:
          item.category,

        amount:
          item.amount.toString(),

        percentage:
          percentage(
            item.amount,
            supply
          ),

        tokenAccounts:
          item.tokenAccounts,

        uniqueOwners:
          item.owners.size
      })
    )
    .sort(
      (a, b) =>
        b.percentage -
        a.percentage
    );
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
            "2.0.0",

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
       2. SUPPLY
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
        "Impossible de récupérer la supply."
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
       3. PUMP.FUN DATA
    ===================================================== */

    const pumpResult =
      await getPumpCoin(
        mint
      );

    const pump =
      normalizePumpData(
        pumpResult.data,
        mint
      );

    /* =====================================================
       4. ALL TOKEN ACCOUNTS
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

            dataSlice: {
              offset: 32,

              length: 40
            }
          }
        ]
      );

    const rawAccounts =
      Array.isArray(
        accountsResult
      )
        ? accountsResult
        : [];

    /* =====================================================
       5. DECODE
    ===================================================== */

    const decodedAccounts =
      [];

    for (
      const account of
        rawAccounts
    ) {
      const encoded =
        account?.account
          ?.data?.[0];

      if (
        typeof encoded !==
        "string"
      ) {
        continue;
      }

      const bytes =
        base64ToBytes(
          encoded
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

      if (
        amount === 0n
      ) {
        continue;
      }

      const classification =
        classifyAccount({
          tokenAccount:
            account.pubkey,

          owner,

          pump
        });

      decodedAccounts.push({
        tokenAccount:
          account.pubkey,

        owner,

        amount,

        category:
          classification.category,

        confidence:
          classification.confidence,

        reason:
          classification.reason
      });
    }

    /* =====================================================
       6. AGGREGATE OWNERS
    ===================================================== */

    const holderMap =
      new Map();

    for (
      const account of
        decodedAccounts
    ) {
      const current =
        holderMap.get(
          account.owner
        ) || {
          owner:
            account.owner,

          amount:
            0n,

          categories:
            new Set(),

          tokenAccounts:
            0
        };

      current.amount +=
        account.amount;

      current.categories.add(
        account.category
      );

      current.tokenAccounts +=
        1;

      holderMap.set(
        account.owner,
        current
      );
    }

    const holders =
      Array.from(
        holderMap.values()
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
       7. RANKED HOLDERS
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
            holder.amount.toString(),

          percentage:
            percentage(
              holder.amount,
              supply
            ),

          categories:
            Array.from(
              holder.categories
            ),

          tokenAccounts:
            holder.tokenAccounts
        })
      );

    /* =====================================================
       8. CATEGORY TOTALS
    ===================================================== */

    const categoryTotals =
      aggregateCategories(
        decodedAccounts,
        supply
      );

    /* =====================================================
       9. EXTERNAL HOLDERS ONLY
    ===================================================== */

    const external =
      holders.filter(
        (holder) =>
          holder.categories.has(
            "EXTERNAL_HOLDER"
          )
      );

    let externalAmount =
      0n;

    for (
      const holder of external
    ) {
      externalAmount +=
        holder.amount;
    }

    const externalPercent =
      percentage(
        externalAmount,
        supply
      );

    /* =====================================================
       10. EXTERNAL CONCENTRATION
    ===================================================== */

    const externalTop1 =
      external[0]
        ? percentage(
            external[0]
              .amount,
            supply
          )
        : 0;

    const externalTop5Amount =
      external
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

    const externalTop10Amount =
      external
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

    const externalTop5 =
      percentage(
        externalTop5Amount,
        supply
      );

    const externalTop10 =
      percentage(
        externalTop10Amount,
        supply
      );

    /* =====================================================
       11. OBSERVED SUPPLY
    ===================================================== */

    let observedSupply =
      0n;

    for (
      const account of
        decodedAccounts
    ) {
      observedSupply +=
        account.amount;
    }

    const unobservedSupply =
      supply >
      observedSupply
        ? supply -
          observedSupply
        : 0n;

    /* =====================================================
       12. RESULT
    ===================================================== */

    return json(
      res,
      200,
      {
        ok: true,

        module:
          "PROFITX_HOLDERS",

        version:
          "2.0.0",

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

        /* -----------------------------------------------
           PUMP.FUN IDENTIFICATION
        ----------------------------------------------- */

        pumpFun: {
          detected:
            pumpResult.ok,

          complete:
            pump.complete,

          bondingCurve:
            pump.bondingCurve,

          associatedBondingCurve:
            pump.associatedBondingCurve,

          creator:
            pump.creator,

          pumpSwapPool:
            pump.pumpSwapPool,

          raydiumPool:
            pump.raydiumPool,

          sourceFields:
            pump.sourceFields
        },

        /* -----------------------------------------------
           ACCOUNT COUNTS
        ----------------------------------------------- */

        tokenAccountsScanned:
          rawAccounts.length,

        nonZeroTokenAccounts:
          decodedAccounts.length,

        uniqueOwners:
          holders.length,

        externalHolders:
          external.length,

        /* -----------------------------------------------
           DISTRIBUTION
        ----------------------------------------------- */

        distribution: {
          categories:
            categoryTotals,

          externalAmount:
            externalAmount.toString(),

          externalPercent,

          externalTop1Percent:
            externalTop1,

          externalTop5Percent:
            externalTop5,

          externalTop10Percent:
            externalTop10
        },

        /* -----------------------------------------------
           OBSERVED SUPPLY
        ----------------------------------------------- */

        observedSupply:
          observedSupply.toString(),

        observedPercent:
          percentage(
            observedSupply,
            supply
          ),

        unobservedSupply:
          unobservedSupply.toString(),

        unobservedPercent:
          percentage(
            unobservedSupply,
            supply
          ),

        /* -----------------------------------------------
           HOLDERS
        ----------------------------------------------- */

        topHolders:
          ranked.slice(
            0,
            20
          ),

        /* -----------------------------------------------
           DATA QUALITY
        ----------------------------------------------- */

        dataQuality: {
          supply:
            true,

          tokenAccounts:
            true,

          holders:
            true,

          pumpFun:
            pumpResult.ok,

          classification:
            true,

          complete:
            unobservedSupply ===
            0n
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

        version:
          "2.0.0",

        error:
          error?.message ||
          "Erreur lors de l'analyse des holders."
      }
    );
  }
}
