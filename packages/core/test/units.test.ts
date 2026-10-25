import { describe, expect, it } from "vitest";
import { formatUsd, fromUnits, normalizePrice, toUnits } from "../src/units.js";

describe("USDC units (7 decimals)", () => {
  it("converts USD prices to base units", () => {
    expect(toUnits("$0.02")).toBe(200_000n);
    expect(toUnits("0.001")).toBe(10_000n);
    expect(toUnits(1)).toBe(10_000_000n);
    expect(toUnits("$12.5")).toBe(125_000_000n);
    expect(toUnits("0.0000001")).toBe(1n);
  });

  it("round-trips back to decimals", () => {
    expect(fromUnits(200_000n)).toBe("0.02");
    expect(fromUnits("10000000")).toBe("1");
    expect(fromUnits(1)).toBe("0.0000001");
    expect(formatUsd(200_000n)).toBe("$0.02");
    expect(formatUsd(10_000_000n)).toBe("$1.00");
  });

  it("normalizes and rejects bad prices", () => {
    expect(normalizePrice("$0.0100")).toBe("0.01");
    expect(normalizePrice("007")).toBe("7");
    expect(() => normalizePrice("-1")).toThrow();
    expect(() => normalizePrice("abc")).toThrow();
    expect(() => normalizePrice("0.00000001")).toThrow(/decimal places/);
  });
});
