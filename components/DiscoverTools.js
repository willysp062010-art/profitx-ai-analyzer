import Link from "next/link";

const STARTS = [
  ["01", "/repertoire-solana", "Trouver le bon token", "Recherchez un nom ou un symbole, puis comparez les adresses mint."],
  ["02", "/radar", "Explorer les détections", "Consultez les tokens indexés et les observations disponibles."],
  ["03", "/compare", "Mettre les faits en regard", "Comparez deux tokens à partir des données observées."],
];
export default function DiscoverTools() {
  return <section className="pfxDiscover" aria-labelledby="pfx-discover-title">
    <div className="pfxDiscoverHeading"><div><span className="eyebrow">VOTRE POINT DE DÉPART</span>
      <h2 id="pfx-discover-title">Le bon outil, au bon moment.</h2></div>
      <Link href="/decouvrir">Première visite ? Suivez le guide <span aria-hidden="true">↗</span></Link></div>
    <div className="pfxDiscoverGrid">{STARTS.map(([n, href, title, text]) =>
      <Link href={href} className="pfxDiscoverCard" key={href}>
        <span className="pfxDiscoverNumber">{n}<span aria-hidden="true">↗</span></span>
        <h3>{title}</h3><p>{text}</p>
      </Link>)}</div>
  </section>;
}
