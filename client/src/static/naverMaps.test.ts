import { describe, expect, it } from "vitest";
import { naverMapsScriptUrl } from "./naverMaps";

describe("naverMapsScriptUrl", () => {
  it("uses the Web Dynamic Map SDK with the geocoder submodule", () => {
    const url = naverMapsScriptUrl("client id");
    expect(url).toContain("oapi.map.naver.com/openapi/v3/maps.js");
    expect(url).toContain("ncpKeyId=client+id");
    expect(url).toContain("submodules=geocoder");
  });
});
