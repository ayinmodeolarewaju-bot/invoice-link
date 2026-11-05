import type { Invoice, Payment } from "./types";

/** True when Upstash Redis REST credentials are configured (Vercel / serverless). */
function useRedis() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

/** Vercel Blob when BLOB_READ_WRITE_TOKEN is set (preferred serverless store without Upstash). */
function useBlob() {
  return !useRedis() && Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/**
 * Last-resort fallback: on Vercel without Upstash or Blob token, keep data in an
 * in-memory Map (per serverless instance; lost on cold start / across instances).
 */
function useMemory() {
  return !useRedis() && !useBlob() && Boolean(process.env.VERCEL);
}
const gM = globalThis as unknown as { __ilMem?: { inv: Map<string, Invoice>; pay: Map<string, Payment> } };
function mem() {
  return (gM.__ilMem ??= { inv: new Map(), pay: new Map() });
}
const byDateDesc = (a: { createdAt: string }, b: { createdAt: string }) => scoreOf(b.createdAt) - scoreOf(a.createdAt);

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
  // Lazy require so Next/Vercel never loads the native module when Redis/Blob is used.
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

// --- Vercel Blob -------------------------------------------------------------
type BlobIndexEntry = { id: string; createdAt: string };

const BLOB_INV = (id: string) => `inv/${id}.json`;
const BLOB_PAY = (id: string) => `pay/${id}.json`;
const BLOB_INV_INDEX = "inv/index.json";
const BLOB_PAY_INV = (invoiceId: string) => `pay/inv/${invoiceId}.json`;
const BLOB_PAY_DEP = (addr: string) => `pay/dep/${encodeURIComponent(addr)}.json`;

type BlobSdk = typeof import("@vercel/blob");
const gB = globalThis as unknown as { __ilBlob?: BlobSdk };

function blobSdk(): BlobSdk {
  if (gB.__ilBlob) return gB.__ilBlob;
  // Lazy require so `next build` / local SQLite path never needs the Blob SDK.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  gB.__ilBlob = require("@vercel/blob") as BlobSdk;
  return gB.__ilBlob!;
}

async function blobGetJson<T>(pathname: string): Promise<T | null> {
  const { get } = blobSdk();
  const result = await get(pathname, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  const text = await new Response(result.stream).text();
  if (!text) return null;
  return JSON.parse(text) as T;
}

async function blobPutJson(pathname: string, data: unknown) {
  const { put } = blobSdk();
  await put(pathname, JSON.stringify(data), {
    access: "private",
    contentType: "application/json",
    allowOverwrite: true,
    addRandomSuffix: false,
    cacheControlMaxAge: 60,
  });
}

async function blobReadInvIndex(): Promise<BlobIndexEntry[]> {
  return (await blobGetJson<BlobIndexEntry[]>(BLOB_INV_INDEX)) ?? [];
}

async function blobWriteInvIndex(entries: BlobIndexEntry[]) {
  entries.sort((a, b) => scoreOf(b.createdAt) - scoreOf(a.createdAt));
  await blobPutJson(BLOB_INV_INDEX, entries);
}

async function blobReadPayInvIndex(invoiceId: string): Promise<BlobIndexEntry[]> {
  return (await blobGetJson<BlobIndexEntry[]>(BLOB_PAY_INV(invoiceId))) ?? [];
}

async function blobWritePayInvIndex(invoiceId: string, entries: BlobIndexEntry[]) {
  entries.sort((a, b) => scoreOf(b.createdAt) - scoreOf(a.createdAt));
  await blobPutJson(BLOB_PAY_INV(invoiceId), entries);
}

// --- Public API (async so Redis/Blob REST works; SQLite path awaits nothing heavy) -
export const newId = (n = 10) => {
  const a = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => a[b % a.length]).join("");
};

export async function saveInvoice(inv: Invoice) {
  if (useMemory()) {
    mem().inv.set(inv.id, inv);
    return;
  }
  if (useRedis()) {
    const r = redis();
    await r.set(INV_KEY(inv.id), inv);
    await r.zadd(INV_INDEX, { score: scoreOf(inv.createdAt), member: inv.id });
    return;
  }
  if (useBlob()) {
    await blobPutJson(BLOB_INV(inv.id), inv);
    const index = await blobReadInvIndex();
    const next = index.filter((e) => e.id !== inv.id);
    next.push({ id: inv.id, createdAt: inv.createdAt });
    await blobWriteInvIndex(next);
    return;
  }
  sqliteConn()
    .prepare("insert or replace into invoices (id,data,created_at) values (?,?,?)")
    .run(inv.id, JSON.stringify(inv), inv.createdAt);
}

export async function getInvoice(id: string): Promise<Invoice | null> {
  if (useMemory()) return mem().inv.get(id) ?? null;
  if (useRedis()) {
    const raw = await redis().get<Invoice | string>(INV_KEY(id));
    if (raw == null) return null;
    return typeof raw === "string" ? (JSON.parse(raw) as Invoice) : raw;
  }
  if (useBlob()) {
    return blobGetJson<Invoice>(BLOB_INV(id));
  }
  const row = sqliteConn().prepare("select data from invoices where id=?").get(id) as { data: string } | undefined;
  return row ? (JSON.parse(row.data) as Invoice) : null;
}

export async function listInvoices(limit = 500): Promise<Invoice[]> {
  if (useMemory()) return [...mem().inv.values()].sort(byDateDesc).slice(0, limit);
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
  if (useBlob()) {
    const index = (await blobReadInvIndex()).slice(0, limit);
    const out: Invoice[] = [];
    for (const e of index) {
      const inv = await blobGetJson<Invoice>(BLOB_INV(e.id));
      if (inv) out.push(inv);
    }
    return out;
  }
  return (
    sqliteConn().prepare("select data from invoices order by created_at desc limit ?").all(limit) as { data: string }[]
  ).map((row) => JSON.parse(row.data) as Invoice);
}

export async function countInvoices(): Promise<number> {
  if (useMemory()) return mem().inv.size;
  if (useRedis()) {
    const n = await redis().zcard(INV_INDEX);
    return Number(n) || 0;
  }
  if (useBlob()) {
    return (await blobReadInvIndex()).length;
  }
  return (sqliteConn().prepare("select count(*) c from invoices").get() as { c: number }).c;
}

export async function savePayment(p: Payment) {
  if (useMemory()) {
    mem().pay.set(p.id, p);
    return;
  }
  if (useRedis()) {
    const r = redis();
    await r.set(PAY_KEY(p.id), p);
    await r.zadd(PAY_INV_INDEX(p.invoiceId), { score: scoreOf(p.createdAt), member: p.id });
    if (p.depositAddress) await r.set(PAY_DEP_KEY(p.depositAddress), p.id);
    return;
  }
  if (useBlob()) {
    await blobPutJson(BLOB_PAY(p.id), p);
    const payIdx = await blobReadPayInvIndex(p.invoiceId);
    const next = payIdx.filter((e) => e.id !== p.id);
    next.push({ id: p.id, createdAt: p.createdAt });
    await blobWritePayInvIndex(p.invoiceId, next);
    if (p.depositAddress) await blobPutJson(BLOB_PAY_DEP(p.depositAddress), { id: p.id });
    return;
  }
  sqliteConn()
    .prepare("insert or replace into payments (id,invoice_id,data,created_at) values (?,?,?,?)")
    .run(p.id, p.invoiceId, JSON.stringify(p), p.createdAt);
}

export async function getPaymentByDeposit(addr: string): Promise<Payment | null> {
  if (useMemory()) return [...mem().pay.values()].find((p) => p.depositAddress === addr) ?? null;
  if (useRedis()) {
    const r = redis();
    const id = await r.get<string>(PAY_DEP_KEY(addr));
    if (!id) return null;
    const payId = typeof id === "string" ? id : String(id);
    const raw = await r.get<Payment | string>(PAY_KEY(payId));
    if (raw == null) return null;
    return typeof raw === "string" ? (JSON.parse(raw) as Payment) : raw;
  }
  if (useBlob()) {
    const ref = await blobGetJson<{ id: string }>(BLOB_PAY_DEP(addr));
    if (!ref?.id) return null;
    return blobGetJson<Payment>(BLOB_PAY(ref.id));
  }
  const rows = sqliteConn().prepare("select data from payments").all() as { data: string }[];
  for (const row of rows) {
    const p = JSON.parse(row.data) as Payment;
    if (p.depositAddress === addr) return p;
  }
  return null;
}

export async function latestPayment(invoiceId: string): Promise<Payment | null> {
  if (useMemory()) return [...mem().pay.values()].filter((p) => p.invoiceId === invoiceId).sort(byDateDesc)[0] ?? null;
  if (useRedis()) {
    const r = redis();
    const ids = (await r.zrange(PAY_INV_INDEX(invoiceId), 0, 0, { rev: true })) as string[];
    if (!ids.length) return null;
    const raw = await r.get<Payment | string>(PAY_KEY(ids[0]!));
    if (raw == null) return null;
    return typeof raw === "string" ? (JSON.parse(raw) as Payment) : raw;
  }
  if (useBlob()) {
    const ids = await blobReadPayInvIndex(invoiceId);
    if (!ids.length) return null;
    return blobGetJson<Payment>(BLOB_PAY(ids[0]!.id));
  }
  const row = sqliteConn()
    .prepare("select data from payments where invoice_id=? order by created_at desc limit 1")
    .get(invoiceId) as { data: string } | undefined;
  return row ? (JSON.parse(row.data) as Payment) : null;
}
