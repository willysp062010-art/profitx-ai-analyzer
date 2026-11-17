import { useEffect, useState } from "react";
export default function AnalysisJourney() {
  const [stats,setStats]=useState(null);
  useEffect(()=>{
    let active=true,revision=0; const controller=new AbortController();
    async function refresh() {
      const request=++revision;
      try {
        const response=await fetch("/api/analysis-usage",{cache:"no-store",signal:controller.signal});
        const data=await response.json();
        if (!response.ok || !data.ok) throw Error("Unavailable");
        if(active && request===revision)setStats(data);
      } catch { if(active && request===revision)setStats(null); }
    }
    refresh(); const timer=setInterval(refresh,30000);
    window.addEventListener("pfx-usage-updated",refresh);
    return ()=>{active=false;controller.abort();clearInterval(timer);window.removeEventListener("pfx-usage-updated",refresh);};
  },[]);
  return <section className="pfxUtility" aria-label="Parcours des analyses">
    <h2>Du lancement au résultat</h2>
    <div className="pfxUsageGrid">{[["started","Analyses lancées"],["completed","Réponses obtenues du moteur"],["failed","Erreurs signalées par le navigateur"]].map(([key,label])=><div key={key}><strong className="pfxJourneyNumber">{stats?stats[key].toLocaleString("fr-FR"):"N/D"}</strong><span>{label}</span></div>)}</div>
    <p className="pfxUtilityNote">{stats?"Mesure depuis le "+new Date(stats.since).toLocaleDateString("fr-FR",{timeZone:"Europe/Paris"})+". ":"Mesure temporairement indisponible. "}Ce nouveau comptage ne reconstitue pas l’historique. Une coupure réseau peut produire une réponse serveur et une erreur navigateur pour le même lancement : ces compteurs ne forment pas un taux de conversion. Aucun wallet, token recherché ou identifiant persistant de visiteur n’est enregistré. Actualisation toutes les 30 secondes.</p>
  </section>;
}
