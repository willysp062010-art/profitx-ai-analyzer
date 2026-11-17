import Head from "next/head";
import Link from "next/link";

const TOOLS = [
  ["Analyzer", "/", "Comprendre un token", "Cherchez un nom, un symbole ou un mint. Examinez les observations de marché, les autorités, la distribution et les limites de l’analyse."],
  ["Répertoire Solana", "/repertoire-solana", "Retrouver son adresse", "Comparez les résultats portant le même nom. Un symbole et un logo ne suffisent pas à prouver l’identité d’un token."],
  ["Radar", "/radar", "Explorer les détections", "Parcourez les tokens enregistrés dans l’index. Une détection n’est pas une preuve de création récente sur la blockchain ; la couverture reste partielle."],
  ["Compare", "/compare", "Comparer deux tokens", "Mettez leurs données en regard et repérez ce qui est observé, incomplet ou indisponible."],
  ["Intelligence", "/intelligence", "Lire l’analyse en contexte", "Retrouvez une lecture structurée des forces, vigilances et informations manquantes d’un token."],
  ["Watchlist", "/watchlist", "Garder vos repères", "Conservez une sélection dans ce navigateur. Utilisez l’export et l’import pour la transférer sur un autre appareil."],
  ["Alertes", "/alerts", "Définir vos seuils", "Suivez des conditions de prix, variation, liquidité ou volume. Les contrôles manuels et automatiques ne garantissent pas une surveillance continue. Les e-mails ne sont pas activés."],
  ["Obtenir PFX", "/obtenir-pfx", "Vérifier le token du projet", "Retrouvez le mint déclaré par PROFITX et ses liens. PFX reste sur Solana. L’Analyzer est utilisable sans détenir PFX ni connecter de wallet."],
];
export default function Decouvrir() {
  return <>
    <Head><title>Découvrir les outils PFX | PROFITX AI</title><meta name="description" content="Prenez en main PROFITX AI : identifier un token Solana, lire les risques, explorer le radar et comparer les données." key="description" /></Head>
    <main id="pfx-main-content" tabIndex={-1} className="shell pfxGuide">
      <section className="hero pfxGuideHero"><span className="eyebrow">PREMIERS PAS · PROFITX AI</span>
        <h1>Un nouveau regard.<br /><span>Les faits, avant les promesses.</span></h1>
        <p className="intro">Le nouveau visage de PFX met nos outils au premier plan. Voici comment les utiliser, sans connecter de wallet.</p>
        <div className="pfxGuideActions"><Link className="primaryButton" href="/">Analyser un token <span aria-hidden="true">↗</span></Link><Link className="secondaryButton" href="/repertoire-solana">Trouver un mint</Link></div>
      </section>
      <section className="pfxGuideSteps" aria-labelledby="pfx-guide-steps"><h2 id="pfx-guide-steps">Votre première analyse, en trois étapes.</h2><ol>
        <li><span>01</span><div><h3>Identifiez l’adresse exacte.</h3><p>Un même nom peut désigner plusieurs tokens. Vérifiez le mint avec les sources du projet.</p></div></li>
        <li><span>02</span><div><h3>Regardez les faits disponibles.</h3><p>Liquidité, activité, autorités et concentration : lisez les sources et les informations manquantes.</p></div></li>
        <li><span>03</span><div><h3>Gardez les limites en vue.</h3><p>Un score, des ventes passées ou une cotation indicative ne garantissent ni la sécurité d’un token ni votre possibilité de revendre.</p></div></li>
      </ol></section>
      <section aria-labelledby="pfx-guide-tools"><div className="pfxDiscoverHeading"><div><span className="eyebrow">HUIT OUTILS · UN MÊME OBJECTIF</span><h2 id="pfx-guide-tools">Comprendre avant de décider.</h2></div></div>
        <div className="pfxGuideGrid">{TOOLS.map(([name,href,title,text])=><article className="panel pfxGuideTool" key={href}><span className="eyebrow">{name}</span><h3>{title}</h3><p>{text}</p><Link href={href}>Ouvrir {name} <span aria-hidden="true">↗</span></Link></article>)}</div>
      </section>
      <section className="panel pfxGuideFaq" aria-labelledby="pfx-guide-faq"><h2 id="pfx-guide-faq">Les réponses essentielles.</h2>
        <details><summary>Faut-il acheter PFX pour utiliser les outils ?</summary><p>Non. L’analyse Solana est gratuite et ne nécessite ni achat de PFX ni connexion de wallet.</p></details>
        <details><summary>Une analyse favorable garantit-elle un investissement sûr ?</summary><p>Non. Les observations dépendent des sources accessibles et peuvent être incomplètes. Les contrôles ne constituent pas un audit de sécurité et ne prédisent pas les performances futures.</p></details>
        <details><summary>Quels réseaux sont disponibles ?</summary><p>Les outils présentés ici sont consacrés à Solana. Le multichain est prévu ; il n’est pas encore disponible.</p></details>
      </section>
      <p className="pfxGuideRelease">Nouvelle interface présentée le 17 novembre 2026 · Logo multicolore, nouvelle typographie et navigation adaptée aux petits écrans.</p>
    </main>
  </>;
}
