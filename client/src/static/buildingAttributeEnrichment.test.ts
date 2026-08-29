import { describe, expect, it } from "vitest";
import { createBuildingRecord } from "./buildingDataModel";
import { enrichBuildingRecords, mergeBuildingAttributeFields, normalizeBuildingAttributes } from "./buildingAttributeEnrichment";
import type { VworldWfsFeature } from "./vworld";

const useFeature = (id: string, managementNo: string, use = "근린생활시설"): VworldWfsFeature => ({ id, geometry: null, properties: { BD_MGT_SN: managementNo, MAIN_USE: use, GRO_FLO_CO: "4", UGRND_FLR: 1, HEIGHT: "12.5m", ARCH_AREA: "1,000.25㎡", TOTAREA: "4,500.5", STRCT_NM: "철근콘크리트", USE_APR_DATE: "2018-03-01", PLAT_PLC: "광주 동구 1-1" } });

function master(id: string, managementNo: string, address?: string) {
  const record = createBuildingRecord({ id });
  record.fields.buildingManagementNo = { value: managementNo, status: "verified", sourceRefIds: ["footprint"] };
  if (address) record.fields.address = { value: address, status: "verified", sourceRefIds: ["footprint"] };
  return record;
}

describe("building attribute normalization", () => {
  it("maps common use, floor, area, structure and date aliases", () => {
    const normalized = normalizeBuildingAttributes(useFeature("use-1", "A-1"), "dt-d198-1");
    expect(normalized.identity.buildingManagementNo).toBe("A-1");
    expect(normalized.fields.primaryUse).toMatchObject({ value: "근린생활시설", status: "verified", sourceRefIds: ["dt-d198-1"], rawFieldNames: ["MAIN_USE"] });
    expect(normalized.fields.aboveGroundFloors?.value).toBe(4);
    expect(normalized.fields.heightMeters?.value).toBe(12.5);
    expect(normalized.fields.buildingAreaSqm?.value).toBe(1000.25);
    expect(normalized.fields.grossFloorAreaSqm?.value).toBe(4500.5);
    expect(normalized.fields.completionDate?.value).toBe("2018-03-01");
  });

  it("does not create a normalized field from an empty or non-numeric value", () => {
    const feature = useFeature("use-1", "A-1");
    feature.properties.GRO_FLO_CO = "";
    feature.properties.HEIGHT = "확인 필요";
    const normalized = normalizeBuildingAttributes(feature, "source-1");
    expect(normalized.fields.aboveGroundFloors).toBeUndefined();
    expect(normalized.fields.heightMeters).toBeUndefined();
  });
});

describe("building attribute enrichment", () => {
  it("enriches only exact and strong matches", () => {
    const records = [master("master-a", "A-1"), master("master-b", "B-1")];
    const result = enrichBuildingRecords(records, [useFeature("use-a", "A-1"), useFeature("use-x", "X-1")], "dt-d198-1");
    expect(result.summary).toMatchObject({ totalSources: 2, matchedExact: 1, unmatched: 1, enrichedRecords: 1 });
    expect(result.records[0].fields.primaryUse?.value).toBe("근린생활시설");
    expect(result.records[1].fields.primaryUse).toBeUndefined();
  });

  it("keeps address-only matches as candidates and does not enrich them", () => {
    const records = [master("master-a", "A-1", "광주 동구 1-1")];
    const feature = useFeature("use-x", "X-1");
    feature.properties.BD_MGT_SN = "";
    feature.properties.PLAT_PLC = "광주 동구 1-1";
    const result = enrichBuildingRecords(records, [feature], "hub-1");
    expect(result.summary.candidates).toBe(1);
    expect(result.summary.enrichedRecords).toBe(0);
    expect(result.records[0].fields.primaryUse).toBeUndefined();
  });

  it("preserves conflicting values and their source references", () => {
    const current = { primaryUse: { value: "주거", status: "verified" as const, sourceRefIds: ["source-a"] } };
    const incoming = { primaryUse: { value: "판매시설", status: "verified" as const, sourceRefIds: ["source-b"] } };
    const result = mergeBuildingAttributeFields(current, incoming);
    expect(result.conflictingFields).toBe(1);
    expect(result.fields.primaryUse).toMatchObject({ value: "주거", status: "conflict", sourceRefIds: ["source-a", "source-b"] });
    expect(result.fields.primaryUse?.note).toContain("판매시설");
  });
});
