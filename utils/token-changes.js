import { isSolanaMint } from "./watchlist";

const amount = value => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
const flag = value => typeof value === "boolean" ? value : null;

export function readSnapshot(value) {
  if (!value || !isSolanaMint(value.mint) || typeof value.at !== "string" ||
      !Number.isFinite(Date.parse(value.at))) return null;
  const pair = isSolanaMint(value.pair) ? value.pair : null;
  const top10 = amount(value.top10);
  return {
    mint: value.mint,
    at: new Date(value.at).toISOString(),
    pair,
    liquidity: pair ? amount(value.liquidity) : null,
    top10: top10 !== null && top10 <= 100 ? top10 : null,
    mintRevoked: flag(value.mintRevoked),
    freezeRevoked: flag(value.freezeRevoked),
  };
}

export function analysisSnapshot(data) {
  const holders = data.modules?.holders;
  const security = data.modules?.security;
  return readSnapshot({
    mint: data.mint,
    at: data.timestamp,
    pair: data.source === "dexscreener" ? data.market?.pairAddress : null,
    liquidity: data.pair?.address === data.market?.pairAddress ? data.pair?.liquidityUsd : null,
    top10: holders?.totalTop10Percent ?? holders?.distribution?.totalTop10Percent,
    mintRevoked: security?.mintAuthorityRevoked,
    freezeRevoked: security?.freezeAuthorityRevoked,
  });
}

export function readComparison(values) {
  if (!Array.isArray(values) || values.length !== 2) return null;
  const [before, after] = values.map(readSnapshot);
  return before && after && before.mint === after.mint && before.at < after.at ? [before, after] : null;
}

export function changeReportPath(values) {
  const comparison = readComparison(values);
  return comparison ? "/changements#" + encodeURIComponent(JSON.stringify(comparison)) : null;
}
