import { describe, expect, it } from "vitest";
import { resolveMapsProxyOrigin } from "./mapsSdkProxy";

describe("resolveMapsProxyOrigin", () => {
  it("uses the public forwarded host when supplied by the managed gateway", () => {
    expect(resolveMapsProxyOrigin({ headers: { host: "127.0.0.1:3000", "x-forwarded-host": "site.manus.space", "x-forwarded-proto": "https" } })).toBe("https://site.manus.space");
  });

  it("uses the allowed development preview origin for a loopback request", () => {
    expect(resolveMapsProxyOrigin({ headers: { host: "127.0.0.1:3000" } })).toContain("manus.computer");
  });
});
