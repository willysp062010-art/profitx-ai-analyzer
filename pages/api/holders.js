const DEFAULT_RPC = "https://api.mainnet-beta.solana.com";

const PUMP_COIN_URL = "https://frontend-api-v3.pump.fun/coins-v2";
const RUGCHECK_URL = "https://api.rugcheck.xyz/v1/tokens";

const TOKEN_PROGRAM_ID =
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

const TOKEN_2022_PROGRAM_ID =
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

const REQUEST_TIMEOUT_MS = 15000;
const VERSION = "2.1.2";

const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/* =========================================================
   RESPONSE / VALIDATION
========================================================= */

function json(res, status, body) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  return res
    .status(status)
    .json(body);
}

function base58ToBytes(value) {
  if (
    typeof value !== "string" ||
    !value.length
  ) {
    return null;
  }

  let number = 0n;

  for (const char of value) {
    const index =
      BASE58_ALPHABET.indexOf(char);

    if (index < 0) {
      return null;
    }

    number =
      number * 58n +
      BigInt(index);
  }

  const decoded = [];

  while (number > 0n) {
    decoded.push(
      Number(number & 255n)
    );

    number >>= 8n;
  }

  decoded.reverse();

  let leadingZeroes = 0;

  while (
    leadingZeroes < value.length &&
    value[leadingZeroes] === "1"
  ) {
    leadingZeroes += 1;
  }

  return Uint8Array.from([
    ...new Array(
      leadingZeroes
    ).fill(0),
    ...decoded,
  ]);
}

