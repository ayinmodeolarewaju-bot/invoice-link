import { afterEach, describe, expect, it, vi } from "vitest";
import { notifyPaid, paidPayload, postPaidWebhook, sendPaidEmail } from "../notify";
import type { Invoice, Payment } from "../types";

const invoice: Invoice = {
  id: "abc", number: "INV-2026-0042", fromName: "Brook Studio", fromTagline: "",
  clientName: "Northwind", clientEmail: "ap@northwind.example", items: [{ description: "Work", amount: 100 }],
  currency: "USDC", payoutAccount: "purefile1686.near", payoutChain: "near",
  issuedAt: "t", dueAt: "t", status: "paid", createdAt: "t",
};
const payment: Payment = {
  id: "p1", invoiceId: "abc", depositAddress: "dep", originAsset: "x", originSymbol: "USDT",
  originChain: "arb", amountIn: "100300000", amountInFormatted: "100.3", amountOutFormatted: "100.00",
  deadline: "t", status: "SUCCESS", mock: true, history: [], createdAt: "t", updatedAt: "t",
};

afterEach(() => {
  delete process.env.PAID_WEBHOOK_URL;
  delete process.env.RESEND_API_KEY;
  delete process.env.NOTIFY_EMAIL;
  delete process.env.NOTIFY_FROM_EMAIL;
  vi.unstubAllGlobals();
});

describe("paidPayload", () => {
  it("includes invoice, payment and receipt link", () => {
    const p = paidPayload(invoice, payment);
    expect(p.event).toBe("invoice.paid");
    expect(p.invoice.amount).toBe(100);
    expect(p.payment.mock).toBe(true);
    expect(p.links.receipt).toContain("/receipt/abc");
  });
});

describe("postPaidWebhook", () => {
  it("skips when PAID_WEBHOOK_URL is unset", async () => {
    expect(await postPaidWebhook(invoice, payment, vi.fn())).toBe("skipped");
  });
  it("POSTs JSON to the webhook URL", async () => {
    process.env.PAID_WEBHOOK_URL = "https://hooks.example/paid";
    const fetchImpl = vi.fn(async () => new Response("ok", { status: 200 }));
    expect(await postPaidWebhook(invoice, payment, fetchImpl as unknown as typeof fetch)).toBe("sent");
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://hooks.example/paid");
    expect((init as RequestInit).method).toBe("POST");
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body.event).toBe("invoice.paid");
    expect(body.invoice.id).toBe("abc");
  });
  it("returns failed on non-2xx", async () => {
    process.env.PAID_WEBHOOK_URL = "https://hooks.example/paid";
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 500 }));
    expect(await postPaidWebhook(invoice, payment, fetchImpl as unknown as typeof fetch)).toBe("failed");
  });
});

describe("sendPaidEmail", () => {
  it("skips when RESEND_API_KEY is unset", async () => {
    expect(await sendPaidEmail(invoice, payment, vi.fn())).toBe("skipped");
  });
  it("skips when no recipient", async () => {
    process.env.RESEND_API_KEY = "re_test";
    const noEmail = { ...invoice, clientEmail: "" };
    expect(await sendPaidEmail(noEmail, payment, vi.fn())).toBe("skipped");
  });
  it("posts to Resend with the client email", async () => {
    process.env.RESEND_API_KEY = "re_test";
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ id: "1" }), { status: 200 }));
    expect(await sendPaidEmail(invoice, payment, fetchImpl as unknown as typeof fetch)).toBe("sent");
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body.to).toEqual(["ap@northwind.example"]);
    expect(body.subject).toMatch(/INV-2026-0042/);
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer re_test");
  });
  it("prefers NOTIFY_EMAIL over client email", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.NOTIFY_EMAIL = "brook@example.com";
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    await sendPaidEmail(invoice, payment, fetchImpl as unknown as typeof fetch);
    const body = JSON.parse(String((fetchImpl.mock.calls[0]![1] as RequestInit).body));
    expect(body.to).toEqual(["brook@example.com"]);
  });
});

describe("notifyPaid", () => {
  it("runs webhook and email in parallel and reports both", async () => {
    process.env.PAID_WEBHOOK_URL = "https://hooks.example/paid";
    process.env.RESEND_API_KEY = "re_test";
    const fetchImpl = vi.fn(async () => new Response("ok", { status: 200 }));
    const r = await notifyPaid(invoice, payment, fetchImpl as unknown as typeof fetch);
    expect(r).toEqual({ webhook: "sent", email: "sent" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
