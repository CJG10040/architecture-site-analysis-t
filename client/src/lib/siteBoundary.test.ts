import { describe, expect, it } from "vitest";
import { createBoundaryGeoJson, getBoundaryMetrics, parseBoundaryGeoJson } from "./siteBoundary";

describe("site boundary metrics", () => {
  it("serializes a polygon as a closed GeoJSON ring and reads its vertices", () => {
    const geoJson = createBoundaryGeoJson([{ lat: 35.146, lng: 126.92 }, { lat: 35.146, lng: 126.921 }, { lat: 35.147, lng: 126.921 }]);
    expect(parseBoundaryGeoJson(geoJson)).toHaveLength(3);
  });

  it("derives positive area, perimeter and a bounded centroid for a parcel polygon", () => {
    const geoJson = createBoundaryGeoJson([{ lat: 35.146, lng: 126.92 }, { lat: 35.146, lng: 126.921 }, { lat: 35.147, lng: 126.921 }, { lat: 35.147, lng: 126.92 }]);
    const metrics = getBoundaryMetrics(geoJson);
    expect(metrics?.areaSqMeters).toBeGreaterThan(9_000);
    expect(metrics?.areaSqMeters).toBeLessThan(12_000);
    expect(metrics?.perimeterMeters).toBeGreaterThan(350);
    expect(metrics?.centroid).toEqual({ lat: 35.1465, lng: 126.9205 });
  });
});
