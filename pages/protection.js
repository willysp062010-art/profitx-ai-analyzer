import { useState } from "react";
import Link from "next/link";
import Head from "next/head";
import { inspectLink } from "../utils/protection-link";

function formatUnits(amount, decimals) {
  if (!decimals) return amount;
  const padded = amount.padStart(decimals + 1, "0");
  const fraction = padded.slice(-decimals).replace(/0+$/, "");
  return padded.slice(0, -decimals) + (fraction ? "," + fraction : "");
}

export default function Protection() {
  const [address, setAddress] = useState("");
  const [link, setLink] = useState("");
  const [checkedLink, setCheckedLink] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [busy, setBusy] = useState(false);
  async function checkWallet(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setWallet(null);
    try {
      const response = await fetch("/api/wallet-protection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner: address.trim() }),
        signal: AbortSignal.timeout(12000)
      });
      const result = await response.json();
      if (!response.ok) {
        setWallet({ error: result.error || "Contrôle indisponible." });
        return;
      }
      setWallet(result);
    } catch {
      setWallet({ error: "Le contrôle a été interrompu. Réessayez dans un instant." });
    } finally {
      setBusy(false);
    }
  }
  return <>
    <Head><title>Protection Solana | PROFITX AI</title></Head>
    <main id="pfx-main-content" className="shell">
      <section className="hero">
        <h1>Protection Solana</h1>
        <p className="intro">Vérifiez les autorisations de vos tokens et examinez un lien avant de l’ouvrir.</p>
      </section>
      <section className="panel">
        <h2>Autorisations du portefeuille</h2>
        <p>Le contrôle lit les comptes SPL Token et Token-2022 associés à votre adresse publique. Une autorisation peut être légitime. Vérifiez celles que vous ne reconnaissez pas.</p>
        <form onSubmit={checkWallet}>
          <label htmlFor="protection-wallet">Adresse publique Solana</label>
          <input id="protection-wallet" required maxLength={44} disabled={busy} value={address} onChange={event => { setAddress(event.target.value); setWallet(null); }} />
          <button disabled={busy}>{busy ? "Vérification…" : "Vérifier le portefeuille"}</button>
        </form>
        <div aria-live="polite">{wallet?.error ? <p>{wallet.error}</p> : wallet && <>
          <p>{wallet.partial ? "Contrôle partiel. Certaines données Solana sont indisponibles." : "Comptes SPL Token et Token-2022 contrôlés."} {wallet.total} autorisation(s) détectée(s).</p>
          {wallet.total > wallet.delegates.length && <p>Les 100 premières autorisations sont affichées.</p>}
          <ul>{wallet.delegates.map(item => <li key={item.account}>
            <a href={`https://solscan.io/account/${item.account}`} target="_blank" rel="noreferrer">Voir le compte token</a>
            {" · Délégataire "}<code>{item.delegate}</code>
          </li>)}</ul>
        </>}</div>
        {wallet && !wallet.error && <section aria-live="polite">
          <h3>Sorties et baisses de solde récentes</h3>
          <p>Jusqu’à huit transactions qui référencent directement cette adresse. Les baisses de solde peuvent correspondre à un échange ou à une autre opération légitime.</p>
          {!wallet.history || (wallet.history.partial && !wallet.history.reviewed) ? <p>Historique indisponible.</p> : <>
            <p>{wallet.history.reviewed} transaction(s) examinée(s). {wallet.history.partial && "Historique partiel."}</p>
            {!wallet.history.transactions.length && <p>Aucune sortie directe de SOL ou baisse de solde token observée dans cet échantillon.</p>}
            {wallet.history.repeatedDestinations?.map(({ destination, signatures }) => <div key={destination}>
              <h4>Envois rapprochés vers le même destinataire</h4>
              <p>{signatures.length} transactions SOL sur dix minutes ou moins vers <code style={{ overflowWrap: "anywhere" }}>{destination}</code>. Vérifiez si vous reconnaissez ces envois.</p>
              <ul>{signatures.map((signature, index) => <li key={signature}>
                <a href={`https://solscan.io/tx/${signature}`} target="_blank" rel="noreferrer">Examiner la transaction {index + 1}</a>
              </li>)}</ul>
            </div>)}
            <ul>{wallet.history.transactions.map(tx => <li key={tx.signature}>
              <a href={`https://solscan.io/tx/${tx.signature}`} target="_blank" rel="noreferrer">Voir la transaction</a>
              {Number.isSafeInteger(tx.blockTime) && <time dateTime={new Date(tx.blockTime * 1000).toISOString()}> · {new Date(tx.blockTime * 1000).toLocaleString("fr-FR")}</time>}
              <ul>{tx.movements.map((movement, index) => <li key={index}>
                {formatUnits(movement.amount, movement.decimals)} {movement.asset}
                {movement.destination && <> vers <code>{movement.destination}</code></>}
              </li>)}</ul>
            </li>)}</ul>
          </>}
        </section>}
      </section>
      <section className="panel">
        <h2>Vérifier un lien</h2>
        <p>Le lien est examiné dans votre navigateur sans ouvrir le site. Le contrôle porte sur la structure de l’adresse. La réputation et le contenu du site restent à vérifier.</p>
        <form onSubmit={event => { event.preventDefault(); setCheckedLink(inspectLink(link) || { invalid: true }); }}>
          <label htmlFor="protection-url">Lien HTTP ou HTTPS</label>
          <input id="protection-url" required maxLength={2048} value={link} onChange={event => { setLink(event.target.value); setCheckedLink(null); }} />
          <button>Examiner le lien</button>
        </form>
        <div aria-live="polite">{checkedLink?.invalid ? <p>Saisissez une adresse complète commençant par http:// ou https://.</p> : checkedLink && <>
          <p>Domaine réel <strong>{checkedLink.hostname}</strong></p>
          {checkedLink.signals.length ? <ul>{checkedLink.signals.map(signal => <li key={signal}>{signal}</li>)}</ul> : <p>Aucun signal structurel détecté. Vérifiez le domaine auprès de la source officielle.</p>}
        </>}</div>
      </section>
      <section className="panel">
        <h2>Vérifier un token</h2>
        <p>Retrouvez les contrôles disponibles sur les autorités, les extensions et les données de marché.</p>
        <Link href="/">Ouvrir l’analyseur Solana</Link>
      </section>
    </main>
  </>;
}
