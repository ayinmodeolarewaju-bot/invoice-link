// Input checks for payout accounts and refund addresses. Pure helpers + one NEAR RPC lookup.

const NEAR_ACCOUNT = /^(?=.{2,64}$)(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;
const NEAR_IMPLICIT = /^[0-9a-f]{64}$/;
const EVM_ADDR = /^0x[0-9a-fA-F]{40}$/;
const B58 = "[1-9A-HJ-NP-Za-km-z]";
const SOL_ADDR = new RegExp(`^${B58}{32,44}$`);
const TRON_ADDR = new RegExp(`^T${B58}{33}$`);
const TON_ADDR = /^(?:[EUk0][Qf][A-Za-z0-9_-]{46}|-?[01]:[0-9a-fA-F]{64})$/;
const BTC_ADDR = new RegExp(`^(?:bc1[02-9ac-hj-np-z]{11,71}|[13]${B58}{25,34})$`);
const EVM_CHAINS = ["eth", "arb", "base", "op", "pol", "bsc", "avax", "gnosis", "bera"];

/** True if `id` is a syntactically valid NEAR account id (named or 64-hex implicit). */
export function isNearAccountId(id: string): boolean {
  const s = id.trim();
  return NEAR_IMPLICIT.test(s) || NEAR_ACCOUNT.test(s);
}

/** Returns an error message for a refund address on `chain`, or null if it looks valid. */
export function refundAddressError(chain: string, address: string, chainLabel = chain.toUpperCase()): string | null {
  const a = address.trim();
  if (!a) return `Enter your ${chainLabel} address so a failed swap can be refunded.`;
  let ok: boolean; let hint: string;
  if (EVM_CHAINS.includes(chain)) { ok = EVM_ADDR.test(a); hint = "a 0x address with 40 hex characters"; }
  else if (chain === "near") { ok = isNearAccountId(a); hint = "a NEAR account like name.near"; }
  else if (chain === "sol") { ok = SOL_ADDR.test(a); hint = "a base58 Solana address (32–44 characters)"; }
  else if (chain === "tron") { ok = TRON_ADDR.test(a); hint = "a Tron address starting with T (34 characters)"; }
  else if (chain === "ton") { ok = TON_ADDR.test(a); hint = "a TON address like UQ… or EQ… (48 characters)"; }
  else if (chain === "btc") { ok = BTC_ADDR.test(a); hint = "a Bitcoin address (bc1…, 1… or 3…)"; }
  else return null; // unknown chain: let 1-Click decide
  return ok ? null : `That doesn't look like a valid ${chainLabel} address. Expected ${hint}.`;
}

export type NearNetwork = "mainnet" | "testnet";
export const NEAR_RPC: Record<NearNetwork, string> = { mainnet: "https://rpc.mainnet.near.org", testnet: "https://rpc.testnet.near.org" };
export type AccountCheck = { exists: boolean; error?: string };

/** Looks up `accountId` with NEAR RPC `view_account`. `exists:false` + error explains why. Network errors throw. */
export async function checkNearAccount(accountId: string, network: NearNetwork = "mainnet", fetchImpl: typeof fetch = fetch): Promise<AccountCheck> {
  const id = accountId.trim();
  if (!isNearAccountId(id)) return { exists: false, error: `"${id}" is not a valid NEAR account id.` };
  const r = await fetchImpl(process.env.NEAR_RPC_URL && network === "mainnet" ? process.env.NEAR_RPC_URL : NEAR_RPC[network], {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "invoicelink", method: "query", params: { request_type: "view_account", finality: "final", account_id: id } }),
  });
  const j = (await r.json()) as { result?: unknown; error?: { cause?: { name?: string }; data?: string; message?: string } };
  if (j.result) return { exists: true };
  const cause = j.error?.cause?.name ?? "";
  if (cause === "UNKNOWN_ACCOUNT" || /does not exist/i.test(j.error?.data ?? "")) return { exists: false, error: `Account ${id} not found on ${network}.` };
  throw new Error(`NEAR RPC error: ${j.error?.message ?? r.status}`);
}
