import "../styles/globals.css";
import "../styles/pfx-observatory.css";
import Head from "next/head";
import Link from "next/link";
import SiteNavigation from "../components/SiteNavigation";

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <link rel="preload" href="/fonts/dm-sans-variable.woff" as="font" type="font/woff" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/outfit-variable.woff" as="font" type="font/woff" crossOrigin="anonymous" />
        <link rel="icon" type="image/webp" href="/pfx-logo-spectrum.webp" />
        <link rel="apple-touch-icon" href="/pfx-logo-spectrum.webp" />
        <title>PROFITX AI — Analyse des tokens Solana</title>
        <meta name="description" content="Analysez les risques des tokens Solana : données de marché, sécurité, concentration, Radar, Watchlist et alertes PROFITX AI." key="description" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="pfxObservatoryBackground" aria-hidden="true" />
      <div className="pfxBackground" aria-hidden="true">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className={`pfxBubble pfxBubble${index + 1}`}>
            <img src="/pfx-logo-spectrum.webp" alt="" width="150" height="150" decoding="async" draggable={false} />
          </div>
        ))}
      </div>
      <div className="pfxSiteContent">
        <SiteNavigation />
        <aside className="pfxReleaseStrip" aria-label="Les nouveautés PROFITX AI">
          <span>NOUVEAU VISAGE</span><p>PFX fait peau neuve. Découvrez nos outils.</p>
          <Link href="/decouvrir">Découvrir <span aria-hidden="true">↗</span></Link>
        </aside>
        <Component {...pageProps} />
      </div>
    </>
  );
}
