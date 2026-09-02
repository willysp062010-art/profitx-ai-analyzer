const DEFAULT_RPC =
  "https://api.mainnet-beta.solana.com";

const PUMP_COIN_URL =
  "https://frontend-api-v3.pump.fun/coins-v2";

const PUMP_SOL_PRICE_URL =
  "https://frontend-api-v3.pump.fun/sol-price";

const TOKEN_2022_PROGRAM_ID =
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

const REQUEST_TIMEOUT_MS = 12000;

const SIGNATURE_LIMIT = 50;

const MAX_TRANSACTIONS = 80;

const MAX_CONCURRENT_TX = 10;

const LAMPORTS_PER_SOL = 1000000000n;

const WINDOW_24H =
  24 * 60 * 60;

const WINDOW_7D =
  7 * 24 * 60 * 60;

const MAX_CONCURRENT_SIGNATURES = 8;

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
            id: "profitx-activity-v3",
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
   PUMP.FUN
========================================================= */

async function fetchJson(url) {
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
        url,
        {
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

async function getPumpCoin(mint) {
  return fetchJson(
    `${PUMP_COIN_URL}/${encodeURIComponent(
      mint
    )}`
  );
}

async function getSolPrice() {
  const data =
    await fetchJson(
      PUMP_SOL_PRICE_URL
    );

  if (
    typeof data === "number"
  ) {
    return data;
  }

  if (
    typeof data?.solPrice ===
    "number"
  ) {
    return data.solPrice;
  }

  if (
    typeof data?.price ===
    "number"
  ) {
    return data.price;
  }

  if (
    typeof data?.usd ===
    "number"
  ) {
    return data.usd;
  }

  return null;
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

  return accounts
    .map(
      (account) => {
        const encoded =
          account?.account
            ?.data?.[0];

        if (
          typeof encoded !==
          "string"
        ) {
          return null;
        }

        try {
          const bytes =
            Uint8Array.from(
              Buffer.from(
                encoded,
                "base64"
              )
            );

          if (
            bytes.length < 40
          ) {
            return null;
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

          return {
            tokenAccount:
              account.pubkey,

            owner,

            amount
          };
        } catch {
          return null;
        }
      }
    )
    .filter(Boolean);
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
            SIGNATURE_LIMIT,

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
   TRANSACTIONS
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

function getAccountKeyObjects(
  transaction
) {
  return (
    transaction
      ?.transaction
      ?.message
      ?.accountKeys || []
  );
}

function getAccountKeys(
  transaction
) {
  return getAccountKeyObjects(
    transaction
  ).map(
    (item) => {
      if (
        typeof item ===
        "string"
      ) {
        return item;
      }

      return (
        item?.pubkey ||
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
      pre.get(address);

    const after =
      post.get(address);

    const beforeAmount =
      before?.amount || 0n;

    const afterAmount =
      after?.amount || 0n;

    const delta =
      afterAmount -
      beforeAmount;

    if (
      delta === 0n
    ) {
      continue;
    }

    deltas.push({
      tokenAccount:
        address,

      owner:
        after?.owner ||
        before?.owner ||
        null,

      delta:
        delta.toString()
    });
  }

  return deltas;
}

/* =========================================================
   SOL BALANCE DELTAS
========================================================= */

function getSolDeltas(
  transaction
) {
  const pre =
    transaction?.meta
      ?.preBalances;

  const post =
    transaction?.meta
      ?.postBalances;

  const keys =
    getAccountKeys(
      transaction
    );

  if (
    !Array.isArray(pre) ||
    !Array.isArray(post)
  ) {
    return [];
  }

  const result = [];

  const length =
    Math.min(
      pre.length,
      post.length,
      keys.length
    );

  for (
    let i = 0;
    i < length;
    i++
  ) {
    const before =
      BigInt(
        pre[i] || 0
      );

    const after =
      BigInt(
        post[i] || 0
      );

    const delta =
      after - before;

    if (
      delta === 0n
    ) {
      continue;
    }

    result.push({
      address:
        keys[i],

      delta:
        delta.toString()
    });
  }

  return result;
}

/* =========================================================
   PUMP MODEL
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

function buildPumpModel(
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
   OWNER CLASSIFICATION
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

function classifyMovement(
  deltas,
  model
) {
  const enriched =
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

  const curveOut =
    enriched.some(
      (x) =>
        x.actor ===
          "BONDING_CURVE" &&
        BigInt(x.delta) < 0n
    );

  const curveIn =
    enriched.some(
      (x) =>
        x.actor ===
          "BONDING_CURVE" &&
        BigInt(x.delta) > 0n
    );

  const externalIn =
    enriched.some(
      (x) =>
        x.actor ===
          "EXTERNAL" &&
        BigInt(x.delta) > 0n
    );

  const externalOut =
    enriched.some(
      (x) =>
        x.actor ===
          "EXTERNAL" &&
        BigInt(x.delta) < 0n
    );

  const creatorIn =
    enriched.some(
      (x) =>
        x.actor ===
          "CREATOR" &&
        BigInt(x.delta) > 0n
    );

  const creatorOut =
    enriched.some(
      (x) =>
        x.actor ===
          "CREATOR" &&
        BigInt(x.delta) < 0n
    );

  const poolIn =
    enriched.some(
      (x) =>
        x.actor ===
          "POOL" &&
        BigInt(x.delta) > 0n
    );

  const poolOut =
    enriched.some(
      (x) =>
        x.actor ===
          "POOL" &&
        BigInt(x.delta) < 0n
    );

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
        "Le créateur intervient dans le mouvement."
    };
  }

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
        "Un pool intervient dans le mouvement."
    };
  }

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

  return {
    type:
      "UNKNOWN",

    confidence:
      "LOW",

    reason:
      "Mouvement détecté mais nature économique indéterminée."
  };
}

/* =========================================================
   EXTERNAL BUYER
========================================================= */

function getBuyer(
  deltas
) {
  const candidate =
    deltas.find(
      (x) =>
        x.actor ===
          "EXTERNAL" &&
        BigInt(x.delta) > 0n
    );

  return (
    candidate?.owner ||
    null
  );
}

/* =========================================================
   EXTERNAL SELLER
========================================================= */

function getSeller(
  deltas
) {
  const candidate =
    deltas.find(
      (x) =>
        x.actor ===
          "EXTERNAL" &&
        BigInt(x.delta) < 0n
    );

  return (
    candidate?.owner ||
    null
  );
}

/* =========================================================
   TOKEN AMOUNT
========================================================= */

function getExternalTokenAmount(
  deltas,
  direction
) {
  const external =
    deltas.filter(
      (x) =>
        x.actor ===
        "EXTERNAL"
    );

  if (
    external.length === 0
  ) {
    return 0n;
  }

  let total = 0n;

  for (
    const item of external
  ) {
    const delta =
      BigInt(item.delta);

    if (
      direction === "IN" &&
      delta > 0n
    ) {
      total += delta;
    }

    if (
      direction === "OUT" &&
      delta < 0n
    ) {
      total += -delta;
    }
  }

  return total;
}

/* =========================================================
   SOL AMOUNT
========================================================= */

function getCurveSolMovement(
  transaction,
  model,
  type
) {
  const solDeltas =
    getSolDeltas(
      transaction
    );

  let total = 0n;

  for (
    const item of solDeltas
  ) {
    const address =
      item.address;

    const delta =
      BigInt(item.delta);

    if (
      !model.bondingCurve.has(
        address
      )
    ) {
      continue;
    }

    if (
      type ===
        "BUY_PROBABLE" &&
      delta > 0n
    ) {
      total += delta;
    }

    if (
      type ===
        "SELL_PROBABLE" &&
      delta < 0n
    ) {
      total += -delta;
    }
  }

  return total;
}

/* =========================================================
   NUMBER FORMAT
========================================================= */

function bigintToDecimal(
  value,
  decimals
) {
  const negative =
    value < 0n;

  const absolute =
    negative
      ? -value
      : value;

  const text =
    absolute
      .toString()
      .padStart(
        decimals + 1,
        "0"
      );

  const split =
    text.length -
    decimals;

  const result =
    `${text.slice(
      0,
      split
    )}.${text.slice(
      split
    )}`;

  return negative
    ? `-${result}`
    : result;
}

function round(
  value,
  decimals = 2
) {
  if (
    typeof value !==
      "number" ||
    !Number.isFinite(value)
  ) {
    return null;
  }

  const factor =
    10 ** decimals;

  return (
    Math.round(
      value * factor
    ) / factor
  );
}

/* =========================================================
   CONCURRENCY
========================================================= */

async function processBatches(
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

    const output =
      await Promise.all(
        batch.map(worker)
      );

    results.push(
      ...output
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
  } else {
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

    const mintInfo =
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

    if (
      !mintInfo?.value
    ) {
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
      mintInfo.value.owner !==
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
            "3.0.0",

          mint,

          isToken2022:
            false
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
       3. PUMP
    ===================================================== */

    const pump =
      await getPumpCoin(
        mint
      );

    const model =
      buildPumpModel(
        pump
      );

    /* =====================================================
       4. SOL PRICE
    ===================================================== */

    const solPrice =
      await getSolPrice();

    /* =====================================================
       5. ADDRESSES
    ===================================================== */

    const addresses =
      new Set();

    for (
      const account of
        tokenAccounts
    ) {
      addresses.add(
        account.tokenAccount
      );
    }

    for (
      const address of
        model.bondingCurve
    ) {
      addresses.add(
        address
      );
    }

    for (
      const address of
        model.creator
    ) {
      addresses.add(
        address
      );
    }

    for (
      const address of
        model.pools
    ) {
      addresses.add(
        address
      );
    }

    /* =====================================================
       6. SIGNATURES
    ===================================================== */

    const signatureMap =
      new Map();

    const signatureResults =
      await processBatches(
        Array.from(addresses),

        async (address) => {
          try {
            return await getSignatures(
              rpcUrl,
              address
            );
          } catch {
            return [];
          }
        },

        MAX_CONCURRENT_SIGNATURES
      );

    for (
      const signaturesForAddress of
        signatureResults
    ) {
      for (
        const item of signaturesForAddress
      ) {
        if (
          !item?.signature ||
          item.err
        ) {
          continue;
        }

        signatureMap.set(
          item.signature,
          {
            signature:
              item.signature,

            slot:
              item.slot,

            blockTime:
              item.blockTime
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
       7. FETCH TRANSACTIONS
    ===================================================== */

    const fetched =
      await processBatches(
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
       8. BUILD MOVEMENTS
    ===================================================== */

    const movements = [];

    for (
      const item of fetched
    ) {
      const transaction =
        item.transaction;

      if (
        !transaction ||
        transaction.meta?.err
      ) {
        continue;
      }

      const tokenDeltas =
        getTokenDeltas(
          transaction,
          mint
        );

      if (
        tokenDeltas.length === 0
      ) {
        continue;
      }

      const classification =
        classifyMovement(
          tokenDeltas,
          model
        );

      const classified =
        tokenDeltas.map(
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
          classified
      };

      if (
        classification.type ===
        "BUY_PROBABLE"
      ) {
        movement.buyer =
          getBuyer(
            classified
          );

        const tokenAmount =
          getExternalTokenAmount(
            classified,
            "IN"
          );

        const solAmount =
          getCurveSolMovement(
            transaction,
            model,
            "BUY_PROBABLE"
          );

        movement.tokenAmountRaw =
          tokenAmount.toString();

        movement.solAmount =
          Number(
            solAmount
          ) /
          Number(
            LAMPORTS_PER_SOL
          );

        movement.volumeUsd =
          solPrice !== null
            ? round(
                movement.solAmount *
                  solPrice,
                2
              )
            : null;
      }

      if (
        classification.type ===
        "SELL_PROBABLE"
      ) {
        movement.seller =
          getSeller(
            classified
          );

        const tokenAmount =
          getExternalTokenAmount(
            classified,
            "OUT"
          );

        const solAmount =
          getCurveSolMovement(
            transaction,
            model,
            "SELL_PROBABLE"
          );

        movement.tokenAmountRaw =
          tokenAmount.toString();

        movement.solAmount =
          Number(
            solAmount
          ) /
          Number(
            LAMPORTS_PER_SOL
          );

        movement.volumeUsd =
          solPrice !== null
            ? round(
                movement.solAmount *
                  solPrice,
                2
              )
            : null;
      }

      movements.push(
        movement
      );
    }

    /* =====================================================
       9. TIME
    ===================================================== */

    const now =
      Math.floor(
        Date.now() / 1000
      );

    const cutoff24h =
      now - WINDOW_24H;

    const cutoff7d =
      now - WINDOW_7D;

    const validTimedMovements =
      movements.filter(
        (item) =>
          Number.isFinite(
            Number(
              item.blockTime
            )
          )
      );

    const last24h =
      validTimedMovements.filter(
        (item) =>
          Number(
            item.blockTime
          ) >= cutoff24h
      );

    const last7d =
      validTimedMovements.filter(
        (item) =>
          Number(
            item.blockTime
          ) >= cutoff7d
      );

    /* =====================================================
       10. ECONOMIC MOVEMENTS
    ===================================================== */

    const isEconomic =
      (item) =>
        item.type ===
          "BUY_PROBABLE" ||
        item.type ===
          "SELL_PROBABLE";

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
       11. UNIQUE PARTICIPANTS
    ===================================================== */

    const buyers =
      new Set();

    for (
      const item of buys
    ) {
      if (
        item.buyer
      ) {
        buyers.add(
          item.buyer
        );
      }
    }

    const sellers =
      new Set();

    for (
      const item of sells
    ) {
      if (
        item.seller
      ) {
        sellers.add(
          item.seller
        );
      }
    }

    /* =====================================================
       12. VOLUME
    ===================================================== */

    function calculateVolume(
      list
    ) {
      const economic =
        list.filter(
          isEconomic
        );

      let volumeSol = 0;

      let volumeUsd = 0;

      let volumeUsdKnown =
        true;

      for (
        const item of economic
      ) {
        if (
          Number.isFinite(
            item.solAmount
          )
        ) {
          volumeSol +=
            item.solAmount;
        }

        if (
          Number.isFinite(
            item.volumeUsd
          )
        ) {
          volumeUsd +=
            item.volumeUsd;
        } else {
          volumeUsdKnown =
            false;
        }
      }

      return {
        transactions:
          economic.length,

        buys:
          list.filter(
            (item) =>
              item.type ===
              "BUY_PROBABLE"
          ).length,

        sells:
          list.filter(
            (item) =>
              item.type ===
              "SELL_PROBABLE"
          ).length,

        volumeSol:
          round(
            volumeSol,
            6
          ),

        volumeUsd:
          economic.length === 0
            ? 0
            : volumeUsdKnown
              ? round(
                  volumeUsd,
                  2
                )
              : null,

        volumeUsdStatus:
          economic.length === 0
            ? "ZERO_ACTIVITY"
            : volumeUsdKnown
              ? "ESTIMATED"
              : "N/D"
      };
    }

    const volume24h =
      calculateVolume(
        last24h
      );

    const volume7d =
      calculateVolume(
        last7d
      );

    const volumeObserved =
      calculateVolume(
        movements
      );

    /* =====================================================
       13. BUYER HISTORY
    ===================================================== */

    const buyerHistory =
      Array.from(
        buyers
      ).map(
        (wallet) => ({
          wallet,

          buyCount:
            buys.filter(
              (item) =>
                item.buyer ===
                wallet
            ).length
        })
      );

    /* =====================================================
       14. LAST ACTIVITY
    ===================================================== */

    const sorted =
      [...movements].sort(
        (a, b) =>
          (b.blockTime || 0) -
          (a.blockTime || 0)
      );

    const latest =
      sorted[0] || null;

    /* =====================================================
       15. ACTIVITY STATUS
    ===================================================== */

    let activityStatus =
      "NO_ACTIVITY";

    if (
      last24h.length > 0
    ) {
      activityStatus =
        "ACTIVE_24H";
    } else if (
      last7d.length > 0
    ) {
      activityStatus =
        "ACTIVE_7D";
    } else if (
      movements.length > 0
    ) {
      activityStatus =
        "HISTORICAL_ACTIVITY";
    }

    /* =====================================================
       16. RESULT
    ===================================================== */

    return json(
      res,
      200,
      {
        ok: true,

        module:
          "PROFITX_ACTIVITY",

        version:
          "3.0.0",

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

        marketData: {
          solPriceUsd:
            solPrice,

          solPriceStatus:
            solPrice !== null
              ? "AVAILABLE"
              : "N/D"
        },

        analysis: {
          addressesScanned:
            addresses.size,

          tokenAccounts:
            tokenAccounts.length,

          signaturesFound:
            signatures.length,

          transactionsFetched:
            fetched.filter(
              (item) =>
                item.transaction
            ).length,

          movementsDetected:
            movements.length,

          activityStatus
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

        volume: {
          last24h:
            volume24h,

          last7d:
            volume7d,

          observed:
            volumeObserved
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

                blockTime:
                  latest.blockTime,

                buyer:
                  latest.buyer ||
                  null,

                seller:
                  latest.seller ||
                  null,

                volumeSol:
                  latest.solAmount ??
                  null,

                volumeUsd:
                  latest.volumeUsd ??
                  null
              }
            : null,

        movements:
          movements
            .slice(0, 50),

        dataQuality: {
          tokenAccounts:
            tokenAccounts.length >
            0,

          signatures:
            signatures.length >
            0,

          transactions:
            fetched.length >
            0,

          activity:
            true,

          volume24h:
            true,

          volume7d:
            true,

          economicClassification:
            "HEURISTIC_ON_CHAIN",

          volumeUsdMethod:
            "SOL_BALANCE_DELTA_X_CURRENT_SOL_PRICE",

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
          "3.0.0",

        error:
          error?.message ||
          "Erreur pendant l'analyse."
      }
    );
  }
}
