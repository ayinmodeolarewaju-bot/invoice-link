import { NextResponse } from "next/server";
import { getInvoice, getPaymentByDeposit, saveInvoice, savePayment } from "@/lib/db";
import { liveStatus, mockStatusAt } from "@/lib/oneclick";
export const runtime = "nodejs";
// GET ?depositAddress=...  ->  1-Click /v0/status ; persists transitions and marks the invoice paid on SUCCESS
export async function GET(req: Request) {
  const addr = new URL(req.url).searchParams.get("depositAddress") ?? "";
  const p = getPaymentByDeposit(addr);
  if (!p) return NextResponse.json({ error: "unknown deposit address" }, { status: 404 });
  const final = ["SUCCESS", "REFUNDED", "FAILED"].includes(p.status);
  if (!final) {
    let next = p.status;
    if (p.mock) next = mockStatusAt(p.history.find((h) => h.status === "KNOWN_DEPOSIT_TX")?.at ?? null);
    else {
      try { const r = await liveStatus(addr, p.depositMemo); next = r.status; p.raw = r; }
      catch (e) { return NextResponse.json({ payment: p, warning: (e as Error).message }); }
    }
    if (next !== p.status) {
      const now = new Date().toISOString();
      // fill skipped steps so the rail animates through each one
      const order = ["PENDING_DEPOSIT", "KNOWN_DEPOSIT_TX", "PROCESSING", "SUCCESS"] as const;
      const from = order.indexOf(p.status as (typeof order)[number]), to = order.indexOf(next as (typeof order)[number]);
      if (from >= 0 && to > from) for (let i = from + 1; i <= to; i++) p.history.push({ status: order[i], at: now });
      else p.history.push({ status: next, at: now });
      p.status = next; p.updatedAt = now; savePayment(p);
      if (next === "SUCCESS") { const inv = getInvoice(p.invoiceId); if (inv) { inv.status = "paid"; saveInvoice(inv); } }
    }
  }
  return NextResponse.json({ payment: p });
}
