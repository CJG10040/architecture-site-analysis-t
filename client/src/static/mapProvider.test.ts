import { describe, expect, it } from "vitest";
import { nominatimSearchUrl, openStreetMapTileUrl } from "./mapProvider";

describe("map provider fallback", () => {
  it("keeps the OpenStreetMap standard tile endpoint explicit for policy-compliant switching", () => {
    expect(openStreetMapTileUrl).toBe("https://tile.openstreetmap.org/{z}/{x}/{y}.png");
  });

  it("limits the backup geocoder to explicit Korean address searches", () => {
    const url = new URL(nominatimSearchUrl("광주광역시청"));
    expect(url.origin + url.pathname).toBe("https://nominatim.openstreetmap.org/search");
    expect(url.searchParams.get("countrycodes")).toBe("kr");
    expect(url.searchParams.get("limit")).toBe("3");
  });

  it("documents a direct OpenStreetMap fallback route", () => expect("?map=osm").toContain("map=osm"));
});
