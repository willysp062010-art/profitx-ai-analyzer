import { useEffect, useRef, useState } from "react";
import { usageEventId } from "../utils/usage-client";
export default function AnalyzerUsage() {
  const [stats,setStats]=useState(null);
  const [error,setError]=useState(false);
  const visit=useRef(null);
  const revision=useRef(0);
  useEffect(()=>{
    let active=true; const controller=new AbortController();
    async function refresh() {
      const request=++revision.current;
      try {
        const response=await fetch("/api/usage",{cache:"no-store",signal:controller.signal});const data=await response.json();
        if (!response.ok || !data.ok) throw Error("Unavailable");
        if(active && request===revision.current){setStats(data);setError(false);}
      } catch { if(active && request===revision.current)setError(true); }
    }
    if(!visit.current) {
      visit.current=usageEventId();
      if(visit.current) fetch("/api/usage",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({kind:"visit",eventId:visit.current}),keepalive:true}).catch(()=>{}).finally(()=>{if(active)refresh();});
    }
    refresh();
    const timer=setInterval(refresh,30000);
    window.addEventListener("pfx-usage-updated",refresh);
    return ()=>{active=false;controller.abort();clearInterval(timer);window.removeEventListener("pfx-usage-updated",refresh);};
  },[]);
  const value=key=>error?"N/D":stats?stats[key].toLocaleString("fr-FR"):"…";
  return <section aria-label="Utilisation de l’Analyzer" style={{margin:"24px 0",padding:22,border:"1px solid #2b8b5b",borderRadius:16,background:"#0a1d14",color:"#e7f5ed"}}>
    <h2 style={{margin:"0 0 8px",fontSize:24}}>L’Analyzer en chiffres</h2>
    <p style={{margin:"0 0 18px",color:"#a9c9b8"}}>Activité observée sur cette page</p>
    <div className="pfxUsageGrid">
      {[["visits","Visites comptabilisées"],["analyses","Analyses réalisées"],["todayVisits","Visites aujourd’hui"],["todayAnalyses","Analyses aujourd’hui"]].map(([key,label])=><div key={key}><strong style={{display:"block",fontSize:34,color:"#40f99b"}}>{value(key)}</strong><span>{label}</span></div>)}
    </div>
    <p role="status" style={{fontSize:13,color:"#a9c9b8",marginBottom:0}}>{error?"Statistiques temporairement indisponibles.":stats?"Comptage depuis le "+new Date(stats.since).toLocaleDateString("fr-FR",{timeZone:"Europe/Paris"})+" · Aujourd’hui : heure de Paris · Actualisation toutes les 30 s.":"Chargement des statistiques…"}</p>
    <details style={{marginTop:12,fontSize:13,color:"#a9c9b8"}}><summary>Comment ces chiffres sont-ils comptés ?</summary><p>Les visites correspondent aux ouvertures de cette page, pas à des personnes uniques ni à des comptes connectés. Un rechargement peut compter une nouvelle visite. Les analyses sont comptées lorsque le moteur répond correctement à un lancement depuis cette page, même si les données sont partielles. Les appels automatiques des autres outils sont exclus. Ces mesures restent indicatives : certains robots ou bloqueurs peuvent les fausser.</p><p>Aucune adresse IP, adresse de portefeuille ou adresse de token n’est enregistrée dans ces compteurs. Aucun identifiant persistant de visiteur n’est créé. Aucun historique antérieur au début du comptage n’est reconstitué.</p></details>
  </section>;
}
