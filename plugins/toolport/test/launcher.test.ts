import { describe, expect, it } from "vitest";
import { buildEnv, resolveCli } from "../scripts/toolport.mjs";

const root = "/repo/plugins/toolport";
const none = () => false;

describe("resolveCli", () => {
  it("runs the cli_path option with the current node", () => {
    const cli = resolveCli({ env: { TOOLPORT_OPT_CLI_PATH: "/x/stellarpay.js", TOOLPORT_CLI: "/y/cli.js" }, pluginRoot: root, exists: none });
    expect(cli).toEqual({ command: process.execPath, args: ["/x/stellarpay.js"] });
  });

  it.each(["", "${user_config.cli_path}"])("falls through an unusable cli_path %j to TOOLPORT_CLI", (value) => {
    const cli = resolveCli({ env: { TOOLPORT_OPT_CLI_PATH: value, TOOLPORT_CLI: "/y/cli.js" }, pluginRoot: root, exists: none });
    expect(cli).toEqual({ command: process.execPath, args: ["/y/cli.js"] });
  });

  it("uses the checkout's CLI when the plugin sits in a toolport checkout with dependencies installed", () => {
    const present = new Set(["/repo/packages/cli/bin/stellarpay.js", "/repo/node_modules/tsx"]);
    const cli = resolveCli({ env: {}, pluginRoot: root, exists: (p: string) => present.has(p) });
    expect(cli).toEqual({ command: process.execPath, args: ["/repo/packages/cli/bin/stellarpay.js"] });
  });

  it("runs a linked toolport from PATH through its real stellarpay.js with the current node", () => {
    const present = new Set(["/repo/packages/cli/bin/stellarpay.js", "/opt/node/bin/toolport"]);
    const cli = resolveCli({
      env: { PATH: "/usr/bin:/opt/node/bin" },
      pluginRoot: root,
      exists: (p: string) => present.has(p),
      realpath: (p: string) => (p === "/opt/node/bin/toolport" ? "/src/toolport/packages/cli/bin/stellarpay.js" : p),
      readFile: (p: string) => {
        if (p === "/src/toolport/packages/cli/package.json") return JSON.stringify({ name: "stellarpay" });
        throw new Error("ENOENT");
      },
    });
    expect(cli).toEqual({ command: process.execPath, args: ["/src/toolport/packages/cli/bin/stellarpay.js"] });
  });

  it("skips relative PATH entries", () => {
    const present = new Set(["bin/toolport"]);
    expect(() =>
      resolveCli({
        env: { PATH: "bin:." },
        pluginRoot: root,
        exists: (p: string) => present.has(p),
        realpath: () => "/src/toolport/packages/cli/bin/stellarpay.js",
        readFile: () => JSON.stringify({ name: "stellarpay" }),
      }),
    ).toThrow("Toolport CLI not found");
  });

  it.each([
    ["another package's toolport", "/usr/local/lib/node_modules/toolport/bin/cli.js", "stellarpay"],
    ["a stellarpay.js from a differently named package", "/src/other/packages/cli/bin/stellarpay.js", "something-else"],
  ])("refuses %s on PATH", (_label, real, name) => {
    expect(() =>
      resolveCli({
        env: { PATH: "/usr/local/bin" },
        pluginRoot: root,
        exists: (p: string) => p === "/usr/local/bin/toolport",
        realpath: () => real,
        readFile: () => JSON.stringify({ name }),
      }),
    ).toThrow("Toolport CLI not found");
  });

  it("explains how to install the CLI when nothing is found", () => {
    expect(() => resolveCli({ env: { PATH: "/usr/bin" }, pluginRoot: root, exists: none })).toThrow(
      'Toolport CLI not found: run "npm ci && npm link -w packages/cli" in a toolport checkout, or set the plugin option cli_path to <checkout>/packages/cli/bin/stellarpay.js',
    );
  });
});

