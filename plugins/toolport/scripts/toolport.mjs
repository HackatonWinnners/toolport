import { spawn } from "node:child_process";
import { accessSync, constants, existsSync, readFileSync, realpathSync } from "node:fs";
import { delimiter, dirname, isAbsolute, join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const usable = (value) => typeof value === "string" && value !== "" && !value.startsWith("${");

const CLI_SUFFIX = ["packages", "cli", "bin", "stellarpay.js"].join(sep);

function linkedCli(candidate, { realpath, readFile }) {
  let real;
  try {
    real = realpath(candidate);
  } catch {
    return null;
  }
  if (!real.endsWith(sep + CLI_SUFFIX)) return null;
  try {
    const pkg = JSON.parse(readFile(join(dirname(real), "..", "package.json")));
    return pkg.name === "stellarpay" ? real : null;
  } catch {
    return null;
  }
}

export function resolveCli({ env, pluginRoot, exists, executable = exists, realpath = (p) => p, readFile = () => { throw new Error("no readFile"); } }) {
  if (usable(env.TOOLPORT_OPT_CLI_PATH)) return { command: process.execPath, args: [env.TOOLPORT_OPT_CLI_PATH] };
  if (env.TOOLPORT_CLI) return { command: process.execPath, args: [env.TOOLPORT_CLI] };
  const checkout = resolve(pluginRoot, "..", "..");
  const inRepo = join(checkout, "packages", "cli", "bin", "stellarpay.js");
  if (exists(inRepo) && exists(join(checkout, "node_modules", "tsx"))) return { command: process.execPath, args: [inRepo] };
  for (const dir of (env.PATH ?? "").split(delimiter)) {
    if (!isAbsolute(dir)) continue;
    const candidate = join(dir, "toolport");
    if (!executable(candidate)) continue;
    const real = linkedCli(candidate, { realpath, readFile });
    if (real) return { command: process.execPath, args: [real] };
  }
  throw new Error(
    'Toolport CLI not found: run "npm ci && npm link -w packages/cli" in a toolport checkout, or set the plugin option cli_path to <checkout>/packages/cli/bin/stellarpay.js',
  );
}

const OPTION_VARS = [
  ["TOOLPORT_OPT_GATEWAY_URL", "TOOLPORT_GATEWAY_URL"],
  ["TOOLPORT_OPT_MAX_PER_CALL", "STELLARPAY_MAX_PER_CALL"],
  ["TOOLPORT_OPT_BUDGET", "STELLARPAY_BUDGET"],
  ["TOOLPORT_OPT_WALLET_FILE", "STELLARPAY_WALLET"],
  ["TOOLPORT_OPT_SECRET_KEY", "STELLAR_SECRET_KEY"],
];

const NOT_INHERITED = ["STELLARPAY_MAX_PER_CALL", "STELLARPAY_BUDGET", "STELLAR_RPC_URL"];

export function buildEnv(env) {
  const childEnv = { ...env };
  for (const name of NOT_INHERITED) delete childEnv[name];
  for (const [option, target] of OPTION_VARS) {
    if (usable(env[option])) childEnv[target] = env[option];
  }
  for (const key of Object.keys(childEnv)) {
    if (key.startsWith("TOOLPORT_OPT_")) delete childEnv[key];
  }
  for (const [, target] of OPTION_VARS) {
    if (childEnv[target] === "") delete childEnv[target];
  }
  childEnv.STELLAR_NETWORK = "stellar:testnet";
  const extraArgs = usable(env.TOOLPORT_OPT_SESSION) ? ["--session", env.TOOLPORT_OPT_SESSION] : [];
  return { env: childEnv, extraArgs };
}

const isExecutable = (path) => {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
};

function main() {
  let cli;
  try {
    cli = resolveCli({
      env: process.env,
      pluginRoot: resolve(dirname(fileURLToPath(import.meta.url)), ".."),
      exists: existsSync,
      executable: isExecutable,
      realpath: realpathSync,
      readFile: (path) => readFileSync(path, "utf8"),
    });
  } catch (error) {
    process.stderr.write(`error: ${error.message}\n`);
    process.exit(1);
  }
  const { env, extraArgs } = buildEnv(process.env);
  const child = spawn(cli.command, [...cli.args, ...process.argv.slice(2), ...extraArgs], { stdio: "inherit", env });
  const forward = (signal) => {
    if (child.exitCode === null && child.signalCode === null) child.kill(signal);
  };
  process.on("SIGINT", () => forward("SIGINT"));
  process.on("SIGTERM", () => forward("SIGTERM"));
  child.on("error", (error) => {
    process.stderr.write(`error: ${error.message}\n`);
    process.exit(1);
  });
  child.on("exit", (code) => process.exit(code ?? 1));
}

const invokedDirectly = () => {
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
  } catch {
    return false;
  }
};

if (invokedDirectly()) main();
