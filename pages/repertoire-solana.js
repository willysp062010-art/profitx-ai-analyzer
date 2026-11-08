import {useEffect,useState} from "react";
import Head from "next/head";
import Link from "next/link";

const money=(value)=>{
  if(value===null||value===undefined||value==="")return "N/D";
  const n=Number(value);
  return Number.isFinite(n)?n.toLocaleString("fr-FR",{maximumFractionDigits:2})+" $":"N/D";
};
const date=(value)=>value?new Date(value).toLocaleString("fr-FR"):"N/D";

export default function RepertoireSolana(){
  const [q,setQ]=useState("");
  const [term,setTerm]=useState("");
  const [page,setPage]=useState(1);
  const [state,setState]=useState({loading:true,tokens:[],count:null,hasMore:false,error:""});
  useEffect(()=>{
    const timer=setTimeout(()=>{setTerm(q.trim());setPage(1);},350);
    return ()=>clearTimeout(timer);
  },[q]);
  useEffect(()=>{
    const ctl=new AbortController();
    const params=new URLSearchParams({q:term,page:String(page)});
    setState(old=>({...old,loading:true,error:""}));
    fetch("/api/token-directory?"+params.toString(),{signal:ctl.signal})
      .then(async response=>{
        const data=await response.json();
        if(!response.ok||!data.ok)throw Error(data.error||"Recherche indisponible");
        return data;
      })
      .then(data=>setState({loading:false,tokens:data.tokens,count:data.count,hasMore:data.hasMore,error:""}))
      .catch(err=>{if(err.name!=="AbortError")setState(old=>({...old,loading:false,error:err.message}));});
    return ()=>ctl.abort();
  },[term,page]);
  const styles={
    page:{minHeight:"100vh",background:"#070b0a",color:"#e7f5ed",fontFamily:"Arial, sans-serif",padding:"24px"},
    shell:{maxWidth:1180,margin:"0 auto"},
    card:{background:"#101b17",border:"1px solid #294c3b",borderRadius:14,padding:18,marginTop:12},
    link:{color:"#42f9a1",textDecoration:"none"},
    input:{width:"100%",maxWidth:610,background:"#101b17",border:"1px solid #347c58",borderRadius:10,padding:15,color:"white",fontSize:16},
    btn:{background:"#123626",color:"#e7f5ed",border:"1px solid #347c58",padding:"10px 16px",borderRadius:8,cursor:"pointer"},
    muted:{color:"#9cb4a5"}
  };
  return <main style={styles.page}>
    <Head><title>Répertoire Solana | PROFITX AI</title><meta name="description" content="Recherche parmi les tokens Solana observés par PROFITX AI. Couverture partielle et données non auditées."/></Head>
    <div style={styles.shell}>
      <nav style={{display:"flex",gap:20,flexWrap:"wrap",marginBottom:32}}>
        <Link href="/" style={styles.link}>ANALYZER</Link>
        <Link href="/radar" style={styles.link}>RADAR LIVE</Link>
        <Link href="/repertoire-solana" style={styles.link}>RÉPERTOIRE SOLANA</Link>
      </nav>
      <div style={{color:"#42f9a1",fontWeight:800,letterSpacing:3}}>PROFITX AI — SOLANA INTELLIGENCE</div>
      <h1 style={{fontSize:"clamp(28px,5vw,46px)",marginBottom:8}}>Répertoire des tokens observés</h1>
      <p style={styles.muted}>Explorez les tokens indexés depuis notre système de détection, y compris les anciennes créations enregistrées.</p>
      <div style={{...styles.card,borderColor:"#937331",color:"#f7d894"}}>
        ⚠ Couverture partielle : ce répertoire ne contient pas encore tous les tokens Solana. Être répertorié ne signifie ni vérifié, ni sûr, ni recommandé à l'achat.
      </div>
      <div style={{marginTop:24}}>
        <input aria-label="Rechercher un token" style={styles.input} value={q} onChange={e=>setQ(e.target.value)} placeholder="Nom, symbole ou adresse mint Solana..." maxLength={64}/>
      </div>
      <p style={styles.muted}>{state.loading?"Recherche en cours...":state.error?"Erreur : "+state.error:state.count===null?"Résultats disponibles":state.count.toLocaleString("fr-FR")+" tokens trouvés"} · Page {page}</p>
      {!state.loading&&!state.error&&state.tokens.length===0&&<div style={styles.card}>Aucun token trouvé dans notre base actuelle. Cela ne prouve pas son inexistence sur Solana.</div>}
      {state.tokens.map(t=><article key={t.mint} style={styles.card}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
          <div><strong style={{fontSize:20}}>{t.name}</strong> <span style={{color:"#42f9a1"}}>{t.symbol!=="N/D"?"$"+t.symbol:""}</span>
            <div style={{...styles.muted,fontSize:12,marginTop:5,overflowWrap:"anywhere"}}>{t.mint}</div></div>
          <Link href={"/?mint="+encodeURIComponent(t.mint)} style={styles.link}>Analyser ce mint →</Link>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12,marginTop:20,fontSize:13}}>
          <div><span style={styles.muted}>Plateforme</span><div>{t.platform}</div></div>
          <div><span style={styles.muted}>Détecté le</span><div>{date(t.detectedAt)}</div></div>
          <div><span style={styles.muted}>Liquidité observée</span><div>{money(t.liquidityUsd)}</div></div>
          <div><span style={styles.muted}>Volume 24 h</span><div>{money(t.volume24hUsd)}</div></div>
          <div><span style={styles.muted}>Analyse</span><div>{t.status||"N/D"}</div></div>
        </div>
      </article>)}
      <div style={{display:"flex",gap:12,marginTop:24,alignItems:"center"}}>
        <button style={styles.btn} disabled={page===1||state.loading} onClick={()=>setPage(n=>Math.max(1,n-1))}>← Précédent</button>
        <span>Page {page}</span>
        <button style={styles.btn} disabled={!state.hasMore||state.loading} onClick={()=>setPage(n=>n+1)}>Suivant →</button>
      </div>
    </div>
  </main>;
}