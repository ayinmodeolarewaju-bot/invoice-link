import { describe, expect, it, vi, afterEach } from "vitest";
import { advance, isFinal } from "../status";
import { mockStatusAt } from "../oneclick";
import type { OneClickStatus } from "../types";
const h = (s: OneClickStatus) => ({ status: s, at: "t0" });
describe("status state machine", () => {
  it("fills skipped happy-path steps", () => {
    const r = advance({ status: "PENDING_DEPOSIT", history: [h("PENDING_DEPOSIT")] }, "SUCCESS", "t1");
    expect(r.changed).toBe(true);
    expect(r.history.map((x) => x.status)).toEqual(["PENDING_DEPOSIT", "KNOWN_DEPOSIT_TX", "PROCESSING", "SUCCESS"]);
  });
  it("appends off-path states as-is", () => {
    const r = advance({ status: "PROCESSING", history: [h("PENDING_DEPOSIT")] }, "REFUNDED", "t1");
    expect(r.status).toBe("REFUNDED");
    expect(r.history.at(-1)).toEqual({ status: "REFUNDED", at: "t1" });
    expect(r.history).toHaveLength(2);
  });
  it("is a no-op when unchanged or already final", () => {
    expect(advance({ status: "PROCESSING", history: [] }, "PROCESSING", "t").changed).toBe(false);
    const done = advance({ status: "SUCCESS", history: [] }, "FAILED", "t");
    expect(done.changed).toBe(false); expect(done.status).toBe("SUCCESS");
  });
  it("never moves backwards along the happy path without recording it", () => {
    const r = advance({ status: "PROCESSING", history: [] }, "KNOWN_DEPOSIT_TX", "t");
    expect(r.history).toEqual([{ status: "KNOWN_DEPOSIT_TX", at: "t" }]);
  });
  it("marks final states", () => {
    expect(["SUCCESS", "REFUNDED", "FAILED"].every((s) => isFinal(s as OneClickStatus))).toBe(true);
    expect(isFinal("PROCESSING")).toBe(false);
  });
});
describe("mock timeline", () => {
  afterEach(() => vi.useRealTimers());
  it("walks PENDING -> KNOWN -> PROCESSING -> SUCCESS over 8s", () => {
    vi.useFakeTimers(); const t0 = new Date("2026-11-04T10:00:00Z"); vi.setSystemTime(t0);
    expect(mockStatusAt(null)).toBe("PENDING_DEPOSIT");
    expect(mockStatusAt(t0.toISOString())).toBe("KNOWN_DEPOSIT_TX");
    vi.setSystemTime(new Date(t0.getTime() + 4000)); expect(mockStatusAt(t0.toISOString())).toBe("PROCESSING");
    vi.setSystemTime(new Date(t0.getTime() + 9000)); expect(mockStatusAt(t0.toISOString())).toBe("SUCCESS");
  });
});
