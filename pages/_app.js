import "../styles/globals.css";
import "../styles/pfx-observatory.css";
import Head from "next/head";
import { useState } from "react";
import Link from "next/link";
import SiteNavigation from "../components/SiteNavigation";

export default function App({ Component, pageProps }) {
  const [medallionPaused, setMedallionPaused] = useState(false);

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
      <div className="pfxSiteContent">
        <SiteNavigation />
        <aside className="pfxReleaseStrip" aria-label="Les nouveautés PROFITX AI">
          <button
            type="button"
            className="pfxFloatingMedallion"
            aria-label="Pause de l’animation du médaillon PFX"
            aria-pressed={medallionPaused}
            onClick={() => setMedallionPaused((paused) => !paused)}
          >
            <img src="/pfx-logo-spectrum.webp" alt="" width="44" height="44" decoding="async" />
          </button>
          <span>NOUVEAU VISAGE</span><p>PFX fait peau neuve. Découvrez nos outils.</p>
          <Link href="/decouvrir">Découvrir <span aria-hidden="true">↗</span></Link>
        </aside>
        <Component {...pageProps} />
      </div>
      <style jsx>{`
        .pfxFloatingMedallion {
          display: grid;
          place-items: center;
          flex: 0 0 56px;
          width: 56px;
          height: 56px;
          padding: 0;
          border: 0;
          border-radius: 50%;
          background: transparent;
          cursor: pointer;
        }
        .pfxFloatingMedallion img {
          display: block;
          width: 44px;
          height: 44px;
          object-fit: contain;
          animation: pfxMedallionFloat 4s ease-in-out infinite;
        }
        .pfxFloatingMedallion[aria-pressed="true"] img {
          animation-play-state: paused;
        }
        @keyframes pfxMedallionFloat {
          0%, 100% { transform: translateY(4px); }
          50% { transform: translateY(-4px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .pfxFloatingMedallion img { animation: none; }
        }
      `}</style>
    </>
  );
}
