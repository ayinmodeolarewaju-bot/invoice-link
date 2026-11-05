import { NextResponse } from "next/server";
import { getInvoice, latestPayment } from "@/lib/db";
export const runtime = "nodejs";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inv = await getInvoice(id);
  if (!inv) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ invoice: inv, payment: await latestPayment(id) });
}
