import { serve } from "@hono/node-server";
import { app, description } from "./app.js";

const port = Number(process.env.PORT ?? 4022);
serve({ fetch: app.fetch, port }, () => console.log(`${description} on http://localhost:${port}/mcp`));
