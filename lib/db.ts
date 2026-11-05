import type { Invoice, Payment } from "./types";

/** True when Upstash Redis REST credentials are configured (Vercel / serverless). */
function useRedis() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

// --- SQLite (local / dev) ----------------------------------------------------
type SqliteDb = {
  prepare: (q: string) => {
    run: (...args: unknown[]) => unknown;
    get: (...args: unknown[]) => unknown;
    all: (...args: unknown[]) => unknown[];
  };
};

const g = globalThis as unknown as { __ilSqlite?: SqliteDb };

function sqliteConn(): SqliteDb {
  if (g.__ilSqlite) return g.__ilSqlite;
  // Lazy require so Next/Vercel never loads the native module when Redis is used.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3") as typeof import("better-sqlite3");
  const fs = require("node:fs") as typeof import("node:fs");
  const path = require("node:path") as typeof import("node:path");
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  const d = new Database(path.join(dir, "invoicelink.db"));
  d.pragma("busy_timeout = 5000");
  d.pragma("journal_mode = WAL");
  d.exec(`create table if not exists invoices (id text primary key, data text not null, created_at text not null);
create table if not exists payments (id text primary key, invoice_id text not null, data text not null, created_at text not null);
create index if not exists payments_invoice on payments(invoice_id, created_at);`);
  g.__ilSqlite = d as unknown as SqliteDb;
  return g.__ilSqlite;
}

// --- Redis (Upstash) ---------------------------------------------------------
type RedisClient = import("@upstash/redis").Redis;
const gR = globalThis as unknown as { __ilRedis?: RedisClient };

function redis(): RedisClient {
  if (gR.__ilRedis) return gR.__ilRedis;
  // Lazy import/construct so `next build` does not need Upstash env.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Redis } = require("@upstash/redis") as typeof import("@upstash/redis");
  gR.__ilRedis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
  return gR.__ilRedis;
}

const INV_KEY = (id: string) => `inv:${id}`;
const PAY_KEY = (id: string) => `pay:${id}`;
const INV_INDEX = "inv:index";
const PAY_INV_INDEX = (invoiceId: string) => `pay:inv:${invoiceId}`;
const PAY_DEP_KEY = (addr: string) => `pay:dep:${addr}`;

function scoreOf(iso: string) {
  const n = Date.parse(iso);
  return Number.isFinite(n) ? n : Date.now();
}

// --- Public API (async so Redis REST works; SQLite path awaits nothing heavy) -
export const newId = (n = 10) => {
  const a = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => a[b % a.length]).join("");
};

export async function saveInvoice(inv: Invoice) {
  if (useRedis()) {
    const r = redis();
    await r.set(INV_KEY(inv.id), inv);
    await r.zadd(INV_INDEX, { score: scoreOf(inv.createdAt), member: inv.id });
    return;
  }
  sqliteConn()
    .prepare("insert or replace into invoices (id,data,created_at) values (?,?,?)")
    .run(inv.id, JSON.stringify(inv), inv.createdAt);
}

export async function getInvoice(id: string): Promise<Invoice | null> {
  if (useRedis()) {
    const raw = await redis().get<Invoice | string>(INV_KEY(id));
    if (raw == null) return null;
    return typeof raw === "string" ? (JSON.parse(raw) as Invoice) : raw;
  }
  const row = sqliteConn().prepare("select data from invoices where id=?").get(id) as { data: string } | undefined;
  return row ? (JSON.parse(row.data) as Invoice) : null;
}

export async function listInvoices(limit = 500): Promise<Invoice[]> {
  if (useRedis()) {
    const r = redis();
    const ids = (await r.zrange(INV_INDEX, 0, Math.max(0, limit - 1), { rev: true })) as string[];
    if (!ids.length) return [];
    const keys = ids.map(INV_KEY);
    const rows = await r.mget<(Invoice | string | null)[]>(...keys);
    const out: Invoice[] = [];
    for (const raw of rows ?? []) {
      if (raw == null) continue;
      out.push(typeof raw === "string" ? (JSON.parse(raw) as Invoice) : raw);
    }
    return out;
  }
  return (
    sqliteConn().prepare("select data from invoices order by created_at desc limit ?").all(limit) as { data: string }[]
  ).map((row) => JSON.parse(row.data) as Invoice);
}

export async function countInvoices(): Promise<number> {
  if (useRedis()) {
    const n = await redis().zcard(INV_INDEX);
    return Number(n) || 0;
  }
  return (sqliteConn().prepare("select count(*) c from invoices").get() as { c: number }).c;
}

export async function savePayment(p: Payment) {
  if (useRedis()) {
    const r = redis();
    await r.set(PAY_KEY(p.id), p);
    await r.zadd(PAY_INV_INDEX(p.invoiceId), { score: scoreOf(p.createdAt), member: p.id });
    if (p.depositAddress) await r.set(PAY_DEP_KEY(p.depositAddress), p.id);
    return;
  }
  sqliteConn()
    .prepare("insert or replace into payments (id,invoice_id,data,created_at) values (?,?,?,?)")
    .run(p.id, p.invoiceId, JSON.stringify(p), p.createdAt);
}

export async function getPaymentByDeposit(addr: string): Promise<Payment | null> {
  if (useRedis()) {
    const r = redis();
    const id = await r.get<string>(PAY_DEP_KEY(addr));
    if (!id) return null;
    const payId = typeof id === "string" ? id : String(id);
    const raw = await r.get<Payment | string>(PAY_KEY(payId));
    if (raw == null) return null;
    return typeof raw === "string" ? (JSON.parse(raw) as Payment) : raw;
  }
  const rows = sqliteConn().prepare("select data from payments").all() as { data: string }[];
  for (const row of rows) {
    const p = JSON.parse(row.data) as Payment;
    if (p.depositAddress === addr) return p;
  }
  return null;
}

export async function latestPayment(invoiceId: string): Promise<Payment | null> {
  if (useRedis()) {
    const r = redis();
    const ids = (await r.zrange(PAY_INV_INDEX(invoiceId), 0, 0, { rev: true })) as string[];
    if (!ids.length) return null;
    const raw = await r.get<Payment | string>(PAY_KEY(ids[0]!));
    if (raw == null) return null;
    return typeof raw === "string" ? (JSON.parse(raw) as Payment) : raw;
  }
  const row = sqliteConn()
    .prepare("select data from payments where invoice_id=? order by created_at desc limit 1")
    .get(invoiceId) as { data: string } | undefined;
  return row ? (JSON.parse(row.data) as Payment) : null;
}