function isValidSolanaAddress(value) {
  if (
    typeof value !== "string" ||
    !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(
      value
    )
  ) {
    return false;
  }

  const decoded =
    base58ToBytes(value);

  return Boolean(
    decoded &&
    decoded.length === 32
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
  if (
    typeof value !== "string"
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
      () =>
        controller.abort(),
      REQUEST_TIMEOUT_MS
    );

  try {
    const response =
      await fetch(
        url,
        {
          ...options,

          signal:
            controller.signal,

          headers: {
            Accept:
              "application/json",

            ...(options.headers || {}),
          },
        }
      );

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
            "application/json",
        },

        body:
          JSON.stringify({
            jsonrpc: "2.0",

            id:
              "profitx-holders-v2-1-2",

            method,
            params,
          }),
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

function extractMintFromObject(
  data
) {
  if (
    !data ||
    typeof data !== "object"
  ) {
    return null;
  }

  const candidates = [
    data.mint,
    data.tokenMint,
    data.token_mint,
    data.coinMint,
    data.coin_mint,
    data.address,
  ];

  for (
    const candidate of
    candidates
  ) {
    const address =
      normalizeAddress(
        candidate
      );

    if (address) {
      return address;
    }
  }

  return null;
}

async function getPumpCoin(
  mint
) {
  try {
    const response =
      await fetchJson(
        `${PUMP_COIN_URL}/${encodeURIComponent(
          mint
        )}`
      );

    const data =
      response?.data ||
      response;

    const returnedMint =
      extractMintFromObject(
        data
      );

    const verified =
      returnedMint === mint;

    return {
      ok: true,

      verified,

      returnedMint,

      data:
        verified
          ? data
          : null,
    };
  } catch {
    return {
      ok: false,

      verified: false,

      returnedMint: null,

      data: null,
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

    const reportedMint =
      extractMintFromObject(
        data
      );

    const identityValid =
      !reportedMint ||
      reportedMint === mint;

    return {
      ok:
        Boolean(
          data &&
          typeof data ===
            "object" &&
          identityValid
        ),

      identityValid,

      reportedMint,

      data:
        identityValid
          ? data
          : null,
    };
  } catch {
    return {
      ok: false,

      identityValid: false,

      reportedMint: null,

      data: null,
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

function bytesToBase58(bytes) {
  if (
    !bytes ||
    bytes.length === 0
  ) {
    return null;
  }

  let digits = [0];

  for (
    const byte of bytes
  ) {
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
    typeof raw === "object"
      ? raw
      : {};

  const returnedMint =
    extractMintFromObject(
      data
    );

  const identityVerified =
    returnedMint === mint;

  const safeData =
    identityVerified
      ? data
      : {};

  const bondingCurve =
    collectAddresses(
      safeData,
      [
        "bonding_curve",
        "bondingCurve",
      ]
    );

  const associatedBondingCurve =
    collectAddresses(
      safeData,
      [
        "associated_bonding_curve",
        "associatedBondingCurve",
      ]
    );

  const creator =
    collectAddresses(
      safeData,
      [
        "creator",
        "creator_address",
        "creatorAddress",
      ]
    );

  const pumpSwapPool =
    collectAddresses(
      safeData,
      [
        "pump_swap_pool",
        "pumpSwapPool",
        "pool",
        "pool_address",
        "poolAddress",
      ]
    );

  const raydiumPool =
    collectAddresses(
      safeData,
      [
        "raydium_pool",
        "raydiumPool",
        "raydium_pool_address",
      ]
    );

  const complete =
    typeof safeData
      .complete ===
      "boolean"
      ? safeData.complete
      : null;

  const detected =
    identityVerified &&
    (
      bondingCurve.size > 0 ||
      associatedBondingCurve
        .size > 0 ||
      creator.size > 0 ||
      pumpSwapPool.size > 0 ||
      raydiumPool.size > 0 ||
      complete !== null
    );

  return {
    mint,

    returnedMint,

    identityVerified,

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
      mint:
        returnedMint,

      bondingCurve:
        safeData
          .bonding_curve ??
        safeData
          .bondingCurve ??
        null,

      associatedBondingCurve:
        safeData
          .associated_bonding_curve ??
        safeData
          .associatedBondingCurve ??
        null,

      creator:
        safeData.creator ??
        safeData
          .creator_address ??
        safeData
          .creatorAddress ??
        null,

      pumpSwapPool:
        safeData
          .pump_swap_pool ??
        safeData
          .pumpSwapPool ??
        safeData.pool ??
        null,

      raydiumPool:
        safeData
          .raydium_pool ??
        safeData
          .raydiumPool ??
        null,

      complete:
        safeData.complete ??
        null,
    },
  };
}

/* =========================================================
   CLASSIFICATION
========================================================= */

function classifyAccount({
  tokenAccount,
  owner,
  pump,
}) {
  if (
    pump
      .associatedBondingCurve
      .includes(
        tokenAccount
      )
  ) {
    return "BONDING_CURVE";
  }

  if (
    pump
      .bondingCurve
      .includes(
        tokenAccount
      ) ||
    pump
      .bondingCurve
      .includes(
        owner
      )
  ) {
    return "BONDING_CURVE";
  }

  if (
    pump
      .pumpSwapPool
      .includes(
        tokenAccount
      ) ||
    pump
      .pumpSwapPool
      .includes(
        owner
      )
  ) {
    return "PUMPSWAP_POOL";
  }

  if (
    pump
      .raydiumPool
      .includes(
        tokenAccount
      ) ||
    pump
      .raydiumPool
      .includes(
        owner
      )
  ) {
    return "RAYDIUM_POOL";
  }

  if (
    pump
      .creator
      .includes(
        owner
      )
  ) {
    return "CREATOR";
  }

  return "EXTERNAL_HOLDER";
}

/* =========================================================
   EXACT RPC DISTRIBUTION
========================================================= */

async function exactRpcDistribution({
  rpcUrl,
  tokenProgram,
  mint,
  supply,
  pump,
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
                bytes: mint,
              },
            },
          ],

          dataSlice: {
            offset: 32,
            length: 40,
          },
        },
      ]
    );

  const rawAccounts =
    Array.isArray(
      accountsResult
    )
      ? accountsResult
      : [];

  if (
    supply > 0n &&
    rawAccounts.length === 0
  ) {
    throw new Error(
      "Scan RPC incomplet : aucun compte token observé pour une supply positive."
    );
  }

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

          pump,
        }),
    });
  }

  if (
    supply > 0n &&
    decodedAccounts
      .length === 0
  ) {
    throw new Error(
      "Scan RPC incomplet : aucun solde token non nul observé pour une supply positive."
    );
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
          0,
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
        holder.categories
          .has(
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
            holder.amount
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
              .tokenAccounts,
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
        ),

      totalTop1Percent:
        topHolders[0]
          ?.percentage ??
        null,

      totalTop5Percent:
        topHolders.length
          ? topHolders
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
              )
          : null,

      totalTop10Percent:
        topHolders.length
          ? topHolders
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
              )
          : null,
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
      0n,
  };
}

