import { total, type Invoice } from "./types";
// "My invoices": only invoices created while this NEAR account was connected.
// The list is a public summary (no client email or line items), since the owner isn't proven by a signature yet.
export type InvoiceSummary = { id: string; number: string; clientName: string; total: number; currency: Invoice["currency"]; status: Invoice["status"]; createdAt: string };
export function invoicesForOwner(all: Invoice[], owner: string | null | undefined, limit = 20): InvoiceSummary[] {
  const o = owner?.trim().toLowerCase();
  if (!o) return [];
  return all
    .filter((i) => (i.ownerAccount ?? "").toLowerCase() === o)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
    .map((i) => ({ id: i.id, number: i.number, clientName: i.clientName, total: total(i), currency: i.currency, status: i.status, createdAt: i.createdAt }));
}
