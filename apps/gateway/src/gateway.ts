import { createApp } from "./app.js";
import { WalletAuth } from "./auth.js";
import { createDb, migrate } from "./db/index.js";
import { env } from "./env.js";
import { PaymentEngine } from "./payments.js";
import { guardUpstreamConnections } from "./upstream.js";

/** Build the gateway from the environment; shared by the Node server and the Vercel function. */
export async function createGateway() {
  if (!env.allowPrivateUpstreams) guardUpstreamConnections();
  const db = await createDb(env.databaseUrl, env.databaseAuthToken);
  await migrate(db);
  const engine = new PaymentEngine({ db, facilitator: env.facilitator, network: env.network, publicUrl: env.publicUrl });
  const auth = new WalletAuth(env.sessionSecret, env.authDisabled);
  const app = createApp({
    db,
    engine,
    auth,
    network: env.network,
    publicUrl: env.publicUrl,
    webOrigins: env.webOrigins,
    allowPrivateUpstreams: env.allowPrivateUpstreams,
  });
  return { app, engine };
}
