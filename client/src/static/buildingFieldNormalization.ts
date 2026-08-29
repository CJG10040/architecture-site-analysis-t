import type { BuildingFieldName, BuildingValue, BuildingValueStatus } from "./buildingDataModel";

export const buildingFieldUnits: Partial<Record<BuildingFieldName, string>> = { aboveGroundFloors: "count", belowGroundFloors: "count", heightMeters: "m", buildingAreaSqm: "㎡", grossFloorAreaSqm: "㎡", coverageRatio: "%", floorAreaRatio: "%" };

const numericFields = new Set<BuildingFieldName>(["aboveGroundFloors", "belowGroundFloors", "heightMeters", "buildingAreaSqm", "grossFloorAreaSqm", "coverageRatio", "floorAreaRatio"]);
const integerFields = new Set<BuildingFieldName>(["aboveGroundFloors", "belowGroundFloors"]);
const nonNegativeFields = new Set<BuildingFieldName>(Array.from(numericFields));
const maximums: Partial<Record<BuildingFieldName, number>> = { aboveGroundFloors: 200, belowGroundFloors: 50, heightMeters: 1000, coverageRatio: 100, floorAreaRatio: 5000 };

function parseNumber(value: unknown) {
  const text = String(value ?? "").replace(/,/g, "").trim();
  if (!text) return null;
  const match = text.match(/[-+]?\d+(?:\.\d+)?/);
  if (!match) return null;
  const number = Number(match[0]);
  return Number.isFinite(number) ? number : null;
}

export function normalizeBuildingField(field: BuildingFieldName, rawValue: unknown, sourceRefId: string, rawFieldName: string, status: BuildingValueStatus = "verified"): BuildingValue {
  const base = { rawValue, sourceRefIds: [sourceRefId], rawFieldNames: [rawFieldName], unit: buildingFieldUnits[field], normalizationMethod: "trim" };
  if (rawValue === undefined || rawValue === null || String(rawValue).trim() === "") return { value: null, status: "unknown", ...base, note: "빈 값" };
  if (!numericFields.has(field)) return { value: String(rawValue).trim().replace(/\s+/g, " "), status, ...base };
  const parsed = parseNumber(rawValue);
  const maximum = maximums[field];
  const valid = parsed !== null && (!integerFields.has(field) || Number.isInteger(parsed)) && (!nonNegativeFields.has(field) || parsed >= 0) && (maximum === undefined || parsed <= maximum);
  if (!valid) return { value: null, status: "unknown", ...base, normalizationMethod: "number", note: "숫자·단위·범위 검증 실패" };
  return { value: parsed, status, ...base, normalizationMethod: integerFields.has(field) ? "nonNegativeInteger" : "nonNegativeNumber" };
}
