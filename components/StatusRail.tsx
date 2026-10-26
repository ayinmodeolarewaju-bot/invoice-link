"use client";
import { motion } from "framer-motion";
import type { Invoice, OneClickStatus, Payment } from "@/lib/types";
import { chainName, money, short, time } from "./fmt";
import { total } from "@/lib/types";

const EASE = [0.22, 1, 0.36, 1] as const;
const ORDER: OneClickStatus[] = ["PENDING_DEPOSIT", "KNOWN_DEPOSIT_TX", "PROCESSING", "SUCCESS"];
export function StatusRail({ p, invoice }: { p: Payment; invoice: Invoice }) {
  const cur = ORDER.indexOf(p.status);
  const at = (s: OneClickStatus) => p.history.find((h) => h.status === s)?.at;
  const bad = ["REFUNDED", "FAILED", "INCOMPLETE_DEPOSIT"].includes(p.status);
  const nodes = [
    { t: "Awaiting deposit", d: `${p.amountInFormatted} ${p.originSymbol === "USDT0" ? "USDT" : p.originSymbol} on ${chainName(p.originChain)}`, s: "PENDING_DEPOSIT" as const },
    { t: "Deposit detected", d: p.txHash ? `Tx ${short(p.txHash)}` : "Watching the deposit address", s: "KNOWN_DEPOSIT_TX" as const },
    { t: "Routing via NEAR Intents", d: `Solver filling ${money(total(invoice))} ${invoice.currency} → ${short(invoice.payoutAccount, 18, 6)}`, s: "PROCESSING" as const },
    { t: "Paid", d: p.status === "SUCCESS" ? "Funds delivered. Receipt issued." : "Receipt is issued when funds land", s: "SUCCESS" as const },
  ];
  return (
    <div>
      {nodes.map((n, i) => {
        const done = cur > i || p.status === "SUCCESS", now = cur === i && !done, last = i === nodes.length - 1;
        return (
          <div key={n.s} className="flex gap-4">
            <div className="flex flex-col items-center">
              <motion.div initial={false} animate={{ scale: now ? 1 : 1, backgroundColor: done ? "#2BD4A4" : "#FFFFFF", borderColor: done ? "#2BD4A4" : now ? "#6E5BFF" : "rgba(11,13,18,.18)" }}
                transition={{ duration: 0.3, ease: EASE }} className={`relative grid h-7 w-7 place-items-center rounded-full border-2 ${!done && !now ? "border-dashed" : ""}`}>
                {done && <motion.svg initial={{ pathLength: 0 }} width="14" height="14" viewBox="0 0 24 24"><motion.path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, ease: EASE }} /></motion.svg>}
                {now && <><span className="h-2 w-2 rounded-full bg-violet" /><motion.span className="absolute inset-[-6px] rounded-full bg-violet/15" animate={{ scale: [0.8, 1.25, 0.8], opacity: [0.9, 0.3, 0.9] }} transition={{ duration: 2, repeat: Infinity }} /></>}
              </motion.div>
              {!last && <div className="relative min-h-[34px] w-0.5 flex-1 bg-ink/[.08]"><motion.div className="absolute inset-x-0 top-0 bg-mint" initial={false} animate={{ height: done ? "100%" : now ? "40%" : "0%", backgroundColor: done ? "#2BD4A4" : "#6E5BFF" }} transition={{ duration: 0.6, ease: EASE }} /></div>}
            </div>
            <div className={`flex-1 ${last ? "" : "pb-[22px]"}`}>
              <div className="flex justify-between gap-3"><b className={now ? "text-violet" : !done ? "text-ink/45" : ""}>{n.t}</b><span className={`font-mono text-xs ${now ? "text-violet" : "text-ink/55"}`}>{at(n.s) && (done || now) ? time(at(n.s)!) : ""}</span></div>
              <div className="text-[13px] text-ink/55">{n.d}</div>
            </div>
          </div>
        );
      })}
      {bad && <div className="mt-3 rounded-xl border border-err/30 bg-err/5 p-3 text-sm text-err">1-Click reported {p.status}. {p.status === "REFUNDED" ? "Funds were returned to the refund address." : "Check the deposit amount or contact the freelancer."}</div>}
    </div>
  );
}
