import type { Subscription } from "@/lib/types";

export type AccessState = "trial" | "active" | "expired" | "none";
export interface Access {
  active: boolean;
  state: AccessState;
  daysLeft: number | null;
}

const DAY = 864e5;

/** Derive whether a restaurant's plan currently grants access. */
export function accessFromSub(sub: Pick<Subscription, "status" | "trial_end" | "current_period_end"> | null): Access {
  if (!sub) return { active: false, state: "none", daysLeft: null };

  const now = Date.now();
  if (sub.status === "trial" && sub.trial_end) {
    const end = new Date(sub.trial_end).getTime();
    const daysLeft = Math.max(0, Math.ceil((end - now) / DAY));
    return { active: end > now, state: end > now ? "trial" : "expired", daysLeft };
  }
  if (sub.status === "active") {
    const end = sub.current_period_end ? new Date(sub.current_period_end).getTime() : now + DAY;
    const daysLeft = Math.max(0, Math.ceil((end - now) / DAY));
    return { active: end > now, state: end > now ? "active" : "expired", daysLeft };
  }
  return { active: false, state: "expired", daysLeft: 0 };
}
