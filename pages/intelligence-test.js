export default function IntelligenceLegacyRedirect() { return null; }
export function getServerSideProps() {
  return { redirect: { destination: "/intelligence", permanent: true } };
}
