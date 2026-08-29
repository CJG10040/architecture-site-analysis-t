import { describe, expect, it } from "vitest";
import { normalizeBuildingField } from "./buildingFieldNormalization";

describe("building field normalization", () => {
  it("normalizes measured values while retaining the raw value and unit", () => {
    expect(normalizeBuildingField("buildingAreaSqm", "1,250.50㎡", "source-1", "ARCH_AREA")).toMatchObject({ value: 1250.5, status: "verified", rawValue: "1,250.50㎡", unit: "㎡", rawFieldNames: ["ARCH_AREA"] });
    expect(normalizeBuildingField("heightMeters", "18.2m", "source-1", "HEIGHT")).toMatchObject({ value: 18.2, unit: "m" });
    expect(normalizeBuildingField("coverageRatio", "55%", "source-1", "BC_RAT").value).toBe(55);
  });

  it("accepts non-negative integer floors and rejects fractional or negative floors", () => {
    expect(normalizeBuildingField("aboveGroundFloors", "4층", "source-1", "GRO_FLO_CO").value).toBe(4);
    expect(normalizeBuildingField("belowGroundFloors", 2, "source-1", "UGRND_FLR").value).toBe(2);
    expect(normalizeBuildingField("aboveGroundFloors", "4.5", "source-1", "GRO_FLO_CO").status).toBe("unknown");
    expect(normalizeBuildingField("belowGroundFloors", -1, "source-1", "UGRND_FLR").status).toBe("unknown");
  });

  it("does not turn malformed or implausible values into facts", () => {
    expect(normalizeBuildingField("heightMeters", "확인 필요", "source-1", "HEIGHT")).toMatchObject({ value: null, status: "unknown" });
    expect(normalizeBuildingField("coverageRatio", "101%", "source-1", "BC_RAT")).toMatchObject({ value: null, status: "unknown" });
    expect(normalizeBuildingField("grossFloorAreaSqm", "", "source-1", "TOTAREA")).toMatchObject({ value: null, status: "unknown", note: "빈 값" });
  });

  it("normalizes label fields without losing the original value", () => {
    expect(normalizeBuildingField("primaryUse", "  근린생활시설  ", "source-1", "MAIN_USE")).toMatchObject({ value: "근린생활시설", rawValue: "  근린생활시설  ", normalizationMethod: "trim" });
  });
});
