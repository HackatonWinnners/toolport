import { randomBytes } from "node:crypto";
import { DEFAULT_NETWORK, facilitatorSettingsFromEnv, isStellarNetworkId, type StellarNetwork } from "@stellarpay/core";

const network = process.env.STELLAR_NETWORK ?? DEFAULT_NETWORK;
if (!isStellarNetworkId(network)) throw new Error(`Unsupported STELLAR_NETWORK ${network}`);

const publicUrl = (process.env.PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 4021}`).replace(/\/$/, "");
const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(publicUrl);

// A guessable secret lets anyone mint a session for any address; without a real one, use a
// random per-process secret (sessions then reset on restart).
const configuredSecret = process.env.SESSION_SECRET;
const weakSecret = !configuredSecret || configuredSecret.length < 32 || /change-me/.test(configuredSecret);

// AUTH_DISABLED accepts any "Bearer G..." as that seller (who could then redirect payouts), so it only runs locally.
if (process.env.AUTH_DISABLED === "true" && !isLocal) {
  throw new Error(`AUTH_DISABLED=true is for local development only; PUBLIC_URL is ${publicUrl}`);
}

export const env = {
  port: Number(process.env.PORT ?? 4021),
  publicUrl,
  databaseUrl: process.env.DATABASE_URL ?? "file:stellarpay.db",
  databaseAuthToken: process.env.DATABASE_AUTH_TOKEN,
  network: network as StellarNetwork,
  facilitator: facilitatorSettingsFromEnv(process.env),
  sessionSecret: weakSecret ? randomBytes(32).toString("hex") : configuredSecret!,
  weakSecret,
  /** Skip Freighter signature checks (local development only) */
  authDisabled: process.env.AUTH_DISABLED === "true",
  /** Allow upstreams on loopback/private addresses (on by default only when the gateway itself is local) */
  allowPrivateUpstreams: process.env.ALLOW_PRIVATE_UPSTREAMS
    ? process.env.ALLOW_PRIVATE_UPSTREAMS === "true"
    : isLocal,
  webOrigins: (process.env.WEB_ORIGIN ?? "http://localhost:3000").split(",").map((s) => s.trim()),
};
