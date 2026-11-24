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
  ["Le token PFX", "/obtenir-pfx", "Vérifier le token du projet", "Retrouvez le mint déclaré par PROFITX et ses liens. PFX reste sur Solana. L’Analyzer est utilisable sans détenir PFX ni connecter de wallet."],
];
const CRYPTO_CHAPTERS = [
  ["Qu’est-ce qu’une crypto ?", [
    "Un crypto-actif est un actif numérique dont la détention et les transferts peuvent être enregistrés sur une blockchain. Une blockchain est un registre partagé. Les ordinateurs du réseau appliquent des règles communes pour vérifier les transactions et s’accorder sur leur ordre.",
    "Imaginez qu’Alice envoie du SOL à Bob. Son portefeuille signe la demande avec sa clé privée, puis le réseau vérifie la signature et le solde. Une fois la transaction confirmée, chacun peut consulter sa trace dans un explorateur public. Les adresses sont visibles, et leur activité peut parfois être reliée à une identité."
  ]],
  ["Bitcoin, Ethereum, Solana et les différentes familles", [
    "Bitcoin est un réseau conçu pour transférer des BTC, son actif natif. Ses mineurs contribuent à la validation avec de la puissance de calcul, selon un mécanisme appelé preuve de travail. Ethereum et Solana utilisent des mécanismes fondés sur la preuve d’enjeu, où des validateurs engagent des actifs selon les règles du réseau.",
    "BTC, ETH et SOL sont des actifs natifs de leurs réseaux respectifs. Un token peut aussi être créé sur un réseau existant. Sur Solana, son adresse de mint permet de l’identifier. Plusieurs tokens peuvent partager un nom, un symbole ou un logo.",
    "Un stablecoin vise à suivre une référence comme le dollar. Cet objectif peut échouer, par exemple si sa réserve ou son mécanisme de stabilisation pose problème. Un token de gouvernance peut donner un droit de vote selon les règles d’un protocole. Un NFT identifie un objet numérique unique, dont les droits dépendent du projet."
  ]],
  ["À quoi ça sert concrètement ?", [
    "On peut transférer de la valeur entre portefeuilles, payer les frais d’un réseau, ou utiliser des applications qui déclenchent des opérations selon des règles programmées. Ces programmes sont appelés contrats intelligents. Un échange décentralisé, ou DEX, peut ainsi échanger deux tokens à partir d’une réserve de liquidité.",
    "La finance décentralisée, ou DeFi, applique ces mécanismes à des services comme le prêt ou les échanges. D’autres usages incluent la représentation de titres ou de documents sous forme de tokens. L’intérêt dépend du besoin réel, des coûts, des droits associés et des risques propres à chaque application."
  ]],
  ["Portefeuille, clés, réseaux et plateformes", [
    "Un portefeuille comme Phantom permet de consulter des adresses et de signer des opérations. L’adresse publique peut être partagée pour recevoir des fonds. La clé privée permet de signer. La phrase de récupération permet de restaurer l’accès au portefeuille et doit rester secrète.",
    "Sur une plateforme qui conserve les actifs pour vous, l’accès dépend aussi du prestataire. En autoconservation, vous gérez vos clés et leur sauvegarde. Pour un transfert, vérifiez le réseau et l’adresse du destinataire. Un transfert confirmé est généralement irréversible. Si vous décidez d’en effectuer un, commencez par un petit test."
  ]],
  ["Pourquoi les prix changent-ils et quels sont les risques ?", [
    "Le prix varie avec l’offre, la demande et les conditions de marché. La capitalisation correspond au prix multiplié par le nombre de jetons en circulation. La liquidité indique la facilité à échanger un montant avec un impact limité sur le prix. Un volume élevé correspond à de l’activité mesurée sur une période et peut masquer une liquidité faible.",
    "Une variation de prix, une faille de code, un problème chez un intermédiaire ou une autorisation malveillante peuvent entraîner une perte totale. Des escrocs peuvent copier un logo ou proposer un faux support. Vérifiez le mint et le domaine, et lisez chaque demande de signature. Une promesse de rendement garanti doit vous alerter."
  ]],
  ["Quel avenir pour les cryptos ?", [
    "Plusieurs usages pourraient progresser si les outils deviennent plus simples et plus fiables. Les stablecoins peuvent faciliter certains transferts internationaux. La tokenisation pourrait simplifier certains règlements ou transferts de titres. Ces usages dépendent de la réglementation, de l’interopérabilité des réseaux et de l’existence d’un besoin concret.",
    "D’autres projets pourraient disparaître si les coûts, la sécurité ou l’adoption restent insuffisants. Un réseau peut être utile sans que le prix d’un token monte. Pour suivre son évolution, regardez les usages réels, la fiabilité du service et les risques documentés."
  ]]
];