describe("buildEnv", () => {
  it("maps each set plugin option onto the variable the CLI reads", () => {
    const { env } = buildEnv({
      TOOLPORT_OPT_GATEWAY_URL: "https://gw.example",
      TOOLPORT_OPT_MAX_PER_CALL: "0.02",
      TOOLPORT_OPT_BUDGET: "3",
      TOOLPORT_OPT_WALLET_FILE: "/w/wallet.json",
      TOOLPORT_OPT_SECRET_KEY: "SOPTION",
      TOOLPORT_GATEWAY_URL: "https://inherited.example",
      STELLARPAY_MAX_PER_CALL: "0.5",
      STELLARPAY_BUDGET: "10",
      STELLARPAY_WALLET: "/inherited.json",
      STELLAR_SECRET_KEY: "SINHERITED",
    });
    expect(env).toMatchObject({
      TOOLPORT_GATEWAY_URL: "https://gw.example",
      STELLARPAY_MAX_PER_CALL: "0.02",
      STELLARPAY_BUDGET: "3",
      STELLARPAY_WALLET: "/w/wallet.json",
      STELLAR_SECRET_KEY: "SOPTION",
    });
  });

  it("keeps the inherited gateway, wallet and secret when their options are empty or unsubstituted, and drops every option variable", () => {
    const { env } = buildEnv({
      TOOLPORT_OPT_GATEWAY_URL: "",
      TOOLPORT_OPT_SESSION: "",
      TOOLPORT_OPT_WALLET_FILE: "${user_config.wallet_file}",
      TOOLPORT_OPT_SECRET_KEY: "${user_config.stellar_secret_key}",
      TOOLPORT_OPT_CLI_PATH: "/x/stellarpay.js",
      TOOLPORT_GATEWAY_URL: "https://inherited.example",
      STELLARPAY_WALLET: "/inherited.json",
      STELLAR_SECRET_KEY: "SINHERITED",
    });
    expect(env).toEqual({
      TOOLPORT_GATEWAY_URL: "https://inherited.example",
      STELLARPAY_WALLET: "/inherited.json",
      STELLAR_SECRET_KEY: "SINHERITED",
      STELLAR_NETWORK: "stellar:testnet",
    });
  });

  it.each(["", "${user_config.max_per_call}"])("drops inherited caps and RPC URL so the CLI defaults apply when the cap options are %j", (value) => {
    const { env } = buildEnv({
      TOOLPORT_OPT_MAX_PER_CALL: value,
      TOOLPORT_OPT_BUDGET: value,
      STELLARPAY_MAX_PER_CALL: "5",
      STELLARPAY_BUDGET: "100",
      STELLAR_RPC_URL: "https://rpc.example",
    });
    expect(env).toEqual({ STELLAR_NETWORK: "stellar:testnet" });
  });

  it("removes empty CLI variables so an empty STELLAR_SECRET_KEY cannot hide the wallet file", () => {
    const { env } = buildEnv({
      STELLAR_SECRET_KEY: "",
      STELLARPAY_WALLET: "",
      STELLARPAY_MAX_PER_CALL: "",
      STELLARPAY_BUDGET: "",
      TOOLPORT_GATEWAY_URL: "",
      HOME: "/home/me",
    });
    expect(env).toEqual({ HOME: "/home/me", STELLAR_NETWORK: "stellar:testnet" });
  });

  it("passes the session option as a --session flag", () => {
    expect(buildEnv({ TOOLPORT_OPT_SESSION: "claude-code" }).extraArgs).toEqual(["--session", "claude-code"]);
  });

  it.each(["", "${user_config.session}"])("adds no --session flag for %j", (value) => {
    expect(buildEnv({ TOOLPORT_OPT_SESSION: value }).extraArgs).toEqual([]);
  });

  it("pins the child to Stellar testnet whatever network the shell inherited", () => {
    expect(buildEnv({ STELLAR_NETWORK: "stellar:pubnet" }).env.STELLAR_NETWORK).toBe("stellar:testnet");
    expect(buildEnv({}).env.STELLAR_NETWORK).toBe("stellar:testnet");
  });
});
