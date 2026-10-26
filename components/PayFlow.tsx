"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Invoice, OneClickStatus, Payment, Token } from "@/lib/types";
import { total } from "@/lib/types";
import { InvoiceCard } from "./InvoiceCard";
import { StatusRail } from "./StatusRail";
import { TokenIcon } from "./TokenIcon";
import { TopBar } from "./TopBar";
import { dispSym, chainName, money, short } from "./fmt";

const EASE = [0.22, 1, 0.36, 1] as const;
const step = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -12 }, transition: { duration: 0.4, ease: EASE } };
type Step = "review" | "pick" | "send" | "status";
type Quote = { amountInFormatted: string; amountOutFormatted: string; timeEstimate?: number; deadline?: string; mock: boolean; error?: string };
const SYMBOLS = ["USDT", "USDC", "ETH"];
const CHAIN_ORDER = ["arb", "eth", "base", "sol", "near", "pol", "bsc", "op", "avax", "ton", "tron", "gnosis"];
const EXAMPLE_REFUND: Record<string, string> = { sol: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU", near: "client-example.near", ton: "UQ-example", tron: "T-example" };

export function PayFlow({ invoice, initialPayment, mock }: { invoice: Invoice; initialPayment: Payment | null; mock: boolean }) {
  const router = useRouter();
  const active = initialPayment && initialPayment.status !== "PENDING_DEPOSIT" ? "status" : initialPayment ? "send" : "review";
  const [s, setS] = useState<Step>(invoice.status === "paid" ? "status" : active);
  const [payment, setPayment] = useState<Payment | null>(initialPayment);
  const amount = total(invoice);

  useEffect(() => { if (invoice.status === "paid" && payment?.status === "SUCCESS") router.prefetch(`/receipt/${invoice.id}`); }, [invoice, payment, router]);

  const idx = { review: 1, pick: 2, send: 3, status: 4 }[s];
  const right = <>{invoice.isExample && <span className="ex">Example data</span>}{mock && <span className="pill text-signal">◐ Mock 1-Click</span>}<span className="hidden sm:inline"><span className="pill">⚡ Settled via NEAR Intents</span></span></>;

  return (
    <div className="min-h-screen" style={{ background: s === "review" ? "radial-gradient(900px 500px at 80% 30%,rgba(43,212,164,.12),transparent)" : "radial-gradient(900px 500px at 50% 0%,rgba(110,91,255,.10),transparent)" }}>
      <TopBar compact right={right} />
      <AnimatePresence mode="wait">
        {s === "review" ? (
          <motion.main key="review" {...step} className="mx-auto grid max-w-[1440px] gap-6 px-5 pb-10 pt-4 md:min-h-[calc(100vh-64px)] md:grid-cols-2 md:items-center md:px-20 md:py-0">
            <div>
              <span className="pill"><Pulse c="bg-signal" />Awaiting payment<span className="hidden md:inline"> · due {new Date(invoice.dueAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "Africa/Lagos" })}</span></span>
              <h1 className="mt-4 text-[30px] font-bold leading-[1.08] tracking-[-.03em] md:mt-6 md:text-[56px] md:leading-[1.02] md:tracking-[-.04em]">
                {invoice.fromName} requested <span className="text-violet">{money(amount)} {invoice.currency}</span>
              </h1>
              <p className="mt-5 hidden max-w-[420px] text-base leading-relaxed text-ink/55 md:block">Pay from any chain with the token you already hold. {invoice.fromName} receives the exact amount, routed by NEAR Intents.</p>
              <div className="mt-9 hidden items-center gap-1.5 md:flex">{["eth", "arb", "base", "sol", "near"].map((c) => <TokenIcon key={c} k={c} />)}<span className="ml-2 text-[13px] text-ink/55">+ many more</span></div>
            </div>
            <div className="grid place-items-center">
              <InvoiceCard inv={invoice} className="w-full max-w-[500px]" layoutAmount>
                <button className="btn btn-v mt-7" onClick={() => setS("pick")}>Pay {money(amount)} {invoice.currency}</button>
                <p className="mt-3.5 text-center text-xs text-ink/55">Pay with USDC, USDT, ETH and more from any chain</p>
              </InvoiceCard>
            </div>
          </motion.main>
        ) : (
          <motion.main key="flow" {...step} className="grid place-items-center px-4 py-8 md:min-h-[calc(100vh-64px)] md:py-5">
            <div className="card w-full max-w-[560px] p-6 md:px-9 md:py-7">
              <div className="mb-5 flex gap-2">{[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-1 flex-1 overflow-hidden rounded bg-ink/[.08]"><motion.div className="h-full bg-violet" initial={false} animate={{ width: i <= idx ? "100%" : "0%" }} transition={{ duration: 0.6, ease: EASE }} /></div>
              ))}</div>
              <AnimatePresence mode="wait">
                {s === "pick" && <motion.div key="pick" {...step}><Pick mock={mock} invoice={invoice} onBack={() => setS("review")} onQuote={(p) => { setPayment(p); setS("send"); }} /></motion.div>}
                {s === "send" && payment && <motion.div key="send" {...step}><Send p={payment} invoice={invoice} onSent={(p) => { setPayment(p); setS("status"); }} onBack={() => setS("pick")} /></motion.div>}
                {s === "status" && payment && <motion.div key="status" {...step}><Status p={payment} invoice={invoice} onUpdate={setPayment} /></motion.div>}
                {s === "status" && !payment && <p className="text-sm">This invoice is already paid. <a className="text-violet" href={`/receipt/${invoice.id}`}>View receipt</a></p>}
              </AnimatePresence>
            </div>
          </motion.main>
        )}
      </AnimatePresence>
    </div>
  );
}

