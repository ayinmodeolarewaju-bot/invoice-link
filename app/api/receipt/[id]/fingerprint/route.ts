import { getInvoice, latestPayment } from "@/lib/db";
import { receiptFingerprint } from "@/lib/fingerprint";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public, read-only: returns the canonical receipt facts and their SHA-256 so a third party can re-hash and compare.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inv = await getInvoice(id);
  const p = await latestPayment(id);
  if (!inv || !p || p.status !== "SUCCESS") return Response.json({ error: "receipt not available" }, { status: 404 });
  return Response.json(receiptFingerprint(inv, p), { headers: { "cache-control": "no-store" } });
}
