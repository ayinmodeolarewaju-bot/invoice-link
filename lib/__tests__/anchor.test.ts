import { describe, expect, it } from "vitest";
import { anchorArgs, anchorTx, isTxHash, nearblocksTx, txHashFromOutcome, verifyAnchorTx } from "../anchor";

const H = "a".repeat(64);
const TX = "8y4TKsZfW1L7xQ2nUpJdRVwXcE3mB6aGhYk9sTqNvP5f"; // 44 base58 chars, test value
const rpc = (over: Record<string, unknown> = {}, args = anchorArgs("brook.testnet", "inv1", H)) => (async () => new Response(JSON.stringify({ result: {
  status: { SuccessValue: "IjAi" },
  transaction: { signer_id: "brook.testnet", receiver_id: "wrap.testnet",
    actions: [{ FunctionCall: { method_name: "ft_balance_of", args: Buffer.from(JSON.stringify(args)).toString("base64") } }] },
  ...over } }))) as unknown as typeof fetch;
const base = { txHash: TX, signer: "brook.testnet", network: "testnet" as const, invoiceId: "inv1", sha256: H };

describe("receipt anchor", () => {
  it("builds a zero-deposit function call carrying the fingerprint", () => {
    const tx = anchorTx("testnet", "brook.testnet", "inv1", H);
    expect(tx.receiverId).toBe("wrap.testnet");
    expect(tx.actions[0].params.deposit).toBe("0");
    expect(tx.actions[0].params.args).toMatchObject({ account_id: "brook.testnet", invoicelink_receipt: { invoice: "inv1", sha256: H } });
    expect(anchorTx("mainnet", "purefile1686.near", "inv1", H).receiverId).toBe("wrap.near");
  });
  it("links NearBlocks per network and reads tx hashes from wallet outcomes", () => {
    expect(nearblocksTx("mainnet", TX)).toBe(`https://nearblocks.io/txns/${TX}`);
    expect(nearblocksTx("testnet", TX)).toBe(`https://testnet.nearblocks.io/txns/${TX}`);
    expect(txHashFromOutcome({ transaction: { hash: TX } })).toBe(TX);
    expect(txHashFromOutcome(undefined)).toBeNull();
    expect(isTxHash("0xdead")).toBe(false);
  });
  it("accepts a successful tx with the matching fingerprint", async () => {
    const r = await verifyAnchorTx(base, rpc());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.anchor).toMatchObject({ txHash: TX, signer: "brook.testnet", contract: "wrap.testnet", sha256: H });
  });
  it("rejects wrong hash, wrong receipt, wrong contract, failed tx and unknown tx", async () => {
    expect((await verifyAnchorTx({ ...base, sha256: "b".repeat(64) }, rpc())).ok).toBe(false);
    expect((await verifyAnchorTx(base, rpc({}, anchorArgs("brook.testnet", "other", H)))).ok).toBe(false);
    expect((await verifyAnchorTx(base, rpc({ transaction: { signer_id: "brook.testnet", receiver_id: "evil.testnet", actions: [] } }))).ok).toBe(false);
    expect((await verifyAnchorTx(base, rpc({ status: { Failure: {} } }))).ok).toBe(false);
    const unknown = (async () => new Response(JSON.stringify({ error: { cause: { name: "UNKNOWN_TRANSACTION" } } }))) as unknown as typeof fetch;
    const u = await verifyAnchorTx(base, unknown);
    expect(u.ok === false && u.error).toMatch(/not found/);
    expect((await verifyAnchorTx({ ...base, txHash: "nope" }, rpc())).ok).toBe(false);
  });
});
