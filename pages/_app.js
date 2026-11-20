import "../styles/globals.css";
import "../styles/pfx-observatory.css";
import Head from "next/head";
import Link from "next/link";
import SiteNavigation from "../components/SiteNavigation";

const bubbleTokens = ["PFX", "SOL", "BONK", "ORCA", "PFX", "JUP", "JTO", "MNDE"];

const raydiumPfx = "https://raydium.io/swap/?inputMint=sol&outputMint=6FwDVfnnETqUe2UrxZEeLA6u7Vo5Td2Nm79z7s38pump";

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
        {bubbleTokens.map((symbol, index) => (
          <div key={index} className={`pfxBubble pfxBubble${index + 1}`}>
            {symbol === "PFX"
              ? <img src="/pfx-logo-spectrum.webp" alt="" width="150" height="150" decoding="async" draggable={false} />
              : <span className="pfxBubbleSymbol">{symbol}</span>}
          </div>
        ))}
      </div>
      <div className="pfxSiteContent">
        <SiteNavigation />
        <aside className="pfxReleaseStrip" aria-label="Les nouveautés PROFITX AI">
          <span>NOUVEAU VISAGE</span><p>PFX fait peau neuve. Découvrez nos outils.</p>
          <Link href="/decouvrir">Découvrir <span aria-hidden="true">↗</span></Link>
        </aside>
        <nav className="pfxRaydiumLinks" aria-label="Liens Raydium">
          <a href={raydiumPfx}>PFX sur Raydium ↗</a>
          <a href="https://raydium.io/liquidity/">Pools Raydium ↗</a>
        </nav>
        <Component {...pageProps} />
      </div>
      <style jsx>{`
        .pfxBubbleSymbol {
          display: grid;
          place-items: center;
          width: 100%;
          height: 100%;
          box-sizing: border-box;
          border: 2px solid #9a87ff;
          border-radius: 50%;
          background: radial-gradient(circle at 28% 22%, #327e83, #161032 70%);
          color: #eafef6;
          font: 700 clamp(12px, 2vw, 19px) var(--pfx-font);
        }
        .pfxRaydiumLinks {
          width: min(1360px, calc(100% - 32px));
          margin: 6px auto 0;
          display: flex;
          justify-content: flex-end;
          flex-wrap: wrap;
          column-gap: 8px;
        }
        .pfxRaydiumLinks a {
          display: inline-flex;
          align-items: center;
          min-height: 32px;
          padding: 0 8px;
          color: #bce9dd;
          background: #0d161c;
          border-radius: 6px;
          font-size: 12px;
          text-underline-offset: 2px;
        }
      `}</style>
    </>
  );
}
