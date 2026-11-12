import { nonNegativeObservation as value } from "../../utils/observed-number";
const POOL_ID = "8xezT7zFCg3adVTyME72qiA42upJdy8SATFyhZJcX9jb";
const PFX_MINT = "6FwDVfnnETqUe2UrxZEeLA6u7Vo5Td2Nm79z7s38pump";
const WSOL_MINT = "So11111111111111111111111111111111111111112";
const RAYDIUM_API = "https://api-v3.raydium.io/pools/info/ids?ids=" + POOL_ID;
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "GET uniquement" });
  }
  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
  try {
    const response = await fetch(RAYDIUM_API, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(9000)
    });
    if (!response.ok) throw Error("Raydium HTTP " + response.status);
    const payload = await response.json();
    const pool = Array.isArray(payload?.data) ? payload.data.find(item => item?.id === POOL_ID) : null;
    if (!payload?.success || !pool) throw Error("Pool absente de Raydium");
    const mintA = pool?.mintA?.address;
    const mintB = pool?.mintB?.address;
    if (!((mintA === WSOL_MINT && mintB === PFX_MINT) ||
      (mintB === WSOL_MINT && mintA === PFX_MINT))) {
      throw Error("La paire ne correspond pas aux mints attendus");
    }
    const solFirst = mintA === WSOL_MINT;
    return res.status(200).json({
      ok: true,
      source: "Raydium API v3 (données indicatives, possiblement différées)",
      checkedAt: new Date().toISOString(),
      poolId: POOL_ID,
      pfxMint: PFX_MINT,
      tokenPair: "PFX/WSOL",
      type: pool.type === "Standard" ? "Standard CPMM" : String(pool.type || "N/D"),
      tvlUsd: value(pool.tvl),
      solReserve: value(solFirst ? pool.mintAmountA : pool.mintAmountB),
      pfxReserve: value(solFirst ? pool.mintAmountB : pool.mintAmountA),
      volume24hUsd: value(pool?.day?.volume),
      feeRate: value(pool.feeRate),
      liquidityUrl: "https://raydium.io/liquidity/increase/?mode=add&pool_id=" + POOL_ID,
      poolExplorerUrl: "https://solscan.io/account/" + POOL_ID,
      note: "Pool identifiée par son adresse et les deux mints. N'atteste ni audit, ni prix garanti, ni possibilité de revente."
    });
  } catch (err) {
    console.error("PFX Raydium pool:", err.message);
    return res.status(502).json({ ok: false, error: "Données Raydium indisponibles pour le moment" });
  }
}