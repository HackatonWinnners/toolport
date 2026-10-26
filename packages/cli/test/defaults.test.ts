import { describe, expect, it } from "vitest";
import { HOSTED_GATEWAY_URL, routerGatewayUrl } from "../src/defaults.js";

describe("routerGatewayUrl", () => {
  it("points the hosted registry at the Coolify gateway", () => {
    expect(HOSTED_GATEWAY_URL).toBe("https://api.toolport.042067.xyz");
  });

  it("defaults to the hosted registry on testnet when neither flag nor env is set", () => {
    expect(routerGatewayUrl(undefined, undefined, "stellar:testnet")).toBe("https://api.toolport.042067.xyz");
  });

  it("treats an empty TOOLPORT_GATEWAY_URL as unset", () => {
    expect(routerGatewayUrl(undefined, "", "stellar:testnet")).toBe("https://api.toolport.042067.xyz");
  });

  it("prefers the env value over the hosted default", () => {
    expect(routerGatewayUrl(undefined, "https://gw.example", "stellar:testnet")).toBe("https://gw.example");
  });

  it("prefers the flag over the env value", () => {
    expect(routerGatewayUrl("https://flag.example", "https://gw.example", "stellar:testnet")).toBe("https://flag.example");
  });

  it("keeps an explicit empty flag so the registry stays off", () => {
    expect(routerGatewayUrl("", "https://gw.example", "stellar:testnet")).toBe("");
  });

  it("has no default registry on pubnet", () => {
    expect(routerGatewayUrl(undefined, undefined, "stellar:pubnet")).toBeUndefined();
  });
});
