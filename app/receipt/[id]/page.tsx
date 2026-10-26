import { notFound } from "next/navigation";
import { getInvoice, latestPayment } from "@/lib/db";
import { Receipt } from "@/components/Receipt";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inv = getInvoice(id); if (!inv) notFound();
  const p = latestPayment(id);
  return <Receipt invoice={inv} payment={p && p.status === "SUCCESS" ? p : null} />;
}
