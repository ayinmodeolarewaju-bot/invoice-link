// Real-mode dry run (no funds move): asks the live 1-Click API for dry EXACT_OUTPUT quotes
// paying 25.00 USDC on NEAR to the payout account, from several chains/tokens, and verifies
// each quote's Ed25519 signature. Dry quotes return no deposit address, so nothing can be sent.
// Usage: node scripts/live-quote-check.mjs [payoutAccount]   -> writes docs/live-quote-check.json
import { writeFileSync } from "node:fs";
import { verifyQuoteSignature } from "@defuse-protocol/one-click-sdk-typescript";

const BASE = "https://1click.chaindefuser.com";
const PAYOUT = process.argv[2] ?? "purefile1686.near";
const AMOUNT_USDC = "25000000"; // 25.00 USDC (6 decimals)
// Well-known public addresses used only as refund targets (1-Click rejects burn/zero addresses). Dry quotes never create a deposit, so no refund can happen.
const REFUND = {
  eth: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", arb: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  base: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", sol: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM", near: PAYOUT,
};
const ROUTES = [["USDC", "arb"], ["USDT", "arb"], ["USDC", "eth"], ["ETH", "eth"], ["USDC", "base"], ["USDC", "sol"], ["USDT", "near"]];
const headers = { "Content-Type": "application/json" };

const tokens = await (await fetch(`${BASE}/v0/tokens`)).json();
const find = (sym, chain) => tokens.find((t) => t.blockchain === chain && (t.symbol === sym || (sym === "USDT" && t.symbol === "USDT0")));
const dest = find("USDC", "near");
const results = [];
for (const [sym, chain] of ROUTES) {
  const origin = find(sym, chain);
  const row = { route: `${sym} on ${chain} -> USDC on near`, originAsset: origin?.assetId ?? null };
  if (!origin) { results.push({ ...row, ok: false, error: "asset not listed" }); continue; }
  const body = { dry: true, swapType: "EXACT_OUTPUT", slippageTolerance: 100, originAsset: origin.assetId, depositType: "ORIGIN_CHAIN",
    destinationAsset: dest.assetId, amount: AMOUNT_USDC, recipient: PAYOUT, recipientType: "DESTINATION_CHAIN",
    refundTo: REFUND[chain], refundType: "ORIGIN_CHAIN", deadline: new Date(Date.now() + 30 * 60_000).toISOString() };
  try {
    const r = await fetch(`${BASE}/v0/quote`, { method: "POST", headers, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) throw new Error(j?.message ?? `HTTP ${r.status}`);
    let verified = false; try { verified = !!(await verifyQuoteSignature(j)); } catch {}
    // Negative control: the same quote with a tampered amountIn must NOT verify.
    let tamperedRejected = false;
    try { tamperedRejected = !(await verifyQuoteSignature({ ...j, quote: { ...j.quote, amountIn: String(BigInt(j.quote.amountIn) - 1n) } })); } catch { tamperedRejected = true; }
    results.push({ ...row, ok: true, amountIn: `${j.quote.amountInFormatted} ${origin.symbol}`, amountOut: `${j.quote.amountOutFormatted} USDC`,
      timeEstimateSec: j.quote.timeEstimate ?? null, depositAddress: j.quote.depositAddress ?? null, signature: j.signature, timestamp: j.timestamp,
      correlationId: j.correlationId ?? null, signatureVerified: verified, tamperedRejected });
  } catch (e) { results.push({ ...row, ok: false, error: e.message }); }
}
const out = { ranAt: new Date().toISOString(), api: BASE, payout: PAYOUT, destinationAsset: dest.assetId, amountOut: "25.00 USDC", dry: true, results };
writeFileSync("docs/live-quote-check.json", JSON.stringify(out, null, 2) + "\n");
for (const r of results) console.log(r.ok ? `OK   ${r.route.padEnd(30)} pay ${r.amountIn.padEnd(22)} sig ${r.signatureVerified ? "verified" : "NOT verified"}, tampered ${r.tamperedRejected ? "rejected" : "ACCEPTED"}  deposit=${r.depositAddress ?? "none (dry)"}` : `FAIL ${r.route}: ${r.error}`);
process.exit(results.every((r) => r.ok && r.signatureVerified && r.tamperedRejected) ? 0 : 1);
