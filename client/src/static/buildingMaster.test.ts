import { describe, expect, it } from "vitest";
import { buildBuildingMaster } from "./buildingMaster";
import type { VworldWfsFeature } from "./vworld";

const polygon = (id: string, managementNo: string, offset = 0): VworldWfsFeature => ({ id, geometry: { type: "Polygon", coordinates: [[[126.9 + offset, 35.1], [126.901 + offset, 35.1], [126.901 + offset, 35.101], [126.9 + offset, 35.1]]] }, properties: { BD_MGT_SN: managementNo } });

describe("building master build", () => {
  it("creates full analysis records and a separate map-limited list", () => {
    const footprintA = polygon("footprint-a", "A-1");
    const footprintB = polygon("footprint-b", "B-1", 0.01);
    const result = buildBuildingMaster({ footprints: { sourceRefId: "footprint-raw", features: [footprintA, footprintB], distanceToSiteMetersByFeatureId: { "footprint-a": 20, "footprint-b": 350 } }, attributes: [{ sourceRefId: "use-raw", features: [{ ...polygon("use-a", "A-1"), properties: { BD_MGT_SN: "A-1", MAIN_USE: "근린생활시설", GRO_FLO_CO: "4" } }] }], lifecycle: [{ sourceRefId: "life-raw", features: [{ ...polygon("life-a", "A-1"), properties: { BD_MGT_SN: "A-1", USE_APR_DATE: "2018-03-01" } }] }], mapLimit: 1 });
    expect(result.quality.totalRecords).toBe(2);
    expect(result.quality.analysisRecordCount).toBe(2);
    expect(result.quality.mapRecordCount).toBe(1);
    expect(result.records).toHaveLength(2);
    expect(result.mapRecords).toHaveLength(1);
    expect(result.records[0].scopeMembership).toEqual(["macro", "meso", "site", "micro"]);
    expect(result.records[0].fields.primaryUse?.value).toBe("근린생활시설");
    expect(result.records[0].lifecycleEvents[0].date).toBe("2018-03-01");
    expect(result.quality.sourceQuality).toMatchObject([{ sourceRefId: "use-raw", sampleCount: 1, matched: 1, matchedRate: 1 }, { sourceRefId: "life-raw", sampleCount: 1, matched: 1, matchedRate: 1 }]);
  });

  it("retains only usable footprints as master records and reports invalid input", () => {
    const invalid: VworldWfsFeature = { id: "point-1", geometry: { type: "Point", coordinates: [126.9, 35.1] }, properties: { BD_MGT_SN: "C-1" } };
    const result = buildBuildingMaster({ footprints: { sourceRefId: "footprint-raw", features: [polygon("a", "A-1"), invalid] } });
    expect(result.records).toHaveLength(1);
    expect(result.quality.usableFootprints).toBe(1);
    expect(result.quality.invalidFootprints).toBe(1);
  });

  it("reports duplicate footprint identities without silently deduplicating them", () => {
    const result = buildBuildingMaster({ footprints: { sourceRefId: "footprint-raw", features: [polygon("a", "A-1"), polygon("b", "A-1", 0.01)] } });
    expect(result.records).toHaveLength(2);
    expect(result.quality.duplicateIdentityGroups).toBe(1);
  });

  it("returns zero-denominator source rates with an explicit empty sample count", () => {
    const result = buildBuildingMaster({ footprints: { sourceRefId: "footprint-raw", features: [polygon("a", "A-1")] }, attributes: [{ sourceRefId: "empty", features: [] }] });
    expect(result.quality.sourceQuality[0]).toMatchObject({ sampleCount: 0, matchedRate: 0, candidateRate: 0, unmatchedRate: 0, conflictRate: 0 });
  });
});
