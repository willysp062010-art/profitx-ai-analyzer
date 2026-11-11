export default function MarketDataNotice({ market = {} }) {
  if (!market.pairAddress && !market.priceStatus) return null;
  const warning = market.priceStatus === "CONFLICTING_POOL_PRICES"
    ? "Prix divergents entre les pools consultés : le prix et la capitalisation sont affichés N/D. Les autres indicateurs restent ceux du périmètre indiqué."
    : market.priceStatus === "QUOTE_PRICE_UNAVAILABLE"
      ? "Le token apparaît en contrepartie de la paire : son prix et sa capitalisation ne sont pas vérifiés et restent N/D."
      : null;
  const sourceLabel = source => source === "sampled_transactions" ? "échantillon on-chain"
    : source === "selected_pair" ? "paire DexScreener sélectionnée" : "indisponible";
  return <div style={{ color: "#c8e7d8", fontSize: 13, lineHeight: 1.6, overflowWrap: "anywhere", marginTop: 12 }}>
    {market.pairAddress && <p>
      Paire retenue : {market.dexId || "DEX non précisé"} · {market.pairAddress}
    </p>}
    <p>Volume : {sourceLabel(market.volumeSource)}. Transactions : {sourceLabel(market.transactionsSource)}.
      Ces mesures ne couvrent pas nécessairement tous les échanges du token ; zéro dans ce périmètre ne prouve pas une inactivité globale.</p>
    {warning && <p role="status" style={{ color: "#ffd18b", borderLeft: "3px solid #d9a24c", paddingLeft: 12 }}>{warning}</p>}
  </div>;
}
