import { notFound } from "next/navigation";
import { getInvoice, latestPayment } from "@/lib/db";
import { isMock } from "@/lib/oneclick";
import { PayFlow } from "@/components/PayFlow";
export const dynamic = "force-dynamic";
export default async function Pay({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inv = getInvoice(id);
  if (!inv) notFound();
  return <PayFlow invoice={inv} initialPayment={latestPayment(id)} mock={isMock()} />;
}
