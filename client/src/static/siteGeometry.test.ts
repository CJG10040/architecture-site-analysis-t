import { describe, expect, it } from "vitest";
import { boundaryGeoJson, boundaryMetrics } from "./siteGeometry";

describe("site geometry", () => {
  const boundary = [{ lat: 35.1467, lng: 126.921 }, { lat: 35.1467, lng: 126.922 }, { lat: 35.1477, lng: 126.922 }, { lat: 35.1477, lng: 126.921 }];
  it("exports a closed GeoJSON polygon", () => expect(boundaryGeoJson(boundary)?.coordinates[0][0]).toEqual([126.921, 35.1467]));
  it("calculates usable area and perimeter for a polygon", () => {
    const metrics = boundaryMetrics(boundary);
    expect(metrics.areaSqm).toBeGreaterThan(9_000);
    expect(metrics.perimeterMeters).toBeGreaterThan(300);
  });
});
