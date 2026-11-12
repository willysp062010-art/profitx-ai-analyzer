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
          <img src="/profitx-logo-02-analyzer.png" alt="" width="42" height="42" /> <span className="pfxBrandText">PROFITX <b>AI</b><small>OBSERVATOIRE SOLANA</small></span>
        </Link>
        <nav className="pfxNavigationLinks" aria-label="Outils PROFITX AI">
          {TOOLS.map(([href, label]) => (
            <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>
              <span className="pfxToolNumber" aria-hidden="true">{String(TOOLS.findIndex(item => item[0] === href) + 1).padStart(2, "0")}</span>{label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
