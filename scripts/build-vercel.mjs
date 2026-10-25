#!/usr/bin/env node
// Bundle an app's src/vercel.ts into a single Node function using Vercel's Build Output API,
// so the workspace's TypeScript-only packages need no separate build step on Vercel.
// Usage: node scripts/build-vercel.mjs apps/gateway
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { build } from "esbuild";

const appDir = resolve(process.argv[2] ?? ".");
const output = join(appDir, ".vercel", "output");
const fn = join(output, "functions", "index.func");

await rm(output, { recursive: true, force: true });
await mkdir(fn, { recursive: true });

await build({
  entryPoints: [join(appDir, "src", "vercel.ts")],
  outfile: join(fn, "index.mjs"),
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  // CommonJS dependencies inside an ESM bundle still call require() for Node built-ins.
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  // Serverless has no disk, so the database is always remote (Turso): use the pure-JS client
  // everywhere, otherwise the native SQLite binary gets hoisted into the bundle's imports.
  plugins: [
    {
      name: "libsql-web",
      setup(b) {
        b.onResolve({ filter: /^@libsql\/client$/ }, (args) =>
          b.resolve("@libsql/client/web", { kind: args.kind, resolveDir: args.resolveDir }),
        );
      },
    },
  ],
  // Optional native modules the pure-JS code paths never load.
  external: ["sodium-native", "require-addon"],
  logLevel: "warning",
});

await writeFile(
  join(fn, ".vc-config.json"),
  JSON.stringify({
    runtime: "nodejs22.x",
    handler: "index.mjs",
    launcherType: "Nodejs",
    shouldAddHelpers: false,
    supportsResponseStreaming: true,
    // A paid call is verify + tool + on-chain settlement: ~5-15 s.
    maxDuration: 60,
  }),
);
await writeFile(join(fn, "package.json"), JSON.stringify({ type: "module" }));
await writeFile(join(output, "config.json"), JSON.stringify({ version: 3, routes: [{ src: "/(.*)", dest: "/index" }] }));
console.log(`built ${fn}`);
