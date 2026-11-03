
import { useState } from "react";
import Head from "next/head";

const PFX_MINT =
  "6FwDVfnnETqUe2UrxZEeLA6u7Vo5Td2Nm79z7s38pump";

const RAYDIUM_URL =
  `https://raydium.io/swap/?inputMint=sol&outputMint=${PFX_MINT}`;

const DEXSCREENER_URL =
  "https://dexscreener.com/solana/8xezT7zFCg3adVTyME72qiA42upJdy8SATFyhZJcX9jb";

const PHANTOM_URL = "https://phantom.com/";

export default function ObtenirPFX() {
  const [copied, setCopied] = useState(false);

  async function copyMint() {
    try {
      await navigator.clipboard.writeText(PFX_MINT);
      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <Head>
        <title>Obtenir PFX sur Raydium | PROFITX AI</title>
        <meta
          name="description"
          content="Guide officiel pour obtenir PROFITX PFX sur Raydium, réseau Solana. Vérifiez le mint et les risques avant toute transaction."
        />
      </Head>

      <main className="page">
        <header className="topbar">
          <a href="/" className="brand">
            <span className="logo">P</span>
            <span>PROFITX AI</span>
          </a>

          <nav className="nav">
            <a href="/">ANALYZER</a>
            <a href="/radar">RADAR</a>
            <a href="/compare">COMPARE</a>
            <a href="/intelligence">INTELLIGENCE</a>
            <a href="/watchlist">WATCHLIST</a>
            <a href="/alerts">ALERTS</a>
            <a href="/obtenir-pfx" className="activeNav">
              OBTENIR PFX
            </a>
          </nav>
        </header>

        <section className="hero">
          <div className="eyebrow">
            PROFITX • TOKEN OFFICIEL • SOLANA
          </div>

          <h1>
            Obtenir <span>PFX</span>
          </h1>

          <p className="lead">
            PROFITX PFX dispose désormais de son pool
            officiel PFX/SOL sur Raydium.
            Ce guide vous accompagne étape par étape
            pour accéder au token officiel.
          </p>

          <div className="status">
            <span className="statusDot" />
            POOL PFX/SOL CRÉÉ SUR RAYDIUM
          </div>

          <div className="official">
            <div>
              <div className="small">
                MINT OFFICIEL PFX
              </div>

              <div className="mint">
                {PFX_MINT}
              </div>
            </div>

            <button
              type="button"
              onClick={copyMint}
              className="copyButton"
            >
              {copied ? "COPIÉ ✓" : "COPIER"}
            </button>
          </div>

          <div className="warning">
            <strong>IMPORTANT — SÉCURITÉ</strong>

            <p>
              Vérifiez toujours le mint officiel avant
              toute transaction. Ne communiquez jamais
              votre phrase de récupération, votre clé
              privée ou vos codes d&apos;accès.
            </p>

            <p>
              ProfitX ne vous demandera jamais
              l&apos;accès à votre wallet.
            </p>

            <p>
              La liquidité du pool PFX/SOL est actuellement
              très faible. Les transactions peuvent entraîner
              un impact important sur le prix, du slippage
              et des pertes financières. Vérifiez toujours
              le montant reçu avant de confirmer.
            </p>
          </div>
        </section>

        <section className="quick">
          <div>
            <div className="eyebrow">
              DÉJÀ PRÊT ?
            </div>

            <h2>
              Vous avez déjà Phantom et du SOL ?
            </h2>

            <p>
              Accédez directement à Raydium pour
              consulter le marché PFX/SOL.
              Vérifiez le token et les conditions
              de transaction avant tout échange.
            </p>
          </div>

          <a
            href={RAYDIUM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="primaryButton"
          >
            OUVRIR PFX SUR RAYDIUM →
          </a>
        </section>

        <section className="market">
          <div className="eyebrow">
            MARCHÉ PFX/SOL
          </div>

          <h2>
            Suivre PFX sur DexScreener
          </h2>

          <p>
            Consultez les transactions, la liquidité,
            les volumes et l&apos;évolution du marché
            directement sur DexScreener.
          </p>

          <p>
            Les données de marché peuvent évoluer
            rapidement. Le référencement ne constitue
            pas une validation de sécurité du token.
          </p>

          <a
            href={DEXSCREENER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="secondaryButton"
          >
            VOIR PFX SUR DEXSCREENER →
          </a>
        </section>

        <section className="guide">
          <div className="sectionTitle">
            <div className="eyebrow">
              GUIDE DÉBUTANT
            </div>

            <h2>
              Comment obtenir PFX sur Raydium ?
            </h2>

            <p>
              Suivez simplement les étapes
              dans l&apos;ordre.
            </p>
          </div>

          <article className="step">
            <div className="number">01</div>

            <div className="content">
              <div className="stepLabel">
                WALLET
              </div>

              <h3>
                Préparer Phantom
              </h3>

              <p>
                Phantom est un wallet compatible avec
                Solana. Si vous ne l&apos;avez pas
                encore, utilisez uniquement son
                site officiel.
              </p>

              <p className="securityText">
                Lors de la création du wallet,
                conservez vos informations de
                récupération dans un endroit sûr
                et ne les communiquez à personne.
              </p>

              <a
                href={PHANTOM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="secondaryButton"
              >
                SITE OFFICIEL PHANTOM →
              </a>
            </div>
          </article>

          <article className="step">
            <div className="number">02</div>

            <div className="content">
              <div className="stepLabel">
                SOLANA
              </div>

              <h3>
                Avoir du SOL dans Phantom
              </h3>

              <p>
                Les échanges PFX/SOL s&apos;effectuent
                sur le réseau Solana. Votre wallet
                doit donc contenir du SOL.
              </p>

              <p>
                Selon votre pays et votre appareil,
                Phantom peut proposer différentes
                méthodes pour obtenir du SOL.
                Vous pouvez également transférer
                du SOL depuis une plateforme
                que vous utilisez déjà.
              </p>

              <div className="tip">
                Gardez également une petite quantité
                de SOL disponible pour les frais
                du réseau.
              </div>
            </div>
          </article>

          <article className="step">
            <div className="number">03</div>

            <div className="content">
              <div className="stepLabel">
                VÉRIFICATION
              </div>

              <h3>
                Vérifier le PFX officiel
              </h3>

              <p>
                Le nom ou le logo d&apos;un token
                ne suffit jamais pour vérifier
                son identité.
              </p>

              <p>
                Comparez toujours son adresse
                avec le mint officiel publié
                par PROFITX AI.
              </p>

              <div className="mintBox">
                <span>Mint officiel</span>

                <strong>
                  {PFX_MINT}
                </strong>

                <button
                  type="button"
                  onClick={copyMint}
                >
                  {copied
                    ? "ADRESSE COPIÉE ✓"
                    : "COPIER LE MINT"}
                </button>
              </div>
            </div>
          </article>

          <article className="step">
            <div className="number">04</div>

            <div className="content">
              <div className="stepLabel">
                RAYDIUM
              </div>

              <h3>
                Ouvrir Raydium
              </h3>

              <p>
                Raydium est désormais la plateforme
                d&apos;échange principale présentée
                par PROFITX AI pour le token PFX.
              </p>

              <p>
                Utilisez le bouton ci-dessous.
                Le lien prépare une recherche
                d&apos;échange SOL vers PFX
                avec le mint officiel.
              </p>

              <p>
                Vérifiez que Raydium affiche bien
                le token correspondant à notre
                adresse officielle avant
                de poursuivre.
              </p>

              <a
                href={RAYDIUM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="primaryButton"
              >
                OUVRIR PFX SUR RAYDIUM →
              </a>
            </div>
          </article>

          <article className="step">
            <div className="number">05</div>

            <div className="content">
              <div className="stepLabel">
                TRANSACTION
              </div>

              <h3>
                Connecter le wallet et vérifier
              </h3>

              <p>
                Sur Raydium, connectez votre wallet
                compatible Solana si vous souhaitez
                effectuer un échange.
              </p>

              <p>
                Sélectionnez SOL comme token de départ
                et vérifiez que le token de destination
                est bien le PFX officiel.
              </p>

              <p>
                Avant toute confirmation, examinez
                le montant de PFX attendu, le taux
                de change, les frais, le slippage
                et l&apos;impact sur le prix.
              </p>

              <div className="tip">
                ATTENTION : la liquidité PFX/SOL
                est actuellement très limitée.
                Même un échange de faible montant
                peut entraîner une variation
                importante du prix.
              </div>

              <div className="tip">
                Vous restez seul décisionnaire
                du montant et de la transaction.
                PFX est un actif spéculatif :
                aucune performance ou valeur future
                n&apos;est garantie.
              </div>
            </div>
          </article>

          <article className="step">
            <div className="number">06</div>

            <div className="content">
              <div className="stepLabel">
                TERMINÉ
              </div>

              <h3>
                Vérifier votre wallet
              </h3>

              <p>
                Une fois la transaction confirmée
                sur Solana, vérifiez votre wallet.
                L&apos;affichage d&apos;un token peut
                parfois demander un court délai
                selon les services utilisés.
              </p>

              <p>
                Vous pouvez également consulter
                les informations de marché
                PFX/SOL sur DexScreener.
              </p>

              <a
                href={DEXSCREENER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="secondaryButton"
              >
                SUIVRE PFX SUR DEXSCREENER →
              </a>
            </div>
          </article>
        </section>

        <section className="finalCta">
          <div className="eyebrow">
            PROFITX AI • PFX • SOLANA
          </div>

          <h2>
            PFX est disponible sur Raydium
          </h2>

          <p>
            Retrouvez notre pool officiel PFX/SOL
            sur Raydium et suivez son activité
            sur DexScreener.
          </p>

          <p>
            Vérifiez une dernière fois le mint
            officiel et les risques avant toute
            interaction.
          </p>

          <div className="finalButtons">
            <button
              type="button"
              onClick={copyMint}
              className="secondaryButton buttonReset"
            >
              {copied
                ? "MINT COPIÉ ✓"
                : "COPIER LE MINT"}
            </button>

            <a
              href={RAYDIUM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="primaryButton"
            >
              ACCÉDER À RAYDIUM →
            </a>

            <a
              href={DEXSCREENER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="secondaryButton"
            >
              DEXSCREENER →
            </a>
          </div>
        </section>

        <footer className="footer">
          <strong>PROFITX AI</strong>

          <p>
            Ce guide est fourni à titre informatif.
            Il ne constitue pas un conseil financier
            ni une promesse de rendement.
            Les crypto-actifs présentent un risque
            de perte en capital.
          </p>

          <p>
            Le pool Raydium est distinct du marché
            Pump.fun existant. La création du pool
            ne ferme pas automatiquement
            la bonding curve Pump.fun.
          </p>
        </footer>
      </main>

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        .page {
          min-height: 100vh;
          background:
            radial-gradient(
              circle at 50% 0%,
              rgba(33, 242, 139, 0.08),
              transparent 32%
            ),
            #030706;
          color: #f4f7f5;
          padding: 0 22px 80px;
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        .topbar {
          width: 100%;
          max-width: 1120px;
          min-height: 82px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          border-bottom:
            1px solid rgba(255, 255, 255, 0.08);
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
          color: #ffffff;
          text-decoration: none;
          font-size: 17px;
          font-weight: 900;
          letter-spacing: 0.8px;
        }

        .logo {
          width: 36px;
          height: 36px;
          display: grid;
          place-items: center;
          border-radius: 9px;
          color: #03140c;
          background: #21f28b;
          box-shadow:
            0 0 22px rgba(33, 242, 139, 0.2);
        }

        .nav {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          flex-wrap: wrap;
          gap: 8px;
        }

        .nav a {
          min-height: 42px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 14px;
          border:
            1px solid rgba(255, 255, 255, 0.12);
          border-radius: 10px;
          background: transparent;
          color: #a9b5af;
          text-decoration: none;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.8px;
        }

        .nav a:hover,
        .nav .activeNav {
          border-color: #21f28b;
          color: #21f28b;
        }

        .hero,
        .quick,
        .market,
        .guide,
        .finalCta,
        .footer {
          width: 100%;
          max-width: 960px;
          margin-left: auto;
          margin-right: auto;
        }

        .hero {
          padding: 78px 0 42px;
          text-align: center;
        }

        .eyebrow,
        .stepLabel,
        .small {
          color: #21f28b;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 1.6px;
        }

        h1 {
          margin: 14px 0 18px;
          font-size: clamp(48px, 8vw, 82px);
          line-height: 0.98;
          letter-spacing: -3px;
        }

        h1 span {
          color: #21f28b;
        }

        h2 {
          margin: 8px 0 12px;
          font-size: clamp(26px, 4vw, 38px);
          letter-spacing: -1px;
        }

        h3 {
          margin: 7px 0 12px;
          font-size: 25px;
        }

        .lead {
          max-width: 670px;
          margin: 0 auto;
          color: #a9b5af;
          font-size: 18px;
          line-height: 1.7;
        }

        .status {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-top: 26px;
          padding: 12px 18px;
          border:
            1px solid rgba(33, 242, 139, 0.3);
          border-radius: 999px;
          background: rgba(33, 242, 139, 0.06);
          color: #21f28b;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.7px;
        }

        .statusDot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #21f28b;
        }

        .official {
          margin: 38px auto 0;
          padding: 20px;
          max-width: 820px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          text-align: left;
          border:
            1px solid rgba(33, 242, 139, 0.32);
          border-radius: 14px;
          background: rgba(33, 242, 139, 0.04);
        }

        .mint {
          margin-top: 7px;
          color: #ffffff;
          font-family: monospace;
          font-size: 14px;
          overflow-wrap: anywhere;
        }

        .copyButton,
        .mintBox button {
          flex-shrink: 0;
          cursor: pointer;
          border: 1px solid #21f28b;
          border-radius: 9px;
          padding: 11px 15px;
          background: transparent;
          color: #21f28b;
          font-weight: 900;
        }

        .warning {
          max-width: 820px;
          margin: 18px auto 0;
          padding: 20px;
          text-align: left;
          border:
            1px solid rgba(255, 190, 80, 0.3);
          border-radius: 14px;
          background: rgba(255, 190, 80, 0.045);
          color: #c8cec9;
          line-height: 1.6;
        }

        .warning strong {
          color: #ffd27a;
          letter-spacing: 1px;
        }

        .warning p:last-child {
          margin-bottom: 0;
        }

        .quick {
          padding: 26px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 30px;
          border:
            1px solid rgba(33, 242, 139, 0.24);
          border-radius: 18px;
          background: #07100c;
        }

        .quick p,
        .market p,
        .sectionTitle p,
        .content p,
        .finalCta p,
        .footer p {
          color: #a9b5af;
          line-height: 1.7;
        }

        .primaryButton,
        .secondaryButton {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 50px;
          padding: 12px 20px;
          border-radius: 10px;
          text-decoration: none;
          text-align: center;
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 0.6px;
          transition:
            transform 0.15s ease,
            opacity 0.15s ease;
        }

        .primaryButton:hover,
        .secondaryButton:hover {
          transform: translateY(-1px);
          opacity: 0.92;
        }

        .primaryButton {
          border: 1px solid #21f28b;
          background: #21f28b;
          color: #02130b;
          box-shadow:
            0 0 22px rgba(33, 242, 139, 0.12);
        }

        .secondaryButton {
          border: 1px solid #21f28b;
          background: #07100c;
          color: #21f28b;
        }

        .market {
          margin-top: 22px;
          padding: 30px;
          border:
            1px solid rgba(33, 242, 139, 0.18);
          border-radius: 18px;
          background: rgba(33, 242, 139, 0.025);
        }

        .market .secondaryButton {
          margin-top: 12px;
        }

        .guide {
          padding-top: 72px;
        }

        .sectionTitle {
          margin-bottom: 26px;
        }

        .step {
          display: grid;
          grid-template-columns: 90px 1fr;
          gap: 28px;
          padding: 32px;
          margin-bottom: 16px;
          border:
            1px solid rgba(255, 255, 255, 0.09);
          border-radius: 18px;
          background:
            linear-gradient(
              135deg,
              rgba(255, 255, 255, 0.025),
              rgba(33, 242, 139, 0.018)
            );
        }

        .number {
          color: rgba(33, 242, 139, 0.3);
          font-size: 42px;
          font-weight: 900;
          line-height: 1;
        }

        .content {
          min-width: 0;
        }

        .securityText {
          padding-left: 14px;
          border-left: 2px solid #21f28b;
        }

        .tip {
          margin-top: 18px;
          padding: 14px 16px;
          border-radius: 10px;
          background: rgba(33, 242, 139, 0.055);
          color: #d9e1dd;
          line-height: 1.6;
        }

        .mintBox {
          margin-top: 20px;
          padding: 18px;
          border:
            1px solid rgba(33, 242, 139, 0.22);
          border-radius: 12px;
          background: #030806;
        }

        .mintBox span {
          display: block;
          margin-bottom: 8px;
          color: #7f8d86;
          font-size: 12px;
          font-weight: 800;
        }

        .mintBox strong {
          display: block;
          margin-bottom: 16px;
          color: #ffffff;
          font-family: monospace;
          font-size: 14px;
          overflow-wrap: anywhere;
        }

        .finalCta {
          margin-top: 70px;
          padding: 42px 30px;
          text-align: center;
          border:
            1px solid rgba(33, 242, 139, 0.3);
          border-radius: 20px;
          background:
            radial-gradient(
              circle at center,
              rgba(33, 242, 139, 0.08),
              rgba(33, 242, 139, 0.02)
            );
        }

        .finalButtons {
          margin-top: 24px;
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 12px;
        }

        .buttonReset {
          cursor: pointer;
          font-family: inherit;
        }

        .footer {
          margin-top: 42px;
          padding-top: 28px;
          text-align: center;
          border-top:
            1px solid rgba(255, 255, 255, 0.08);
        }

        .footer strong {
          color: #21f28b;
        }

        .footer p {
          max-width: 720px;
          margin: 10px auto 0;
          font-size: 12px;
        }

        @media (max-width: 720px) {
          .page {
            padding-left: 15px;
            padding-right: 15px;
          }

          .topbar {
            min-height: 70px;
          }

          .brand {
            font-size: 14px;
          }

          .hero {
            padding-top: 52px;
          }

          h1 {
            letter-spacing: -2px;
          }

          .official,
          .quick {
            flex-direction: column;
            align-items: stretch;
          }

          .official {
            text-align: center;
          }

          .copyButton {
            width: 100%;
          }

          .quick {
            text-align: center;
          }

          .market {
            padding: 24px 20px;
          }

          .step {
            grid-template-columns: 1fr;
            gap: 15px;
            padding: 24px 20px;
          }

          .number {
            font-size: 32px;
          }

          .primaryButton,
          .secondaryButton {
            width: 100%;
          }
        }
      `}</style>
    </>
  );
}
