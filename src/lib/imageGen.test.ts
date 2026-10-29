import { describe, it, expect } from "vitest";
import { IMAGE_OPS, MAX_STRENGTH, safeStrength } from "./imageGen";

describe("image operation safety", () => {
  it("clamps strength to the ceiling", () => {
    expect(safeStrength(0.9)).toBe(MAX_STRENGTH);
    expect(safeStrength(-1)).toBe(0);
    expect(safeStrength(0.3)).toBe(0.3);
  });

  it("keeps every operation below the reinvention threshold", () => {
    // Above ~0.45, image-to-image stops correcting the photo and starts
    // inventing food that never arrives at the table.
    for (const op of Object.values(IMAGE_OPS)) {
      expect(op.strength).toBeLessThanOrEqual(MAX_STRENGTH);
      expect(op.strength).toBeGreaterThan(0);
    }
  });

  it("every prompt forbids changing the food", () => {
    // The guardrail has to live in the prompt as well as the strength cap.
    for (const op of Object.values(IMAGE_OPS)) {
      expect(op.prompt.toLowerCase()).toMatch(/same|unchanged|without altering|do not add/);
    }
  });

  it("charges a positive whole number of credits for every operation", () => {
    for (const op of Object.values(IMAGE_OPS)) {
      expect(Number.isInteger(op.cost)).toBe(true);
      expect(op.cost).toBeGreaterThan(0);
    }
  });
});
