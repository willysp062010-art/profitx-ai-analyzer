const DEFAULT_RPC =
  "https://api.mainnet-beta.solana.com";

const PUMP_COIN_URL =
  "https://frontend-api-v3.pump.fun/coins-v2";

const TOKEN_2022_PROGRAM_ID =
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

const REQUEST_TIMEOUT_MS = 12000;

const SIGNATURE_LIMIT_PER_ACCOUNT = 50;

const MAX_TRANSACTIONS = 100;

const MAX_CONCURRENT_TX = 6;

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
            id: "profitx-activity-v2",
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
   PUMP.FUN
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
      return null;
    }

    return await response.json();
  } catch {
    return null;
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
   TOKEN ACCOUNTS
========================================================= */

async function getTokenAccounts(
  rpcUrl,
  mint
) {
  const result =
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

  const accounts =
    Array.isArray(result)
      ? result
      : [];

  const decoded = [];

  for (
    const account of accounts
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

    let amount = 0n;

    for (
      let i = 0;
      i < 8;
      i++
    ) {
      amount +=
        BigInt(
          bytes[32 + i]
        ) <<
        (8n * BigInt(i));
    }

    if (!owner) {
      continue;
    }

    decoded.push({
      tokenAccount:
        account.pubkey,

      owner,

      amount
    });
  }

  return decoded;
}

/* =========================================================
   SIGNATURES
========================================================= */

async function getSignatures(
  rpcUrl,
  address
) {
  const result =
    await rpcCall(
      rpcUrl,
      "getSignaturesForAddress",
      [
        address,
        {
          limit:
            SIGNATURE_LIMIT_PER_ACCOUNT,

          commitment:
            "confirmed"
        }
      ]
    );

  return Array.isArray(result)
    ? result
    : [];
}

/* =========================================================
   TRANSACTION
========================================================= */

async function getTransaction(
  rpcUrl,
  signature
) {
  return rpcCall(
    rpcUrl,
    "getTransaction",
    [
      signature,
      {
        encoding:
          "jsonParsed",

        commitment:
          "confirmed",

        maxSupportedTransactionVersion:
          0
      }
    ]
  );
}

/* =========================================================
   ACCOUNT KEYS
========================================================= */

function getAccountKeys(
  transaction
) {
  const keys =
    transaction
      ?.transaction
      ?.message
      ?.accountKeys;

  if (
    !Array.isArray(keys)
  ) {
    return [];
  }

  return keys.map(
    (key) => {
      if (
        typeof key ===
        "string"
      ) {
        return key;
      }

      return (
        key?.pubkey ||
        null
      );
    }
  );
}

/* =========================================================
   TOKEN BALANCE MAP
========================================================= */

function buildTokenBalanceMap(
  balances,
  accountKeys,
  mint
) {
  const map =
    new Map();

  if (
    !Array.isArray(
      balances
    )
  ) {
    return map;
  }

  for (
    const item of balances
  ) {
    if (
      item?.mint !== mint
    ) {
      continue;
    }

    const index =
      Number(
        item.accountIndex
      );

    const account =
      accountKeys[index];

    if (!account) {
      continue;
    }

    const amount =
      item?.uiTokenAmount
        ?.amount;

    if (
      typeof amount !==
      "string"
    ) {
      continue;
    }

    map.set(
      account,
      {
        amount:
          BigInt(amount),

        owner:
          item?.owner ||
          null
      }
    );
  }

  return map;
}

/* =========================================================
   TOKEN DELTAS
========================================================= */

function getTokenDeltas(
  transaction,
  mint
) {
  const accountKeys =
    getAccountKeys(
      transaction
    );

  const pre =
    buildTokenBalanceMap(
      transaction?.meta
        ?.preTokenBalances,

      accountKeys,

      mint
    );

  const post =
    buildTokenBalanceMap(
      transaction?.meta
        ?.postTokenBalances,

      accountKeys,

      mint
    );

  const addresses =
    new Set([
      ...pre.keys(),
      ...post.keys()
    ]);

  const deltas = [];

  for (
    const address of addresses
  ) {
    const before =
      pre.get(
        address
      );

    const after =
      post.get(
        address
      );

    const beforeAmount =
      before?.amount ||
      0n;

    const afterAmount =
      after?.amount ||
      0n;

    const delta =
      afterAmount -
      beforeAmount;

    if (
      delta === 0n
    ) {
      continue;
    }

    const owner =
      after?.owner ||
      before?.owner ||
      null;

    deltas.push({
      tokenAccount:
        address,

      owner,

      delta:
        delta.toString()
    });
  }

  return deltas;
}

/* =========================================================
   ADDRESS SET
========================================================= */

function addAddress(
  set,
  value
) {
  if (
    isValidSolanaAddress(
      value
    )
  ) {
    set.add(value);
  }
}

/* =========================================================
   PUMP ADDRESS MODEL
========================================================= */

function buildPumpAddressModel(
  pump
) {
  const bondingCurve =
    new Set();

  const creator =
    new Set();

  const pools =
    new Set();

  if (!pump) {
    return {
      bondingCurve,
      creator,
      pools
    };
  }

  addAddress(
    bondingCurve,
    pump.bonding_curve
  );

  addAddress(
    bondingCurve,
    pump.bondingCurve
  );

  addAddress(
    bondingCurve,
    pump.associated_bonding_curve
  );

  addAddress(
    bondingCurve,
    pump.associatedBondingCurve
  );

  addAddress(
    creator,
    pump.creator
  );

  addAddress(
    creator,
    pump.creator_address
  );

  addAddress(
    creator,
    pump.creatorAddress
  );

  addAddress(
    pools,
    pump.pump_swap_pool
  );

  addAddress(
    pools,
    pump.pumpSwapPool
  );

  addAddress(
    pools,
    pump.raydium_pool
  );

  addAddress(
    pools,
    pump.raydiumPool
  );

  return {
    bondingCurve,
    creator,
    pools
  };
}

/* =========================================================
   CLASSIFY OWNER
========================================================= */

function classifyOwner(
  owner,
  tokenAccount,
  model
) {
  if (
    model.bondingCurve.has(
      owner
    ) ||
    model.bondingCurve.has(
      tokenAccount
    )
  ) {
    return "BONDING_CURVE";
  }

  if (
    model.creator.has(
      owner
    ) ||
    model.creator.has(
      tokenAccount
    )
  ) {
    return "CREATOR";
  }

  if (
    model.pools.has(
      owner
    ) ||
    model.pools.has(
      tokenAccount
    )
  ) {
    return "POOL";
  }

  return "EXTERNAL";
}

/* =========================================================
   MOVEMENT CLASSIFICATION
========================================================= */

function classifyMovement({
  deltas,
  model
}) {
  const enriched =
    deltas.map(
      (delta) => ({
        ...delta,

        direction:
          BigInt(
            delta.delta
          ) > 0n
            ? "IN"
            : "OUT",

        actor:
          classifyOwner(
            delta.owner,
            delta.tokenAccount,
            model
          )
      })
    );

  const curveOut =
    enriched.some(
      (item) =>
        item.actor ===
          "BONDING_CURVE" &&
        BigInt(
          item.delta
        ) < 0n
    );

  const curveIn =
    enriched.some(
      (item) =>
        item.actor ===
          "BONDING_CURVE" &&
        BigInt(
          item.delta
        ) > 0n
    );

  const externalIn =
    enriched.some(
      (item) =>
        item.actor ===
          "EXTERNAL" &&
        BigInt(
          item.delta
        ) > 0n
    );

  const externalOut =
    enriched.some(
      (item) =>
        item.actor ===
          "EXTERNAL" &&
        BigInt(
          item.delta
        ) < 0n
    );

  const creatorIn =
    enriched.some(
      (item) =>
        item.actor ===
          "CREATOR" &&
        BigInt(
          item.delta
        ) > 0n
    );

  const creatorOut =
    enriched.some(
      (item) =>
        item.actor ===
          "CREATOR" &&
        BigInt(
          item.delta
        ) < 0n
    );

  const poolIn =
    enriched.some(
      (item) =>
        item.actor ===
          "POOL" &&
        BigInt(
          item.delta
        ) > 0n
    );

  const poolOut =
    enriched.some(
      (item) =>
        item.actor ===
          "POOL" &&
        BigInt(
          item.delta
        ) < 0n
    );

  /*
   * BUY:
   *
   * Bonding curve loses PFX
   * External wallet receives PFX
   *
   * Creator is deliberately excluded.
   */

  if (
    curveOut &&
    externalIn
  ) {
    return {
      type:
        "BUY_PROBABLE",

      confidence:
        "HIGH",

      reason:
        "La bonding curve perd des PFX et un wallet externe reçoit les PFX."
    };
  }

  /*
   * SELL:
   *
   * External wallet loses PFX
   * Bonding curve receives PFX.
   */

  if (
    curveIn &&
    externalOut
  ) {
    return {
      type:
        "SELL_PROBABLE",

      confidence:
        "HIGH",

      reason:
        "Un wallet externe perd des PFX et la bonding curve reçoit les PFX."
    };
  }

  /*
   * Creator movement.
   */

  if (
    creatorIn ||
    creatorOut
  ) {
    return {
      type:
        "CREATOR_MOVEMENT",

      confidence:
        "HIGH",

      reason:
        "Le créateur intervient dans le mouvement de PFX."
    };
  }

  /*
   * Pool movement.
   */

  if (
    poolIn ||
    poolOut
  ) {
    return {
      type:
        "POOL_MOVEMENT",

      confidence:
        "HIGH",

      reason:
        "Un pool de liquidité intervient dans le mouvement."
    };
  }

  /*
   * External wallet transfer.
   */

  if (
    externalIn &&
    externalOut
  ) {
    return {
      type:
        "TRANSFER",

      confidence:
        "MEDIUM",

      reason:
        "Les PFX passent entre wallets externes."
    };
  }

  /*
   * Unknown.
   */

  return {
    type:
      "UNKNOWN",

    confidence:
      "LOW",

    reason:
      "Mouvement détecté mais nature économique non déterminable."
  };
}

/* =========================================================
   EXTERNAL ACTOR
========================================================= */

function getExternalActor(
  movement
) {
  const candidates =
    movement.tokenDeltas.filter(
      (delta) =>
        delta.actor ===
          "EXTERNAL" &&
        BigInt(
          delta.delta
        ) > 0n
    );

  if (
    candidates.length === 0
  ) {
    return null;
  }

  return (
    candidates[0].owner ||
    null
  );
}

/* =========================================================
   CONCURRENCY
========================================================= */

async function processInBatches(
  items,
  worker,
  batchSize
) {
  const results = [];

  for (
    let i = 0;
    i < items.length;
    i += batchSize
  ) {
    const batch =
      items.slice(
        i,
        i + batchSize
      );

    const batchResults =
      await Promise.all(
        batch.map(
          worker
        )
      );

    results.push(
      ...batchResults
    );
  }

  return results;
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
       1. MINT
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
            "Mint introuvable."
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
            "PROFITX_ACTIVITY",

          version:
            "2.0.0",

          mint,

          isToken2022:
            false,

          message:
            "Le mint n'utilise pas Token-2022."
        }
      );
    }

    /* =====================================================
       2. TOKEN ACCOUNTS
    ===================================================== */

    const tokenAccounts =
      await getTokenAccounts(
        rpcUrl,
        mint
      );

    /* =====================================================
       3. PUMP DATA
    ===================================================== */

    const pump =
      await getPumpCoin(
        mint
      );

    const model =
      buildPumpAddressModel(
        pump
      );

    /* =====================================================
       4. SIGNATURE DISCOVERY
    ===================================================== */

    const addressesToScan =
      new Set();

    /*
     * Token accounts
     */

    for (
      const account of
        tokenAccounts
    ) {
      addressesToScan.add(
        account.tokenAccount
      );
    }

    /*
     * Pump addresses
     *
     * We include the bonding curve
     * and its associated token account
     * so historical trade transactions
     * are easier to recover.
     */

    for (
      const address of
        model.bondingCurve
    ) {
      addressesToScan.add(
        address
      );
    }

    for (
      const address of
        model.creator
    ) {
      addressesToScan.add(
        address
      );
    }

    for (
      const address of
        model.pools
    ) {
      addressesToScan.add(
        address
      );
    }

    const signatureMap =
      new Map();

    for (
      const address of
        addressesToScan
    ) {
      const signatures =
        await getSignatures(
          rpcUrl,
          address
        );

      for (
        const signatureInfo of
          signatures
      ) {
        if (
          !signatureInfo?.signature
        ) {
          continue;
        }

        if (
          signatureInfo.err
        ) {
          continue;
        }

        signatureMap.set(
          signatureInfo.signature,
          {
            signature:
              signatureInfo.signature,

            slot:
              signatureInfo.slot,

            blockTime:
              signatureInfo.blockTime
          }
        );
      }
    }

    const signatures =
      Array.from(
        signatureMap.values()
      )
        .sort(
          (a, b) =>
            (b.blockTime || 0) -
            (a.blockTime || 0)
        )
        .slice(
          0,
          MAX_TRANSACTIONS
        );

    /* =====================================================
       5. TRANSACTIONS
    ===================================================== */

    const transactions =
      await processInBatches(
        signatures,

        async (item) => {
          try {
            const transaction =
              await getTransaction(
                rpcUrl,
                item.signature
              );

            return {
              ...item,

              transaction
            };
          } catch {
            return {
              ...item,

              transaction:
                null
            };
          }
        },

        MAX_CONCURRENT_TX
      );

    /* =====================================================
       6. MOVEMENTS
    ===================================================== */

    const movements = [];

    for (
      const item of transactions
    ) {
      const transaction =
        item.transaction;

      if (!transaction) {
        continue;
      }

      if (
        transaction.meta?.err
      ) {
        continue;
      }

      const deltas =
        getTokenDeltas(
          transaction,
          mint
        );

      if (
        deltas.length === 0
      ) {
        continue;
      }

      const classification =
        classifyMovement({
          deltas,

          model
        });

      const enrichedDeltas =
        deltas.map(
          (delta) => ({
            ...delta,

            actor:
              classifyOwner(
                delta.owner,
                delta.tokenAccount,
                model
              )
          })
        );

      const movement = {
        signature:
          item.signature,

        slot:
          item.slot,

        blockTime:
          item.blockTime,

        type:
          classification.type,

        confidence:
          classification.confidence,

        reason:
          classification.reason,

        tokenDeltas:
          enrichedDeltas
      };

      if (
        classification.type ===
        "BUY_PROBABLE"
      ) {
        movement.buyer =
          getExternalActor(
            movement
          );
      }

      movements.push(
        movement
      );
    }

    /* =====================================================
       7. COUNTERS
    ===================================================== */

    const buys =
      movements.filter(
        (item) =>
          item.type ===
          "BUY_PROBABLE"
      );

    const sells =
      movements.filter(
        (item) =>
          item.type ===
          "SELL_PROBABLE"
      );

    const transfers =
      movements.filter(
        (item) =>
          item.type ===
          "TRANSFER"
      );

    const creatorMovements =
      movements.filter(
        (item) =>
          item.type ===
          "CREATOR_MOVEMENT"
      );

    const poolMovements =
      movements.filter(
        (item) =>
          item.type ===
          "POOL_MOVEMENT"
      );

    const unknown =
      movements.filter(
        (item) =>
          item.type ===
          "UNKNOWN"
      );

    /* =====================================================
       8. UNIQUE EXTERNAL BUYERS
    ===================================================== */

    const buyers =
      new Set();

    for (
      const buy of buys
    ) {
      if (
        buy.buyer
      ) {
        buyers.add(
          buy.buyer
        );
      }
    }

    /* =====================================================
       9. UNIQUE EXTERNAL SELLERS
    ===================================================== */

    const sellers =
      new Set();

    for (
      const sell of sells
    ) {
      const candidates =
        sell.tokenDeltas.filter(
          (delta) =>
            delta.actor ===
              "EXTERNAL" &&
            BigInt(
              delta.delta
            ) < 0n
        );

      for (
        const candidate of
          candidates
      ) {
        if (
          candidate.owner
        ) {
          sellers.add(
            candidate.owner
          );
        }
      }
    }

    /* =====================================================
       10. BUYER HISTORY
    ===================================================== */

    const buyerHistory =
      Array.from(
        buyers
      ).map(
        (wallet) => ({
          wallet,

          buyCount:
            buys.filter(
              (buy) =>
                buy.buyer ===
                wallet
            ).length
        })
      );

    /* =====================================================
       11. LAST MOVEMENT
    ===================================================== */

    const sortedMovements =
      [...movements].sort(
        (a, b) =>
          (b.blockTime || 0) -
          (a.blockTime || 0)
      );

    const latest =
      sortedMovements[0] ||
      null;

    /* =====================================================
       12. RESULT
    ===================================================== */

    return json(
      res,
      200,
      {
        ok: true,

        module:
          "PROFITX_ACTIVITY",

        version:
          "2.0.0",

        timestamp:
          new Date().toISOString(),

        mint,

        tokenProgram:
          TOKEN_2022_PROGRAM_ID,

        pumpFun: {
          detected:
            Boolean(pump),

          complete:
            pump?.complete ??
            null,

          bondingCurve:
            pump?.bonding_curve ||
            null,

          associatedBondingCurve:
            pump?.associated_bonding_curve ||
            null,

          creator:
            pump?.creator ||
            null,

          pumpSwapPool:
            pump?.pump_swap_pool ||
            null,

          raydiumPool:
            pump?.raydium_pool ||
            null
        },

        analysis: {
          addressesScanned:
            addressesToScan.size,

          tokenAccounts:
            tokenAccounts.length,

          signaturesFound:
            signatures.length,

          transactionsFetched:
            transactions.filter(
              (item) =>
                item.transaction
            ).length,

          movementsDetected:
            movements.length
        },

        activity: {
          buysProbable:
            buys.length,

          sellsProbable:
            sells.length,

          transfers:
            transfers.length,

          creatorMovements:
            creatorMovements.length,

          poolMovements:
            poolMovements.length,

          unknown:
            unknown.length
        },

        participants: {
          uniqueExternalBuyers:
            buyers.size,

          uniqueExternalSellers:
            sellers.size,

          buyerHistory,

          creatorExcludedFromBuyers:
            true,

          poolsExcludedFromBuyers:
            true,

          bondingCurveExcludedFromBuyers:
            true
        },

        latestMovement:
          latest
            ? {
                type:
                  latest.type,

                confidence:
                  latest.confidence,

                signature:
                  latest.signature,

                slot:
                  latest.slot,

                blockTime:
                  latest.blockTime,

                buyer:
                  latest.buyer ||
                  null,

                reason:
                  latest.reason
              }
            : null,

        movements:
          movements.slice(
            0,
            50
          ),

        dataQuality: {
          tokenAccounts:
            tokenAccounts.length >
            0,

          signatures:
            signatures.length >
            0,

          transactions:
            transactions.length >
            0,

          activity:
            true,

          economicClassification:
            "HEURISTIC_ON_CHAIN",

          creatorExcluded:
            true,

          poolsExcluded:
            true,

          bondingCurveExcluded:
            true,

          noInventedValues:
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
          "PROFITX_ACTIVITY",

        version:
          "2.0.0",

        error:
          error?.message ||
          "Erreur pendant l'analyse de l'activité."
      }
    );
  }
}
