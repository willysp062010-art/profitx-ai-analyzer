import Link from "next/link";
import { useRouter } from "next/router";

const TOOLS = [
  ["/", "Analyzer"],
  ["/radar", "Radar"],
  ["/repertoire-solana", "Répertoire"],
  ["/compare", "Compare"],
  ["/intelligence", "Intelligence"],
  ["/watchlist", "Watchlist"],
  ["/alerts", "Alertes"],
  ["/protection", "Protection"],
  ["/obtenir-pfx", "Le token PFX"],
  ["/contact", "Contact"],
];

export default function SiteNavigation() {
  const { pathname } = useRouter();
  return (
    <header className="pfxNavigation">
      <a className="pfxSkipLink" href="#pfx-main-content">Aller au contenu</a>
      <div className="pfxNavigationInner">
        <Link href="/" className="pfxNavigationBrand" aria-label="PROFITX AI — accueil Analyzer">
          <img src="/pfx-logo-spectrum.webp" alt="" width="64" height="64" /> <span className="pfxBrandText">PROFITX <b>AI</b><small>OBSERVATOIRE SOLANA</small></span>
        </Link>
        <nav className="pfxNavigationLinks" aria-label="Outils PROFITX AI">
          {TOOLS.map(([href, label]) => (
            <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
