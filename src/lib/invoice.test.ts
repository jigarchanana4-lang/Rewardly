import { describe, it, expect } from "vitest";
import { splitInclusive, paise, rupees, formatINR, GST_RATE } from "./invoice";

describe("GST split (inclusive pricing)", () => {
  it("derives taxable value from a GST-inclusive total", () => {
    // ₹999 charged, 18% inclusive -> ₹846.61 taxable + ₹152.39 GST
    const s = splitInclusive(paise(999), false);
    expect(s.taxablePaise).toBe(84661);
    expect(s.taxPaise).toBe(15239);
  });

  it("always sums exactly back to what was charged", () => {
    // The invoice must reconcile with the bank statement to the last paisa,
    // for every price we might ever charge.
    for (let rs = 1; rs <= 50000; rs += 7) {
      const s = splitInclusive(paise(rs), false);
      expect(s.taxablePaise + s.taxPaise).toBe(paise(rs));
    }
  });

  it("never produces negative or fractional paise", () => {
    for (const rs of [1, 99, 999, 2499, 4999, 19999]) {
      const s = splitInclusive(paise(rs), false);
      expect(Number.isInteger(s.taxablePaise)).toBe(true);
      expect(Number.isInteger(s.taxPaise)).toBe(true);
      expect(s.taxPaise).toBeGreaterThan(0);
    }
  });

  it("carries the interstate flag through untouched", () => {
    expect(splitInclusive(paise(999), true).isInterstate).toBe(true);
    expect(splitInclusive(paise(999), false).isInterstate).toBe(false);
  });

  it("splits intra-state tax in half without losing a paisa", () => {
    // CGST + SGST must equal the total tax even when it is an odd number.
    for (const rs of [999, 2499, 4999, 1234]) {
      const s = splitInclusive(paise(rs), false);
      const half = Math.round(s.taxPaise / 2);
      expect(s.taxPaise - half + half).toBe(s.taxPaise);
    }
  });

  it("applies the documented rate", () => {
    const s = splitInclusive(paise(1180), false);
    // 1180 inclusive of 18% -> 1000 taxable
    expect(rupees(s.taxablePaise)).toBeCloseTo(1000, 1);
    expect(GST_RATE).toBe(18);
  });

  it("formats as Indian rupees with paise", () => {
    expect(formatINR(84661)).toContain("846.61");
  });
});
