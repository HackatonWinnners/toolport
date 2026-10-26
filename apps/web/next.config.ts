import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // Standalone output for the Docker image; trace from the repo root so hoisted workspace deps are included.
  output: "standalone",
  outputFileTracingRoot: fileURLToPath(new URL("../..", import.meta.url)),
  // Always inline the e2e flag (Next skips unset vars), so lib/signer.ts's test branch is dropped from normal builds.
  env: { NEXT_PUBLIC_E2E_SIGNER: process.env.NEXT_PUBLIC_E2E_SIGNER === "true" ? "true" : "false" },
  async redirects() {
    return [
      { source: "/registry", destination: "/catalog", permanent: false },
      { source: "/playground", destination: "/#connect", permanent: false },
      { source: "/activity", destination: "/catalog", permanent: false },
    ];
  },
};

export default config;
