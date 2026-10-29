import { describe, it, expect } from "vitest";
import { slugify, inr, normalizePhone, one, haversineKm, nearestBranch } from "@/lib/utils";
import { accessFromSub } from "@/lib/subscription";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Borcella Coffee!")).toBe("borcella-coffee");
  });
  it("collapses repeats and trims", () => {
    expect(slugify("  A  --  B  ")).toBe("a-b");
  });
});

describe("normalizePhone", () => {
  it("adds +91 to a 10-digit number", () => {
    expect(normalizePhone("9876543210")).toBe("+919876543210");
  });
  it("keeps a 91-prefixed number", () => {
    expect(normalizePhone("919876543210")).toBe("+919876543210");
  });
  it("rejects short input", () => {
    expect(normalizePhone("123")).toBeNull();
  });
});

describe("inr", () => {
  it("formats with the rupee sign and grouping", () => {
    expect(inr(2499)).toBe("₹2,499");
  });
});

describe("one", () => {
  it("unwraps an array join to a single object", () => {
    expect(one([{ id: 1 }, { id: 2 }])).toEqual({ id: 1 });
  });
  it("passes through an object", () => {
    expect(one({ id: 1 })).toEqual({ id: 1 });
  });
  it("returns null for empty/undefined", () => {
    expect(one([])).toBeNull();
    expect(one(null)).toBeNull();
  });
});

describe("geo", () => {
  it("computes ~0 km for identical points", () => {
    expect(haversineKm(12.9, 77.6, 12.9, 77.6)).toBeCloseTo(0, 5);
  });
  it("picks the nearest branch", () => {
    const branches = [
      { id: "far", lat: 19.07, lng: 72.87 },
      { id: "near", lat: 12.95, lng: 77.62 },
    ];
    expect(nearestBranch(branches, 12.96, 77.63)?.id).toBe("near");
  });
  it("ignores branches without coordinates", () => {
    const branches = [{ id: "a", lat: null, lng: null }];
    expect(nearestBranch(branches, 12.96, 77.63)).toBeNull();
  });
});

describe("accessFromSub", () => {
  const future = new Date(Date.now() + 5 * 864e5).toISOString();
  const past = new Date(Date.now() - 864e5).toISOString();

  it("grants access during a live trial", () => {
    const a = accessFromSub({ status: "trial", trial_end: future, current_period_end: null });
    expect(a.active).toBe(true);
    expect(a.state).toBe("trial");
  });
  it("marks an ended trial expired", () => {
    const a = accessFromSub({ status: "trial", trial_end: past, current_period_end: null });
    expect(a.active).toBe(false);
    expect(a.state).toBe("expired");
  });
  it("grants access for an active period", () => {
    const a = accessFromSub({ status: "active", trial_end: null, current_period_end: future });
    expect(a.active).toBe(true);
  });
  it("denies with no subscription", () => {
    expect(accessFromSub(null).active).toBe(false);
  });
});
