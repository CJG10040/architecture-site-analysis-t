import { describe, expect, it } from "vitest";
import { normalizeBoundaryGeoJson } from "./boundaryGeoJson";

describe("normalizeBoundaryGeoJson", () => {
  it("normalizes an open triangle into a closed WGS84 GeoJSON feature", () => {
    const output = normalizeBoundaryGeoJson(JSON.stringify({ type: "Polygon", coordinates: [[[126.9, 35.1], [126.901, 35.1], [126.9, 35.101]]] }));
    const parsed = JSON.parse(output!);
    expect(parsed.type).toBe("Feature");
    expect(parsed.geometry.coordinates[0]).toHaveLength(4);
    expect(parsed.geometry.coordinates[0][0]).toEqual(parsed.geometry.coordinates[0][3]);
  });

  it("rejects boundaries without three distinct valid vertices", () => {
    expect(() => normalizeBoundaryGeoJson(JSON.stringify({ type: "Polygon", coordinates: [[[126.9, 35.1], [126.9, 35.1], [126.9, 35.1]]] }))).toThrow("최소 3개");
    expect(() => normalizeBoundaryGeoJson("not-json")).toThrow("유효한 GeoJSON");
  });
});
