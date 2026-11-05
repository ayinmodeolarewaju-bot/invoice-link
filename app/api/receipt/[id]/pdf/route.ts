import { getInvoice, latestPayment } from "@/lib/db";
import { ReceiptPdf } from "@/components/ReceiptPdf";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Serverless-safe PDF via @react-pdf/renderer (no Chrome).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inv = await getInvoice(id);
  const p = await latestPayment(id);
  if (!inv || !p || p.status !== "SUCCESS") return new Response("receipt not available", { status: 404 });
  const doc = createElement(ReceiptPdf, { invoice: inv, payment: p }) as Parameters<typeof renderToBuffer>[0];
  const buf = await renderToBuffer(doc);
  return new Response(new Uint8Array(buf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="receipt-${inv.number}.pdf"`,
    },
  });
}
