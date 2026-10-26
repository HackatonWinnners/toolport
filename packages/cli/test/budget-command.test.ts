import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { Keypair } from "@stellar/stellar-sdk";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const run = promisify(execFile);
const bin = fileURLToPath(new URL("../bin/stellarpay.js", import.meta.url));
let dir: string;
let stateDb: string;
const secret = Keypair.random().secret();

async function budget(args: string[], env: Record<string, string> = {}) {
  const base = { ...process.env };
  for (const key of ["STELLARPAY_BUDGET", "STELLARPAY_MAX_PER_CALL", "STELLARPAY_WALLET", "STELLAR_NETWORK"]) delete base[key];
  const { stdout } = await run(process.execPath, [bin, "budget", "--session", "plugin", "--state-db", stateDb, ...args], {
    env: { ...base, STELLAR_SECRET_KEY: secret, ...env },
  });
  return stdout;
}

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "toolport-budget-"));
  stateDb = join(dir, "agent.db");
});
afterAll(() => rm(dir, { recursive: true, force: true }));

describe("toolport budget", () => {
  it("shows the stored limits without overwriting them from the shell's environment", async () => {
    await budget(["--budget", "0.1", "--max-per-call", "0.02"]);
    const out = await budget([], { STELLARPAY_BUDGET: "1", STELLARPAY_MAX_PER_CALL: "0.05" });
    expect(out).toContain("Cap      0.1 USDC (max 0.02 per call)");
    expect(await budget([])).toContain("Cap      0.1 USDC (max 0.02 per call)");
  });

  it("changes the stored limits only when --budget or --max-per-call is passed", async () => {
    expect(await budget(["--budget", "0.5"])).toContain("Cap      0.5 USDC");
    expect(await budget([])).toContain("Cap      0.5 USDC");
  });
});
