import { createHash } from "node:crypto";
import type { Invoice, Payment } from "./types";
import { total } from "./types";

// Receipt fingerprint: SHA-256 over a canonical JSON of the facts a receipt asserts.
// Anyone can fetch /api/receipt/<id>/fingerprint, re-hash `canonical` and compare.
// This is the payload an on-chain anchor would commit to (anchoring itself is not done yet).
export const FINGERPRINT_VERSION = "invoicelink-receipt-v1";

export function receiptFacts(invoice: Invoice, payment: Payment) {
  const settledAt = payment.history.find((h) => h.status === "SUCCESS")?.at ?? payment.updatedAt;
  return {
    v: FINGERPRINT_VERSION,
    invoice: {
      id: invoice.id, number: invoice.number, from: invoice.fromName, client: invoice.clientName,
      currency: invoice.currency, total: total(invoice).toFixed(2),
      items: invoice.items.map((x) => ({ description: x.description, amount: (Number(x.amount) || 0).toFixed(2) })),
      payoutAccount: invoice.payoutAccount, payoutChain: invoice.payoutChain,
    },
    payment: {
      id: payment.id, originAsset: payment.originAsset, amountIn: payment.amountIn, amountOut: payment.amountOutFormatted,
      depositAddress: payment.depositAddress, depositMemo: payment.depositMemo ?? null, txHash: payment.txHash ?? null,
      quoteSignature: payment.proof?.signature ?? null, status: payment.status, settledAt, simulated: payment.mock,
    },
  };
}

// Deterministic JSON: object keys sorted at every level, no whitespace.
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const o = value as Record<string, unknown>;
  return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(",")}}`;
}

export const sha256Hex = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

export function receiptFingerprint(invoice: Invoice, payment: Payment) {
  const canonical = canonicalJson(receiptFacts(invoice, payment));
  return { version: FINGERPRINT_VERSION, algorithm: "sha256", hash: sha256Hex(canonical), canonical };
}
