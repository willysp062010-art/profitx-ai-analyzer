// Brand artwork only: no score, audit result or live measurement is implied.
export default function ObservatoryMark() {
  return <div className="pfxObservatoryMark" aria-label="Identité PROFITX AI Analyzer">
    <div className="pfxMarkLabel"><span>PROFITX AI</span><span>SOLANA</span></div>
    <div className="pfxMarkInstrument">
      <img src="/pfx-logo-spectrum.webp" width="900" height="900"
        alt="Logo officiel PFX multicolore, argent, cyan, violet, magenta et vert"
        fetchPriority="high" decoding="async" />
    </div>
    <div className="pfxMarkFooter"><span className="pfxSpectrum" aria-hidden="true"><i/><i/><i/></span><span>Observer. Comprendre. Décider.</span></div>
  </div>;
}
