"use client";
// NEAR Wallet Selector: the freelancer signs in with a NEAR account, which becomes the invoice owner + default payout.
import { createContext, useContext, useEffect, useState } from "react";
import type { WalletSelector } from "@near-wallet-selector/core";
import type { WalletSelectorModal } from "@near-wallet-selector/modal-ui";

export type SimpleFnCall = { signerId: string; receiverId: string; actions: { type: "FunctionCall"; params: { methodName: string; args: object; gas: string; deposit: string } }[] };
type Ctx = { accountId: string | null; ready: boolean; signIn: () => void; signOut: () => void; network: string; signAndSend: (tx: SimpleFnCall) => Promise<unknown> };
const WalletCtx = createContext<Ctx>({ accountId: null, ready: false, signIn: () => {}, signOut: () => {}, network: "testnet", signAndSend: async () => { throw new Error("wallet not ready"); } });
export const useWallet = () => useContext(WalletCtx);
const network = (process.env.NEXT_PUBLIC_NEAR_NETWORK as "testnet" | "mainnet") || "testnet";

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [selector, setSelector] = useState<WalletSelector | null>(null);
  const [modal, setModal] = useState<WalletSelectorModal | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  useEffect(() => {
    let unsub: (() => void) | undefined;
    (async () => {
      try {
        const [{ setupWalletSelector }, { setupModal }, { setupMyNearWallet }, { setupMeteorWallet }] = await Promise.all([
          import("@near-wallet-selector/core"), import("@near-wallet-selector/modal-ui"),
          import("@near-wallet-selector/my-near-wallet"), import("@near-wallet-selector/meteor-wallet"),
        ]);
        const s = await setupWalletSelector({ network, modules: [setupMyNearWallet(), setupMeteorWallet()] });
        setSelector(s); setModal(setupModal(s, {}));
        const pick = (st: { accounts: { accountId: string; active?: boolean }[] }) => setAccountId(st.accounts.find((a) => a.active)?.accountId ?? st.accounts[0]?.accountId ?? null);
        pick(s.store.getState());
        const sub = s.store.observable.subscribe(pick as never); unsub = () => sub.unsubscribe();
      } catch (e) { console.warn("wallet selector unavailable", e); }
    })();
    return () => unsub?.();
  }, []);
  const signOut = async () => { try { (await selector?.wallet())?.signOut(); } catch {} setAccountId(null); };
  // Opens the user's wallet to sign; the app never sees a private key.
  const signAndSend = async (tx: SimpleFnCall) => {
    const wallet = await selector?.wallet(); if (!wallet) throw new Error("Connect a NEAR wallet first");
    const { actionCreators } = await import("@near-wallet-selector/core");
    const actions = tx.actions.map((a) => actionCreators.functionCall(a.params.methodName, a.params.args, BigInt(a.params.gas), BigInt(a.params.deposit)));
    return wallet.signAndSendTransaction({ signerId: tx.signerId, receiverId: tx.receiverId, actions });
  };
  return <WalletCtx.Provider value={{ accountId, ready: !!selector, signIn: () => modal?.show(), signOut, network, signAndSend }}>{children}</WalletCtx.Provider>;
}

export function WalletButton() {
  const { accountId, ready, signIn, signOut } = useWallet();
  if (accountId) return <button onClick={signOut} className="pill" title="Sign out"><span className="h-2 w-2 rounded-full bg-mint" />{accountId}</button>;
  return <button onClick={signIn} disabled={!ready} className="pill hover:border-violet/40">{ready ? "Connect NEAR wallet" : "Loading wallet…"}</button>;
}
