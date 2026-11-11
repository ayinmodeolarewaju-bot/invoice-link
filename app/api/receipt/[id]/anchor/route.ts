import { getInvoice, latestPayment, saveInvoice } from "@/lib/db";
import { receiptFingerprint } from "@/lib/fingerprint";
import { nearblocksTx, verifyAnchorTx, type AnchorNetwork } from "@/lib/anchor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function load(id: string) {
  const inv = await getInvoice(id);
  const p = await latestPayment(id);
  if (!inv || !p || p.status !== "SUCCESS") return null;
  return { inv, sha256: receiptFingerprint(inv, p).hash };
}

// Verify path: re-fetches the anchor tx from NEAR RPC and re-checks it against the receipt's current fingerprint.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await load(id);
  if (!r) return Response.json({ error: "receipt not available" }, { status: 404 });
  const a = r.inv.anchor;
  if (!a) return Response.json({ anchored: false, sha256: r.sha256 }, { headers: { "cache-control": "no-store" } });
  const check = await verifyAnchorTx({ txHash: a.txHash, signer: a.signer, network: a.network, invoiceId: id, sha256: r.sha256 }).catch((e) => ({ ok: false as const, error: (e as Error).message }));
  return Response.json({ anchored: true, verified: check.ok, error: check.ok ? undefined : check.error, sha256: r.sha256, anchor: a, nearblocks: nearblocksTx(a.network, a.txHash) }, { headers: { "cache-control": "no-store" } });
}

// Record an anchor after the payee signed it in their wallet. The tx is verified on-chain before it is stored,
// so a random hash cannot be attached. Body: { txHash, signer, network }.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await load(id);
  if (!r) return Response.json({ error: "receipt not available" }, { status: 404 });
  if (r.inv.anchor) return Response.json({ error: "receipt already anchored", anchor: r.inv.anchor }, { status: 409 });
  const body = (await req.json().catch(() => ({}))) as { txHash?: string; signer?: string; network?: string };
  const network: AnchorNetwork = body.network === "mainnet" ? "mainnet" : "testnet";
  const check = await verifyAnchorTx({ txHash: String(body.txHash ?? "").trim(), signer: String(body.signer ?? "").trim(), network, invoiceId: id, sha256: r.sha256 })
    .catch((e) => ({ ok: false as const, error: (e as Error).message }));
  if (!check.ok) return Response.json({ error: check.error }, { status: 422 });
  await saveInvoice({ ...r.inv, anchor: check.anchor });
  return Response.json({ anchor: check.anchor, nearblocks: nearblocksTx(network, check.anchor.txHash) });
}
