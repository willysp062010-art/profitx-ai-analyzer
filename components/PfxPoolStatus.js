import { useEffect, useState } from "react";

function formatted(value, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "N/D";
  return Number(value).toLocaleString("fr-FR", { maximumFractionDigits: digits });
}
export default function PfxPoolStatus({ analysisContext = false }) {
  const [pool, setPool] = useState(null);
  const [status, setStatus] = useState("loading");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/pfx-raydium-pool", { signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok || !data.ok) throw Error(data.error || "Indisponible");
        return data;
      })
      .then(data => { setPool(data); setStatus("ready"); })
      .catch(error => {
        if (error.name !== "AbortError") setStatus("error");
      });
    return () => controller.abort();
  }, []);
  const text = { color: "#c8e7d8", fontSize: 13 };
  return <div style={{
    background: "#071810", border: "1px solid #276d4b", borderRadius: 10,
    padding: "14px", marginTop: 14, marginBottom: 14
  }}>
    <strong style={{ color: "#55ffba" }}>POOL PFX / WSOL — RAYDIUM</strong>
    {analysisContext && <p style={text}>
      Les données de ce pool Raydium sont présentées séparément des chiffres et scores de la paire analysée.
    </p>}
    {status === "loading" && <p style={text}>Lecture des réserves Raydium...</p>}
    {status === "error" && <p style={text}>Données indisponibles. La pool reste consultable sur Solscan.</p>}
    {status === "ready" && pool && <>
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(115px,1fr))",
        gap: 14, marginTop: 12, marginBottom: 12
      }}>
        <div><div style={text}>Liquidité TVL</div><strong>{formatted(pool.tvlUsd)} $</strong></div>
        <div><div style={text}>Réserve SOL</div><strong>{formatted(pool.solReserve, 9)}</strong></div>
        <div><div style={text}>Réserve PFX</div><strong>{formatted(pool.pfxReserve, 3)}</strong></div>
        <div><div style={text}>Volume 24 h</div><strong>{formatted(pool.volume24hUsd)} $</strong></div>
      </div>
      <p style={{ ...text, fontSize: 12 }}>
        Source : Raydium API v3 · Consultation : {new Date(pool.checkedAt).toLocaleString("fr-FR")}.
        Les chiffres peuvent être différés ; ils ne garantissent pas la liquidité disponible à la seconde.
      </p>
    </>}
    <p style={{...text, fontSize: 12, overflowWrap: "anywhere"}}>Pool : 8xezT7zFCg3adVTyME72qiA42upJdy8SATFyhZJcX9jb</p>
    <div style={{display:"flex",flexWrap:"wrap",gap:16}}>
      <a href="https://solscan.io/account/8xezT7zFCg3adVTyME72qiA42upJdy8SATFyhZJcX9jb"
         target="_blank" rel="noopener noreferrer" style={{color:"#55ffba"}}>Vérifier sur Solscan ↗</a>
      <a href="https://raydium.io/liquidity/increase/?mode=add&pool_id=8xezT7zFCg3adVTyME72qiA42upJdy8SATFyhZJcX9jb"
         target="_blank" rel="noopener noreferrer" style={{color:"#55ffba"}}>Voir sur Raydium ↗</a>
    </div>
  </div>;
}