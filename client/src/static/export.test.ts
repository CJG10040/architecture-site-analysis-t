import { describe, expect, it } from "vitest";
import { researchLayerGeoJson, researchNoteBundle, researchNotesCsv, safeDownloadName } from "./export";
import type { ResearchNote } from "./model";

const note: ResearchNote = { id: "r1", source: "VWorld", title: "도로·상권 자료", summary: "객체 1개", detail: "상세 속성", rawData: "{\"features\":[]}", latitude: 35, longitude: 126, createdAt: "2026-01-01", spatialLayer: { id: "roads", title: "도로", source: "VWorld", fetchedAt: "2026-01-01", totalFeatureCount: 1, truncated: false, features: [{ id: "f1", geometry: { type: "Point", coordinates: [126, 35] }, properties: { name: "A" } }] } };

describe("research exports", () => {
  it("creates safe names and preserves detail plus raw data in the bundle", () => {
    expect(safeDownloadName("대지 / 조사: 01")).toBe("대지-조사-01");
    const bundle = researchNoteBundle(note);
    expect(bundle).toContain("상세 속성");
    expect(bundle).toContain("features");
  });

  it("exports extracted spatial features as GeoJSON and notes as CSV", () => {
    const geoJson = researchLayerGeoJson(note);
    expect(geoJson).toContain("FeatureCollection");
    expect(geoJson).toContain("f1");
    expect(researchNotesCsv([note])).toContain("hasSpatialLayer");
    expect(researchNotesCsv([note])).toContain("도로·상권 자료");
  });
});
