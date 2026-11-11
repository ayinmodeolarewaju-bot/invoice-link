"use client";
// "Anchor on NEAR": the payee signs one zero-deposit call in their own wallet that carries the receipt SHA-256.
import { useEffect, useState } from "react";
import { useWallet } from "./Wallet";
import { anchorTx, isTxHash, nearblocksTx, txHashFromOutcome, type Anchor, type AnchorNetwork } from "@/lib/anchor";
import { short } from "./fmt";

export function AnchorReceipt({ invoiceId, fingerprint, initial }: { invoiceId: string; fingerprint: string; initial: Anchor | null }) {
  const { accountId, ready, signIn, signAndSend, network } = useWallet();
  const net: AnchorNetwork = network === "mainnet" ? "mainnet" : "testnet";
  const [anchor, setAnchor] = useState<Anchor | null>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [manual, setManual] = useState("");

  const record = async (txHash: string, signer: string) => {
    setBusy(true); setMsg("Checking the transaction on NEAR…");
    try {
      const r = await fetch(`/api/receipt/${invoiceId}/anchor`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ txHash, signer, network: net }) });
      const j = await r.json();
      if (!r.ok) { setMsg(j.error ?? "Could not record the anchor"); if (j.anchor) setAnchor(j.anchor); return; }
      setAnchor(j.anchor); setMsg(null);
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };

  // Redirect-style wallets come back with ?transactionHashes=… on this page.
  useEffect(() => {
    const q = new URLSearchParams(location.search).get("transactionHashes");
    if (q && accountId && !anchor) { record(q.split(",").pop()!, accountId); history.replaceState(null, "", location.pathname); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  const go = async () => {
    if (!accountId) return signIn();
    setBusy(true); setMsg("Confirm the transaction in your wallet…");
    try {
      const out = await signAndSend(anchorTx(net, accountId, invoiceId, fingerprint));
      const h = txHashFromOutcome(out);
      if (!h) { setMsg("Signed. Paste the transaction hash below to attach it."); setBusy(false); return; }
      await record(h, accountId);
    } catch (e) { setMsg((e as Error).message || "Wallet closed"); setBusy(false); }
  };

  if (anchor) return (
    <div className="flex justify-between gap-3" data-testid="anchor">
      <span className="text-ink/55">Anchored on NEAR</span>
      <span className="flex gap-2 font-mono text-[11px]">
        <a className="text-violet underline" href={nearblocksTx(anchor.network, anchor.txHash)} target="_blank" rel="noreferrer">✓ {short(anchor.txHash, 8, 4)} ↗</a>
        <a className="text-violet underline" href={`/api/receipt/${invoiceId}/anchor`} target="_blank" rel="noreferrer">verify</a>
      </span>
    </div>
  );
  return (
    <div className="mt-1 grid gap-1.5 print:hidden" data-testid="anchor">
      <button type="button" className="pill justify-center hover:border-violet/40 disabled:opacity-60" onClick={go} disabled={busy || !ready}>
        {!ready ? "Loading wallet…" : accountId ? `Anchor on NEAR (${net}) · gas only` : "Connect wallet to anchor on NEAR"}
      </button>
      {msg && <p role="status" aria-live="polite" className="text-[10.5px] text-ink/60">{msg}</p>}
      {accountId && (
        <form className="flex gap-1.5" onSubmit={(e) => { e.preventDefault(); if (isTxHash(manual.trim())) record(manual.trim(), accountId); else setMsg("That is not a NEAR transaction hash"); }}>
          <label className="sr-only" htmlFor="anchor-tx">Anchor transaction hash</label>
          <input id="anchor-tx" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="…or paste a signed anchor tx hash" className="min-w-0 flex-1 rounded-lg border border-ink/[.1] bg-white px-2 py-1 font-mono text-[10.5px]" />
          <button className="pill text-[10.5px]" disabled={busy}>Attach</button>
        </form>
      )}
    </div>
  );
}