function Pulse({ c }: { c: string }) {
  return <span className="relative flex h-2 w-2"><motion.span className={`absolute inset-0 rounded-full ${c}`} animate={{ scale: [1, 2.2], opacity: [0.6, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }} /><span className={`relative h-2 w-2 rounded-full ${c}`} /></span>;
}

function Pick({ invoice, onQuote, onBack, mock }: { invoice: Invoice; onQuote: (p: Payment) => void; onBack: () => void; mock: boolean }) {
  const [tokens, setTokens] = useState<Token[]>([]); const [live, setLive] = useState(false);
  const [sym, setSym] = useState("USDT"); const [chain, setChain] = useState("arb");
  const [refund, setRefund] = useState(""); const [q, setQ] = useState<Quote | null>(null); const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [tick, setTick] = useState(45);
  useEffect(() => { fetch("/api/oneclick/tokens").then((r) => r.json()).then((j) => { setTokens(j.tokens); setLive(j.live); }); }, []);
  const chains = useMemo(() => { const set = new Set(tokens.filter((t) => t.symbol === sym || (sym === "USDT" && t.symbol === "USDT0")).map((t) => t.blockchain)); return CHAIN_ORDER.filter((c) => set.has(c)).slice(0, 4); }, [tokens, sym]);
  useEffect(() => { if (chains.length && !chains.includes(chain)) setChain(chains[0]); }, [chains, chain]);
  const isEvm = !["sol", "near", "ton", "tron", "btc"].includes(chain);
  const refundTo = refund || (mock ? (EXAMPLE_REFUND[chain] ?? "0xA11cE0000000000000000000000000000000b0b0") : "");
  const body = (dry: boolean) => JSON.stringify({ invoiceId: invoice.id, symbol: sym, chain, refundTo, dry });
  useEffect(() => {
    if (!chains.includes(chain)) return;
    let off = false; setLoading(true); setErr("");
    const t = setTimeout(async () => {
      const r = await fetch("/api/oneclick/quote", { method: "POST", headers: { "content-type": "application/json" }, body: body(true) });
      const j = await r.json(); if (off) return; setLoading(false);
      if (!r.ok) { setQ(null); setErr(j.error); } else { setQ(j); setTick(45); }
    }, 250);
    return () => { off = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sym, chain, chains, refund]);
  useEffect(() => { const i = setInterval(() => setTick((t) => (t <= 1 ? 45 : t - 1)), 1000); return () => clearInterval(i); }, []);
  async function go() {
    setBusy(true); setErr("");
    const r = await fetch("/api/oneclick/quote", { method: "POST", headers: { "content-type": "application/json" }, body: body(false) });
    const j = await r.json(); setBusy(false);
    if (!r.ok) return setErr(j.error); onQuote(j.payment);
  }
  const fee = q ? Math.max(0, Number(q.amountInFormatted) - Number(q.amountOutFormatted)) : 0;
  return (
    <div>
      <div className="flex items-center justify-between"><h2 className="text-[22px] font-bold tracking-[-.02em]">Pay with</h2><button onClick={onBack} className="lbl hover:text-ink">← Step 2 of 4</button></div>
      <div className="lbl mb-2 mt-4">Token</div>
      <div className="grid grid-cols-3 gap-2">{SYMBOLS.map((t) => <Chip key={t} on={t === sym} onClick={() => setSym(t)}><TokenIcon k={t} />{t}</Chip>)}</div>
      <div className="lbl mb-2 mt-3.5 flex justify-between"><span>Network</span><span className="normal-case tracking-normal">{live ? "live list from 1-Click /v0/tokens" : "offline token list"}</span></div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{chains.map((c) => <Chip key={c} on={c === chain} onClick={() => setChain(c)}><TokenIcon k={c} />{chainName(c)}</Chip>)}</div>
      <label className="mt-3.5 block"><div className="lbl mb-1.5">Refund address on {chainName(chain)} {!refund && (mock ? <span className="normal-case tracking-normal text-signal">· example prefilled</span> : <span className="normal-case tracking-normal text-err">· required for a live quote</span>)}</div>
        <input className="field font-mono text-xs" placeholder={refundTo || "Your address on this chain"} value={refund} onChange={(e) => setRefund(e.target.value)} /></label>
      <motion.div layout className="mt-4 rounded-[14px] bg-ink px-[22px] py-[18px] text-white">
        <div className="flex items-center justify-between"><span className="lbl text-white/50">You send</span><span className="text-xs text-mint">● {mock ? "Simulated" : "Live"} 1-Click quote · refreshes in 0:{String(tick).padStart(2, "0")}</span></div>
        <div className="mb-3 mt-1 font-mono text-[32px] font-semibold tracking-[-.02em]">
          <AnimatePresence mode="popLayout"><motion.span key={q?.amountInFormatted ?? "x"} initial={{ opacity: 0, y: 10 }} animate={{ opacity: loading ? 0.4 : 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3, ease: EASE }} className="inline-block">{q ? Number(q.amountInFormatted).toLocaleString("en-US", { maximumFractionDigits: 6 }) : "…"}</motion.span></AnimatePresence>
          {" "}<span className="text-base text-white/50">{sym} · {chainName(chain)}</span></div>
        <div className="grid gap-1.5 border-t border-white/10 pt-3 text-[13px]">
          <Row k={`${invoice.fromName} receives`} v={`${money(total(invoice))} ${invoice.currency} · ${chainName(invoice.payoutChain)}`} />
          {sym !== "ETH" && <Row k="Network & route fee" v={q ? `${fee.toFixed(2)} ${sym}` : "…"} />}
          <Row k="Estimated time" v={q?.timeEstimate ? `~ ${q.timeEstimate} sec` : "…"} />
          <Row k="Route" v="NEAR Intents · EXACT_OUTPUT" sans />
        </div>
      </motion.div>
      {err && <p className="mt-3 text-sm text-err">{err}</p>}
      <button className="btn btn-v mt-4" disabled={!q || busy || !refundTo} onClick={go}>{busy ? "Requesting deposit address…" : "Get deposit address"}</button>
      <p className="mt-2.5 text-center text-xs text-ink/55">If the swap can&apos;t complete, funds are refunded to your {chainName(chain)} address.</p>
    </div>
  );
}

function Send({ p, invoice, onSent, onBack }: { p: Payment; invoice: Invoice; onSent: (p: Payment) => void; onBack: () => void }) {
  const [qr, setQr] = useState(""); const [tx, setTx] = useState(""); const [busy, setBusy] = useState(false); const [copied, setCopied] = useState(false);
  const [left, setLeft] = useState(0);
  useEffect(() => { QRCode.toDataURL(p.depositAddress, { margin: 1, width: 360, color: { dark: "#0B0D12", light: "#FFFFFF" } }).then(setQr); }, [p.depositAddress]);
  useEffect(() => { const f = () => setLeft(Math.max(0, new Date(p.deadline).getTime() - Date.now())); f(); const i = setInterval(f, 1000); return () => clearInterval(i); }, [p.deadline]);
  async function sent() {
    setBusy(true);
    const r = await fetch("/api/oneclick/deposit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ depositAddress: p.depositAddress, txHash: tx }) });
    const j = await r.json(); setBusy(false); onSent(j.payment);
  }
  const mm = Math.floor(left / 60000), ss = Math.floor((left % 60000) / 1000);
  const pct = Math.min(1, left / (30 * 60_000));
  return (
    <div>
      <div className="flex items-center justify-between"><h2 className="text-[22px] font-bold tracking-[-.02em]">Send exactly</h2><button onClick={onBack} className="lbl hover:text-ink">← Step 3 of 4</button></div>
      <motion.div layoutId="amount" className="mt-2 font-mono text-[34px] font-semibold tracking-[-.02em]">{p.amountInFormatted} <span className="text-base text-ink/50">{dispSym(p.originSymbol)} · {chainName(p.originChain)}</span></motion.div>
      <div className="mt-5 grid grid-cols-[150px_1fr] gap-5 rounded-[14px] bg-paper p-4">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 30 }} className="rounded-xl bg-white p-2">{qr && <img src={qr} alt="Deposit address QR" className="w-full" />}</motion.div>
        <div className="flex min-w-0 flex-col justify-between gap-3">
          <div><div className="lbl">Deposit address{p.mock && <span className="ml-1 normal-case tracking-normal text-signal">· simulated</span>}</div><div className="mt-1 break-all font-mono text-[12px] leading-relaxed">{p.depositAddress}</div>{p.depositMemo && <div className="mt-1 font-mono text-xs">Memo: {p.depositMemo}</div>}</div>
          <button className="pill self-start" onClick={() => { navigator.clipboard?.writeText(p.depositAddress); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? "Copied ✓" : "Copy address"}</button>
          <div className="flex items-center gap-2 text-xs text-ink/55">
            <svg width="18" height="18" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="none" stroke="rgba(11,13,18,.1)" strokeWidth="2.5" /><circle cx="10" cy="10" r="8" fill="none" stroke="#6E5BFF" strokeWidth="2.5" strokeDasharray={`${pct * 50.3} 50.3`} transform="rotate(-90 10 10)" strokeLinecap="round" /></svg>
            Quote valid for {mm}:{String(ss).padStart(2, "0")}
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-2 text-[13px]">
        <Row k={`${invoice.fromName} receives`} v={`${p.amountOutFormatted} ${invoice.currency}`} dark />
        <Row k="To" v={short(invoice.payoutAccount, 18, 6)} dark />
      </div>
      <label className="mt-4 block"><div className="lbl mb-1.5">Transaction hash (optional, speeds up detection)</div><input className="field font-mono text-xs" value={tx} onChange={(e) => setTx(e.target.value)} placeholder="0x…" /></label>
      <button className="btn btn-v mt-5" onClick={sent} disabled={busy}>{p.mock ? "Simulate deposit (mock mode)" : "I've sent it, track payment"}</button>
      <p className="mt-3 text-center text-xs text-ink/55">Send only {p.originSymbol === "USDT0" ? "USDT (USDT0)" : p.originSymbol} on {chainName(p.originChain)} to this address. Sending less shows as an incomplete deposit.</p>
    </div>
  );
}

const TERMINAL: OneClickStatus[] = ["SUCCESS", "REFUNDED", "FAILED"];
function Status({ p, invoice, onUpdate }: { p: Payment; invoice: Invoice; onUpdate: (p: Payment) => void }) {
  const router = useRouter(); const ref = useRef(p); ref.current = p;
  useEffect(() => {
    if (TERMINAL.includes(p.status)) return;
    const i = setInterval(async () => {
      const r = await fetch(`/api/oneclick/status?depositAddress=${encodeURIComponent(ref.current.depositAddress)}`); const j = await r.json();
      if (j.payment) onUpdate(j.payment);
    }, 1500);
    return () => clearInterval(i);
  }, [p.status, onUpdate]);
  useEffect(() => { if (p.status === "SUCCESS") { const t = setTimeout(() => router.push(`/receipt/${invoice.id}`), 2200); return () => clearTimeout(t); } }, [p.status, router, invoice.id]);
  const done = p.status === "SUCCESS";
  const label = { PENDING_DEPOSIT: "Awaiting deposit", KNOWN_DEPOSIT_TX: "Deposit seen", PROCESSING: "Processing", SUCCESS: "Paid", INCOMPLETE_DEPOSIT: "Incomplete deposit", REFUNDED: "Refunded", FAILED: "Failed" }[p.status];
  const tone = done ? "text-mint" : ["REFUNDED", "FAILED", "INCOMPLETE_DEPOSIT"].includes(p.status) ? "text-err" : "text-violet";
  return (
    <div>
      <div className="flex items-center justify-between gap-3"><h2 className="text-[22px] font-bold tracking-[-.02em]">{done ? "Payment complete" : "Payment in progress"}</h2>
        <motion.span key={p.status} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={`pill ${tone}`}><Pulse c={done ? "bg-mint" : "bg-violet"} />{label}</motion.span></div>
      <p className="mb-6 mt-1.5 text-sm text-ink/55">{done ? "Opening your receipt…" : "You can close this page. The status updates on its own."}</p>
      <StatusRail p={p} invoice={invoice} />
      <div className="mt-6 flex items-center justify-between rounded-xl bg-paper px-4 py-3.5 text-xs"><span className="lbl">Deposit address</span><span className="font-mono">{short(p.depositAddress)}</span></div>
      {done && <a href={`/receipt/${invoice.id}`} className="btn mt-4">View receipt</a>}
      <p className="mt-2.5 text-center text-[11px] text-ink/55">Times shown in WAT (UTC+1) · 1-Click status: <span className="font-mono">{p.status}</span>{p.mock && " · simulated"}</p>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`flex items-center gap-2.5 rounded-xl border bg-white px-3.5 py-3 text-sm font-semibold transition ${on ? "border-[1.5px] border-violet ring-4 ring-violet/15" : "border-ink/10 hover:border-ink/25"}`}>{children}</button>;
}
function Row({ k, v, sans, dark }: { k: string; v: string; sans?: boolean; dark?: boolean }) {
  return <div className="flex justify-between gap-4"><span className={dark ? "text-ink/55" : "text-white/55"}>{k}</span><span className={sans ? "" : "font-mono"}>{v}</span></div>;
}
