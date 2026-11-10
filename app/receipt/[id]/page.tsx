import { notFound } from "next/navigation";
import { getInvoice, latestPayment } from "@/lib/db";
import { Receipt } from "@/components/Receipt";
import { receiptFingerprint } from "@/lib/fingerprint";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inv = await getInvoice(id); if (!inv) notFound();
  const p = await latestPayment(id);
  const paid = p && p.status === "SUCCESS" ? p : null;
  return <Receipt invoice={inv} payment={paid} fingerprint={paid ? receiptFingerprint(inv, paid).hash : null} />;
}
