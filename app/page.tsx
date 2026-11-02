"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { InvoiceCard } from "@/components/InvoiceCard";
import { TokenIcon } from "@/components/TokenIcon";
import { TopBar } from "@/components/TopBar";
import { useWallet, WalletButton } from "@/components/Wallet";
import { chainName } from "@/components/fmt";
import type { LineItem } from "@/lib/types";

const EXAMPLE = {
  fromName: "Brook Studio", fromTagline: "Motion design · Lagos, NG", clientName: "Northwind Labs GmbH", clientEmail: "ap@northwind.example", clientLocation: "Berlin, DE",
  items: [{ description: "Product launch explainer", detail: "60s 2D motion, 2 revision rounds", amount: 350 }, { description: "Social cutdowns ×4", detail: "9:16 + 1:1 exports", amount: 100 }] as LineItem[],
};
const spring = { type: "spring" as const, stiffness: 300, damping: 30 };

export default function Builder() {
  const { accountId } = useWallet();
  const [f, setF] = useState({ ...EXAMPLE, currency: "USDC" as "USDC" | "USDT", payoutAccount: process.env.NEXT_PUBLIC_DEFAULT_PAYOUT || "purefile1686.near", payoutChain: "near" });
  const [created, setCreated] = useState<{ id: string; number: string } | null>(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [copied, setCopied] = useState(false);
  useEffect(() => { if (accountId) setF((s) => ({ ...s, payoutAccount: accountId })); }, [accountId]);
  const [acct, setAcct] = useState<{ id: string; exists: boolean | null; error?: string } | null>(null);
  useEffect(() => {
    if (f.payoutChain !== "near" || !f.payoutAccount.trim()) { setAcct(null); return; }
    const id = f.payoutAccount.trim(); let off = false;
    const t = setTimeout(async () => {
      try { const j = await (await fetch(`/api/near/account?id=${encodeURIComponent(id)}`)).json(); if (!off) setAcct({ id, exists: j.exists, error: j.error }); }
      catch { if (!off) setAcct(null); }
    }, 400);
    return () => { off = true; clearTimeout(t); };
  }, [f.payoutAccount, f.payoutChain]);
  const payoutMissing = acct?.id === f.payoutAccount.trim() && acct.exists === false;
  const now = useMemo(() => new Date().toISOString(), []);
  const due = useMemo(() => new Date(Date.now() + 14 * 864e5).toISOString(), []);
  const set = (k: string, v: unknown) => setF((s) => ({ ...s, [k]: v }));
  const setItem = (i: number, k: keyof LineItem, v: string) => setF((s) => ({ ...s, items: s.items.map((it, j) => (j === i ? { ...it, [k]: k === "amount" ? v.replace(/[^\d.]/g, "") : v } : it)) }));
  const isExample = f.clientName === EXAMPLE.clientName;
  const link = created ? `${typeof window !== "undefined" ? window.location.origin : ""}/pay/${created.id}` : "";

  async function create() {
    setBusy(true); setErr("");
    const r = await fetch("/api/invoices", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...f, ownerAccount: accountId, isExample }) });
    const j = await r.json(); setBusy(false);
    if (!r.ok) return setErr(j.error); setCreated(j);
  }

  return (
    <div className="min-h-screen">
      <TopBar right={<>{isExample && <span className="ex">Example data</span>}<WalletButton /></>} />
      <div className="grid min-h-[calc(100vh-64px)] lg:grid-cols-[520px_1fr]">
        <section className="flex flex-col gap-[18px] border-r border-ink/[.08] px-6 py-9 md:px-10">
          <div><h1 className="text-[28px] font-bold tracking-[-.03em]">New invoice</h1><p className="mt-1 text-sm text-ink/55">Get paid in stablecoins from any chain.</p></div>
          <div className="grid grid-cols-2 gap-3">
            <L t="Client"><input className="field" value={f.clientName} onChange={(e) => set("clientName", e.target.value)} /></L>
            <L t="Client email"><input className="field" value={f.clientEmail} onChange={(e) => set("clientEmail", e.target.value)} /></L>
          </div>
          <div>
            <div className="lbl mb-2">Line items</div>
            <div className="flex flex-col gap-2">
              <AnimatePresence initial={false}>
                {f.items.map((it, i) => (
                  <motion.div key={i} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={spring} className="grid grid-cols-[1fr_110px_28px] gap-2">
                    <input className="field" aria-label={`Item ${i + 1}`} value={it.description} onChange={(e) => setItem(i, "description", e.target.value)} placeholder="Description" />
                    <input className="field text-right font-mono" aria-label={`Amount ${i + 1}`} value={String(it.amount)} onChange={(e) => setItem(i, "amount", e.target.value)} />
                    <button aria-label="Remove" className="text-ink/30 hover:text-err" onClick={() => setF((s) => ({ ...s, items: s.items.filter((_, j) => j !== i) }))}>×</button>
                  </motion.div>
                ))}
              </AnimatePresence>
              <button className="self-start px-0.5 py-1 text-[13px] font-semibold text-violet" onClick={() => setF((s) => ({ ...s, items: [...s.items, { description: "", detail: "", amount: 0 }] }))}>+ Add item</button>
            </div>
          </div>
          <div>
            <div className="lbl mb-2">Receive as</div>
            <div className="grid grid-cols-3 gap-2">
              {(["USDC", "USDT"] as const).map((c) => (
                <button key={c} onClick={() => set("currency", c)} className={`relative flex items-center gap-2.5 rounded-xl border bg-white px-3.5 py-3 text-sm font-semibold ${f.currency === c ? "border-violet ring-4 ring-violet/15" : "border-ink/10"}`}><TokenIcon k={c} />{c}</button>
              ))}
              <select aria-label="Payout chain" value={f.payoutChain} onChange={(e) => set("payoutChain", e.target.value)} className="rounded-xl border border-ink/10 bg-white px-3 text-sm font-semibold">
                {["near", "base", "arb", "eth", "sol"].map((c) => <option key={c} value={c}>on {chainName(c)}</option>)}
              </select>
            </div>
          </div>
          <L t="Payout to">
            <div className="relative"><input className={`field pr-32 font-mono ${payoutMissing ? "border-err ring-4 ring-err/10" : ""}`} aria-invalid={payoutMissing} value={f.payoutAccount} onChange={(e) => set("payoutAccount", e.target.value)} />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-mint">{payoutMissing ? "" : accountId && f.payoutAccount === accountId ? "✓ Connected" : acct?.exists && acct.id === f.payoutAccount.trim() ? "✓ Found on mainnet" : ""}</span></div>
            {payoutMissing && <p role="alert" className="mt-1.5 text-xs font-semibold text-err">{acct?.error?.startsWith("Account") ? "Account not found on mainnet. Check the spelling, or create it first." : acct?.error}</p>}
          </L>
          <div className="flex-1" />
          {err && <p className="text-sm text-err">{err}</p>}
          <AnimatePresence mode="wait">
            {!created ? (
              <motion.button key="b" layoutId="cta" onClick={create} disabled={busy || payoutMissing} className="btn btn-v" transition={spring}>{busy ? "Creating…" : "Create pay link →"}</motion.button>
            ) : (
              <motion.div key="l" layoutId="cta" transition={spring} className="rounded-[14px] bg-ink p-4 text-white">
                <div className="flex items-center justify-between"><span className="text-xs font-semibold text-mint">● Pay link ready · {created.number}</span><button onClick={() => setCreated(null)} className="text-xs text-white/50">New</button></div>
                <div className="mt-2 truncate font-mono text-[13px]" data-testid="paylink">{link}</div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button className="h-10 rounded-lg bg-white/10 text-sm font-semibold" onClick={() => { navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? "Copied ✓" : "Copy link"}</button>
                  <a href={`/pay/${created.id}`} className="grid h-10 place-items-center rounded-lg bg-violet text-sm font-semibold">Open pay page</a>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
        <section className="relative hidden place-items-center p-10 lg:grid" style={{ background: "radial-gradient(1200px 600px at 70% 20%,rgba(110,91,255,.10),transparent)" }}>
          <div className="lbl absolute left-10 top-7">Live preview</div>
          <InvoiceCard className="w-[560px]" inv={{ number: "INV-2026-DRAFT", fromName: f.fromName, fromTagline: f.fromTagline, clientName: f.clientName, clientLocation: f.clientLocation, items: f.items, currency: f.currency, issuedAt: now, dueAt: due }} />
          <div className="pill absolute bottom-10">Clients pay with stablecoins and more on 20+ chains via NEAR Intents</div>
        </section>
      </div>
    </div>
  );
}
function L({ t, children }: { t: string; children: React.ReactNode }) { return <label className="block"><div className="lbl mb-1.5">{t}</div>{children}</label>; }
