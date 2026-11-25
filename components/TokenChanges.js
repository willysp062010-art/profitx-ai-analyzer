import { useEffect, useState } from "react";
import { analysisSnapshot, changeReportPath, readComparison, readSnapshot } from "../utils/token-changes";

const number = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const date = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "medium", timeZone: "UTC" });
const missing = "Impossible à vérifier";
const formatAuthority = revoked => revoked ? "Révoquée" : "Active";

export function ChangeEvidence({ comparison }) {
  const [before, after] = comparison;
  const samePair = before.pair && before.pair === after.pair;
  const rows = [
    ["Liquidité de la paire", before.liquidity, after.liquidity, value => number.format(value) + " USD",
      samePair
        ? <a href={`https://dexscreener.com/solana/${after.pair}`}>Voir la paire sur DexScreener</a>
        : "Comparaison suspendue : paire différente ou inconnue."],
    ["Concentration totale des 10 principaux détenteurs", before.top10, after.top10,
      value => number.format(value) + " %", "Une hausse indique une concentration plus élevée."],
    ["Autorité de création", before.mintRevoked, after.mintRevoked, formatAuthority,
      "Une autorité active peut augmenter l’offre."],
    ["Autorité de gel", before.freezeRevoked, after.freezeRevoked, formatAuthority,
      "Une autorité active peut geler des comptes de jetons."],
  ];

  return (
    <div>
      <p style={{ overflowWrap: "anywhere" }}>
        Mint Solana · <a href={`https://solscan.io/token/${after.mint}`}>{after.mint}</a>
      </p>
      <p>Avant · {date.format(new Date(before.at))} UTC<br />Après · {date.format(new Date(after.at))} UTC</p>
      <dl>
        {rows.map(([label, first, last, format, detail], index) => (
          <div key={label} style={{ marginBottom: 14 }}>
            <dt><strong>{label}</strong></dt>
            <dd style={{ marginLeft: 0 }}>
              {first === null ? missing : format(first)} → {last === null ? missing : format(last)}
              {first !== null && last !== null && (index !== 0 || samePair) && (
                first === last ? " · Stable"
                  : index === 0 && first > 0 ? ` · ${number.format((last / first - 1) * 100)} %`
                  : index === 1 ? ` · ${number.format(last - first)} points` : " · Changé"
              )}
              <br />{detail}
            </dd>
          </div>
        ))}
      </dl>
      <p>Sources des relevés · DexScreener pour la liquidité et données Solana pour les détenteurs et autorités. Les liens de source affichent les données disponibles au moment de leur consultation.</p>
    </div>
  );
}

export default function TokenChanges({ analysis }) {
  const [saved, setSaved] = useState(null);

  useEffect(() => {
    const next = analysisSnapshot(analysis);
    if (!next) return;
    const key = "pfx-token-changes-v1:" + next.mint;
    let previous = null;
    let available = true;
    try {
      const record = JSON.parse(localStorage.getItem(key) ?? "null");
      const latest = readSnapshot(record?.latest);
      if (latest?.mint === next.mint && latest.at >= next.at) {
        previous = latest.at === next.at ? readSnapshot(record?.previous) : null;
      } else {
        previous = latest?.mint === next.mint ? latest : null;
        localStorage.setItem(key, JSON.stringify({ latest: next, previous }));
      }
    } catch {
      available = false;
    }
    setSaved({ at: next.at, available, comparison: readComparison([previous, next]) });
  }, [analysis]);

  if (!saved) return null;
  const path = changeReportPath(saved.comparison);
  return (
    <section className="panel" id="changements" style={{ padding: 20, margin: "16px 0" }}>
      <h2>Qu’est-ce qui a changé ?</h2>
      {saved.comparison ? <>
        <ChangeEvidence comparison={saved.comparison} />
        <a className="secondaryButton" href={path}>Ouvrir le rapport partageable</a>
      </> : <p>{saved.available
        ? "La comparaison s’affichera après deux relevés successifs de ce token dans ce navigateur."
        : "L’historique local est indisponible dans ce navigateur."}</p>}
    </section>
  );
}
