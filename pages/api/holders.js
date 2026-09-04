const DEFAULT_RPC =
  "https://api.mainnet-beta.solana.com";

const PUMP_COIN_URL =
  "https://frontend-api-v3.pump.fun/coins-v2";

const RUGCHECK_URL =
  "https://api.rugcheck.xyz/v1/tokens";

const TOKEN_PROGRAM_ID =
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

const TOKEN_2022_PROGRAM_ID =
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

const REQUEST_TIMEOUT_MS = 15000;
const VERSION = "2.1.0";

/* =========================================================
   RESPONSE / VALIDATION
========================================================= */

function json(res, status, body) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader(
    "Content-Type",
    "application/json; charset=utf-8"
  );

  return res.status(status).json(body);
}

function isValidSolanaAddress(value) {
  return (
    typeof value === "string" &&
    /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)
  );
}

function num(value) {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value === "boolean"
  ) {
    return null;
  }

  const n = Number(value);

  return Number.isFinite(n)
    ? n
    : null;
}

function normalizeAddress(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return isValidSolanaAddress(trimmed)
    ? trimmed
    : null;
}

/* =========================================================
   FETCH / RPC
========================================================= */

async function fetchJson(
  url,
  options = {}
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
      await fetch(url, {
        ...options,

        signal:
          controller.signal,

        headers: {
          Accept:
            "application/json",

          ...(options.headers || {})
        }
      });

    const text =
      await response.text();

    let data = null;

    if (text) {
      try {
        data =
          JSON.parse(text);
      } catch {
        throw new Error(
          `Réponse JSON invalide (${response.status}).`
        );
      }
    }

    if (!response.ok) {
      throw new Error(
        data?.error ||
        data?.message ||
        `HTTP ${response.status}`
      );
    }

    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function rpcCall(
  rpcUrl,
  method,
  params
) {
  const data =
    await fetchJson(
      rpcUrl,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify({
            jsonrpc: "2.0",

            id:
              "profitx-holders-v2-1",

            method,

            params
          })
      }
    );

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
}

/* =========================================================
   EXTERNAL SOURCES
========================================================= */

async function getPumpCoin(
  mint
) {
  try {
    const data =
      await fetchJson(
        `${PUMP_COIN_URL}/${encodeURIComponent(
          mint
        )}`
      );

    return {
      ok: true,

      data:
        data?.data ||
        data
    };
  } catch {
    return {
      ok: false,
      data: null
    };
  }
}

async function getRugCheckReport(
  mint
) {
  try {
    const data =
      await fetchJson(
        `${RUGCHECK_URL}/${encodeURIComponent(
          mint
        )}/report`
      );

    return {
      ok:
        Boolean(
          data &&
          typeof data ===
            "object"
        ),

      data
    };
  } catch {
    return {
      ok: false,
      data: null
    };
  }
}

/* =========================================================
   BINARY HELPERS
========================================================= */

function base64ToBytes(
  base64
) {
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

const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function bytesToBase58(
  bytes
) {
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
        digits[i] *
          256 +
        carry;

      digits[i] =
        value % 58;

      carry =
        Math.floor(
          value / 58
        );
    }

    while (
      carry > 0
    ) {
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
      (
        8n *
        BigInt(i)
      );
  }

  return value;
}

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
    (
      amount *
      1000000n
    ) /
    supply;

  return (
    Number(scaled) /
    10000
  );
}

/* =========================================================
   PUMP NORMALIZATION
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
    const address =
      normalizeAddress(
        object[key]
      );

    if (address) {
      result.add(
        address
      );
    }
  }

  return result;
}

function normalizePumpData(
  raw,
  mint
) {
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

  const detected =
    bondingCurve.size > 0 ||
    associatedBondingCurve.size > 0 ||
    creator.size > 0 ||
    pumpSwapPool.size > 0 ||
    raydiumPool.size > 0 ||
    complete !== null;

  return {
    mint,

    detected,

    complete,

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
   ACCOUNT CLASSIFICATION
========================================================= */

function classifyAccount({
  tokenAccount,
  owner,
  pump
}) {
  if (
    pump
      .associatedBondingCurve
      .includes(
        tokenAccount
      )
  ) {
    return (
      "BONDING_CURVE"
    );
  }

  if (
    pump.bondingCurve.includes(
      tokenAccount
    ) ||
    pump.bondingCurve.includes(
      owner
    )
  ) {
    return (
      "BONDING_CURVE"
    );
  }

  if (
    pump.pumpSwapPool.includes(
      tokenAccount
    ) ||
    pump.pumpSwapPool.includes(
      owner
    )
  ) {
    return (
      "PUMPSWAP_POOL"
    );
  }

  if (
    pump.raydiumPool.includes(
      tokenAccount
    ) ||
    pump.raydiumPool.includes(
      owner
    )
  ) {
    return (
      "RAYDIUM_POOL"
    );
  }

  if (
    pump.creator.includes(
      owner
    )
  ) {
    return "CREATOR";
  }

  return (
    "EXTERNAL_HOLDER"
  );
}

