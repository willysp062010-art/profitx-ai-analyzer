import { useState } from "react";
import Head from "next/head";

const DEFAULT_MINT =
  "6FwDVfnnETqUe2UrxZEeLA6u7Vo5Td2Nm79z7s38pump";

export default function IntelligenceTest() {
  const [mint, setMint] = useState(DEFAULT_MINT);
  const [analyzer, setAnalyzer] = useState(null);
  const [intelligence, setIntelligence] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function runTest() {
    setLoading(true);
    setError("");
    setAnalyzer(null);
    setIntelligence(null);

    try {
      const cleanMint = mint.trim();

      if (!cleanMint) {
        throw new Error("Mint manquant.");
      }

      // 1. Analyse normale PROFITX
      const analyzerResponse = await fetch(
        `/api/analyze?mint=${encodeURIComponent(cleanMint)}`
      );

      const analyzerData = await analyzerResponse.json();

      if (!analyzerResponse.ok || analyzerData?.ok !== true) {
        throw new Error(
          analyzerData?.error ||
            "L'Analyzer PROFITX n'a pas retourné une analyse valide."
        );
      }

      setAnalyzer(analyzerData);

      // 2. Envoi du résultat complet vers PFX Intelligence
      const intelligenceResponse = await fetch(
        "/api/intelligence",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            analyzer: analyzerData
          })
        }
      );

      const intelligenceData =
        await intelligenceResponse.json();

      if (
        !intelligenceResponse.ok ||
        intelligenceData?.ok !== true
      ) {
        throw new Error(
          intelligenceData?.error ||
            "PFX Intelligence n'a pas retourné de résultat valide."
        );
      }

      setIntelligence(intelligenceData);
    } catch (err) {
      setError(
        err?.message ||
          "Erreur inconnue pendant le test."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>PFX Intelligence Test</title>
      </Head>

      <main className="page">
        <section className="panel">
          <div className="brand">
            PROFITX <span>AI</span>
          </div>

          <div className="badge">
            PFX INTELLIGENCE V1 • TEST
          </div>

          <h1>
            Test du moteur
            <br />
            PFX Intelligence
          </h1>

          <p className="intro">
            Cette page exécute d'abord PROFITX Analyzer,
            puis transmet son résultat à PFX Intelligence.
          </p>

          <div className="form">
            <label htmlFor="mint">
              Mint Solana
            </label>

            <input
              id="mint"
              value={mint}
              onChange={(event) =>
                setMint(event.target.value)
              }
              placeholder="Adresse du token Solana"
              spellCheck="false"
            />

            <button
              onClick={runTest}
              disabled={loading}
            >
              {loading
                ? "Analyse en cours..."
                : "Tester PFX Intelligence"}
            </button>
          </div>

          {error && (
            <div className="error">
              <strong>ERREUR</strong>
              <p>{error}</p>
            </div>
          )}

          {intelligence && (
            <section className="result">
              <div className="success">
                ✓ PFX Intelligence répond correctement
              </div>

              <h2>Synthèse</h2>
              <p>
                {intelligence?.intelligence?.summary ||
                  "N/D"}
              </p>

              <h2>Lecture économique</h2>
              <p>
                {intelligence?.intelligence
                  ?.economicReading || "N/D"}
              </p>

              <h2>Points solides</h2>

              {intelligence?.intelligence?.strengths
                ?.length ? (
                <ul>
                  {intelligence.intelligence.strengths.map(
                    (item, index) => (
                      <li key={index}>
                        {item.text}
                      </li>
                    )
                  )}
                </ul>
              ) : (
                <p>Aucun point solide identifié.</p>
              )}

              <h2>Points à surveiller</h2>

              {intelligence?.intelligence?.watchPoints
                ?.length ? (
                <ul>
                  {intelligence.intelligence.watchPoints.map(
                    (item, index) => (
                      <li key={index}>
                        {item.text}
                      </li>
                    )
                  )}
                </ul>
              ) : (
                <p>
                  Aucun point particulier identifié.
                </p>
              )}

              <h2>Conclusion</h2>
              <p>
                {intelligence?.intelligence?.conclusion ||
                  "N/D"}
              </p>

              <h2>Scores reçus</h2>

              <pre>
                {JSON.stringify(
                  intelligence?.scores,
                  null,
                  2
                )}
              </pre>

              <details>
                <summary>
                  Voir la réponse PFX Intelligence complète
                </summary>

                <pre>
                  {JSON.stringify(
                    intelligence,
                    null,
                    2
                  )}
                </pre>
              </details>

              <details>
                <summary>
                  Voir la réponse Analyzer source
                </summary>

                <pre>
                  {JSON.stringify(
                    analyzer,
                    null,
                    2
                  )}
                </pre>
              </details>
            </section>
          )}
        </section>

        <style jsx>{`
          * {
            box-sizing: border-box;
          }

          .page {
            min-height: 100vh;
            padding: 40px 20px;
            background:
              radial-gradient(
                circle at top,
                #10251c 0%,
                #050706 40%,
                #020302 100%
              );
            color: #f5f7f6;
            font-family:
              Arial,
              Helvetica,
              sans-serif;
          }

          .panel {
            width: 100%;
            max-width: 980px;
            margin: 0 auto;
            padding: 32px;
            border: 1px solid #1d3328;
            border-radius: 22px;
            background: rgba(5, 9, 7, 0.96);
            box-shadow:
              0 20px 80px rgba(0, 0, 0, 0.45);
          }

          .brand {
            font-size: 24px;
            font-weight: 900;
            letter-spacing: 1px;
          }

          .brand span {
            color: #00ff88;
          }

          .badge {
            display: inline-block;
            margin-top: 22px;
            padding: 7px 11px;
            border: 1px solid #00ff88;
            border-radius: 999px;
            color: #00ff88;
            font-size: 12px;
            font-weight: 800;
          }

          h1 {
            margin: 22px 0 10px;
            font-size: clamp(
              34px,
              7vw,
              62px
            );
            line-height: 0.98;
          }

          .intro {
            max-width: 680px;
            color: #aeb9b3;
            line-height: 1.6;
          }

          .form {
            display: grid;
            gap: 10px;
            margin-top: 30px;
          }

          label {
            color: #aeb9b3;
            font-size: 13px;
            font-weight: 700;
          }

          input {
            width: 100%;
            padding: 15px;
            border: 1px solid #304039;
            border-radius: 10px;
            background: #080c0a;
            color: white;
            outline: none;
            font-family: monospace;
          }

          input:focus {
            border-color: #00ff88;
          }

          button {
            min-height: 48px;
            padding: 12px 18px;
            border: 1px solid #00ff88;
            border-radius: 10px;
            background: #00ff88;
            color: #021108;
            font-weight: 900;
            cursor: pointer;
          }

          button:disabled {
            opacity: 0.55;
            cursor: wait;
          }

          .error {
            margin-top: 25px;
            padding: 18px;
            border: 1px solid #7a2929;
            border-radius: 12px;
            background: #180909;
          }

          .error strong {
            color: #ff7070;
          }

          .result {
            margin-top: 32px;
            padding-top: 28px;
            border-top: 1px solid #243129;
          }

          .success {
            padding: 14px 16px;
            border: 1px solid #00ff88;
            border-radius: 10px;
            background: #06140c;
            color: #00ff88;
            font-weight: 800;
          }

          h2 {
            margin-top: 28px;
            margin-bottom: 8px;
            font-size: 19px;
          }

          p,
          li {
            color: #c7d0cb;
            line-height: 1.65;
          }

          li {
            margin-bottom: 8px;
          }

          pre {
            overflow-x: auto;
            padding: 16px;
            border: 1px solid #25332b;
            border-radius: 10px;
            background: #020403;
            color: #bfffdc;
            font-size: 12px;
            line-height: 1.55;
          }

          details {
            margin-top: 16px;
            padding: 14px;
            border: 1px solid #25332b;
            border-radius: 10px;
            background: #060906;
          }

          summary {
            cursor: pointer;
            color: #00ff88;
            font-weight: 800;
          }

          @media (max-width: 600px) {
            .page {
              padding: 18px 10px;
            }

            .panel {
              padding: 20px 14px;
            }
          }
        `}</style>
      </main>
    </>
  );
}
