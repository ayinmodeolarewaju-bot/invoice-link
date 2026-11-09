import type { Invoice, Payment } from "./types";
import { total } from "./types";

export type NotifyResult = {
  webhook: "sent" | "skipped" | "failed";
  email: "sent" | "skipped" | "failed";
  detail?: string;
};

function appOrigin() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  );
}

export function paidPayload(invoice: Invoice, payment: Payment) {
  const amount = total(invoice);
  return {
    event: "invoice.paid" as const,
    at: new Date().toISOString(),
    invoice: {
      id: invoice.id,
      number: invoice.number,
      fromName: invoice.fromName,
      clientName: invoice.clientName,
      clientEmail: invoice.clientEmail,
      currency: invoice.currency,
      amount,
      payoutAccount: invoice.payoutAccount,
      status: invoice.status,
    },
    payment: {
      id: payment.id,
      status: payment.status,
      originSymbol: payment.originSymbol,
      originChain: payment.originChain,
      amountInFormatted: payment.amountInFormatted,
      amountOutFormatted: payment.amountOutFormatted,
      depositAddress: payment.depositAddress,
      mock: payment.mock,
      txHash: payment.txHash ?? null,
    },
    links: {
      receipt: `${appOrigin()}/receipt/${invoice.id}`,
      pay: `${appOrigin()}/pay/${invoice.id}`,
    },
  };
}

/** POST to PAID_WEBHOOK_URL when set. Never throws. */
export async function postPaidWebhook(
  invoice: Invoice,
  payment: Payment,
  fetchImpl: typeof fetch = fetch,
): Promise<"sent" | "skipped" | "failed"> {
  const url = (process.env.PAID_WEBHOOK_URL || "").trim();
  if (!url) return "skipped";
  try {
    const r = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "InvoiceLink-Notify/1.0" },
      body: JSON.stringify(paidPayload(invoice, payment)),
      signal: AbortSignal.timeout(8_000),
    });
    return r.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}

/** Optional Resend email when RESEND_API_KEY is set. No-op otherwise. Never throws. */
export async function sendPaidEmail(
  invoice: Invoice,
  payment: Payment,
  fetchImpl: typeof fetch = fetch,
): Promise<"sent" | "skipped" | "failed"> {
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  if (!apiKey) return "skipped";
  const to = (process.env.NOTIFY_EMAIL || invoice.clientEmail || "").trim();
  if (!to || !to.includes("@")) return "skipped";
  const from = (process.env.NOTIFY_FROM_EMAIL || "Invoice Link <onboarding@resend.dev>").trim();
  const amount = total(invoice);
  const subject = payment.mock
    ? `[Simulated] Invoice ${invoice.number} paid`
    : `Invoice ${invoice.number} paid`;
  const text = [
    `${invoice.fromName}: invoice ${invoice.number} is paid.`,
    ``,
    `Client: ${invoice.clientName}`,
    `Amount: ${amount} ${invoice.currency}`,
    `Paid with: ${payment.amountInFormatted} ${payment.originSymbol} on ${payment.originChain}`,
    `Receipt: ${appOrigin()}/receipt/${invoice.id}`,
    payment.mock ? `` : ``,
    payment.mock ? `Note: this was a simulated (mock) payment.` : ``,
  ]
    .filter((line, i, arr) => !(line === "" && arr[i - 1] === ""))
    .join("\n")
    .trim();
  try {
    const r = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, text }),
      signal: AbortSignal.timeout(8_000),
    });
    return r.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}

/** Fire webhook + optional email after SUCCESS. Failures are logged, never block payment. */
export async function notifyPaid(
  invoice: Invoice,
  payment: Payment,
  fetchImpl: typeof fetch = fetch,
): Promise<NotifyResult> {
  const [webhook, email] = await Promise.all([
    postPaidWebhook(invoice, payment, fetchImpl),
    sendPaidEmail(invoice, payment, fetchImpl),
  ]);
  return { webhook, email };
}
