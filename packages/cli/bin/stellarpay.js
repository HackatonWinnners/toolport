#!/usr/bin/env node
// Runs the TypeScript entry through tsx so the workspace needs no build step.
import { register } from "tsx/esm/api";
register();
await import("../src/index.ts");
