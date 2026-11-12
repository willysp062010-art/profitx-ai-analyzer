import { useEffect, useState } from "react";
import { quoteAge } from "../utils/quote-freshness";

export default function QuoteFreshness({ quotedAt }) {
  const [now, setNow] = useState(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, [quotedAt]);
  const age = now === null ? null : quoteAge(quotedAt, now);
  if (now === null) return <p role="status">Vérification de la date de cotation…</p>;
  if (age === null) return <p role="status">Date de cotation non confirmée : relancez la demande.</p>;
  return <p role="status" style={{color:age >= 60 ? "#ffbf57" : "#a9bfb3",lineHeight:1.6}}>
    {age >= 60 ? "Cotation ancienne — relancez la demande avant toute comparaison. " : "Cotation indicative. "}
    Relevé du {new Date(quotedAt).toLocaleString("fr-FR",{timeZone:"Europe/Paris"})} (Paris).
    {" "}{age < 60 ? "Moins d’une minute." : "Valeurs conservées à titre historique."}
    {" "}Une route cotée ne garantit jamais l’exécution d’une vente.
  </p>;
}
