import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import type { Invoice, Payment } from "./types";

const g = globalThis as unknown as { __db?: Database.Database };
// Opened lazily so `next build` never touches the database file.
function conn() {
  if (g.__db) return g.__db;
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  const d = new Database(path.join(dir, "invoicelink.db"));
  d.pragma("busy_timeout = 5000");
  d.pragma("journal_mode = WAL");
  d.exec(`create table if not exists invoices (id text primary key, data text not null, created_at text not null);
create table if not exists payments (id text primary key, invoice_id text not null, data text not null, created_at text not null);
create index if not exists payments_invoice on payments(invoice_id, created_at);`);
  g.__db = d;
  return d;
}
const db = { prepare: (q: string) => conn().prepare(q) };

export const newId = (n = 10) => {
  const a = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => a[b % a.length]).join("");
};
export function saveInvoice(inv: Invoice) {
  db.prepare("insert or replace into invoices (id,data,created_at) values (?,?,?)").run(inv.id, JSON.stringify(inv), inv.createdAt);
}
export function getInvoice(id: string): Invoice | null {
  const r = db.prepare("select data from invoices where id=?").get(id) as { data: string } | undefined;
  return r ? JSON.parse(r.data) : null;
}
export function listInvoices(limit = 500): Invoice[] {
  return (db.prepare("select data from invoices order by created_at desc limit ?").all(limit) as { data: string }[]).map((r) => JSON.parse(r.data));
}
export function countInvoices() { return (db.prepare("select count(*) c from invoices").get() as { c: number }).c; }
export function savePayment(p: Payment) {
  db.prepare("insert or replace into payments (id,invoice_id,data,created_at) values (?,?,?,?)").run(p.id, p.invoiceId, JSON.stringify(p), p.createdAt);
}
export function getPaymentByDeposit(addr: string): Payment | null {
  const rows = db.prepare("select data from payments").all() as { data: string }[];
  for (const r of rows) { const p = JSON.parse(r.data) as Payment; if (p.depositAddress === addr) return p; }
  return null;
}
export function latestPayment(invoiceId: string): Payment | null {
  const r = db.prepare("select data from payments where invoice_id=? order by created_at desc limit 1").get(invoiceId) as { data: string } | undefined;
  return r ? JSON.parse(r.data) : null;
}
