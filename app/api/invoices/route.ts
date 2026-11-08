import { NextResponse } from "next/server";
import { newId, saveInvoice, countInvoices, listInvoices } from "@/lib/db";
import { destChainFor, parseCurrency } from "@/lib/currency";
import { invoicesForOwner } from "@/lib/owner";
import type { Invoice } from "@/lib/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// GET /api/invoices?owner=<near account> → summaries of that account's invoices (newest first).
export async function GET(req: Request) {
  const owner = new URL(req.url).searchParams.get("owner");
  return NextResponse.json({ invoices: invoicesForOwner(await listInvoices(), owner) });
}
export async function POST(req: Request) {
  const b = await req.json();
  const items = (b.items ?? []).filter((x: { description: string; amount: number }) => x.description && Number(x.amount) > 0)
    .map((x: { description: string; detail?: string; amount: number }) => ({ description: String(x.description).slice(0, 120), detail: x.detail ? String(x.detail).slice(0, 160) : "", amount: Math.round(Number(x.amount) * 100) / 100 }));
  if (!b.clientName || !items.length || !b.payoutAccount) return NextResponse.json({ error: "clientName, at least one item and payoutAccount are required" }, { status: 400 });
  const currency = parseCurrency(b.currency);
  const now = new Date();
  const inv: Invoice = {
    id: newId(), number: `INV-${now.getUTCFullYear()}-${String((await countInvoices()) + 42).padStart(4, "0")}`,
    fromName: String(b.fromName || "Brook Studio"), fromTagline: String(b.fromTagline || ""), clientName: String(b.clientName), clientEmail: String(b.clientEmail || ""),
    clientLocation: String(b.clientLocation || ""), items, currency, payoutAccount: String(b.payoutAccount).trim(),
    payoutChain: destChainFor(currency, String(b.payoutChain || "near")), ownerAccount: b.ownerAccount ?? null, issuedAt: now.toISOString(),
    dueAt: new Date(now.getTime() + 14 * 864e5).toISOString(), status: "open", createdAt: now.toISOString(), isExample: !!b.isExample,
  };
  await saveInvoice(inv);
  return NextResponse.json(inv, { status: 201 });
}
