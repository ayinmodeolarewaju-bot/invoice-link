import type { OneClickStatus, Payment } from "./types";
// Pure 1-Click status state machine, shared by the status route and tests.
export const FINAL: OneClickStatus[] = ["SUCCESS", "REFUNDED", "FAILED"];
export const isFinal = (s: OneClickStatus) => FINAL.includes(s);
const ORDER = ["PENDING_DEPOSIT", "KNOWN_DEPOSIT_TX", "PROCESSING", "SUCCESS"] as const;
// Returns the new history after moving from p.status to next. Skipped happy-path steps are filled in
// so the status rail animates through each one; off-path states (REFUNDED, FAILED, INCOMPLETE_DEPOSIT) are appended as-is.
export function advance(p: Pick<Payment, "status" | "history">, next: OneClickStatus, at: string) {
  if (isFinal(p.status) || next === p.status) return { status: p.status, history: p.history, changed: false };
  const history = [...p.history];
  const from = ORDER.indexOf(p.status as (typeof ORDER)[number]), to = ORDER.indexOf(next as (typeof ORDER)[number]);
  if (from >= 0 && to > from) for (let i = from + 1; i <= to; i++) history.push({ status: ORDER[i], at });
  else history.push({ status: next, at });
  return { status: next, history, changed: true };
}
