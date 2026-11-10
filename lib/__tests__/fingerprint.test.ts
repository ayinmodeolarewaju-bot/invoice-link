import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { canonicalJson, receiptFingerprint } from "../fingerprint";
import type { Invoice, Payment } from "../types";

const inv: Invoice = { id: "inv1", number: "INV-0001", fromName: "Brook", fromTagline: "", clientName: "Acme", clientEmail: "a@x.io",
  items: [{ description: "Design", amount: 450 }], currency: "USDC", payoutAccount: "purefile1686.near", payoutChain: "near",
  issuedAt: "2026-11-01", dueAt: "2026-11-15", status: "paid", createdAt: "2026-11-01T00:00:00Z" };
const pay: Payment = { id: "p1", invoiceId: "inv1", depositAddress: "0xabc", originAsset: "nep141:arb-usdt", originSymbol: "USDT", originChain: "arb",
  amountIn: "451000000", amountInFormatted: "451.00", amountOutFormatted: "450.00", deadline: "2026-11-01T01:00:00Z", status: "SUCCESS",
  txHash: "0xdead", mock: true, history: [{ status: "SUCCESS", at: "2026-11-01T00:10:00Z" }], createdAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-01T00:10:00Z",
  proof: { signature: "ed25519:sig", timestamp: null, correlationId: null, verified: null, simulated: true } };

describe("receipt fingerprint", () => {
  it("canonical JSON sorts keys and is whitespace-free", () => {
    expect(canonicalJson({ b: 1, a: { d: [2, { z: 1, y: null }], c: "x" } })).toBe('{"a":{"c":"x","d":[2,{"y":null,"z":1}]},"b":1}');
  });
  it("hash is the sha256 of the returned canonical string", () => {
    const f = receiptFingerprint(inv, pay);
    expect(f.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(createHash("sha256").update(f.canonical).digest("hex")).toBe(f.hash);
  });
  it("is stable and ignores fields that are not receipt facts", () => {
    const a = receiptFingerprint(inv, pay).hash;
    expect(receiptFingerprint({ ...inv, clientEmail: "other@x.io", fromTagline: "new" }, { ...pay, raw: { any: 1 } }).hash).toBe(a);
  });
  it("changes when any asserted fact changes", () => {
    const a = receiptFingerprint(inv, pay).hash;
    expect(receiptFingerprint({ ...inv, payoutAccount: "evil.near" }, pay).hash).not.toBe(a);
    expect(receiptFingerprint(inv, { ...pay, txHash: "0xbeef" }).hash).not.toBe(a);
    expect(receiptFingerprint({ ...inv, items: [{ description: "Design", amount: 451 }] }, pay).hash).not.toBe(a);
    expect(receiptFingerprint(inv, { ...pay, mock: false }).hash).not.toBe(a);
  });
});