/* =========================================================
   RUGCHECK DISTRIBUTION

   RugCheck donne le nombre total de holders.
   Il ne prouve pas qu'ils sont tous "externes".

   Un totalHolders = 0 sans distribution n'est pas accepté
   comme un vrai zéro lorsque la supply est positive.
========================================================= */

function rugCheckDistribution(
  report,
  supply
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
      report
        .totalHolders ??
      report
        .total_holders
    );

  const rawTop =
    Array.isArray(
      report.topHolders
    )
      ? report.topHolders
      : Array.isArray(
          report
            .top_holders
        )
        ? report
            .top_holders
        : [];

  const top =
    rawTop
      .map(
        (holder) => {
          const pct =
            num(
              holder?.pct ??
              holder
                ?.percentage
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
                    holder
                      .amount
                  )
                : null,

            percentage:
              pct,

            uiAmount:
              num(
                holder
                  ?.uiAmount ??
                holder
                  ?.ui_amount
              ),
          };
        }
      )
      .filter(
        (holder) =>
          holder
            .percentage !==
          null
      )
      .sort(
        (a, b) =>
          b.percentage -
          a.percentage
      );

  if (
    totalHolders ===
      null &&
    top.length === 0
  ) {
    return null;
  }

  if (
    supply > 0n &&
    totalHolders === 0 &&
    top.length === 0
  ) {
    return null;
  }

  const totalTop1Percent =
    top[0]
      ?.percentage ??
    null;

  const totalTop5Percent =
    top.length
      ? top
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
          )
      : null;

  const totalTop10Percent =
    top.length
      ? top
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
          )
      : null;

  return {
    source:
      "rugcheck",

    tokenAccountsScanned:
      null,

    nonZeroTokenAccounts:
      null,

    uniqueOwners:
      totalHolders,

    externalHolders:
      null,

    distribution: {
      categories: [],

      externalTop1Percent:
        null,

      externalTop5Percent:
        null,

      externalTop10Percent:
        null,

      totalTop1Percent,

      totalTop5Percent,

      totalTop10Percent,
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
              holder
                .percentage,

            uiAmount:
              holder
                .uiAmount,

            categories:
              [],
          })
        ),

    complete:
      totalHolders !==
        null &&
      top.length > 0,
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
          "Méthode non autorisée.",
      }
    );
  }

  const mint =
    req.method === "GET"
      ? typeof req.query?.mint ===
        "string"
        ? req.query.mint.trim()
        : ""
      : typeof req.body?.mint ===
        "string"
        ? req.body.mint.trim()
        : "";

  if (!mint) {
    return json(
      res,
      400,
      {
        ok: false,

        error:
          "Adresse mint manquante.",
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

        module:
          "PROFITX_HOLDERS",

        version:
          VERSION,

        mint,

        error:
          "Adresse mint Solana invalide (32 octets requis).",
      }
    );
  }

  const rpcUrl =
    process.env
      .SOLANA_RPC_URL ||
    DEFAULT_RPC;

  try {
    /*
     * On vérifie d'abord que le compte existe.
     * Les autres appels ne démarrent qu'après cette validation.
     */

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
              "confirmed",
          },
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

          module:
            "PROFITX_HOLDERS",

          version:
            VERSION,

          mint,

          error:
            "Mint introuvable sur Solana.",
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
            "Programme de token non pris en charge.",
        }
      );
    }

    const [
      supplyResult,
      pumpResult,
      rugResult,
    ] =
      await Promise.all([
        rpcCall(
          rpcUrl,
          "getTokenSupply",
          [
            mint,
            {
              commitment:
                "confirmed",
            },
          ]
        ),

        getPumpCoin(
          mint
        ),

        getRugCheckReport(
          mint
        ),
      ]);

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
        supplyData.decimals ??
        0
      );

    const supplyUi =
      num(
        supplyData.uiAmount
      ) ??
      num(
        supplyData
          .uiAmountString
      );

    /*
     * La réponse Pump.fun ne peut être utilisée
     * que si son mint correspond réellement au mint demandé.
     */

    const pump =
      normalizePumpData(
        pumpResult.data,
        mint
      );

    let holdersData =
      null;

    let rpcExactError =
      null;

    let rugCheckRejected =
      false;

    /* =====================================================
       ROUTAGE v2.1.2

       TOKEN-2022 :
       RPC exact d'abord.

       SPL CLASSIQUE :
       RugCheck d'abord pour éviter les scans géants.

       Si RugCheck renvoie un faux zéro ou une réponse
       inexploitable, fallback vers le RPC exact.
    ===================================================== */

    if (
      isToken2022
    ) {
      try {
        holdersData =
          await exactRpcDistribution({
            rpcUrl,
            tokenProgram,
            mint,
            supply,
            pump,
          });
      } catch (
        error
      ) {
        rpcExactError =
          error?.message ||
          "Scan RPC exact indisponible.";
      }

      if (
        !holdersData &&
        rugResult.ok
      ) {
        holdersData =
          rugCheckDistribution(
            rugResult.data,
            supply
          );

        if (
          !holdersData
        ) {
          rugCheckRejected =
            true;
        }
      }
    } else {
      if (
        rugResult.ok
      ) {
        holdersData =
          rugCheckDistribution(
            rugResult.data,
            supply
          );

        if (
          !holdersData
        ) {
          rugCheckRejected =
            true;
        }
      }

      if (
        !holdersData
      ) {
        try {
          holdersData =
            await exactRpcDistribution({
              rpcUrl,
              tokenProgram,
              mint,
              supply,
              pump,
            });
        } catch (
          error
        ) {
          rpcExactError =
            error?.message ||
            "Scan RPC exact indisponible.";
        }
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
            rugCheckAvailable:
              rugResult.ok,

            rugCheckUsed:
              false,

            rugCheckRejected,

            rugCheckIdentityValid:
              rugResult
                .identityValid ??
              null,

            pumpApiAvailable:
              pumpResult.ok,

            pumpIdentityVerified:
              pump
                .identityVerified,

            pumpReturnedMint:
              pump
                .returnedMint,

            pumpDetected:
              pump.detected,

            rpcExactUsed:
              false,

            rpcExactError,
          },
        }
      );
    }

    const hasHolderCount =
      holdersData
        .uniqueOwners !==
      null;

    const hasDistribution =
      holdersData
        .distribution
        ?.externalTop1Percent !==
        null ||
      holdersData
        .distribution
        ?.externalTop10Percent !==
        null ||
      holdersData
        .distribution
        ?.totalTop1Percent !==
        null ||
      holdersData
        .distribution
        ?.totalTop10Percent !==
        null;

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
          holdersData.source,

        pumpFun: {
          detected:
            pump.detected,

          apiAvailable:
            pumpResult.ok,

          identityVerified:
            pump
              .identityVerified,

          returnedMint:
            pump
              .returnedMint,

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
              .sourceFields,
        },

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
            null,

          totalTop1Percent:
            holdersData
              .distribution
              ?.totalTop1Percent ??
            null,

          totalTop5Percent:
            holdersData
              .distribution
              ?.totalTop5Percent ??
            null,

          totalTop10Percent:
            holdersData
              .distribution
              ?.totalTop10Percent ??
            null,
        },

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

        topHolders:
          holdersData
            .topHolders,

        dataQuality: {
          supply:
            true,

          holders:
            hasHolderCount,

          distribution:
            hasDistribution,

          externalClassification:
            holdersData.source ===
            "rpc_exact",

          pumpFun:
            pump.detected,

          complete:
            holdersData.complete,

          source:
            holdersData.source,
        },

        diagnostics: {
          rugCheckAvailable:
            rugResult.ok,

          rugCheckUsed:
            holdersData.source ===
            "rugcheck",

          rugCheckRejected,

          rugCheckIdentityValid:
            rugResult
              .identityValid ??
            null,

          pumpApiAvailable:
            pumpResult.ok,

          pumpIdentityVerified:
            pump
              .identityVerified,

          pumpReturnedMint:
            pump
              .returnedMint,

          pumpDetected:
            pump.detected,

          rpcExactUsed:
            holdersData.source ===
            "rpc_exact",

          rpcExactError,
        },
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

        mint,

        error:
          error?.message ||
          "Erreur lors de l'analyse des holders.",
      }
    );
  }
}
