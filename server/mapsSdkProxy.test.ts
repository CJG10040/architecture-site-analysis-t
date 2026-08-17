import { describe, expect, it } from "vitest";
import { resolveMapsProxyOrigin, resolveMapsSdkCredentials } from "./mapsSdkProxy";

describe("resolveMapsProxyOrigin", () => {
  it("uses the public forwarded host when supplied by the managed gateway", () => {
    expect(resolveMapsProxyOrigin({ headers: { host: "127.0.0.1:3000", "x-forwarded-host": "site.manus.space", "x-forwarded-proto": "https" } })).toBe("https://site.manus.space");
  });

  it("uses the allowed development preview origin for a loopback request", () => {
    expect(resolveMapsProxyOrigin({ headers: { host: "127.0.0.1:3000" } })).toContain("manus.computer");
  });

  it("prefers the managed frontend credential required by the browser Maps proxy", () => {
    expect(resolveMapsSdkCredentials({
      VITE_FRONTEND_FORGE_API_URL: "https://frontend-forge.example/",
      VITE_FRONTEND_FORGE_API_KEY: "frontend-key",
      BUILT_IN_FORGE_API_URL: "https://server-forge.example",
      BUILT_IN_FORGE_API_KEY: "server-key",
    })).toEqual({ baseUrl: "https://frontend-forge.example", apiKey: "frontend-key" });
  });
});
