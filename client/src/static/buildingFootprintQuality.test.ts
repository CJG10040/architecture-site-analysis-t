import { describe, expect, it } from "vitest";
import { auditBuildingFootprints, isUsableBuildingFootprint, usableBuildingFootprintFeatures } from "./buildingFootprintQuality";
import type { VworldWfsFeature } from "./vworld";

const polygon = (id: string, managementNo?: string): VworldWfsFeature => ({ id, geometry: { type: "Polygon", coordinates: [[[126.9, 35.1], [126.901, 35.1], [126.901, 35.101], [126.9, 35.1]]] }, properties: managementNo ? { BD_MGT_SN: managementNo, USE: "주거" } : { USE: "미확인" } });

describe("building footprint quality", () => {
  it("accepts valid polygon and multipolygon footprints only", () => {
    expect(isUsableBuildingFootprint(polygon("b-1").geometry)).toBe(true);
    expect(isUsableBuildingFootprint({ type: "MultiPolygon", coordinates: [[[[126.9, 35.1], [126.901, 35.1], [126.901, 35.101], [126.9, 35.1]]]] })).toBe(true);
    expect(isUsableBuildingFootprint({ type: "Point", coordinates: [126.9, 35.1] })).toBe(false);
    expect(isUsableBuildingFootprint({ type: "Polygon", coordinates: [[[126.9, 35.1], [126.9, 35.1]]] })).toBe(false);
  });

  it("counts invalid geometry and missing identities without deleting source features", () => {
    const features = [polygon("b-1", "A-1"), polygon("b-2"), { id: "point-1", geometry: { type: "Point", coordinates: [126.9, 35.1] }, properties: {} } as VworldWfsFeature];
    const quality = auditBuildingFootprints(features);
    expect(quality).toMatchObject({ totalFeatures: 3, polygonFeatures: 2, usablePolygonFeatures: 2, invalidGeometryCount: 1, missingIdentityCount: 2 });
    expect(usableBuildingFootprintFeatures(features)).toHaveLength(2);
  });

  it("reports duplicate identity and geometry groups separately", () => {
    const features = [polygon("b-1", "A-1"), { ...polygon("b-2", "A-1"), geometry: { type: "Polygon", coordinates: [[[126.91, 35.1], [126.911, 35.1], [126.911, 35.101], [126.91, 35.1]]] } }, polygon("b-3", "B-1"), { ...polygon("b-4", "B-1") }];
    const quality = auditBuildingFootprints(features);
    expect(quality.duplicateIdentityGroups).toEqual(expect.arrayContaining([expect.objectContaining({ key: "buildingManagementNo:A1", count: 2 }), expect.objectContaining({ key: "buildingManagementNo:B1", count: 2 })]));
    expect(quality.duplicateIdentityFeatureCount).toBe(4);
    expect(quality.duplicateGeometryCount).toBe(3);
  });

  it("returns field names and geometry types for source diagnostics", () => {
    const quality = auditBuildingFootprints([polygon("b-1", "A-1"), { id: "point-1", geometry: { type: "Point", coordinates: [126.9, 35.1] }, properties: { HEIGHT: 12 } }]);
    expect(quality.propertyFieldNames).toEqual(["BD_MGT_SN", "HEIGHT", "USE"]);
    expect(quality.geometryTypes).toEqual(["Point", "Polygon"]);
  });
});
