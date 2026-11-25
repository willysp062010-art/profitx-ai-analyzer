import Head from "next/head";
import Link from "next/link";
import { useEffect } from "react";
import { demoJourneyId, recordDemoEvent } from "../utils/demo-usage";
import { ChangeEvidence } from "../components/TokenChanges";
import { changeReportPath } from "../utils/token-changes";

const comparison = [
  {"mint":"DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263","at":"2026-11-25T14:17:07.210Z","pair":"5zpyutJu9ee6jFymDGoK7F6S5Kczqtc9FomP3ueKuyA9","liquidity":199939.39,"top10":36.23255937128201,"mintRevoked":true,"freezeRevoked":true},
  {"mint":"DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263","at":"2026-11-25T14:17:32.700Z","pair":"5zpyutJu9ee6jFymDGoK7F6S5Kczqtc9FomP3ueKuyA9","liquidity":199762.3,"top10":36.23255937128201,"mintRevoked":true,"freezeRevoked":true},
];
const mint = comparison[1].mint;

export default function RealExample() {
  useEffect(() => {
    recordDemoEvent(demoJourneyId({ create: true }), "demo_open");
  }, []);

  return (
    <main id="pfx-main-content" style={{ width: "min(720px, calc(100% - 32px))", margin: "32px auto" }}>
      <Head><title>Exemple réel sur BONK | PROFITX AI</title></Head>
      <h1>BONK · Qu’est-ce qui a changé ?</h1>
      <p>Deux relevés historiques de l’Analyzer sur la même paire Solana. Comparez ce qui a bougé et ce qui est resté stable.</p>
      <section className="panel" style={{ padding: 20, margin: "16px 0" }} aria-label="Comparaison des relevés BONK">
        <ChangeEvidence comparison={comparison} />
      </section>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <Link className="primaryButton" href={`/?mint=${mint}&analyze=1&from=demo`}>Analyser BONK maintenant</Link>
        <Link className="secondaryButton" href={`/alerts?mint=${mint}`}>Créer une alerte sur BONK</Link>
        <a className="secondaryButton" href={changeReportPath(comparison)}>Ouvrir le rapport partageable</a>
      </div>
    </main>
  );
}
