import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import PfxPoolStatus from "../components/PfxPoolStatus";
import { readWatchlist, writeWatchlist, mergeWatchlist } from "../utils/watchlist";

const REFRESH_INTERVAL = 60000;
const OFFICIAL_PFX_MINT = "6FwDVfnnETqUe2UrxZEeLA6u7Vo5Td2Nm79z7s38pump";
const OFFICIAL_PFX_TOKEN = {
  mint: OFFICIAL_PFX_MINT,
  name: "PROFITX",
  symbol: "PFX",
  source: "Mint déclaré par PROFITX AI",
  status: "Identité déclarée, pas un audit",
  officialPfx: true,
};

function num(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function money(value) {
  const n = num(value);
  if (n === null) return "N/D";
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(2)} Md$`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(2)} M$`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(1)} k$`;
  return `${n.toLocaleString("fr-FR", {
    maximumFractionDig…12220 tokens truncated…liquidité DEX librement retirable. Les réserves réelles et virtuelles
                        de la courbe de bonding ne sont pas vérifiées par ce contrôle.
                      </span>
                    </div>
                  )}

                  {source === "live" && (
                    <div className="onchainLine">
                      <span>
                        Classification : {token.onchainCreationTime !== null
                          ? token.onchainCreationTime > Date.now()
                            ? "DATE DE CRÉATION FUTURE — À VÉRIFIER"
                            : Date.now() - token.onchainCreationTime <= 24 * 60 * 60 * 1000
                              ? "ÉVÉNEMENT DE CRÉATION HELIUS DATÉ DE MOINS DE 24 H — NON AUDITÉ"
                              : "ÉVÉNEMENT DE CRÉATION HELIUS DATÉ DE PLUS DE 24 H — NON AUDITÉ"
                          : "DATE DE CRÉATION NON CONFIRMÉE — TOKEN SIMPLEMENT INDEXÉ"}
                      </span>
                    </div>
                  )}

                  {source === "live" && (
                    <div className="onchainLine">
                      <span>
                        Première détection PFX : {token.detectedAt && !Number.isNaN(new Date(token.detectedAt).getTime())
                          ? new Date(token.detectedAt).toLocaleString("fr-FR")
                          : "non disponible"}
                      </span>
                    </div>
                  )}

                  {source === "live" && token.liquidityVerification !== "dexscreener_live_pair" && (
                    <div className="onchainLine">
                      <span>
                        Aucune liquidité DEX confirmée pour ce token. S'il est encore sur une bonding curve Pump.fun,
                        la liquidité virtuelle éventuelle ne représente pas une réserve DEX disponible pour la revente.
                      </span>
                    </div>
                  )}

                  {source === "live" && (
                    <div className="onchainLine">
                      <span>
                        Données DEX : {token.marketFetchedAt
                          ? "récupérées le " + new Date(token.marketFetchedAt).toLocaleString("fr-FR") + " (heure de consultation, pas celle du dernier échange)"
                          : "actualisation non confirmée"}
                      </span>
                    </div>
                  )}

                  <div className="marketLine">
                    <div>
                      <span>VARIATION 24 H</span>
                      <strong
                        className={
                          token.change24h === null
                            ? "neutral"
                            : token.change24h > 0
                            ? "positive"
                            : token.change24h < 0
                            ? "negative"
                            : "neutral"
                        }
                      >
                        {percent(token.change24h)}
                      </strong>
                    </div>

                    <div>
                      <span>ACHATS / VENTES</span>
                      <strong>
                        {integer(token.buys24h)}
                        {" / "}
                        {integer(token.sells24h)}
                      </strong>
                    </div>
                  </div>

                  {source === "live" && (
                    <div className="onchainLine">
                      <strong>VÉRIFICATIONS ON-CHAIN</strong>
                      {token.securityChecked ? (
                        <span>
                          Émission : {token.mintAuthorityEnabled ? "AUTORISÉE ⚠" : "DÉSACTIVÉE"}
                          {" • "}
                          Gel : {token.freezeAuthorityEnabled ? "AUTORITÉ ACTIVE ⚠" : "AUTORITÉ ABSENTE"}
                        </span>
                      ) : (
                        <span>Non vérifiées — vérification Solana RPC indisponible</span>
                      )}
                      {token.concentrationChecked && (token.top1AccountPercent !== null || token.top10AccountsPercent !== null) && (
                        <span>
                          Plus gros compte : {token.top1AccountPercent !== null ? token.top1AccountPercent.toFixed(1) + " %" : "non disponible"}
                          {" • "}10 plus gros comptes : {token.top10AccountsPercent !== null ? token.top10AccountsPercent.toFixed(1) + " %" : "non disponible"}
                          {" (comptes tokens, pools et réserves éventuellement inclus)"}
                        </span>
                      )}
                      {token.largestTokenAccountOwner && (
                        <span>
                          Autorité du plus gros compte : {shortMint(token.largestTokenAccountOwner)}
                          {" (adresse on-chain ; pool ou personne non déterminé)"}
                          {token.largestTokenAccountFrozen ? " • COMPTE GELÉ ⚠" : ""}
                        </span>
                      )}
                      {token.largestAuthorityAccountType && (
                        <span>
                          Type de l'autorite du compte principal : {
                            token.largestAuthorityAccountType === "program_owned_account" ? "Compte appartenant a un programme" :
                            token.largestAuthorityAccountType === "executable_program" ? "Programme executable" :
                            "Compte appartenant au programme Systeme"
                          }{token.largestAuthorityKnownProtocol ? " — programme reconnu : " + token.largestAuthorityKnownProtocol : ""} (programme reconnu ne prouve pas que le compte est un pool ni qu'une vente est possible).
                        </span>
                      )}
                      <span>
                        Adresse associée au lancement : {token.creatorAddress
                          ? shortMint(token.creatorAddress)
                          : "NON IDENTIFIÉ"}
                        {token.creatorAddress && token.creatorSeenTokenCount !== null
                          ? " • " + token.creatorSeenTokenCount + " token(s) associés dans la base PFX"
                          : " • historique non disponible"}
                        {" — observation limitée aux tokens indexés par PFX ; cette adresse ne prouve pas l'identité du créateur ni l'ensemble de ses lancements."}
                      </span>
                      <span>
                        Revente : {token.sellabilityEvidence === "transfer_restriction_observed"
                          ? "RESTRICTIONS DE TRANSFERT ⚠ — VENTE NON TESTÉE"
                          : token.sellabilityEvidence === "freeze_risk_observed"
                            ? "RISQUE DE GEL OBSERVÉ ⚠ — VENTE NON TESTÉE"
                          : token.sellabilityEvidence === "historical_sales_observed"
                            ? "VENTES OBSERVÉES SUR UNE PAIRE (24 H) — VOTRE REVENTE NON GARANTIE"
                            : token.liquidity !== null && token.liquidity > 0
                              ? "MARCHÉ OBSERVÉ — VENTE NON TESTÉE"
                              : "NON VÉRIFIÉE"}
                      </span>
                      {token.tokenProgram === "token-2022" && (
                        <span>Token-2022 : {token.tokenExtensions?.length ? `extensions déclarées : ${token.tokenExtensions.join(", ")}. ` : ""}Extensions et restrictions supplémentaires non auditées.</span>
                      )}
                    </div>
                  )}

                  {source === "live" && (
                    <div className="analysisLine">
                      <span>ANALYSE DE SÉCURITÉ</span>
                      <strong>
                        {token.securityScore !== null
                          ? `${Math.round(token.securityScore)}/100 (analyse enregistrée, non audit)`
                          : "EN ATTENTE"}
                      </strong>
                    </div>
                  )}

                  <div className="cardFooter">
                    <div className="tokenStatus">
                      <span>STATUT</span>
                      <strong>
                        {token.status === "pending"
                          ? "EN ATTENTE"
                          : token.status === "enriched"
                          ? "ENRICHI"
                          : token.status}
                      </strong>
                    </div>

                    <div className="cardActions">
                      <button
                        type="button"
                        className={`watchlistButton ${
                          isInWatchlist(token.mint)
                            ? "watchlistAdded"
                            : ""
                        }`}
                        disabled={isInWatchlist(token.mint)}
                        onClick={() => addToWatchlist(token)}
                      >
                        {isInWatchlist(token.mint)
                          ? "AJOUTÉ ✓"
                          : "+ WATCHLIST"}
                      </button>

                      <button
                        type="button"
                        className="analyzeButton"
                        onClick={() =>
                          router.push({
                            pathname: "/",
                            query: { mint: token.mint },
                          })
                        }
                      >
                        ANALYSER →
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </section>
          )}

          <section className="methodology">
            <div>
              <span className="methodNumber">01</span>
              <strong>DÉTECTION</strong>
              <p>
                Helius détecte de nouveaux tokens Solana et
                les enregistre dans Supabase.
              </p>
            </div>
            <div>
              <span className="methodNumber">02</span>
              <strong>ENRICHISSEMENT</strong>
              <p>
                Les informations disponibles sont complétées
                progressivement. Les valeurs absentes restent N/D.
              </p>
            </div>
            <div>
              <span className="methodNumber">03</span>
              <strong>ANALYSE</strong>
              <p>
                Chaque token peut être transmis à PROFITX AI
                Analyzer pour un examen approfondi.
              </p>
            </div>
          </section>

          <footer className="radarFooter">
            <div>
              <strong>PROFITX AI</strong>
              <span>PFX RADAR V2</span>
            </div>
            <p>
              Outil informatif. Une détection ou un score ne
              garantit ni la sécurité ni la performance d&apos;un token.
              Aucun conseil financier.
            </p>
          </footer>
        </div>
      </main>

      <style jsx>{`
        .radarPage {
          min-height: 100vh;
          background:
            radial-gradient(circle at 80% 10%, rgba(33,242,139,.08), transparent 28%),
            radial-gradient(circle at 15% 35%, rgba(89,72,255,.07), transparent 30%),
            #050807;
          color: #f4f7f5;
        }
        .radarShell {
          width: min(1380px, calc(100% - 48px));
          margin: 0 auto;
          padding-bottom: 60px;
        }
        .radarHeader {
          min-height: 92px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          border-bottom: 1px solid #1d3028;
        }
        .brandBlock {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .brandMark {
          width: 46px;
          height: 46px;
          display: grid;
          place-items: center;
          border: 1px solid #21f28b;
          border-radius: 10px;
          color: #21f28b;
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 1px;
          box-shadow: 0 0 24px rgba(33,242,139,.08);
        }
        .brandName {
          font-size: 15px;
          font-weight: 900;
          letter-spacing: 2px;
        }
        .brandSub {
          margin-top: 5px;
          color: #789087;
          font-size: 10px;
          letter-spacing: 2px;
        }
        .navActions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .navButton {
          min-height: 40px;
          padding: 0 14px;
          border: 1px solid #294138;
          border-radius: 10px;
          background: transparent;
          color: #9cb0a8;
          cursor: pointer;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1px;
        }
        .navButton:hover,
        .activeNav {
          border-color: #21f28b;
          color: #21f28b;
        }
        .hero {
          min-height: 410px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 60px;
          padding: 65px 0;
          overflow: hidden;
        }
        .heroCopy {
          position: relative;
          z-index: 2;
          max-width: 780px;
        }
        .eyebrow {
          color: #21f28b;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 3px;
        }
        .hero h1 {
          margin: 18px 0 20px;
          font-size: clamp(58px, 8vw, 118px);
          line-height: .9;
          letter-spacing: -7px;
        }
        .hero h1 span {
          color: #21f28b;
        }
        .hero p {
          max-width: 720px;
          margin: 0;
          color: #9aaba4;
          font-size: 15px;
          line-height: 1.8;
        }
        .radarPulse {
          position: relative;
          flex: 0 0 300px;
          width: 300px;
          height: 300px;
          display: grid;
          place-items: center;
        }
        .pulseRing {
          position: absolute;
          border: 1px solid rgba(33,242,139,.25);
          border-radius: 50%;
        }
        .ringOne { width: 100%; height: 100%; }
        .ringTwo { width: 68%; height: 68%; }
        .ringThree { width: 36%; height: 36%; }
        .pulseLine {
          position: absolute;
          width: 100%;
          height: 1px;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(33,242,139,.6),
            transparent
          );
        }
        .lineOne { transform: rotate(45deg); }
        .lineTwo { transform: rotate(-45deg); }
        .pulseCore {
          position: relative;
          z-index: 2;
          width: 76px;
          height: 76px;
          display: grid;
          place-items: center;
          border: 1px solid #21f28b;
          border-radius: 50%;
          background: #07100c;
          color: #21f28b;
          font-weight: 900;
          box-shadow: 0 0 40px rgba(33,242,139,.2);
        }
        .statusBar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 18px 20px;
          border: 1px solid #1c3128;
          border-radius: 14px;
          background: rgba(8,15,12,.8);
        }
        .statusLeft {
          display: flex;
          align-items: center;
          gap: 13px;
        }
        .statusLeft strong,
        .statusLeft span {
          display: block;
        }
        .statusLeft strong {
          font-size: 11px;
          letter-spacing: 1px;
        }
        .statusLeft span {
          margin-top: 5px;
          color: #71857d;
          font-size: 11px;
        }
        .statusDot {
          width: 9px;
          height: 9px;
          flex: 0 0 9px;
          border-radius: 50%;
        }
        .statusOnline {
          background: #21f28b;
          box-shadow: 0 0 15px #21f28b;
        }
        .statusError {
          background: #ff5d68;
          box-shadow: 0 0 15px rgba(255,93,104,.6);
        }
        .statusActions {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .autoRefresh {
          display: flex;
          align-items: center;
          gap: 7px;
          color: #82958d;
          font-size: 11px;
          cursor: pointer;
        }
        .autoRefresh input {
          accent-color: #21f28b;
        }
        .refreshButton {
          min-height: 40px;
          padding: 0 18px;
          border: 1px solid #21f28b;
          border-radius: 9px;
          background: rgba(33,242,139,.08);
          color: #21f28b;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 1px;
          cursor: pointer;
        }
        .refreshButton:disabled {
          opacity: .5;
          cursor: wait;
        }
        .sourceSelector {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 10px;
          margin-top: 18px;
          padding: 15px;
          border: 1px solid #1c3128;
          border-radius: 12px;
          background: #080d0b;
        }
        .sourceSelector button {
          min-height: 42px;
          padding: 0 16px;
          border: 1px solid #294138;
          border-radius: 9px;
          background: #0a1410;
          color: #a0b4aa;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .5px;
          cursor: pointer;
        }
        .sourceSelector button.sourceActive {
          border-color: #21f28b;
          background: rgba(33,242,139,.12);
          color: #21f28b;
        }
        .sourceSelector span {
          color: #71857d;
          font-size: 11px;
        }
        .controls {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 160px;
          gap: 12px;
          margin: 18px 0 24px;
        }
        .searchBox,
        .controlBox,
        .resultCounter {
          min-height: 82px;
          padding: 14px 16px;
          border: 1px solid #182a23;
          border-radius: 12px;
          background: #080d0b;
        }
        .searchBox label,
        .controlBox label,
        .resultCounter span {
          display: block;
          margin-bottom: 8px;
          color: #60746c;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 1.5px;
        }
        .searchBox input,
        .controlBox select {
          width: 100%;
          height: 36px;
          border: 0;
          outline: 0;
          background: transparent;
          color: #f4f7f5;
          font-size: 13px;
        }
        .searchBox input::placeholder {
          color: #44554e;
        }
        .controlBox select {
          cursor: pointer;
        }
        .controlBox option {
          background: #0b110e;
          color: #fff;
        }
        .resultCounter {
          display: flex;
          flex-direction: column;
          justify-content: center;
          text-align: right;
        }
        .resultCounter strong {
          color: #21f28b;
          font-size: 27px;
        }
        .message,
        .loadingPanel,
        .emptyPanel {
          margin: 25px 0;
          padding: 50px 30px;
          border: 1px solid #1d3028;
          border-radius: 16px;
          background: #080d0b;
          text-align: center;
        }
        .errorMessage {
          border-color: rgba(255,93,104,.35);
        }
        .errorMessage strong {
          color: #ff7881;
          letter-spacing: 2px;
        }
        .errorMessage p,
        .emptyPanel p {
          color: #81938c;
          line-height: 1.7;
        }
        .loadingPanel {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          color: #82958d;
        }
        .loadingPanel strong {
          color: #f4f7f5;
          letter-spacing: 2px;
        }
        .loader {
          width: 38px;
          height: 38px;
          margin-bottom: 10px;
          border: 2px solid #1b3328;
          border-top-color: #21f28b;
          border-radius: 50%;
          animation: spin .8s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .emptyIcon {
          margin-bottom: 12px;
          color: #21f28b;
          font-size: 40px;
        }
        .tokenGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }
        .tokenCard {
          min-width: 0;
          padding: 22px;
          border: 1px solid #1b3027;
          border-radius: 16px;
          background: linear-gradient(
            145deg,
            rgba(13,23,19,.96),
            rgba(6,10,8,.98)
          );
          transition: transform .2s ease, border-color .2s ease;
        }
        .riskGlobalBanner {
          margin: 20px 0;
          padding: 18px 22px;
          border: 2px solid #e4a84b;
          border-radius: 12px;
          background: linear-gradient(100deg, rgba(137,78,0,.25), rgba(75,36,0,.12));
          color: #ffdfa0;
        }
        .riskGlobalBanner strong {
          display: block;
          font-size: 13px;
          letter-spacing: .5px;
        }
        .riskGlobalBanner p {
          font-size: 12px;
          margin: 8px 0 0;
          line-height: 1.6;
        }
        .riskWarning {
          border: 2px solid #f0b74a;
          border-radius: 12px;
          padding: 15px 16px;
          margin-bottom: 17px;
          color: #ffe1a4;
          background: rgba(138, 82, 0, .22);
          box-shadow: inset 0 0 18px rgba(240, 183, 74, .06);
        }
        .riskWarning.critical {
          border-color: #ff5868;
          color: #ffe2e5;
          background: rgba(154, 22, 45, .26);
          box-shadow: inset 0 0 24px rgba(255, 88, 104, .08);
        }
        .riskWarning strong {
          display: block;
          font-size: 13px;
          font-weight: 950;
          letter-spacing: .6px;
          line-height: 1.4;
        }
        .riskWarning p {
          margin: 8px 0 0;
          font-size: 12px;
          line-height: 1.55;
        }
        .tokenCard:hover {
          transform: translateY(-2px);
          border-color: #315244;
        }
        .cardTop {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
        }
        .rank {
          color: #52665e;
          font-size: 12px;
          font-weight: 900;
        }
        .scoreBadge {
          display: flex;
          align-items: baseline;
          gap: 5px;
          padding: 8px 10px;
          border: 1px solid #283b34;
          border-radius: 9px;
        }
        .scoreBadge span {
          margin-right: 5px;
          color: #6f817a;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 1px;
        }
        .scoreBadge strong {
          font-size: 22px;
        }
        .scoreBadge small {
          color: #61736c;
          font-size: 9px;
        }
        .scoreBadge.good strong { color: #21f28b; }
        .scoreBadge.medium strong { color: #ffcf5a; }
        .scoreBadge.bad strong { color: #ff7881; }
        .scoreBadge.neutral strong { color: #8b9c95; }
        .tokenIdentity {
          display: flex;
          align-items: center;
          gap: 14px;
          margin: 22px 0 14px;
        }
        .tokenIcon {
          width: 48px;
          height: 48px;
          display: grid;
          place-items: center;
          flex: 0 0 48px;
          border: 1px solid #29483b;
          border-radius: 12px;
          background: #0c1612;
          color: #21f28b;
          font-size: 12px;
          font-weight: 900;
        }
        .tokenTitle {
          min-width: 0;
        }
        .tokenTitle h2 {
          margin: 0 0 5px;
          overflow-wrap: anywhere;
          font-size: 21px;
          letter-spacing: -.5px;
        }
        .tokenTitle div {
          color: #758880;
          font-size: 11px;
          font-weight: 800;
        }
        .mintButton {
          width: 100%;
          min-height: 38px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 0 12px;
          border: 1px solid #172820;
          border-radius: 9px;
          background: #060a08;
          color: #778a82;
          cursor: pointer;
        }
        .mintButton span {
          overflow: hidden;
          font-family: monospace;
          font-size: 11px;
          text-overflow: ellipsis;
        }
        .mintButton strong {
          color: #21f28b;
          font-size: 8px;
          letter-spacing: 1px;
        }
        .metrics {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
          margin-top: 18px;
        }
        .metric {
          min-height: 75px;
          min-width: 0;
          padding: 12px;
          border: 1px solid #16261f;
          border-radius: 9px;
          background: rgba(4,8,6,.55);
        }
        .metric span,
        .marketLine span,
        .tokenStatus span,
        .onchainLine {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-top: 12px;
          padding: 12px;
          border: 1px solid #263d33;
          border-radius: 9px;
          background: rgba(9, 22, 15, .65);
          color: #a5b7ac;
          font-size: 11px;
          line-height: 1.5;
        }
        .onchainLine strong {
          color: #d0eadb;
          font-size: 10px;
          letter-spacing: .6px;
        }
        .analysisLine span {
          display: block;
          margin-bottom: 9px;
          color: #596d64;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 1px;
        }
        .metric strong {
          overflow-wrap: anywhere;
          font-size: 13px;
        }
        .marketLine {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-top: 8px;
        }
        .marketLine > div {
          padding: 12px;
          border: 1px solid #16261f;
          border-radius: 9px;
        }
        .marketLine strong {
          font-size: 12px;
        }
        .positive { color: #21f28b; }
        .negative { color: #ff6570; }
        .neutral { color: #93a39d; }
        .analysisLine {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-top: 8px;
          padding: 12px;
          border: 1px solid #16261f;
          border-radius: 9px;
        }
        .analysisLine span {
          margin-bottom: 0;
        }
        .analysisLine strong {
          color: #9fb6aa;
          font-size: 11px;
        }
        .cardFooter {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          margin-top: 18px;
          padding-top: 17px;
          border-top: 1px solid #172820;
        }
        .tokenStatus strong {
          font-size: 10px;
          letter-spacing: 1px;
        }
        .cardActions {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .watchlistButton {
          min-height: 42px;
          padding: 0 16px;
          border: 1px solid #21f28b;
          border-radius: 9px;
          background: transparent;
          color: #21f28b;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 1px;
          cursor: pointer;
        }
        .watchlistButton:hover:not(:disabled) {
          background: rgba(33,242,139,.08);
        }
        .watchlistAdded {
          border-color: #315244;
          background: rgba(33,242,139,.08);
          color: #7fae99;
          cursor: default;
        }
        .analyzeButton {
          min-height: 42px;
          padding: 0 20px;
          border: 0;
          border-radius: 9px;
          background: #21f28b;
          color: #03130b;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 1px;
          cursor: pointer;
        }
        .analyzeButton:hover {
          box-shadow: 0 0 25px rgba(33,242,139,.2);
        }
        .methodology {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1px;
          margin-top: 50px;
          border: 1px solid #1a2c24;
          border-radius: 15px;
          overflow: hidden;
          background: #1a2c24;
        }
        .methodology > div {
          padding: 25px;
          background: #080d0b;
        }
        .methodNumber {
          display: block;
          margin-bottom: 20px;
          color: #21f28b;
          font-size: 10px;
          font-weight: 900;
        }
        .methodology strong {
          font-size: 11px;
          letter-spacing: 1.5px;
        }
        .methodology p {
          margin: 10px 0 0;
          color: #72857d;
          font-size: 11px;
          line-height: 1.7;
        }
        .radarFooter {
          display: flex;
          justify-content: space-between;
          gap: 40px;
          margin-top: 45px;
          padding-top: 25px;
          border-top: 1px solid #172820;
        }
        .radarFooter div {
          display: flex;
          gap: 12px;
          font-size: 10px;
          letter-spacing: 1px;
        }
        .radarFooter div span {
          color: #21f28b;
        }
        .radarFooter p {
          max-width: 700px;
          margin: 0;
          color: #566961;
          font-size: 10px;
          line-height: 1.6;
          text-align: right;
        }
        @media (max-width: 1100px) {
          .radarHeader {
            align-items: flex-start;
            flex-direction: column;
            padding: 20px 0;
          }
        }
        @media (max-width: 900px) {
          .radarShell {
            width: calc(100% - 28px);
          }
          .hero {
            min-height: auto;
            padding: 70px 0;
          }
          .radarPulse {
            display: none;
          }
          .hero h1 {
            letter-spacing: -4px;
          }
          .controls {
            grid-template-columns: 1fr 1fr;
          }
          .searchBox {
            grid-column: 1 / -1;
          }
          .tokenGrid {
            grid-template-columns: 1fr;
          }
          .methodology {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 620px) {
          .statusBar,
          .cardFooter,
          .radarFooter {
            align-items: stretch;
            flex-direction: column;
          }
          .navActions,
          .statusActions {
            width: 100%;
            flex-wrap: wrap;
          }
          .navButton,
          .refreshButton {
            flex: 1;
          }
          .hero {
            padding: 55px 0;
          }
          .hero h1 {
            font-size: 58px;
            letter-spacing: -4px;
          }
          .controls {
            grid-template-columns: 1fr;
          }
          .searchBox {
            grid-column: auto;
          }
          .resultCounter {
            text-align: left;
          }
          .metrics {
            grid-template-columns: 1fr 1fr;
          }
          .marketLine {
            grid-template-columns: 1fr;
          }
          .cardActions {
            width: 100%;
            flex-direction: column;
          }
          .watchlistButton,
          .analyzeButton {
            width: 100%;
          }
          .radarFooter p {
            text-align: left;
          }
        }
      `}</style>
    </>
  );
}
