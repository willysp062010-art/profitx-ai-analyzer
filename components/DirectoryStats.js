import { useEffect, useState } from "react";

export default function DirectoryStats() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let timer;
    async function refresh() {
      try {
        const response = await fetch("/api/directory-stats", { signal: controller.signal });
        const data = await response.json();
        if (!response.ok || !data.ok || !Number.isSafeInteger(data.total) || data.total < 0 ||
            !Number.isSafeInteger(data.detected24h) || data.detected24h < 0 || data.detected24h > data.total || !Number.isFinite(Date.parse(data.updatedAt))) throw Error();
        if (!controller.signal.aborted) { setStats(data); setError(false); }
      } catch {
        if (!controller.signal.aborted) setError(true);
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(refresh, 60000);
      }
    }
    refresh();
    return () => { controller.abort(); clearTimeout(timer); };
  }, []);
  const value = n => n == null ? (error ? "N/D" : "…") : n.toLocaleString("fr-FR");
  return (
    <section className="pfxDirectoryStats" aria-label="Évolution du répertoire Solana">
      <div className="pfxDirectoryStatsLabel">LE RÉPERTOIRE PFX EN CHIFFRES</div>
      <div className="pfxDirectoryStatsGrid">
        <div><strong>{value(stats?.total)}</strong><span>Tokens Solana observés au total</span></div>
        <div><strong>{value(stats?.detected24h)}</strong><span>Premières détections sur les dernières 24 h</span></div>
      </div>
      <p>Des tokens observés par PFX, pas un décompte de toutes les créations sur Solana. Une première détection peut concerner un token plus ancien. Couverture partielle.</p>
      <p role="status">{error ? (stats ? "Actualisation indisponible — derniers chiffres conservés. " : "Statistiques temporairement indisponibles. ") : "Actualisation automatique toutes les 60 s. "}{stats && "Dernier relevé : " + new Date(stats.updatedAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris" }) + " (Paris)."}</p>
      <p>Ces compteurs restent globaux lorsque vous recherchez ou filtrez des tokens.</p>
    </section>
  );
}
