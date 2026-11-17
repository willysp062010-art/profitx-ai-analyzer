import "../styles/globals.css";
import "../styles/pfx-observatory.css";
import Head from "next/head";
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
      <div className="pfxSiteContent">
        <SiteNavigation />
        <Component {...pageProps} />
      </div>
    </>
  );
}
