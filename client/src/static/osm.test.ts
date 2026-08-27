import { describe, expect, it } from "vitest";
import { normalizeOsmHydrology, osmHydrologyQuery } from "./osm";

describe("OSM hydrology", () => {
  it("creates a bounded Overpass query", () => {
    const query = osmHydrologyQuery(35.1, 126.9, 300);
    expect(query).toContain('["waterway"]');
    expect(query).toContain('["natural"="water"]');
    expect(query).toContain("out tags geom");
  });

  it("normalizes waterways and closed water areas without inventing flood data", () => {
    const features = normalizeOsmHydrology({ elements: [
      { type: "way", id: 1, tags: { waterway: "stream", name: "테스트천" }, geometry: [{ lat: 35, lon: 126 }, { lat: 35.001, lon: 126.001 }] },
      { type: "way", id: 2, tags: { natural: "water", name: "테스트못" }, geometry: [{ lat: 35, lon: 126 }, { lat: 35, lon: 126.001 }, { lat: 35.001, lon: 126.001 }, { lat: 35, lon: 126 }] },
    ] });
    expect(features).toHaveLength(2);
    expect(features[0].geometry.type).toBe("LineString");
    expect(features[1].geometry.type).toBe("Polygon");
    expect(features[0].properties._source).toContain("OpenStreetMap");
  });
});
