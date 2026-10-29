import { describe, it, expect } from "vitest";
import { accessFromSub } from "./subscription";

const DAY = 864e5;
const inDays = (n: number) => new Date(Date.now() + n * DAY).toISOString();

/**
 * accessFromSub decides whether a shop is visible to customers and whether its
 * loyalty programme runs. Migration 0013 mirrors this logic in SQL
 * (public.shop_has_access) — if you change one, change the other, or the page
 * and the database will disagree about who has paid.
 */
describe("accessFromSub", () => {
  it("denies access with no subscription at all", () => {
    expect(accessFromSub(null)).toEqual({ active: false, state: "none", daysLeft: null });
  });

  it("grants access during a live trial", () => {
    const a = accessFromSub({ status: "trial", trial_end: inDays(2), current_period_end: null });
    expect(a.active).toBe(true);
    expect(a.state).toBe("trial");
    expect(a.daysLeft).toBe(2);
  });

  it("revokes access the moment a trial lapses", () => {
    const a = accessFromSub({ status: "trial", trial_end: inDays(-1), current_period_end: null });
    expect(a.active).toBe(false);
    expect(a.state).toBe("expired");
    expect(a.daysLeft).toBe(0);
  });

  it("treats a trial with no end date as expired rather than infinite", () => {
    // Guards the worst failure mode: a free trial that never ends.
    const a = accessFromSub({ status: "trial", trial_end: null, current_period_end: null });
    expect(a.active).toBe(false);
  });

  it("grants access on a paid plan inside its period", () => {
    const a = accessFromSub({ status: "active", trial_end: null, current_period_end: inDays(30) });
    expect(a.active).toBe(true);
    expect(a.state).toBe("active");
    expect(a.daysLeft).toBe(30);
  });

  it("revokes access once the paid period ends", () => {
    const a = accessFromSub({ status: "active", trial_end: null, current_period_end: inDays(-3) });
    expect(a.active).toBe(false);
    expect(a.state).toBe("expired");
  });

  it("gives an active plan with no period end a short grace window", () => {
    // A late webhook must not lock a paying shop out of its own counter.
    const a = accessFromSub({ status: "active", trial_end: null, current_period_end: null });
    expect(a.active).toBe(true);
  });

  it("denies cancelled and expired statuses outright", () => {
    for (const status of ["cancelled", "expired"] as const) {
      const a = accessFromSub({ status, trial_end: inDays(30), current_period_end: inDays(30) });
      expect(a.active).toBe(false);
      expect(a.state).toBe("expired");
    }
  });

  it("never reports negative days remaining", () => {
    const a = accessFromSub({ status: "active", trial_end: null, current_period_end: inDays(-99) });
    expect(a.daysLeft).toBeGreaterThanOrEqual(0);
  });
});
