import { describe, expect, it } from "vitest";
import { destChainFor, isStable, parseCurrency } from "../currency";

describe("parseCurrency", () => {
  it("accepts USDC, USDT and NEAR (plus 1-Click aliases)", () => {
    expect(parseCurrency("USDC")).toBe("USDC");
    expect(parseCurrency("usdt")).toBe("USDT");
    expect(parseCurrency("USDT0")).toBe("USDT");
    expect(parseCurrency("NEAR")).toBe("NEAR");
    expect(parseCurrency("wNEAR")).toBe("NEAR");
  });
  it("defaults missing or unknown values to USDC", () => {
    expect(parseCurrency(undefined)).toBe("USDC");
    expect(parseCurrency("ETH")).toBe("USDC");
    expect(parseCurrency("")).toBe("USDC");
  });
});

describe("destChainFor", () => {
  it("locks NEAR invoices to the NEAR chain", () => {
    expect(destChainFor("NEAR", "base")).toBe("near");
    expect(destChainFor("NEAR", "near")).toBe("near");
  });
  it("keeps the chosen chain for stablecoins", () => {
    expect(destChainFor("USDC", "base")).toBe("base");
    expect(destChainFor("USDT", "arb")).toBe("arb");
    expect(destChainFor("USDC", "")).toBe("near");
  });
});

describe("isStable", () => {
  it("treats USDC/USDT/USDT0 as dollar stables", () => {
    expect(isStable("USDC")).toBe(true);
    expect(isStable("usdt")).toBe(true);
    expect(isStable("USDT0")).toBe(true);
    expect(isStable("NEAR")).toBe(false);
    expect(isStable("ETH")).toBe(false);
  });
});
