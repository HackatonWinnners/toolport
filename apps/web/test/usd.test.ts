import { describe, expect, it } from "vitest";
import { usd } from "../lib/api";

describe("usd", () => {
  it.each([
    ["0", "free"],
    [0, "free"],
    ["0.0000001", "$0.0000001"],
    ["0.000001", "$0.000001"],
    ["0.00375", "$0.00375"],
    ["0.001", "$0.001"],
    ["0.015", "$0.015"],
    ["0.125", "$0.125"],
    ["0.06", "$0.06"],
    ["0.1", "$0.10"],
    ["0.01", "$0.01"],
    ["1", "$1"],
    ["100", "$100"],
    ["2.5", "$2.50"],
    [1e-7, "$0.0000001"],
  ])("formats %s as %s", (value, expected) => {
    expect(usd(value)).toBe(expected);
  });

  it("never uses exponent notation", () => {
    expect(usd(0.0000005)).not.toMatch(/e/i);
  });

  it("passes non-numbers through", () => {
    expect(usd("n/a")).toBe("n/a");
  });
});
