import { getInvoice, latestPayment } from "@/lib/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Renders /receipt/[id] in headless Chrome (print media) and returns a real PDF.
// Needs a local Chrome/Chromium: CHROME_PATH or /usr/bin/google-chrome.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inv = getInvoice(id); const p = latestPayment(id);
  if (!inv || !p || p.status !== "SUCCESS") return new Response("receipt not available", { status: 404 });
  const { chromium } = await import("playwright-core");
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 520, height: 900 } });
    await page.emulateMedia({ media: "print", reducedMotion: "reduce" });
    await page.goto(`${new URL(req.url).origin}/receipt/${id}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200); // let entry animations settle
    const pdf = await page.pdf({ width: "148mm", height: "232mm", printBackground: true, margin: { top: "6mm", bottom: "6mm", left: "6mm", right: "6mm" } });
    return new Response(new Uint8Array(pdf), { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="receipt-${inv.number}.pdf"` } });
  } finally { await browser.close(); }
}
