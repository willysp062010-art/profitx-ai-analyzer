export default function AnalysisQualityNotice({ quality }) {
  if (!quality) return null;
  const partial = quality.status !== "COMPLETE";
  return <div role="status" style={{ margin: "16px 0", padding: 16, borderRadius: 12,
    border: `1px solid ${partial ? "#805f2e" : "#294936"}`, background: partial ? "#1b160d" : "#0b1811",
    color: "#d8e5dd", fontSize: 14, lineHeight: 1.6, overflowWrap: "anywhere" }}>
    <strong style={{ color: partial ? "#ffd18b" : "#80ddb0" }}>{quality.label}</strong>
    {quality.scoreStatus === "PROVISIONAL" && <p>Score indicatif : les limites ci-dessous empêchent une conclusion globale sur la solidité du token.</p>}
    <p>Couverture des critères structurels : {quality.structuralCoverage} %.</p>
    {quality.issues?.length > 0 && <ul>{quality.issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}
    <p style={{ marginBottom: 0 }}>{quality.note}</p>
  </div>;
}
