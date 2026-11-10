"use client";
import { motion } from "framer-motion";
import type { Invoice, Payment } from "@/lib/types";
import { total } from "@/lib/types";
import { TopBar } from "./TopBar";
import { chainName, dispSym, intentsUrl, money, short, txUrl } from "./fmt";

export function Receipt({ invoice, payment, fingerprint = null }: { invoice: Invoice; payment: Payment | null; fingerprint?: string | null }) {
  if (!payment) return (<div className="min-h-screen"><TopBar /><div className="grid place-items-center p-16 text-center"><div><h1 className="text-2xl font-bold">Not paid yet</h1><a className="mt-3 inline-block text-violet" href={`/pay/${invoice.id}`}>Go to the pay page →</a></div></div></div>);
  const settled = payment.history.find((h) => h.status === "SUCCESS")?.at ?? payment.updatedAt;
  const when = new Date(settled).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Lagos" }) + " WAT";
  const rows: [string, string][] = [["Invoice", invoice.number], ["Paid with", `${payment.amountInFormatted} ${dispSym(payment.originSymbol)} · ${chainName(payment.originChain)}`],
    ["Received to", short(invoice.payoutAccount, 20, 6)], ["Route", "NEAR Intents (1-Click)"], ["Settled", when]];
  const pr = payment.proof; const sim = payment.mock;
  const txLink = !sim && payment.txHash ? txUrl(payment.originChain, payment.txHash) : null;
  return (
    <div className="min-h-screen print:bg-white" style={{ background: "radial-gradient(500px 400px at 50% 0%,rgba(43,212,164,.22),transparent)" }}>
      <div className="print:hidden"><TopBar compact right={<>{invoice.isExample && <span className="ex">Example data</span>}{payment.mock && <span className="pill text-signal">◐ Simulated payment</span>}</>} /></div>
      <main className="mx-auto max-w-[420px] px-5 py-4 md:py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} className="card relative overflow-hidden px-[22px] py-[26px]">
          <motion.div initial={{ scale: 1.4, rotate: -8, opacity: 0 }} animate={{ scale: 1, rotate: -8, opacity: 1 }} transition={{ duration: 0.25, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-5 top-[30px] rounded-[10px] border-[3px] border-mint px-3.5 py-1 text-[26px] font-extrabold tracking-[.12em] text-mint">PAID</motion.div>
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.15 }} className="grid h-[52px] w-[52px] place-items-center rounded-full bg-mint text-[26px] font-bold text-white shadow-[0_10px_30px_-8px_rgba(43,212,164,.8)]">✓</motion.div>
          <div className="lbl mt-[18px]">Payment received</div>
          <div className="my-1 font-mono text-[36px] font-semibold tracking-[-.03em]">{money(total(invoice))} <span className="text-base text-ink/55">{invoice.currency}</span></div>
          <div className="text-[13px] text-ink/55">{invoice.clientName} → {invoice.fromName}</div>
          <div className="-mx-[22px] my-[18px] border-t-2 border-dashed border-ink/[.12]" />
          {rows.map(([k, v], i) => (
            <motion.div key={k} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + i * 0.05 }} className="flex justify-between gap-3 border-b border-ink/[.08] py-2.5 text-[13px]"><span className="text-ink/55">{k}</span><span className="text-right font-mono text-xs">{v}</span></motion.div>
          ))}
          <div className="mt-4 rounded-xl bg-paper p-3.5" data-testid="proof">
            <div className="flex items-center justify-between"><span className="lbl">Proof</span>{sim ? <span className="pill text-signal">◐ Simulated · not on-chain</span> : <span className="pill text-mint">✓ Signature verified</span>}</div>
            <div className="mt-2 grid gap-1.5 text-[12px]">
              <div className="flex justify-between gap-3"><span className="text-ink/55">Quote signature</span><span className="whitespace-nowrap font-mono text-[11px]" title={pr?.signature}>{pr?.signature ? short(pr.signature, 12, 6) : "not recorded"}</span></div>
              <div className="flex justify-between gap-3"><span className="text-ink/55">Signed at</span><span className="font-mono text-[11px]">{pr?.timestamp ? new Date(pr.timestamp).toISOString().replace("T", " ").slice(0, 19) + " UTC" : "n/a"}</span></div>
              <div className="flex justify-between gap-3"><span className="text-ink/55">Deposit tx{sim && " (simulated)"}</span>{txLink ? <a className="font-mono text-[11px] text-violet underline" href={txLink} target="_blank" rel="noreferrer">{short(payment.txHash!, 10, 6)} ↗</a> : <span className="font-mono text-[11px]">{payment.txHash ? short(payment.txHash, 10, 6) : "n/a"}</span>}</div>
              {!sim && <div className="flex justify-between gap-3"><span className="text-ink/55">Intents explorer</span><a className="font-mono text-[11px] text-violet underline" href={intentsUrl(payment.depositAddress)} target="_blank" rel="noreferrer">{short(payment.depositAddress)} ↗</a></div>}
              {fingerprint && <div className="flex justify-between gap-3"><span className="text-ink/55">Receipt SHA-256</span><a className="whitespace-nowrap font-mono text-[11px] text-violet underline" data-testid="fingerprint" href={`/api/receipt/${invoice.id}/fingerprint`} target="_blank" rel="noreferrer" title={fingerprint}>{short(fingerprint, 10, 6)} ↗</a></div>}
            </div>
            <p className="mt-2 text-[10.5px] leading-snug text-ink/50">{sim ? "Mock mode: no funds moved. Signature and tx hash are placeholders." : "Ed25519 signature checked with verifyQuoteSignature() from the 1-Click SDK before the deposit address was shown."}</p>
          </div>
          <div className="flex justify-between pt-3 text-xs"><span className="pill text-mint">{payment.mock ? "◐ Simulated status" : "✓ Status from 1-Click"}</span><span className="pill font-mono">{short(payment.depositAddress)}</span></div>
        </motion.div>
        <p className="mt-4 hidden text-center text-[10px] text-ink/50 print:block">Invoice Link receipt · settled via NEAR Intents (1-Click) · {invoice.number}</p>
        <div className="mt-4 grid grid-cols-2 gap-2.5 print:hidden">
          <a className="btn" href={`/api/receipt/${invoice.id}/pdf`} download>Download PDF</a>
          <button className="btn border border-ink/[.08] !bg-white !text-ink" onClick={() => { if (navigator.share) navigator.share({ url: location.href, title: `Receipt ${invoice.number}` }); else navigator.clipboard?.writeText(location.href); }}>Share</button>
        </div>
      </main>
    </div>
  );
}
