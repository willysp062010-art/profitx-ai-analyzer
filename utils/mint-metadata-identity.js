// Metadata describes a token; it does not verify the legitimacy of its project.
export function mintMetadataIdentity(moduleResult, mint) {
  const metadata = moduleResult?.analysis?.metadata;
  if (moduleResult?.ok !== true || moduleResult.mint !== mint || metadata?.decoded !== true || metadata.metadataMint !== mint) return {};
  const text = value => typeof value === "string" && value.trim() ? value.trim().slice(0,200) : null;
  return { name: text(metadata.name), symbol: text(metadata.symbol) };
}
