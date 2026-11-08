import { describe, expect, it } from "vitest";
import { toBaseUnits, verifyOrReject } from "../quote";
import { mockQuote, symMatch } from "../oneclick";
import { dispSym } from "../../components/fmt";
describe("quote mapping", () => {
  it("converts invoice dollars to destination base units", () => {
    expect(toBaseUnits(1250, 6)).toBe("1250000000");
    expect(toBaseUnits(0.1 + 0.2, 6)).toBe("300000"); // float noise rounds to cents
    expect(toBaseUnits(19.99, 18)).toBe("19990000000000000000");
    expect(toBaseUnits(12.34, 2)).toBe("1234");
    expect(toBaseUnits(12.34, 0)).toBe("12");
    expect(toBaseUnits(12.34, 24)).toBe("12340000000000000000000000"); // NEAR / wNEAR
  });
  it("rejects bad amounts", () => {
    expect(() => toBaseUnits(-1, 6)).toThrow(); expect(() => toBaseUnits(NaN, 6)).toThrow();
  });
  it("mock quote adds ~0.3% fee and keeps the exact output", () => {
    const q = mockQuote(1000, "USDC", 1, 6);
    expect(q.amountOutFormatted).toBe("1000.00"); expect(q.amountInFormatted).toBe("1003.00");
    expect(q.amountIn).toBe("1003000000"); expect(q.depositAddress).toMatch(/^0x[0-9a-f]{40}$/);
    const eth = mockQuote(2300, "ETH", 2300, 18);
    expect(eth.amountInFormatted).toBe("1.003000"); expect(eth.amountIn).toHaveLength(19);
  });
  it("prices a non-stable destination (NEAR) using destPrice", () => {
    const q = mockQuote(100, "USDC", 1, 6, 3.7); // 100 NEAR at $3.70
    expect(q.amountOutFormatted).toBe("100.00");
    expect(q.amountInFormatted).toBe("371.11"); // 100 * 3.7 * 1.003
    const eth = mockQuote(100, "ETH", 3700, 18, 3.7);
    expect(eth.amountOutFormatted).toBe("100.00");
    expect(Number(eth.amountInFormatted)).toBeCloseTo((100 * 3.7 * 1.003) / 3700, 5);
  });
});
describe("symbols", () => {
  it("symMatch treats USDT0 as USDT only", () => {
    expect(symMatch("USDT", "USDT")).toBe(true); expect(symMatch("USDT0", "USDT")).toBe(true);
    expect(symMatch("USDT0", "USDC")).toBe(false); expect(symMatch("USDC", "USDT")).toBe(false);
    expect(symMatch("wNEAR", "NEAR")).toBe(true); expect(symMatch("NEAR", "NEAR")).toBe(true);
    expect(symMatch("wNEAR", "USDC")).toBe(false);
  });
  it("dispSym shows USDT0 as USDT and wNEAR as NEAR", () => {
    expect(dispSym("USDT0")).toBe("USDT"); expect(dispSym("USDC")).toBe("USDC");
    expect(dispSym("wNEAR")).toBe("NEAR"); expect(dispSym("NEAR")).toBe("NEAR");
  });
});
describe("signature verification", () => {
  it("rejects when the verifier throws or returns false", async () => {
    expect(await verifyOrReject({}, () => { throw new Error("bad sig"); })).toBe(false);
    expect(await verifyOrReject({}, async () => false)).toBe(false);
    expect(await verifyOrReject({}, async () => undefined)).toBe(false);
  });
  it("accepts only a truthy verifier result", async () => {
    expect(await verifyOrReject({ signature: "ed25519:x" }, async () => true)).toBe(true);
  });
});
