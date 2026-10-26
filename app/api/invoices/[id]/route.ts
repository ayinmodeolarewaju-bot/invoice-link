import { NextResponse } from "next/server";
import { getInvoice, latestPayment } from "@/lib/db";
export const runtime = "nodejs";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inv = getInvoice(id);
  if (!inv) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ invoice: inv, payment: latestPayment(id) });
}
