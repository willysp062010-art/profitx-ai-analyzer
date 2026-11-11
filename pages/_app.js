import "../styles/globals.css";
import Head from "next/head";

const PFX_BACKGROUNDS = [
  "/ChatGPT%20Image%2019%20mai%202026%2C%2019_22_01.png",
  "/ChatGPT%20Image%205%20sept.%202026%2C%2008_13_25.png",
  "/ChatGPT%20Image%205%20sept.%202026%2C%2008_15_55.png",
];

function PfxBackground() {
  const bubbles = [
    { logo: 0, className: "pfxBubble pfxBubble1" },
    { logo: 1, className: "pfxBubble pfxBubble2" },
    { logo: 2, className: "pfxBubble pfxBubble3" },
    { logo: 1, className: "pfxBubble pfxBubble4" },
    { logo: 0, className: "pfxBubble pfxBubble5" },
    { logo: 2, className: "pfxBubble pfxBubble6" },
    { logo: 0, className: "pfxBubble pfxBubble7" },
    { logo: 1, className: "pfxBubble pfxBubble8" },
  ];

  return (
    <div className="pfxBackground" aria-hidden="true">
      {bubbles.map((bubble, index) => (
        <div className={bubble.className} key={index}>
          <img
            src={PFX_BACKGROUNDS[bubble.logo]}
            alt=""
            draggable="false"
          />
        </div>
      ))}
    </div>
  );
}

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>PROFITX AI — Analyse des tokens Solana</title>
        <meta name="description" content="Analysez les risques des tokens Solana : données de marché, sécurité, concentration, Radar, Watchlist et alertes PROFITX AI." key="description" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <PfxBackground />
      <div className="pfxSiteContent">
        <Component {...pageProps} />
      </div>
    </>
  );
}
