import type { PaymentPayload, PaymentRequired, SettleResponse } from "@x402/core/types";
import { PAYMENT_META_KEY, PAYMENT_RESPONSE_META_KEY } from "./constants.js";

/** A tool result per the x402 MCP transport: isError + PaymentRequired in structuredContent and text. */
export function paymentRequiredToolResult(paymentRequired: PaymentRequired) {
  return {
    isError: true,
    structuredContent: paymentRequired as unknown as Record<string, unknown>,
    content: [{ type: "text" as const, text: JSON.stringify(paymentRequired) }],
  };
}

export function readPaymentFromMeta(meta: unknown): PaymentPayload | null {
  if (!meta || typeof meta !== "object") return null;
  const payment = (meta as Record<string, unknown>)[PAYMENT_META_KEY];
  if (!payment || typeof payment !== "object") return null;
  const p = payment as Partial<PaymentPayload>;
  return typeof p.x402Version === "number" && p.payload ? (payment as PaymentPayload) : null;
}

export function readPaymentResponseFromMeta(meta: unknown): SettleResponse | null {
  if (!meta || typeof meta !== "object") return null;
  const value = (meta as Record<string, unknown>)[PAYMENT_RESPONSE_META_KEY];
  return value && typeof value === "object" ? (value as SettleResponse) : null;
}

export function toolResourceUrl(base: string, toolName: string) {
  return `${base.replace(/\/$/, "")}#tool=${encodeURIComponent(toolName)}`;
}