export default function Decouvrir() {
  return <>
    <Head><title>Découvrir les outils PFX | PROFITX AI</title><meta name="description" content="Comprenez les crypto-actifs, les blockchains, les portefeuilles et les risques, puis faites votre première analyse Solana avec PROFITX AI." key="description" /></Head>
    <main id="pfx-main-content" tabIndex={-1} className="shell pfxGuide">
      <section className="hero pfxGuideHero"><span className="eyebrow">PREMIERS PAS · PROFITX AI</span>
        <h1>Un nouveau regard.<br /><span>Les faits, avant les promesses.</span></h1>
        <p className="intro">Le nouveau visage de PFX met nos outils au premier plan. Voici comment les utiliser, sans connecter de wallet.</p>
        <div className="pfxGuideActions"><Link className="primaryButton" href="/">Analyser un token <span aria-hidden="true">↗</span></Link><a className="secondaryButton" href="#guide-crypto">Comprendre les cryptos</a><Link className="secondaryButton" href="/repertoire-solana">Trouver un mint</Link></div>
      </section>
      <section id="guide-crypto" className="panel pfxGuideFaq" aria-labelledby="guide-crypto-titre">
        <h2 id="guide-crypto-titre">Comprendre les cryptos, de zéro</h2>
        <p>Blockchain, Bitcoin, portefeuille, risques et avenir. Ouvrez les chapitres dans l’ordre ou choisissez la question qui vous intéresse.</p>
        {CRYPTO_CHAPTERS.map(([title, paragraphs]) => (
          <details key={title}>
            <summary>{title}</summary>
            {paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </details>
        ))}
        <details>
          <summary>Faire un premier exercice sans wallet</summary>
          <p>Dans le <Link href="/repertoire-solana">Répertoire Solana</Link>, cherchez un symbole comme BONK. Comparez les adresses affichées. Recoupez le mint avec les sources du projet, puis ouvrez l’<Link href="/">Analyzer</Link> pour examiner la liquidité et les données manquantes. Cet exercice est gratuit et ne demande aucun achat.</p>
        </details>
        <p>Pour approfondir les risques et les précautions en France, consultez le <a href="https://www.amf-france.org/fr/espace-epargnants/proteger-son-epargne/crypto-actifs-bitcoin-etc">dossier crypto-actifs de l’AMF</a>.</p>
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
        <details><summary>À quoi sert PFX aujourd’hui ?</summary><p>PFX est le token du projet sur Solana. Il ne débloque actuellement aucune fonction supplémentaire. Une option de paiement avec avantage tarifaire pour de futurs services est envisagée ; elle n’est pas activée. <Link href="/obtenir-pfx">Voir le rôle du token et les fonctions envisagées.</Link></p></details>
        <details><summary>Quels réseaux sont disponibles ?</summary><p>Les outils présentés ici sont consacrés à Solana. Le multichain est prévu ; il n’est pas encore disponible.</p></details>
      </section>
      <p className="pfxGuideRelease">Nouvelle interface présentée le 17 novembre 2026 · Logo multicolore, nouvelle typographie et navigation adaptée aux petits écrans.</p>
    </main>
  </>;
}
