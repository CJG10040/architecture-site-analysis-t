import { describe, expect, it } from "vitest";
import { buildBuildingIdentityIndex, buildingIdentityFromProperties, buildingRecordMatchState, matchBuildingIdentity, normalizeBuildingAddress, normalizeBuildingIdentity } from "./buildingIdentity";

describe("building identity normalization", () => {
  it("normalizes identifier formatting without converting identifiers to numbers", () => {
    expect(normalizeBuildingIdentity(" ab-001_02 ")).toBe("AB00102");
    expect(normalizeBuildingIdentity("0002911010100100010000")).toBe("0002911010100100010000");
    expect(normalizeBuildingAddress("  광주광역시   동구 1-1 ")).toBe("광주광역시 동구 1-1");
  });

  it("extracts known aliases while retaining source values as strings", () => {
    expect(buildingIdentityFromProperties({ BD_MGT_SN: "A-1", PNU: "0001", 주소: "광주 동구 1-1", GID: 12 }, "source-1")).toMatchObject({ sourceRecordId: "source-1", buildingManagementNo: "A-1", pnu: "0001", address: "광주 동구 1-1", gid: 12 });
  });
});

describe("building identity matching", () => {
  const masters = [
    { masterBuildingId: "master-a", buildingManagementNo: "A-1", pnu: "0001", address: "광주 동구 1-1" },
    { masterBuildingId: "master-b", buildingManagementNo: "B-1", pnu: "0002", address: "광주 동구 2-1" },
  ];

  it("matches one master by a strong identifier and records the evidence", () => {
    const result = matchBuildingIdentity({ sourceRecordId: "source-a", buildingManagementNo: " a 1 " }, masters);
    expect(result).toMatchObject({ masterBuildingId: "master-a", status: "matched", confidence: "exact", matchedFields: ["buildingManagementNo"] });
    expect(result.matchEvidence[0]).toMatchObject({ field: "buildingManagementNo", value: "A1", masterBuildingIds: ["master-a"] });
    expect(buildingRecordMatchState(result)).toEqual({ matchStatus: "matched", matchConfidence: "exact" });
  });

  it("does not promote an address-only match to a confirmed building", () => {
    const result = matchBuildingIdentity({ sourceRecordId: "source-a", address: "광주 동구 1-1" }, masters);
    expect(result).toMatchObject({ masterBuildingId: "master-a", status: "candidate", confidence: "candidate" });
    expect(result.notes.join(" ")).toContain("geometry");
  });

  it("returns unmatched when no identifier or address is found", () => {
    const result = matchBuildingIdentity({ sourceRecordId: "source-x", pnu: "9999", address: "광주 동구 없음" }, masters);
    expect(result).toMatchObject({ status: "unmatched", confidence: "unknown", conflictRecordIds: [] });
    expect(result.unmatchedFields).toContain("pnu");
  });

  it("returns conflict when identifiers point to different master buildings", () => {
    const result = matchBuildingIdentity({ sourceRecordId: "source-conflict", buildingManagementNo: "A-1", pnu: "0002" }, masters);
    expect(result).toMatchObject({ status: "conflict", confidence: "unknown", conflictRecordIds: ["master-a", "master-b"] });
    expect(result.matchedFields).toEqual(["buildingManagementNo", "pnu"]);
  });

  it("treats an ambiguous address as a conflict rather than selecting arbitrarily", () => {
    const ambiguous = [...masters, { masterBuildingId: "master-c", address: "광주 동구 1-1" }];
    const result = matchBuildingIdentity({ sourceRecordId: "source-ambiguous", address: "광주 동구 1-1" }, ambiguous);
    expect(result).toMatchObject({ status: "conflict", confidence: "candidate", conflictRecordIds: ["master-a", "master-c"] });
  });

  it("reuses a prebuilt index for repeated source matching", () => {
    const index = buildBuildingIdentityIndex(masters);
    expect(matchBuildingIdentity({ buildingManagementNo: "B-1" }, masters, index).masterBuildingId).toBe("master-b");
  });
});
