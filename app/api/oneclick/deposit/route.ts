import { NextResponse } from "next/server";
import { getPaymentByDeposit, savePayment } from "@/lib/db";
import { liveSubmitDeposit } from "@/lib/oneclick";
export const runtime = "nodejs";
// POST { depositAddress, txHash }  ->  1-Click /v0/deposit/submit (optional; speeds up detection)
export async function POST(req: Request) {
  const { depositAddress, txHash } = await req.json();
  const p = getPaymentByDeposit(depositAddress);
  if (!p) return NextResponse.json({ error: "unknown deposit address" }, { status: 404 });
  const now = new Date().toISOString();
  p.txHash = txHash || (p.mock ? `0x${Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("")}` : null);
  let upstream: unknown = null;
  if (!p.mock && txHash) upstream = await liveSubmitDeposit(depositAddress, txHash, p.depositMemo);
  if (p.mock && p.status === "PENDING_DEPOSIT") { p.status = "KNOWN_DEPOSIT_TX"; p.history.push({ status: "KNOWN_DEPOSIT_TX", at: now }); }
  p.updatedAt = now; savePayment(p);
  return NextResponse.json({ payment: p, upstream });
}
