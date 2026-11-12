// A missing or malformed measurement is unavailable, never an observed zero.
export function nonNegativeObservation(value) {
  if (!["number", "string"].includes(typeof value) || String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}
