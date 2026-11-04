import { NextResponse } from "next/server";
import { getInvoice, newId, savePayment } from "@/lib/db";
import { findToken, isMock, liveQuote, mockQuote } from "@/lib/oneclick";
import { total, type Payment } from "@/lib/types";
import { CHAINS } from "@/components/fmt";
import { checkNearAccount, refundAddressError } from "@/lib/validate";
import { toBaseUnits, verifyOrReject } from "@/lib/quote";
import { verifyQuoteSignature } from "@defuse-protocol/one-click-sdk-typescript";
export const runtime = "nodejs";
// POST { invoiceId, symbol, chain, refundTo, dry }  ->  1-Click /v0/quote with swapType EXACT_OUTPUT
export async function POST(req: Request) {
  const { invoiceId, symbol, chain, refundTo, dry } = await req.json();
  const inv = getInvoice(invoiceId);
  if (!inv) return NextResponse.json({ error: "invoice not found" }, { status: 404 });
  if (inv.status === "paid") return NextResponse.json({ error: "invoice already paid" }, { status: 409 });
  const origin = await findToken(symbol, chain);
  const dest = await findToken(inv.currency, inv.payoutChain);
  if (!origin || !dest) return NextResponse.json({ error: `unsupported asset ${symbol} on ${chain}` }, { status: 400 });
  if (refundTo || !isMock()) {
    const bad = refundAddressError(origin.blockchain, String(refundTo ?? ""), CHAINS[origin.blockchain] ?? origin.blockchain);
    if (bad) return NextResponse.json({ error: bad, code: "REFUND_INVALID" }, { status: 400 });
  }
  const amountOut = total(inv);
  const mock = isMock();
  let q; let proof: Payment["proof"];
  try {
    if (mock) { q = mockQuote(amountOut, origin.symbol, origin.price, origin.decimals); proof = { signature: "ed25519:SIMULATED-" + q.depositAddress.slice(2, 26), timestamp: new Date().toISOString(), correlationId: null, verified: null, simulated: true }; }
    else {
      if (!refundTo) return NextResponse.json({ error: "refundTo (your address on the origin chain) is required for a live quote" }, { status: 400 });
      if (inv.payoutChain === "near") {
        // Check the payout account exists before quoting, so the client sees a clear error instead of a raw 1-Click failure
        const acct = await checkNearAccount(inv.payoutAccount, "mainnet").catch(() => null);
        if (acct && !acct.exists) return NextResponse.json({ error: `${acct.error} Ask the freelancer to fix the payout account on this invoice.`, code: "PAYOUT_NOT_FOUND" }, { status: 400 });
      }
      const r = await liveQuote({ dry: !!dry, originAsset: origin.assetId, destinationAsset: dest.assetId,
        amountOut: toBaseUnits(amountOut, dest.decimals), recipient: inv.payoutAccount, refundTo });
      // Verify the 1-Click Ed25519 quote signature (docs: /1click-api/verify-quote-signature) before using depositAddress
      const verified = await verifyOrReject(r, verifyQuoteSignature);
      if (!verified) return NextResponse.json({ error: "1-Click quote signature did not verify; refusing to use this quote" }, { status: 502 });
      proof = { signature: r.signature ?? "", timestamp: r.timestamp ?? null, correlationId: r.correlationId ?? null, verified, simulated: false };
      q = { ...r.quote, deadline: r.quote.deadline ?? new Date(Date.now() + 30 * 60_000).toISOString() };
    }
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 502 }); }
  const base = { mock, proof, originAsset: origin.assetId, destinationAsset: dest.assetId, swapType: "EXACT_OUTPUT", ...q };
  if (dry) return NextResponse.json({ dry: true, ...base, depositAddress: undefined });
  if (!q.depositAddress) return NextResponse.json({ error: "no deposit address returned" }, { status: 502 });
  const now = new Date().toISOString();
  const p: Payment = { id: newId(), invoiceId, depositAddress: q.depositAddress, depositMemo: (q as { depositMemo?: string }).depositMemo ?? null,
    originAsset: origin.assetId, originSymbol: origin.symbol, originChain: origin.blockchain, amountIn: q.amountIn, amountInFormatted: q.amountInFormatted,
    amountOutFormatted: q.amountOutFormatted, deadline: q.deadline!, timeEstimate: q.timeEstimate, status: "PENDING_DEPOSIT", txHash: null, mock,
    history: [{ status: "PENDING_DEPOSIT", at: now }], proof, createdAt: now, updatedAt: now };
  savePayment(p);
  return NextResponse.json({ dry: false, ...base, payment: p });
}
