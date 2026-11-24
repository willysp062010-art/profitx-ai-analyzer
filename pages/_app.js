import "../styles/globals.css";
import "../styles/pfx-observatory.css";
import Head from "next/head";
import Link from "next/link";
import SiteNavigation from "../components/SiteNavigation";

const bubbleTokens = ["PFX", "SOL", "BONK", "ORCA", "PFX", "JUP", "JTO", "MNDE"];

const bubbleLogos = {
  PFX: "/pfx-logo-spectrum.webp",
  SOL: "https://coin-images.coingecko.com/coins/images/4128/small/solana.png?1718769756",
  BONK: "https://coin-images.coingecko.com/coins/images/28600/small/bonk.jpg?1696527587",
  ORCA: "https://coin-images.coingecko.com/coins/images/17547/small/Orca_Logo.png?1696517083",
  JUP: "https://coin-images.coingecko.com/coins/images/34188/small/jup.png?1704266489",
  JTO: "https://coin-images.coingecko.com/coins/images/33228/small/jto.png?1701137022",
  MNDE: "https://coin-images.coingecko.com/coins/images/18867/small/c1.png?1750668234",
};

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
            <img src={bubbleLogos[symbol]} alt="" width="150" height="150" decoding="async" draggable={false} />
          </div>
        ))}
      </div>
      <div className="pfxSiteContent">
        <SiteNavigation />
        <Link className="pfxReleaseStrip" href="/decouvrir#guide-crypto">
          <span className="pfxReleaseCopy">
            <strong>Nouveau en crypto ?</strong>
            <span>Comprenez la blockchain et apprenez à repérer les risques.</span>
          </span>
          <span className="pfxReleaseAction">Ouvrir le guide gratuit <span aria-hidden="true">↗</span></span>
        </Link>
        <nav className="pfxRaydiumLinks" aria-label="Liens Raydium">
          <a href={raydiumPfx}>PFX sur Raydium ↗</a>
          <a href="https://raydium.io/liquidity/">Pools Raydium ↗</a>
        </nav>
        <Component {...pageProps} />
      </div>
      <style jsx>{`
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
