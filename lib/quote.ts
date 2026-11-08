// Pure helpers for mapping an invoice total to a 1-Click EXACT_OUTPUT quote request.
// Invoice amounts are in the destination currency with 2 decimals; 1-Click wants an integer string in that token's base units.
export function toBaseUnits(amount: number, decimals: number): string {
  if (!Number.isFinite(amount) || amount < 0) throw new Error("invalid amount");
  const cents = BigInt(Math.round(amount * 100));
  if (decimals >= 2) return (cents * 10n ** BigInt(decimals - 2)).toString();
  return (cents / 10n ** BigInt(2 - decimals)).toString();
}
// Verify a live quote with the given verifier; any throw or falsy result counts as a rejection.
export async function verifyOrReject(quote: unknown, verify: (q: never) => unknown | Promise<unknown>): Promise<boolean> {
  try { return !!(await verify(quote as never)); } catch { return false; }
}
