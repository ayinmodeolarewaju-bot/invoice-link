// On-chain receipt anchor (wallet-signed, no keys on the server).
// The payee signs ONE zero-deposit FunctionCall in their own NEAR wallet. The call goes to the wNEAR
// contract's read-only `ft_balance_of`; near-sdk ignores unknown JSON fields, so the extra
// `invoicelink_receipt` arg rides along and is stored forever in the transaction. Nothing is transferred:
// the only cost is gas (well under 0.01 NEAR). Anyone can later fetch the tx from NEAR RPC, decode the
// args and compare the SHA-256 with /api/receipt/<id>/fingerprint.
import { FINGERPRINT_VERSION } from "./version";

export type AnchorNetwork = "mainnet" | "testnet";
export type Anchor = { txHash: string; signer: string; network: AnchorNetwork; contract: string; sha256: string; at: string };

export const ANCHOR_METHOD = "ft_balance_of";
export const ANCHOR_GAS = "10000000000000"; // 10 TGas attached; unused gas is refunded
export const ANCHOR_CONTRACT: Record<AnchorNetwork, string> = { mainnet: "wrap.near", testnet: "wrap.testnet" };
export const ANCHOR_RPC: Record<AnchorNetwork, string> = { mainnet: "https://rpc.mainnet.fastnear.com", testnet: "https://rpc.testnet.fastnear.com" };

export const anchorContract = (network: AnchorNetwork) =>
  (network === "mainnet" ? process.env.NEXT_PUBLIC_ANCHOR_CONTRACT_MAINNET : process.env.NEXT_PUBLIC_ANCHOR_CONTRACT_TESTNET) || ANCHOR_CONTRACT[network];

export const nearblocksTx = (network: AnchorNetwork, txHash: string) =>
  `https://${network === "testnet" ? "testnet." : ""}nearblocks.io/txns/${encodeURIComponent(txHash)}`;

export const isHex64 = (s: string) => /^[0-9a-f]{64}$/.test(s);
export const isTxHash = (s: string) => /^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(s); // base58 sha256

/** The exact args the wallet signs. */
export function anchorArgs(signer: string, invoiceId: string, sha256: string) {
  return { account_id: signer, invoicelink_receipt: { v: FINGERPRINT_VERSION, invoice: invoiceId, sha256 } };
}

/** Transaction for the wallet selector (actions in the selector's simple FunctionCall form). */
export function anchorTx(network: AnchorNetwork, signer: string, invoiceId: string, sha256: string) {
  return {
    signerId: signer, receiverId: anchorContract(network),
    actions: [{ type: "FunctionCall" as const, params: { methodName: ANCHOR_METHOD, args: anchorArgs(signer, invoiceId, sha256), gas: ANCHOR_GAS, deposit: "0" } }],
  };
}

/** Pull the tx hash out of whatever a wallet returns (FinalExecutionOutcome, string, or nothing). */
export function txHashFromOutcome(o: unknown): string | null {
  if (!o) return null;
  if (typeof o === "string") return isTxHash(o) ? o : null;
  const x = o as { transaction?: { hash?: string }; transaction_outcome?: { id?: string } };
  return x.transaction?.hash ?? x.transaction_outcome?.id ?? null;
}

export type AnchorCheck = { ok: true; anchor: Anchor } | { ok: false; error: string };

/** Fetch the tx from NEAR RPC and check it is a successful anchor of `sha256` for `invoiceId`. */
export async function verifyAnchorTx(
  { txHash, signer, network, invoiceId, sha256 }: { txHash: string; signer: string; network: AnchorNetwork; invoiceId: string; sha256: string },
  fetchImpl: typeof fetch = fetch,
): Promise<AnchorCheck> {
  if (!isTxHash(txHash)) return { ok: false, error: "not a NEAR transaction hash" };
  if (!/^[a-z0-9._-]{2,64}$/.test(signer)) return { ok: false, error: "invalid signer account" };
  const rpc = (network === "mainnet" ? process.env.NEAR_RPC_URL : process.env.NEAR_RPC_URL_TESTNET) || ANCHOR_RPC[network];
  const r = await fetchImpl(rpc, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "invoicelink-anchor", method: "tx", params: { tx_hash: txHash, sender_account_id: signer, wait_until: "FINAL" } }),
  });
  const j = (await r.json().catch(() => null)) as { result?: RpcTx; error?: { cause?: { name?: string }; message?: string } } | null;
  if (!j?.result) return { ok: false, error: j?.error?.cause?.name === "UNKNOWN_TRANSACTION" ? "transaction not found on " + network : "NEAR RPC error: " + (j?.error?.message ?? r.status) };
  const t = j.result;
  if (!t.status || !("SuccessValue" in t.status)) return { ok: false, error: "transaction did not succeed" };
  const contract = anchorContract(network);
  if (t.transaction.receiver_id !== contract) return { ok: false, error: `transaction was not sent to ${contract}` };
  const fc = t.transaction.actions.map((a) => (typeof a === "object" ? a.FunctionCall : undefined)).find((f) => f?.method_name === ANCHOR_METHOD);
  if (!fc) return { ok: false, error: "no anchor call in transaction" };
  let args: ReturnType<typeof anchorArgs> | null = null;
  try { args = JSON.parse(Buffer.from(fc.args, "base64").toString("utf8")); } catch { /* fallthrough */ }
  const rec = args?.invoicelink_receipt;
  if (!rec || rec.invoice !== invoiceId) return { ok: false, error: "transaction anchors a different receipt" };
  if (rec.sha256 !== sha256) return { ok: false, error: "fingerprint in transaction does not match this receipt" };
  return { ok: true, anchor: { txHash, signer: t.transaction.signer_id, network, contract, sha256, at: new Date().toISOString() } };
}

type RpcTx = {
  status: Record<string, unknown>;
  transaction: { signer_id: string; receiver_id: string; actions: ({ FunctionCall?: { method_name: string; args: string } } | string)[] };
};
