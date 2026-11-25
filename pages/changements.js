import Head from "next/head";
import { useEffect, useState } from "react";
import { ChangeEvidence } from "../components/TokenChanges";
import { readComparison } from "../utils/token-changes";

export default function ChangeReport() {
  const [report, setReport] = useState(undefined);
  useEffect(() => {
    function readLink() {
      const fragment = window.location.hash.slice(1);
      try {
        setReport(fragment.length <= 4096 ? readComparison(JSON.parse(decodeURIComponent(fragment))) : null);
      } catch {
        setReport(null);
      }
    }
    readLink();
    window.addEventListener("hashchange", readLink);
    return () => window.removeEventListener("hashchange", readLink);
  }, []);

  return (
    <main id="pfx-main-content" style={{ width: "min(720px, calc(100% - 32px))", margin: "32px auto" }}>
      <Head><title>Qu’est-ce qui a changé ? | PROFITX AI</title></Head>
      <h1>Qu’est-ce qui a changé ?</h1>
      {report ? <>
        <p>Copie l’adresse de cette page pour partager ces deux relevés. Les valeurs proviennent du lien partagé et peuvent être modifiées par son auteur.</p>
        <ChangeEvidence comparison={report} />
        <a href={`/?mint=${report[1].mint}`}>Relancer l’analyse du token</a>
      </> : report === null ? <p>Ce lien ne contient pas de comparaison valide.</p> : <p>Lecture du rapport…</p>}
    </main>
  );
}
