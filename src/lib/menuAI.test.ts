import { describe, it, expect } from "vitest";
import { parseItems } from "./menuAI";
import { hexToRgb, readableOn, channels, contrastRatio, shopThemeCss } from "./theme";

describe("parseItems", () => {
  it("reads a clean response", () => {
    const out = parseItems('{"items":[{"category":"Hot","name":"Filter Coffee","description":null,"price":90}]}');
    expect(out).toEqual([{ category: "Hot", name: "Filter Coffee", description: null, price: 90 }]);
  });

  it("survives code fences and preamble", () => {
    const out = parseItems('Here you go:\n```json\n{"items":[{"name":"Chai","price":30}]}\n```');
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ name: "Chai", price: 30, category: "Menu" });
  });

  it("coerces string prices and strips currency", () => {
    const out = parseItems('{"items":[{"name":"Cold Brew","price":"₹1,180/-"}]}');
    expect(out[0].price).toBe(1180);
  });

  it("nulls unusable prices rather than guessing", () => {
    const out = parseItems('{"items":[{"name":"Market Fish","price":"seasonal"},{"name":"Free Water","price":0}]}');
    expect(out.map((i) => i.price)).toEqual([null, null]);
  });

  it("drops nameless rows and de-duplicates within a category", () => {
    const out = parseItems(
      '{"items":[{"name":"Chai","category":"Hot"},{"name":"chai","category":"hot"},{"name":"  ","category":"Hot"}]}',
    );
    expect(out).toHaveLength(1);
  });

  it("returns nothing for malformed output instead of throwing", () => {
    expect(parseItems("sorry, I cannot read that")).toEqual([]);
    expect(parseItems('{"items":')).toEqual([]);
    expect(parseItems('{"items":"not an array"}')).toEqual([]);
  });
});

describe("theme contrast", () => {
  it("parses hex", () => {
    expect(hexToRgb("#4B21F5")).toEqual([75, 33, 245]);
    expect(hexToRgb("4b21f5")).toEqual([75, 33, 245]);
    expect(hexToRgb("#xyz")).toBeNull();
  });

  it("picks readable text for dark and light brands", () => {
    expect(channels(readableOn([74, 44, 29]))).toBe("255 255 255"); // espresso -> white
    expect(channels(readableOn([217, 255, 61]))).toBe("20 9 59"); // lime -> ink
  });

  it("never emits text below the 4.5:1 body threshold", () => {
    const brands: [number, number, number][] = [
      [75, 33, 245],
      [217, 255, 61],
      [255, 255, 255],
      [0, 0, 0],
      [128, 128, 128],
      [232, 176, 75],
    ];
    for (const b of brands) {
      expect(contrastRatio(b, readableOn(b))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("emits nothing when a shop has chosen no colours", () => {
    expect(shopThemeCss("abc", {})).toBe("");
  });

  it("scopes the override to the shop", () => {
    const css = shopThemeCss("abc", { brand: "#4A2C1D" });
    expect(css).toContain('[data-shop-theme="abc"]');
    expect(css).toContain("--brand:74 44 29");
    expect(css).toContain("prefers-color-scheme:dark");
  });
});
