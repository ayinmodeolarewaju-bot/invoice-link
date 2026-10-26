"use client";
import { motion } from "framer-motion";
import type { Invoice } from "@/lib/types";
import { total } from "@/lib/types";
import { date, money } from "./fmt";

type Props = { inv: Pick<Invoice, "number" | "fromName" | "fromTagline" | "clientName" | "clientLocation" | "items" | "currency" | "issuedAt" | "dueAt">; children?: React.ReactNode; className?: string; layoutAmount?: boolean };
export function InvoiceCard({ inv, children, className = "", layoutAmount }: Props) {
  return (
    <div className={`card p-6 md:p-9 ${className}`}>
      <div className="flex items-start justify-between gap-4">
        <div><div className="lbl">Invoice</div><div className="mt-1 font-mono text-[13px]">{inv.number}</div></div>
        <div className="text-right"><div className="text-base font-bold">{inv.fromName || "Your studio"}</div><div className="text-xs text-ink/55">{inv.fromTagline}</div></div>
      </div>
      <div className="my-6 grid grid-cols-[1.4fr_1fr_1fr] gap-4 text-[13px]">
        <div><div className="lbl">Billed to</div><div className="mt-1 font-semibold">{inv.clientName || "Client name"}</div><div className="text-xs text-ink/55">{inv.clientLocation}</div></div>
        <div className="whitespace-nowrap"><div className="lbl">Issued</div><div className="mt-1">{date(inv.issuedAt)}</div></div>
        <div className="whitespace-nowrap"><div className="lbl">Due</div><div className="mt-1">{date(inv.dueAt)}</div></div>
      </div>
      <div className="border-t border-ink/[.08]">
        {inv.items.map((it, i) => (
          <motion.div layout key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="flex items-center justify-between gap-4 border-b border-ink/[.08] py-3 text-[13px]">
            <div className="min-w-0"><div className="truncate font-semibold">{it.description || "Item"}</div>{it.detail ? <div className="truncate text-xs text-ink/55">{it.detail}</div> : null}</div>
            <span className="font-mono">{money(Number(it.amount) || 0)}</span>
          </motion.div>
        ))}
      </div>
      <div className="flex items-baseline justify-between pt-4">
        <span className="lbl">Total due</span>
        <motion.span layoutId={layoutAmount ? "amount" : undefined} className="font-mono text-[26px] font-semibold tracking-[-.02em]">
          {money(total(inv))} <span className="text-sm text-ink/55">{inv.currency}</span>
        </motion.span>
      </div>
      {children}
    </div>
  );
}
