import { describe, expect, it } from "vitest";
import { invoicesForOwner } from "../owner";
import type { Invoice } from "../types";

const inv = (id: string, owner: string | null, createdAt: string): Invoice => ({
  id, number: `INV-${id}`, fromName: "B", fromTagline: "", clientName: "C", clientEmail: "secret@example.com", items: [{ description: "x", amount: 100 }, { description: "y", amount: 50 }],
  currency: "USDC", payoutAccount: "p.near", payoutChain: "near", ownerAccount: owner, issuedAt: createdAt, dueAt: createdAt, status: "open", createdAt,
});

describe("invoicesForOwner", () => {
  const all = [inv("a", "alice.near", "2026-11-01"), inv("b", "bob.near", "2026-11-02"), inv("c", "alice.near", "2026-11-03"), inv("d", null, "2026-11-03")];
  it("returns only the connected account's invoices, newest first", () => {
    expect(invoicesForOwner(all, "alice.near").map((i) => i.id)).toEqual(["c", "a"]);
  });
  it("returns nothing without a connected account", () => {
    expect(invoicesForOwner(all, null)).toEqual([]);
    expect(invoicesForOwner(all, "  ")).toEqual([]);
  });
  it("summarises totals and leaves out the client email", () => {
    const [s] = invoicesForOwner(all, "bob.near");
    expect(s.total).toBe(150);
    expect(JSON.stringify(s)).not.toContain("secret@example.com");
  });
});
