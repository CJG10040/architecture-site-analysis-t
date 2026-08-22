import { describe, expect, it } from "vitest";
import { googleMapsScriptUrl } from "./googleMaps";

describe("googleMapsScriptUrl", () => {
  it("uses the browser Maps API with Korean places libraries", () => {
    const url = googleMapsScriptUrl("test key");
    expect(url).toContain("maps.googleapis.com/maps/api/js?");
    expect(url).toContain("key=test+key");
    expect(url).toContain("libraries=places%2Cgeometry");
  });
});
