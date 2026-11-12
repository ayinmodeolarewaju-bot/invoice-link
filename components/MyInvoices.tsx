"use client";
import { useEffect, useState } from "react";
import { money } from "@/components/fmt";
import type { InvoiceSummary } from "@/lib/owner";

// Invoices owned by the connected NEAR account. Hidden when no wallet is connected.
export function MyInvoices({ accountId, refreshKey }: { accountId: string | null; refreshKey?: string }) {
  const [list, setList] = useState<InvoiceSummary[] | null>(null);
  useEffect(() => {
    if (!accountId) { setList(null); return; }
    let off = false;
    fetch(`/api/invoices?owner=${encodeURIComponent(accountId)}`).then((r) => r.json()).then((j) => { if (!off) setList(j.invoices ?? []); }).catch(() => { if (!off) setList([]); });
    return () => { off = true; };
  }, [accountId, refreshKey]);
  if (!accountId) return null;
  return (
    <div data-testid="my-invoices">
      <div className="lbl mb-2">My invoices <span className="normal-case text-ink/40">· {accountId}</span></div>
      {list === null ? <p className="text-xs text-ink/45">Loading…</p> : !list.length ? <p className="text-xs text-ink/45">No invoices for this account yet.</p> : (
        <ul className="flex flex-col gap-1.5">
          {list.map((i) => (
            <li key={i.id}>
              <a href={i.status === "paid" ? `/receipt/${i.id}` : `/pay/${i.id}`} className="flex items-center justify-between rounded-lg border border-ink/10 bg-white px-3 py-2 text-[13px] hover:border-violet/40">
                <span className="truncate"><span className="font-mono text-ink/50">{i.number}</span> · {i.clientName}</span>
                <span className="flex shrink-0 items-center gap-2 font-mono">{money(i.total)} {i.currency}
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${i.status === "paid" ? "bg-mint/15 text-mint-ink" : "bg-ink/[.06] text-ink/55"}`}>{i.status === "paid" ? "Paid" : "Open"}</span></span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
