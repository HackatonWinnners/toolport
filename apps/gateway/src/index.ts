import { serve } from "@hono/node-server";
import { env } from "./env.js";
import { createGateway } from "./gateway.js";

const { app, engine } = await createGateway();

// Warm up the facilitator connection so the first paid call isn't slow; failures are retried lazily.
engine.resourceServer().then(
  () => console.log(`facilitator ready (${env.facilitator.kind === "http" ? env.facilitator.url : "in-process"})`),
  (error) => console.warn(`facilitator not reachable yet: ${error.message}`),
);

serve({ fetch: app.fetch, port: env.port }, (info) => {
  console.log(`StellarPay gateway on http://localhost:${info.port} (${env.network})`);
  if (env.authDisabled) console.warn("AUTH_DISABLED=true: wallet signatures are not checked");
  if (env.weakSecret) console.warn("SESSION_SECRET unset or weak (<32 chars): using a random one, sessions reset on restart");
  if (!env.allowPrivateUpstreams) console.log("upstreams on private/loopback addresses are refused");
});
