import { describe, expect, it } from "vitest";
import { isFromWallet, onManualEdit, onWalletChange } from "../payout";

const D = "purefile1686.near";
const def = { payoutAccount: D, payoutSource: "default" as const };

describe("payout autofill", () => {
  it("fills from the wallet on connect (NEAR chain)", () => {
    expect(onWalletChange(def, "alice.near", "near", D)).toEqual({ payoutAccount: "alice.near", payoutSource: "wallet" });
  });
  it("does not fill a NEAR account into a non-NEAR payout chain", () => {
    expect(onWalletChange(def, "alice.near", "base", D)).toEqual(def);
  });
  it("never overwrites a manually typed payout", () => {
    const m = onManualEdit("bob.near", "alice.near");
    expect(m.payoutSource).toBe("manual");
    expect(onWalletChange(m, "carol.near", "near", D)).toEqual(m);
    expect(onWalletChange(m, null, "near", D)).toEqual(m);
  });
  it("restores the default on sign-out when the value came from the wallet", () => {
    expect(onWalletChange({ payoutAccount: "alice.near", payoutSource: "wallet" }, null, "near", D)).toEqual(def);
  });
  it("typing the wallet account back counts as from-wallet", () => {
    const s = onManualEdit("alice.near", "alice.near");
    expect(isFromWallet(s, "alice.near")).toBe(true);
    expect(isFromWallet(onManualEdit("alice.nea", "alice.near"), "alice.near")).toBe(false);
  });
});
