// Server-only wrapper around the NEAR Intents 1-Click Swap API.
// Docs: https://docs.near-intents.org/integration/distribution-channels/1click-api/about-1click-api.md
import type { OneClickStatus, Token } from "./types";

export const BASE = "https://1click.chaindefuser.com";
export const isMock = () => process.env.MOCK_1CLICK !== "0";
const headers = () => {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.ONECLICK_JWT) h["X-API-Key"] = process.env.ONECLICK_JWT;
  return h;
};

// Fallback list used only if the live tokens endpoint is unreachable.
const FALLBACK: Token[] = [
  { assetId: "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1", decimals: 6, blockchain: "near", symbol: "USDC", price: 1 },
  { assetId: "nep141:usdt.tether-token.near", decimals: 6, blockchain: "near", symbol: "USDT", price: 1 },
  { assetId: "nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near", decimals: 6, blockchain: "eth", symbol: "USDC", price: 1 },
  { assetId: "nep141:eth-0xdac17f958d2ee523a2206206994597c13d831ec7.omft.near", decimals: 6, blockchain: "eth", symbol: "USDT", price: 1 },
  { assetId: "nep141:arb-0xaf88d065e77c8cc2239327c5edb3a432268e5831.omft.near", decimals: 6, blockchain: "arb", symbol: "USDC", price: 1 },
  { assetId: "nep141:arb-0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9.omft.near", decimals: 6, blockchain: "arb", symbol: "USDT", price: 1 },
  { assetId: "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near", decimals: 6, blockchain: "base", symbol: "USDC", price: 1 },
  { assetId: "nep141:sol-5ce3bf3a31af18be40ba30f721101b4341690186.omft.near", decimals: 6, blockchain: "sol", symbol: "USDC", price: 1 },
  { assetId: "nep141:eth.omft.near", decimals: 18, blockchain: "eth", symbol: "ETH", price: 2300 },
];

let cache: { at: number; tokens: Token[]; live: boolean } | null = null;
export async function getTokens(): Promise<{ tokens: Token[]; live: boolean }> {
  if (cache && Date.now() - cache.at < 5 * 60_000) return cache;
  try {
    const r = await fetch(`${BASE}/v0/tokens`, { headers: headers(), cache: "no-store", signal: AbortSignal.timeout(6000) });
    if (!r.ok) throw new Error(String(r.status));
    const tokens = (await r.json()) as Token[];
    cache = { at: Date.now(), tokens, live: true };
  } catch {
    cache = { at: Date.now(), tokens: FALLBACK, live: false };
  }
  return cache;
}
// USDT on some chains (e.g. Arbitrum) is listed by 1-Click as USDT0, the omnichain Tether.
export const symMatch = (tokenSym: string, want: string) => tokenSym === want || (want === "USDT" && tokenSym === "USDT0");
export async function findToken(symbol: string, chain: string) {
  const { tokens } = await getTokens();
  const hit = (t: Token) => t.blockchain === chain && symMatch(t.symbol, symbol);
  return tokens.find((t) => hit(t) && t.symbol === symbol) ?? tokens.find(hit) ?? FALLBACK.find(hit) ?? null;
}

export type QuoteInput = {
  dry: boolean; originAsset: string; destinationAsset: string; amountOut: string; recipient: string; refundTo: string; slippageBps?: number;
};
export async function liveQuote(q: QuoteInput) {
  const body = {
    dry: q.dry, swapType: "EXACT_OUTPUT", slippageTolerance: q.slippageBps ?? 100,
    originAsset: q.originAsset, depositType: "ORIGIN_CHAIN", destinationAsset: q.destinationAsset, amount: q.amountOut,
    recipient: q.recipient, recipientType: "DESTINATION_CHAIN", refundTo: q.refundTo, refundType: "ORIGIN_CHAIN",
    deadline: new Date(Date.now() + 30 * 60_000).toISOString(),
  };
  const r = await fetch(`${BASE}/v0/quote`, { method: "POST", headers: headers(), body: JSON.stringify(body), cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.message ?? `1-Click quote failed (${r.status})`);
  return j as { signature?: string; timestamp?: string; correlationId?: string; quoteRequest?: unknown; quote: { depositAddress?: string; depositMemo?: string; amountIn: string; amountInFormatted: string; amountOutFormatted: string; deadline?: string; timeEstimate?: number } };
}
export async function liveSubmitDeposit(depositAddress: string, txHash: string, memo?: string | null) {
  const r = await fetch(`${BASE}/v0/deposit/submit`, { method: "POST", headers: headers(), body: JSON.stringify({ depositAddress, txHash, ...(memo ? { memo } : {}) }) });
  return r.json().catch(() => ({}));
}
export async function liveStatus(depositAddress: string, memo?: string | null) {
  const u = new URL(`${BASE}/v0/status`);
  u.searchParams.set("depositAddress", depositAddress);
  if (memo) u.searchParams.set("depositMemo", memo);
  const r = await fetch(u, { headers: headers(), cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.message ?? `status ${r.status}`);
  return j as { status: OneClickStatus; swapDetails?: unknown };
}

// ---- Mock: deterministic simulation of the same lifecycle ----
export function mockQuote(amountOut: number, originSymbol: string, originPrice: number, originDecimals: number) {
  const feeRate = 0.003; // ~ route + network fee
  const inUsd = amountOut * (1 + feeRate);
  const amountInNum = originSymbol === "USDC" || originSymbol === "USDT" ? inUsd : inUsd / (originPrice || 1);
  const fmt = amountInNum.toFixed(originDecimals > 6 ? 6 : 2);
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(20)), (b) => b.toString(16).padStart(2, "0")).join("");
  return {
    depositAddress: `0x${hex}`, amountIn: BigInt(Math.round(amountInNum * 10 ** Math.min(originDecimals, 9))).toString() + "0".repeat(Math.max(0, originDecimals - 9)),
    amountInFormatted: fmt, amountOutFormatted: amountOut.toFixed(2), deadline: new Date(Date.now() + 30 * 60_000).toISOString(), timeEstimate: 45,
  };
}
// Mock timeline after the payer says they sent funds: 0s KNOWN_DEPOSIT_TX, 3s PROCESSING, 8s SUCCESS
export function mockStatusAt(sentAt: string | null): OneClickStatus {
  if (!sentAt) return "PENDING_DEPOSIT";
  const s = (Date.now() - new Date(sentAt).getTime()) / 1000;
  return s < 3 ? "KNOWN_DEPOSIT_TX" : s < 8 ? "PROCESSING" : "SUCCESS";
}
