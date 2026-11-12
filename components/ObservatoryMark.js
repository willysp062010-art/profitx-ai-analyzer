// Brand illustration only: the rings do not represent a score or live data.
export default function ObservatoryMark() {
  return <div className="pfxObservatoryMark" aria-label="Identité PROFITX AI Analyzer">
    <div className="pfxMarkLabel"><span>PROFITX / OBSERVATOIRE</span><span>SOLANA</span></div>
    <div className="pfxMarkInstrument">
      <svg className="pfxMarkOrbits" viewBox="0 0 480 480" fill="none" aria-hidden="true">
        <circle cx="240" cy="240" r="221" stroke="currentColor" strokeDasharray="2 12" />
        <circle cx="240" cy="240" r="198" stroke="currentColor" />
        <path d="M45 250A198 198 0 0 1 250 42" stroke="var(--pfx-magenta)" strokeWidth="3" />
        <path d="M438 230A198 198 0 0 1 230 438" stroke="var(--pfx-cyan)" strokeWidth="3" />
        <path d="M8 240H55M425 240H472M240 8V55M240 425V472" stroke="currentColor" />
      </svg>
      <img src="/profitx-logo-02-analyzer.png" width="350" height="350" alt="Logo officiel PROFITX AI Analyzer" fetchPriority="high" />
      <span className="pfxMarkTag pfxMarkTagTop">DONNÉES</span>
      <span className="pfxMarkTag pfxMarkTagBottom">RISQUES & SOURCES</span>
    </div>
    <div className="pfxMarkFooter"><span className="pfxSpectrum" aria-hidden="true"><i/><i/><i/></span><span>Observer. Comprendre. Décider.</span></div>
  </div>;
}
