import Link from "next/link";
import { useRouter } from "next/router";

const TOOLS = [
  ["/", "Analyzer"],
  ["/radar", "Radar"],
  ["/repertoire-solana", "Répertoire Solana"],
  ["/compare", "Compare"],
  ["/intelligence", "Intelligence"],
  ["/watchlist", "Watchlist"],
  ["/alerts", "Alertes"],
  ["/obtenir-pfx", "Obtenir PFX"],
];

export default function SiteNavigation() {
  const { pathname } = useRouter();
  return (
    <header className="pfxNavigation">
      <a className="pfxSkipLink" href="#pfx-main-content">Aller au contenu</a>
      <div className="pfxNavigationInner">
        <Link href="/" className="pfxNavigationBrand" aria-label="PROFITX AI — accueil Analyzer">
          <span aria-hidden="true">P</span> PROFITX AI
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
