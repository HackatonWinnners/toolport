import { getRequestListener } from "@hono/node-server";
import { createGateway } from "./gateway.js";

// One gateway per function instance; the DB migration runs once on cold start.
const gateway = createGateway();

export default getRequestListener(async (request) => (await gateway).app.fetch(request));
