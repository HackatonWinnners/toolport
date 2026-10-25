import { DEFAULT_TOKEN_DECIMALS } from "@x402/stellar";

/** Stellar USDC has 7 decimals: $1 = 10_000_000 units. */
export const USDC_DECIMALS = DEFAULT_TOKEN_DECIMALS;
const SCALE = 10n ** BigInt(USDC_DECIMALS);

export type PriceInput = string | number;

/**
 * Parse "$0.01", "0.01" or 0.01 into a canonical decimal string ("0.01").
 * Rejects negatives and more precision than USDC supports.
 */
export function normalizePrice(price: PriceInput): string {
  const raw = typeof price === "number" ? price.toFixed(USDC_DECIMALS) : price.trim().replace(/^\$/, "");
  if (!/^\d+(\.\d+)?$/.test(raw)) {
    throw new Error(`Invalid price "${price}". Use a USD amount like "$0.01".`);
  }
  const [whole, frac = ""] = raw.split(".");
  const trimmed = frac.replace(/0+$/, "");
  if (trimmed.length > USDC_DECIMALS) {
    throw new Error(`Price "${price}" has more than ${USDC_DECIMALS} decimal places.`);
  }
  const wholeNorm = whole.replace(/^0+(?=\d)/, "");
  return trimmed ? `${wholeNorm}.${trimmed}` : wholeNorm;
}

/** USD price → USDC base units (bigint). */
export function toUnits(price: PriceInput): bigint {
  const [whole, frac = ""] = normalizePrice(price).split(".");
  return BigInt(whole) * SCALE + BigInt(frac.padEnd(USDC_DECIMALS, "0"));
}

/** USDC base units → decimal string without trailing zeros ("0.02"). */
export function fromUnits(units: bigint | string | number): string {
  const value = BigInt(units);
  const sign = value < 0n ? "-" : "";
  const abs = value < 0n ? -value : value;
  const whole = abs / SCALE;
  const frac = (abs % SCALE).toString().padStart(USDC_DECIMALS, "0").replace(/0+$/, "");
  return frac ? `${sign}${whole}.${frac}` : `${sign}${whole}`;
}

/** "$0.02" style label for UIs and tool descriptions. */
export function formatUsd(units: bigint | string | number): string {
  const decimal = fromUnits(units);
  const [whole, frac = ""] = decimal.split(".");
  return `$${whole}.${frac.padEnd(2, "0")}`;
}