/* =========================================================
   EXACT RPC SCAN
   Utilisé en priorité pour les tokens Pump.fun
========================================================= */

async function exactRpcDistribution({
  rpcUrl,
  tokenProgram,
  mint,
  supply,
  pump
}) {
  const accountsResult =
    await rpcCall(
      rpcUrl,
      "getProgramAccounts",
      [
        tokenProgram,
        {
          commitment:
            "confirmed",

          encoding:
            "base64",

          filters: [
            {
              memcmp: {
                offset: 0,

                bytes:
                  mint
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
      amount === null ||
      amount === 0n
    ) {
      continue;
    }

    decodedAccounts.push({
      tokenAccount:
        account.pubkey,

      owner,

      amount,

      category:
        classifyAccount({
          tokenAccount:
            account.pubkey,

          owner,

          pump
        })
    });
  }

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

          return (
            a.amount >
            b.amount
              ? -1
              : 1
          );
        }
      );

  const external =
    holders.filter(
      (holder) =>
        holder.categories.has(
          "EXTERNAL_HOLDER"
        )
    );

  const topHolders =
    holders
      .slice(
        0,
        20
      )
      .map(
        (
          holder,
          index
        ) => ({
          rank:
            index + 1,

          owner:
            holder.owner,

          amount:
            holder
              .amount
              .toString(),

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
            holder
              .tokenAccounts
        })
      );

  const externalTop1Percent =
    external[0]
      ? percentage(
          external[0]
            .amount,
          supply
        )
      : 0;

  const externalTop5Amount =
    external
      .slice(
        0,
        5
      )
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
      .slice(
        0,
        10
      )
      .reduce(
        (
          total,
          holder
        ) =>
          total +
          holder.amount,
        0n
      );

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

  return {
    source:
      "rpc_exact",

    tokenAccountsScanned:
      rawAccounts.length,

    nonZeroTokenAccounts:
      decodedAccounts.length,

    uniqueOwners:
      holders.length,

    externalHolders:
      external.length,

    distribution: {
      categories: [],

      externalTop1Percent,

      externalTop5Percent:
        percentage(
          externalTop5Amount,
          supply
        ),

      externalTop10Percent:
        percentage(
          externalTop10Amount,
          supply
        )
    },

    observedSupply:
      observedSupply
        .toString(),

    observedPercent:
      percentage(
        observedSupply,
        supply
      ),

    unobservedSupply:
      unobservedSupply
        .toString(),

    unobservedPercent:
      percentage(
        unobservedSupply,
        supply
      ),

    topHolders,

    complete:
      unobservedSupply ===
      0n
  };
}

/* =========================================================
   RUGCHECK DISTRIBUTION
   Adapté aux tokens possédant beaucoup de holders
========================================================= */

function rugCheckDistribution(
  report
) {
  if (
    !report ||
    typeof report !==
      "object"
  ) {
    return null;
  }

  const totalHolders =
    num(
      report.totalHolders ??
      report.total_holders
    );

  const rawTop =
    Array.isArray(
      report.topHolders
    )
      ? report.topHolders
      : Array.isArray(
          report.top_holders
        )
        ? report.top_holders
        : [];

  const top =
    rawTop
      .map(
        (holder) => {
          const pct =
            num(
              holder?.pct ??
              holder?.percentage
            );

          const owner =
            normalizeAddress(
              holder?.owner
            ) ||
            normalizeAddress(
              holder?.address
            ) ||
            null;

          return {
            owner,

            address:
              normalizeAddress(
                holder?.address
              ) ||
              null,

            amount:
              holder?.amount !==
                undefined &&
              holder?.amount !==
                null
                ? String(
                    holder.amount
                  )
                : null,

            percentage:
              pct,

            uiAmount:
              num(
                holder?.uiAmount ??
                holder?.ui_amount
              )
          };
        }
      )
      .filter(
        (holder) =>
          holder.percentage !==
          null
      )
      .sort(
        (a, b) =>
          b.percentage -
          a.percentage
      );

  if (
    totalHolders === null &&
    top.length === 0
  ) {
    return null;
  }

  const top1 =
    top[0]
      ?.percentage ??
    null;

  const top5 =
    top
      .slice(
        0,
        5
      )
      .reduce(
        (
          sum,
          holder
        ) =>
          sum +
          (
            holder
              .percentage ||
            0
          ),
        0
      );

  const top10 =
    top
      .slice(
        0,
        10
      )
      .reduce(
        (
          sum,
          holder
        ) =>
          sum +
          (
            holder
              .percentage ||
            0
          ),
        0
      );

  return {
    source:
      "rugcheck",

    tokenAccountsScanned:
      null,

    nonZeroTokenAccounts:
      null,

    uniqueOwners:
      totalHolders,

    /*
     * Pour un token non-Pump, les détenteurs
     * sont considérés comme externes au système
     * PROFITX/Pump.fun.
     */
    externalHolders:
      totalHolders,

    distribution: {
      categories: [],

      externalTop1Percent:
        top1,

      externalTop5Percent:
        top.length
          ? top5
          : null,

      externalTop10Percent:
        top.length
          ? top10
          : null
    },

    observedSupply:
      null,

    observedPercent:
      null,

    unobservedSupply:
      null,

    unobservedPercent:
      null,

    topHolders:
      top
        .slice(
          0,
          20
        )
        .map(
          (
            holder,
            index
          ) => ({
            rank:
              index + 1,

            owner:
              holder.owner,

            address:
              holder.address,

            amount:
              holder.amount,

            percentage:
              holder.percentage,

            uiAmount:
              holder.uiAmount,

            categories: [
              "EXTERNAL_HOLDER"
            ]
          })
        ),

    complete:
      totalHolders !==
        null &&
      top.length > 0
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

  const mint =
    req.method ===
      "GET"
      ? typeof req.query
          ?.mint ===
        "string"
        ? req.query.mint
            .trim()
        : ""
      : typeof req.body
          ?.mint ===
        "string"
        ? req.body.mint
            .trim()
        : "";

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
    process.env
      .SOLANA_RPC_URL ||
    DEFAULT_RPC;

  try {
    /*
     * On récupère en parallèle :
     * - le compte mint
     * - la supply
     * - Pump.fun
     * - RugCheck
     */

    const [
      mintResult,
      supplyResult,
      pumpResult,
      rugResult
    ] =
      await Promise.all([
        rpcCall(
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
        ),

        rpcCall(
          rpcUrl,
          "getTokenSupply",
          [
            mint,
            {
              commitment:
                "confirmed"
            }
          ]
        ),

        getPumpCoin(
          mint
        ),

        getRugCheckReport(
          mint
        )
      ]);

    const mintAccount =
      mintResult?.value ??
      null;

    if (!mintAccount) {
      return json(
        res,
        404,
        {
          ok: false,

          module:
            "PROFITX_HOLDERS",

          version:
            VERSION,

          mint,

          error:
            "Mint introuvable sur Solana."
        }
      );
    }

    const tokenProgram =
      mintAccount.owner;

    const isToken2022 =
      tokenProgram ===
      TOKEN_2022_PROGRAM_ID;

    const isClassicToken =
      tokenProgram ===
      TOKEN_PROGRAM_ID;

    if (
      !isToken2022 &&
      !isClassicToken
    ) {
      return json(
        res,
        200,
        {
          ok: false,

          module:
            "PROFITX_HOLDERS",

          version:
            VERSION,

          mint,

          tokenProgram,

          error:
            "Programme de token non pris en charge."
        }
      );
    }

    const supplyData =
      supplyResult?.value ??
      null;

    if (
      !supplyData ||
      typeof supplyData
        .amount !==
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
        supplyData
          .decimals ??
        0
      );

    const supplyUi =
      num(
        supplyData
          .uiAmount
      ) ??
      num(
        supplyData
          .uiAmountString
      );

    const pump =
      normalizePumpData(
        pumpResult.data,
        mint
      );

    let holdersData =
      null;

    let rpcExactError =
      null;

    /*
     * PFX / tokens Pump.fun :
     * priorité au scan on-chain exact.
     */

    if (
      pump.detected
    ) {
      try {
        holdersData =
          await exactRpcDistribution({
            rpcUrl,

            tokenProgram,

            mint,

            supply,

            pump
          });
      } catch (
        error
      ) {
        rpcExactError =
          error?.message ||
          "Scan RPC exact indisponible.";
      }
    }

    /*
     * Gros tokens :
     * RugCheck évite de charger tous
     * les comptes SPL dans Vercel.
     */

    if (
      !holdersData &&
      rugResult.ok
    ) {
      holdersData =
        rugCheckDistribution(
          rugResult.data
        );
    }

    /*
     * Dernier fallback pour un petit
     * token SPL non-Pump.
     */

    if (
      !holdersData &&
      !pump.detected
    ) {
      try {
        holdersData =
          await exactRpcDistribution({
            rpcUrl,

            tokenProgram,

            mint,

            supply,

            pump
          });
      } catch (
        error
      ) {
        rpcExactError =
          error?.message ||
          "Scan RPC exact indisponible.";
      }
    }

    if (
      !holdersData
    ) {
      return json(
        res,
        200,
        {
          ok: false,

          module:
            "PROFITX_HOLDERS",

          version:
            VERSION,

          timestamp:
            new Date()
              .toISOString(),

          mint,

          tokenProgram,

          isToken2022,

          tokenStandard:
            isToken2022
              ? "TOKEN_2022"
              : "SPL_TOKEN",

          error:
            "Données holders indisponibles.",

          diagnostics: {
            rugCheckUsed:
              false,

            rugCheckAvailable:
              rugResult.ok,

            pumpDetected:
              pump.detected,

            rpcExactError
          }
        }
      );
    }

    return json(
      res,
      200,
      {
        ok: true,

        module:
          "PROFITX_HOLDERS",

        version:
          VERSION,

        timestamp:
          new Date()
            .toISOString(),

        mint,

        tokenProgram,

        isToken2022,

        tokenStandard:
          isToken2022
            ? "TOKEN_2022"
            : "SPL_TOKEN",

        decimals,

        supply:
          supply
            .toString(),

        supplyUi,

        source:
          holdersData
            .source,

        /* -----------------------------------------------
           PUMP.FUN
        ----------------------------------------------- */

        pumpFun: {
          detected:
            pump.detected,

          apiAvailable:
            pumpResult.ok,

          complete:
            pump.complete,

          bondingCurve:
            pump
              .bondingCurve,

          associatedBondingCurve:
            pump
              .associatedBondingCurve,

          creator:
            pump.creator,

          pumpSwapPool:
            pump
              .pumpSwapPool,

          raydiumPool:
            pump
              .raydiumPool,

          sourceFields:
            pump
              .sourceFields
        },

        /* -----------------------------------------------
           HOLDERS
        ----------------------------------------------- */

        tokenAccountsScanned:
          holdersData
            .tokenAccountsScanned,

        nonZeroTokenAccounts:
          holdersData
            .nonZeroTokenAccounts,

        uniqueOwners:
          holdersData
            .uniqueOwners,

        externalHolders:
          holdersData
            .externalHolders,

        /* -----------------------------------------------
           DISTRIBUTION
        ----------------------------------------------- */

        distribution: {
          categories:
            holdersData
              .distribution
              ?.categories ??
            [],

          externalTop1Percent:
            holdersData
              .distribution
              ?.externalTop1Percent ??
            null,

          externalTop5Percent:
            holdersData
              .distribution
              ?.externalTop5Percent ??
            null,

          externalTop10Percent:
            holdersData
              .distribution
              ?.externalTop10Percent ??
            null
        },

        /* -----------------------------------------------
           OBSERVED SUPPLY
        ----------------------------------------------- */

        observedSupply:
          holdersData
            .observedSupply,

        observedPercent:
          holdersData
            .observedPercent,

        unobservedSupply:
          holdersData
            .unobservedSupply,

        unobservedPercent:
          holdersData
            .unobservedPercent,

        /* -----------------------------------------------
           TOP HOLDERS
        ----------------------------------------------- */

        topHolders:
          holdersData
            .topHolders,

        /* -----------------------------------------------
           DATA QUALITY
        ----------------------------------------------- */

        dataQuality: {
          supply:
            true,

          holders:
            holdersData
              .uniqueOwners !==
            null,

          distribution:
            holdersData
              .distribution
              ?.externalTop1Percent !==
              null ||
            holdersData
              .distribution
              ?.externalTop10Percent !==
              null,

          pumpFun:
            pump.detected,

          complete:
            holdersData
              .complete,

          source:
            holdersData
              .source
        },

        /* -----------------------------------------------
           DIAGNOSTICS
        ----------------------------------------------- */

        diagnostics: {
          rugCheckAvailable:
            rugResult.ok,

          rugCheckUsed:
            holdersData
              .source ===
            "rugcheck",

          pumpDetected:
            pump.detected,

          rpcExactUsed:
            holdersData
              .source ===
            "rpc_exact",

          rpcExactError
        }
      }
    );
  } catch (
    error
  ) {
    return json(
      res,
      500,
      {
        ok: false,

        module:
          "PROFITX_HOLDERS",

        version:
          VERSION,

        error:
          error?.message ||
          "Erreur lors de l'analyse des holders."
      }
    );
  }
}
