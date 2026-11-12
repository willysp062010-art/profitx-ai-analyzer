import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { WATCHLIST_KEY, isSolanaMint, readWatchlist, writeWatchlist, mergeWatchlist, parseWatchlistImport, makeWatchlistBackup, watchlistIdentityLabel } from "../utils/watchlist";

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

export default function Watchlist() {
  const router = useRouter();

  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [notice, setNotice] = useState("");

  const [chainId, setChainId] = useState("solana");
  const [tokenAddress, setTokenAddress] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [filter, setFilter] = useState("");
  const [removed, setRemoved] = useState(null);
  const [identifying, setIdentifying] = useState("");
  const officialMint = "6FwDVfnnETqUe2UrxZEeLA6u7Vo5Td2Nm79z7s38pump";
  const visibleItems = items.filter(item => [item.name, item.symbol, item.tokenAddress, item.tokenAddress === officialMint ? "PROFITX PFX" : ""].some(value => String(value || "").toLocaleLowerCase().includes(filter.trim().toLocaleLowerCase())));

  useEffect(() => {
    function refresh() {
      try { setItems(readWatchlist(window.localStorage)); setStorageReady(true); }
      catch { setStorageReady(false); setError("Stockage local inaccessible ou Watchlist illisible. Aucune donnée enregistrée n'a été remplacée."); }
    }
    refresh();
    setLoaded(true);
    const onStorage = event => { if (event.key === WATCHLIST_KEY || event.key === null) refresh(); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function commitItems(next) {
    if (!storageReady) { setError("Le stockage local n'est pas disponible. La Watchlist n'a pas été modifiée."); return false; }
    try { writeWatchlist(window.localStorage, next); setItems(next); return true; }
    catch { setError("Sauvegarde impossible dans ce navigateur. La modification n'a pas été enregistrée."); return false; }
  }

  function exportItems() {
    setError(""); setNotice("");
    try {
      const current = readWatchlist(window.localStorage);
      const url = URL.createObjectURL(new Blob([JSON.stringify(makeWatchlistBackup(current), null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url; link.download = "PROFITX_WATCHLIST.json";
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice("Sauvegarde exportée. Conservez ce fichier pour retrouver vos tokens sur un autre appareil.");
    } catch { setError("Impossible d'exporter la Watchlist."); }
  }

  async function importItems(event) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    setError(""); setNotice("");
    try {
      if (file.size > 256 * 1024) throw Error("Fichier trop volumineux (256 Ko maximum).");
      const incoming = parseWatchlistImport(await file.text());
      const current = readWatchlist(window.localStorage);
      const next = mergeWatchlist(current, incoming);
      if (commitItems(next)) setNotice(`${next.length - current.length} token(s) ajouté(s). Les tokens déjà présents sont conservés.`);
    } catch (error) { setError(error.message || "Import impossible. La Watchlist n'a pas été modifiée."); }
  }

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
    setNotice("");

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

    if (chainId === "solana" && !isSolanaMint(cleanAddress)) {
      setError("Adresse mint Solana invalide. Copiez l’adresse complète du token.");
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

    try {
      if (commitItems(mergeWatchlist(readWatchlist(window.localStorage), [newItem]))) {
        setTokenAddress(""); setNotice("Token enregistré dans la Watchlist de ce navigateur.");
      }
    } catch (error) { setError(error.message || "Ajout impossible."); }
  }

  function removeToken(id) {
    setError(""); setNotice("");
    try {
      const current = readWatchlist(window.localStorage);
      const item = current.find(item => item.id === id);
      if (item && commitItems(current.filter(item => item.id !== id))) {
        setRemoved(item);
        setNotice("Token retiré de la Watchlist. Vous pouvez annuler ce retrait.");
      }
    }
    catch { setError("La suppression n'a pas été enregistrée."); }
  }

  async function identifyToken(item) {
    if (identifying || item.chainId !== "solana" || !storageReady) return;
    setIdentifying(item.tokenAddress); setError(""); setNotice("");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch("/api/search-token?q=" + encodeURIComponent(item.tokenAddress), {signal: controller.signal});
      const data = await response.json();
      if (!response.ok || !data.ok) throw Error("Identification temporairement indisponible.");
      const match = Array.isArray(data.results) ? data.results.find(token => token.mint === item.tokenAddress) : null;
      const name = typeof match?.name === "string" ? match.name.trim().slice(0,100) : "";
      const symbol = typeof match?.symbol === "string" ? match.symbol.trim().slice(0,40) : "";
      if (!name && !symbol) { setNotice("Aucun nom récupéré pour cette adresse. Le token reste enregistré par son mint."); return; }
      const current = readWatchlist(window.localStorage);
      if (!current.some(token => token.chainId === item.chainId && token.tokenAddress === item.tokenAddress)) {
        setNotice("Ce token a été retiré entre-temps. La Watchlist n’a pas été modifiée."); return;
      }
      if (commitItems(current.map(token => token.chainId === item.chainId && token.tokenAddress === item.tokenAddress
        ? {...token, ...(name ? {name} : {}), ...(symbol ? {symbol} : {})} : token))) setNotice("Nom récupéré pour le mint exact. Ces métadonnées ne constituent pas une vérification du projet.");
    } catch { setError("Impossible de récupérer le nom actuellement. Votre token reste enregistré."); }
    finally { clearTimeout(timer); setIdentifying(""); }
  }

  function undoRemoval() {
    setError("");
    try {
      const current = readWatchlist(window.localStorage);
      if (removed && commitItems(mergeWatchlist(current, [removed]))) {
        setRemoved(null); setNotice("Token rétabli dans la Watchlist.");
      }
    } catch (error) { setError(error.message || "Restauration impossible."); }
  }

  async function copyAddress(address) {
    setError("");
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
      <Head><title>PFX Watchlist — PROFITX AI</title></Head>
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
    onClick={() => router.push("/")}
  >
    ANALYZER
  </button>

  <button
    type="button"
    className="secondaryButton"
    onClick={() => router.push("/radar")}
  >
    RADAR
  </button>

  <button
    type="button"
    className="secondaryButton"
    onClick={() => router.push("/compare")}
  >
    COMPARE
  </button>

  <button
    type="button"
    className="secondaryButton"
    onClick={() => router.push("/intelligence")}
  >
    INTELLIGENCE
  </button>

  <button
    type="button"
    className="secondaryButton"
    onClick={() => router.push("/watchlist")}
  >
    WATCHLIST
  </button>

  <button
    type="button"
    className="secondaryButton"
    onClick={() => router.push("/alerts")}
  >
    ALERTS
  </button>

  <button
    type="button"
    className="secondaryButton"
    onClick={() => router.push("/obtenir-pfx")}
  >
    OBTENIR PFX
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
                  disabled={!network.enabled}
                >
                  {network.label}
                  {network.enabled
                    ? ""
                    : " • bientôt"}
                </option>
              ))}
            </select>

            <input
              aria-label="Adresse mint Solana à suivre"
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
            La Watchlist est enregistrée uniquement dans ce navigateur, sur cet appareil.
            Exportez-la pour la sauvegarder ou la transférer sur votre téléphone ou votre ordinateur.
            Seul Solana est actuellement pris en charge.
          </div>

          <div className="navigation" style={{ marginTop: 16 }}>
            <button type="button" className="secondaryButton" onClick={exportItems} disabled={!loaded || !storageReady}>EXPORTER LA WATCHLIST</button>
            <label className="secondaryButton" style={{ cursor: "pointer" }}>
              IMPORTER UNE SAUVEGARDE
              <input type="file" accept="application/json,.json" aria-label="Importer une sauvegarde Watchlist" onChange={importItems} disabled={!loaded || !storageReady} style={{ display: "block", marginTop: 8, maxWidth: "100%" }} />
            </label>
          </div>
          {notice && <p role="status" style={{ color: "#65efad" }}>{notice}</p>}
          {removed && <button type="button" className="secondaryButton" onClick={undoRemoval} disabled={!storageReady}>ANNULER LE DERNIER RETRAIT</button>}

          {error && (
            <div className="error" role="alert">
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

          <label className="hint" htmlFor="watchlist-filter">Filtrer vos tokens par nom, symbole ou mint</label>
          <input id="watchlist-filter" value={filter} onChange={event => setFilter(event.target.value)} placeholder="Rechercher dans ma Watchlist" style={{width:"100%",boxSizing:"border-box",padding:14,margin:"12px 0",background:"#07120d",border:"1px solid #347c58",borderRadius:10,color:"white",fontSize:16}} />
          <p className="hint">{visibleItems.length} affiché(s) sur {items.length} enregistré(s). Les noms déclarés ne constituent pas une vérification du token.</p>
          {!loaded ? (
            <div className="empty">
              Chargement de la Watchlist...
            </div>
          ) : !storageReady ? (
            <div className="empty"><strong>Watchlist inaccessible.</strong><span>Les données enregistrées n’ont pas été remplacées. Vérifiez l’accès au stockage de ce navigateur.</span></div>
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
          ) : visibleItems.length === 0 ? (
            <div className="empty"><strong>Aucun token ne correspond à votre filtre.</strong><button type="button" className="secondaryButton" onClick={() => setFilter("")}>EFFACER LE FILTRE</button></div>
          ) : (
            <div className="tokenList">
              {visibleItems.map((item) => {
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

                        <strong style={{display:"block",marginTop:10,overflowWrap:"anywhere"}}>{watchlistIdentityLabel(item)}</strong>
                        {item.tokenAddress === officialMint && <span className="hint" style={{display:"block"}}>Mint déclaré par PROFITX AI · non audité</span>}
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
                        title="Retirer de la Watchlist"
                        aria-label={"Retirer " + (item.name || item.tokenAddress) + " de la Watchlist"}
                      >
                        ×
                      </button>
                    </div>

                    <div className="fullAddress">
                      {item.tokenAddress}
                    </div>

                    <p className="hint">{Number.isFinite(Date.parse(item.addedAt)) ? "Ajouté le " + new Date(item.addedAt).toLocaleDateString("fr-FR") : "Date d’ajout non renseignée"}</p>
                    <div className="actions">
                      {item.chainId === "solana" && item.tokenAddress !== officialMint && <button type="button" className="copyButton" disabled={Boolean(identifying) || !storageReady} onClick={() => identifyToken(item)}>{identifying === item.tokenAddress ? "IDENTIFICATION…" : item.name ? "ACTUALISER LE NOM" : "RÉCUPÉRER LE NOM"}</button>}
                      <button type="button" className="copyButton" disabled={item.chainId !== "solana"} onClick={() => router.push("/alerts?mint=" + encodeURIComponent(item.tokenAddress))}>ALERTES</button>
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
