import type { InvoiceCurrency } from "./types";

export const INVOICE_CURRENCIES = ["USDC", "USDT", "NEAR"] as const;

export function parseCurrency(raw: unknown): InvoiceCurrency {
  const s = String(raw ?? "USDC").trim().toUpperCase();
  if (s === "USDT" || s === "USDT0") return "USDT";
  if (s === "NEAR" || s === "WNEAR") return "NEAR";
  return "USDC";
}

export function isStable(symbol: string): boolean {
  const s = symbol.toUpperCase();
  return s === "USDC" || s === "USDT" || s === "USDT0";
}

// Native NEAR is only quoted as wNEAR on the NEAR chain (nep141:wrap.near).
export function destChainFor(currency: InvoiceCurrency, payoutChain: string): string {
  if (currency === "NEAR") return "near";
  return payoutChain || "near";
}
