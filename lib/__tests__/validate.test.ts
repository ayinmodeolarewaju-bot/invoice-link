import { describe, expect, it } from "vitest";
import { checkNearAccount, isNearAccountId, refundAddressError } from "../validate";

const rpc = (body: unknown) => (async () => ({ status: 200, json: async () => body })) as unknown as typeof fetch;

describe("isNearAccountId", () => {
  it("accepts named and implicit accounts", () => {
    for (const id of ["purefile1686.near", "a.b-c_d.near", "alice.testnet", "a".repeat(64).replace(/a/g, "f")]) expect(isNearAccountId(id)).toBe(true);
  });
  it("rejects bad ids", () => {
    for (const id of ["", "a", "Alice.near", "bad..near", "-x.near", "x_.near", "has space.near"]) expect(isNearAccountId(id)).toBe(false);
  });
});

describe("checkNearAccount", () => {
  it("returns exists for a view_account result", async () => {
    expect(await checkNearAccount("purefile1686.near", "mainnet", rpc({ result: { amount: "1" } }))).toEqual({ exists: true });
  });
  it("returns a friendly error for UNKNOWN_ACCOUNT", async () => {
    const r = await checkNearAccount("nobody-xyz.near", "mainnet", rpc({ error: { cause: { name: "UNKNOWN_ACCOUNT" } } }));
    expect(r).toEqual({ exists: false, error: "Account nobody-xyz.near not found on mainnet." });
  });
  it("rejects malformed ids without calling RPC", async () => {
    const r = await checkNearAccount("Not Valid", "mainnet", (() => { throw new Error("should not fetch"); }) as unknown as typeof fetch);
    expect(r.exists).toBe(false);
  });
  it("throws on other RPC errors", async () => {
    await expect(checkNearAccount("x.near", "mainnet", rpc({ error: { message: "boom" } }))).rejects.toThrow("NEAR RPC error: boom");
  });
});

describe("refundAddressError", () => {
  it("accepts valid addresses per chain", () => {
    expect(refundAddressError("arb", "0xA11cE0000000000000000000000000000000b0b0")).toBeNull();
    expect(refundAddressError("sol", "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU")).toBeNull();
    expect(refundAddressError("near", "client.near")).toBeNull();
    expect(refundAddressError("tron", "TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7")).toBeNull();
    expect(refundAddressError("ton", "UQBvW8Z5huBkMJYdnfAEM5JqTNkuWX3diqYENkWsIL0XggGG")).toBeNull();
    expect(refundAddressError("btc", "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq")).toBeNull();
  });
  it("rejects wrong-chain addresses with a clear message", () => {
    expect(refundAddressError("eth", "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU", "Ethereum")).toBe("That doesn't look like a valid Ethereum address. Expected a 0x address with 40 hex characters.");
    expect(refundAddressError("sol", "0xA11cE0000000000000000000000000000000b0b0")).toMatch(/base58 Solana/);
    expect(refundAddressError("tron", "client.near")).toMatch(/starting with T/);
    expect(refundAddressError("near", "Bad Addr")).toMatch(/NEAR account/);
  });
  it("asks for an address when empty", () => {
    expect(refundAddressError("arb", "  ", "Arbitrum")).toMatch(/Enter your Arbitrum address/);
  });
});
