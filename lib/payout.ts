// Payout autofill from the connected NEAR wallet.
// The wallet account fills the payout field until the user types their own value; signing out restores the default.
export type PayoutSource = "default" | "wallet" | "manual";
export type PayoutState = { payoutAccount: string; payoutSource: PayoutSource };

export function onWalletChange(s: PayoutState, accountId: string | null, payoutChain: string, fallback: string): PayoutState {
  if (s.payoutSource === "manual") return s; // never clobber a value the user typed
  if (accountId && payoutChain === "near") return { payoutAccount: accountId, payoutSource: "wallet" };
  if (!accountId && s.payoutSource === "wallet") return { payoutAccount: fallback, payoutSource: "default" };
  return s;
}
export function onManualEdit(value: string, accountId: string | null): PayoutState {
  return { payoutAccount: value, payoutSource: accountId && value.trim() === accountId ? "wallet" : "manual" };
}
export const walletPayout = (accountId: string): PayoutState => ({ payoutAccount: accountId, payoutSource: "wallet" });
export const isFromWallet = (s: PayoutState, accountId: string | null) => !!accountId && s.payoutSource === "wallet" && s.payoutAccount.trim() === accountId;
