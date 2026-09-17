import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

const STORAGE_KEY = "profitx-watchlist-v1";

const NETWORKS = [
  {
    id: "solana",
    label: "Solana",
    enabled: true,
  },
  {
    id: "ethereum",
    label: "Ethereum",
    enabled: false,
  },
  {
    id: "base",
    label: "Base",
    enabled: false,
  },
  {
    id: "bsc",
    label: "BNB Chain",
    enabled: false,
  },
];

function shortAddress(value, start = 10, end = 10) {
  if (!value || typeof value !== "string") return "N/D";

  if (value.length <= start + end + 3) {
    return value;
  }

  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

function loadWatchlist() {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) return [];

    const parsed = JSON.parse(raw);

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function Watchlist() {
  const router = useRouter();

  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const [chainId, setChainId] = useState("solana");
  const [tokenAddress, setTokenAddress] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  useEffect(() => {
    setItems(loadWatchlist());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;

    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(items)
      );
    } catch {
      // La Watchlist reste utilisable pendant la session
      // même si le stockage local est indisponible.
    }
  }, [items, loaded]);

  const selectedNetwork = useMemo(
    () =>
      NETWORKS.find(
        (network) => network.id === chainId
      ),
    [chainId]
  );

  function addToken(event) {
    event.preventDefault();

    const cleanAddress = tokenAddress.trim();

    setError("");

    if (!cleanAddress) {
      setError("Entrez une adresse de token.");
      return;
    }

    if (!selectedNetwork?.enabled) {
      setError(
        `${selectedNetwork?.label || "Ce réseau"} sera disponible avec ProfitX Multi-Chain.`
      );
      return;
    }

    const alreadyExists = items.some(
      (item) =>
        item.chainId === chainId &&
        item.tokenAddress === cleanAddress
    );

    if (alreadyExists) {
      setError(
        "Ce token est déjà présent dans la Watchlist."
      );
      return;
    }

    const newItem = {
      id: `${chainId}:${cleanAddress}`,
      chainId,
      tokenAddress: cleanAddress,
      addedAt: new Date().toISOString(),
    };

    setItems((current) => [
      newItem,
      ...current,
    ]);

    setTokenAddress("");
  }

  function removeToken(id) {
    setItems((current) =>
      current.filter((item) => item.id !== id)
    );
  }

  async function copyAddress(address) {
    try {
      await navigator.clipboard.writeText(address);

      setCopied(address);

      window.setTimeout(() => {
        setCopied("");
      }, 1500);
    } catch {
      setError(
        "Impossible de copier l'adresse automatiquement."
      );
    }
  }

  function analyzeToken(item) {
    if (item.chainId !== "solana") {
      setError(
        "L'Analyzer complet est actuellement disponible pour Solana."
      );
      return;
    }

    router.push({
      pathname: "/",
      query: {
        mint: item.tokenAddress,
      },
    });
  }

  return (
    <>
      <main className="shell">
        <header className="topbar">
          <div className="brand">
            <span className="logo">P</span>
            PROFITX AI
          </div>

          <div className="tag">
            PFX WATCHLIST
          </div>
        </header>

        <section className="hero">
          <div className="eyebrow">
            PROFITX • TOKEN MONITORING
          </div>

          <h1>
            PFX Watchlist
          </h1>

          <p className="intro">
            Enregistrez les tokens que vous souhaitez
            suivre et accédez rapidement à leur analyse
            ProfitX.
          </p>

          <div className="navigation">
            <button
              type="button"
              className="secondaryButton"
              onClick={() => router.push("/radar")}
            >
              ← PFX RADAR
            </button>

            <button
              type="button"
              className="secondaryButton"
              onClick={() => router.push("/")}
            >
              ANALYZER
            </button>
          </div>
        </section>

        <section className="panel">
          <div className="eyebrow">
            AJOUTER UN TOKEN
          </div>

          <form
            className="addForm"
            onSubmit={addToken}
          >
            <select
              value={chainId}
              onChange={(event) =>
                setChainId(event.target.value)
              }
              aria-label="Réseau"
            >
              {NETWORKS.map((network) => (
                <option
                  key={network.id}
                  value={network.id}
                >
                  {network.label}
                  {network.enabled
                    ? ""
                    : " • bientôt"}
                </option>
              ))}
            </select>

            <input
              value={tokenAddress}
              onChange={(event) =>
                setTokenAddress(event.target.value)
              }
              placeholder="Adresse du token"
              spellCheck="false"
              autoComplete="off"
            />

            <button
              type="submit"
              className="primaryButton"
            >
              + AJOUTER
            </button>
          </form>

          <div className="hint">
            Solana est actuellement pris en charge.
            La structure de la Watchlist est déjà prévue
            pour l'évolution Multi-Chain de ProfitX.
          </div>

          {error && (
            <div className="error">
              {error}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="watchHeader">
            <div>
              <div className="eyebrow">
                TOKENS SUIVIS
              </div>

              <h2>
                Ma Watchlist
              </h2>
            </div>

            <div className="counter">
              {items.length}
              <span>
                TOKEN{items.length > 1 ? "S" : ""}
              </span>
            </div>
          </div>

          {!loaded ? (
            <div className="empty">
              Chargement de la Watchlist...
            </div>
          ) : items.length === 0 ? (
            <div className="empty">
              <strong>
                Aucun token enregistré.
              </strong>

              <span>
                Ajoutez votre premier token pour commencer
                à construire votre Watchlist ProfitX.
              </span>
            </div>
          ) : (
            <div className="tokenList">
              {items.map((item) => {
                const network =
                  NETWORKS.find(
                    (entry) =>
                      entry.id === item.chainId
                  );

                return (
                  <article
                    className="tokenCard"
                    key={item.id}
                  >
                    <div className="tokenTop">
                      <div>
                        <span className="network">
                          {network?.label ||
                            item.chainId}
                        </span>

                        <strong className="address">
                          {shortAddress(
                            item.tokenAddress
                          )}
                        </strong>
                      </div>

                      <button
                        type="button"
                        className="deleteButton"
                        onClick={() =>
                          removeToken(item.id)
                        }
                        title="Supprimer"
                      >
                        ×
                      </button>
                    </div>

                    <div className="fullAddress">
                      {item.tokenAddress}
                    </div>

                    <div className="actions">
                      <button
                        type="button"
                        className="copyButton"
                        onClick={() =>
                          copyAddress(
                            item.tokenAddress
                          )
                        }
                      >
                        {copied ===
                        item.tokenAddress
                          ? "COPIÉ ✓"
                          : "COPIER"}
                      </button>

                      <button
                        type="button"
                        className="analyzeButton"
                        onClick={() =>
                          analyzeToken(item)
                        }
                      >
                        ANALYSER →
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="future">
          <div className="eyebrow">
            PROFITX MULTI-CHAIN
          </div>

          <strong>
            Architecture prête pour la suite
          </strong>

          <p>
            Chaque entrée est enregistrée avec son réseau
            et son adresse. Ethereum, Base et BNB Chain
            pourront donc être ajoutés sans reconstruire
            la Watchlist.
          </p>
        </section>

        <div className="disclaimer">
          ProfitX fournit des outils d'analyse et de
          suivi à partir de données observables.
          La présence d'un token dans la Watchlist ne
          constitue pas une recommandation d'achat ou
          de vente.
        </div>
      </main>

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        .shell {
          min-height: 100vh;
          padding: 28px;
          background:
            radial-gradient(
              circle at top,
              rgba(33, 242, 139, 0.08),
              transparent 32%
            ),
            #030706;
          color: #f4f7f5;
          font-family:
            Inter,
            Arial,
            sans-serif;
        }

        .topbar {
          max-width: 1180px;
          margin: 0 auto 28px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
          font-weight: 900;
          letter-spacing: 1px;
        }

        .logo {
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border: 1px solid #21f28b;
          border-radius: 10px;
          color: #21f28b;
          box-shadow:
            0 0 22px
            rgba(33, 242, 139, 0.18);
        }

        .tag,
        .eyebrow {
          color: #21f28b;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 1.3px;
        }

        .hero,
        .panel,
        .future {
          max-width: 1180px;
          margin: 0 auto 20px;
          padding: 28px;
          border:
            1px solid
            rgba(255, 255, 255, 0.09);
          border-radius: 18px;
          background:
            rgba(8, 14, 12, 0.92);
          box-shadow:
            0 16px 50px
            rgba(0, 0, 0, 0.25);
        }

        h1 {
          margin: 12px 0;
          font-size: clamp(
            34px,
            6vw,
            64px
          );
          line-height: 1;
        }

        h2 {
          margin: 8px 0 0;
          font-size: 28px;
        }

        .intro {
          max-width: 720px;
          color: #aab6b0;
          line-height: 1.7;
        }

        .navigation {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 24px;
        }

        button,
        input,
        select {
          font: inherit;
        }

        button {
          cursor: pointer;
        }

        .secondaryButton,
        .copyButton {
          padding: 12px 16px;
          border:
            1px solid
            rgba(33, 242, 139, 0.35);
          border-radius: 10px;
          background: #07100c;
          color: #21f28b;
          font-weight: 800;
        }

        .addForm {
          display: grid;
          grid-template-columns:
            190px minmax(0, 1fr) 150px;
          gap: 12px;
          margin-top: 20px;
        }

        input,
        select {
          width: 100%;
          min-height: 50px;
          padding: 0 15px;
          border:
            1px solid
            rgba(255, 255, 255, 0.12);
          border-radius: 11px;
          outline: none;
          background: #050a08;
          color: #f4f7f5;
        }

        input:focus,
        select:focus {
          border-color: #21f28b;
          box-shadow:
            0 0 0 3px
            rgba(33, 242, 139, 0.08);
        }

        .primaryButton,
        .analyzeButton {
          min-height: 50px;
          padding: 0 18px;
          border: 0;
          border-radius: 11px;
          background: #21f28b;
          color: #00150c;
          font-weight: 900;
        }

        .hint {
          margin-top: 14px;
          color: #7f8d86;
          font-size: 13px;
          line-height: 1.6;
        }

        .error {
          margin-top: 16px;
          padding: 13px 15px;
          border:
            1px solid
            rgba(255, 105, 105, 0.3);
          border-radius: 10px;
          background:
            rgba(255, 70, 70, 0.06);
          color: #ff9b9b;
        }

        .watchHeader {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
        }

        .counter {
          min-width: 82px;
          padding: 12px;
          border:
            1px solid
            rgba(33, 242, 139, 0.25);
          border-radius: 12px;
          color: #21f28b;
          text-align: center;
          font-size: 25px;
          font-weight: 900;
        }

        .counter span {
          display: block;
          margin-top: 2px;
          color: #7f8d86;
          font-size: 9px;
          letter-spacing: 1px;
        }

        .empty {
          margin-top: 24px;
          padding: 40px 20px;
          border:
            1px dashed
            rgba(255, 255, 255, 0.12);
          border-radius: 14px;
          color: #7f8d86;
          text-align: center;
        }

        .empty strong,
        .empty span {
          display: block;
        }

        .empty strong {
          margin-bottom: 8px;
          color: #dce4e0;
        }

        .tokenList {
          display: grid;
          grid-template-columns:
            repeat(
              auto-fit,
              minmax(280px, 1fr)
            );
          gap: 14px;
          margin-top: 24px;
        }

        .tokenCard {
          padding: 18px;
          border:
            1px solid
            rgba(255, 255, 255, 0.09);
          border-radius: 14px;
          background: #050a08;
        }

        .tokenTop {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 15px;
        }

        .network {
          display: block;
          margin-bottom: 8px;
          color: #21f28b;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .address {
          font-size: 16px;
        }

        .deleteButton {
          width: 32px;
          height: 32px;
          border:
            1px solid
            rgba(255, 100, 100, 0.25);
          border-radius: 8px;
          background:
            rgba(255, 70, 70, 0.05);
          color: #ff8b8b;
          font-size: 20px;
        }

        .fullAddress {
          margin-top: 15px;
          padding: 10px;
          overflow-wrap: anywhere;
          border-radius: 8px;
          background: #020504;
          color: #7f8d86;
          font-family: monospace;
          font-size: 11px;
        }

        .actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-top: 14px;
        }

        .copyButton,
        .analyzeButton {
          min-height: 42px;
        }

        .future strong {
          display: block;
          margin-top: 10px;
          font-size: 22px;
        }

        .future p {
          margin-bottom: 0;
          color: #8c9993;
          line-height: 1.7;
        }

        .disclaimer {
          max-width: 1180px;
          margin: 25px auto 0;
          padding: 18px;
          color: #66736d;
          text-align: center;
          font-size: 12px;
          line-height: 1.6;
        }

        @media (max-width: 720px) {
          .shell {
            padding: 16px;
          }

          .topbar {
            align-items: flex-start;
            flex-direction: column;
          }

          .hero,
          .panel,
          .future {
            padding: 20px;
          }

          .addForm {
            grid-template-columns: 1fr;
          }

          .actions {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}
