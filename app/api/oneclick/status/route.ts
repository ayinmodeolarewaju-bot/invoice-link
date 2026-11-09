import { NextResponse } from "next/server";
import { getInvoice, getPaymentByDeposit, saveInvoice, savePayment } from "@/lib/db";
import { notifyPaid } from "@/lib/notify";
import { liveStatus, mockStatusAt } from "@/lib/oneclick";
import { advance, isFinal } from "@/lib/status";
export const runtime = "nodejs";
// GET ?depositAddress=...  ->  1-Click /v0/status ; persists transitions and marks the invoice paid on SUCCESS
export async function GET(req: Request) {
  const addr = new URL(req.url).searchParams.get("depositAddress") ?? "";
  const p = await getPaymentByDeposit(addr);
  if (!p) return NextResponse.json({ error: "unknown deposit address" }, { status: 404 });
  if (!isFinal(p.status)) {
    let next = p.status;
    if (p.mock) next = mockStatusAt(p.history.find((h) => h.status === "KNOWN_DEPOSIT_TX")?.at ?? null);
    else {
      try { const r = await liveStatus(addr, p.depositMemo); next = r.status; p.raw = r; }
      catch (e) { return NextResponse.json({ payment: p, warning: (e as Error).message }); }
    }
    const now = new Date().toISOString();
    const step = advance(p, next, now);
    if (step.changed) {
      p.history = step.history; p.status = step.status; p.updatedAt = now; await savePayment(p);
      if (next === "SUCCESS") {
        const inv = await getInvoice(p.invoiceId);
        if (inv) {
          inv.status = "paid";
          await saveInvoice(inv);
          // Fire-and-forget: webhook + optional Resend email. Never block the status response.
          void notifyPaid(inv, p).catch(() => undefined);
        }
      }
    }
  }
  return NextResponse.json({ payment: p });
}
