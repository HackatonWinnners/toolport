import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { guardUpstreamConnections, upstreamFetch } from "../src/upstream.js";

describe("upstream connections", () => {
  let server: Server;
  let port: number;

  beforeAll(async () => {
    server = createServer((req, res) => {
      if (req.url === "/redirect") res.writeHead(307, { location: "http://169.254.169.254/latest/meta-data" }).end();
      else res.end("ok");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = (server.address() as AddressInfo).port;
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it("refuses redirects instead of following them to unchecked addresses", async () => {
    await expect(upstreamFetch(`http://127.0.0.1:${port}/redirect`)).rejects.toThrow();
    await expect((await upstreamFetch(`http://127.0.0.1:${port}/`)).text()).resolves.toBe("ok");
  });

  it("re-checks the resolved address at connect time once guarded", async () => {
    guardUpstreamConnections();
    // "localhost" resolves to loopback: the connection itself must be refused, whatever passed the registration check.
    const error = await upstreamFetch(`http://localhost:${port}/`).then(() => null, (e: Error & { cause?: { code?: string } }) => e);
    expect(error?.cause?.code).toBe("EPRIVATE");
  });
});
