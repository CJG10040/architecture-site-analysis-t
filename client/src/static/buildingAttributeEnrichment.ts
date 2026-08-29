import { buildingIdentityFromProperties, buildBuildingIdentityIndex, matchBuildingIdentity, type BuildingIdentityInput, type BuildingMatchDecision } from "./buildingIdentity";
import type { BuildingFieldName, BuildingRecord, BuildingValue } from "./buildingDataModel";
import { normalizeBuildingField } from "./buildingFieldNormalization";
import type { VworldWfsFeature } from "./vworld";

export type NormalizedBuildingAttributes = {
  sourceRefId: string;
  identity: BuildingIdentityInput;
  fields: Partial<Record<BuildingFieldName, BuildingValue>>;
  rawFieldNames: string[];
};

export type BuildingAttributeEnrichmentSummary = {
  totalSources: number;
  matchedExact: number;
  matchedStrong: number;
  matchedPartial: number;
  candidates: number;
  unmatched: number;
  conflicts: number;
  enrichedRecords: number;
  conflictingFields: number;
};

export type BuildingAttributeEnrichmentResult = {
  records: BuildingRecord[];
  attributes: NormalizedBuildingAttributes[];
  decisions: BuildingMatchDecision[];
  summary: BuildingAttributeEnrichmentSummary;
};

const aliases: Record<BuildingFieldName, string[]> = {
  buildingManagementNo: ["buildingManagementNo", "bd_mgt_sn", "bld_mng_no", "bldg_mng_no", "building_management_no", "건축물대장관리번호"],
  bldrgstPk: ["bldrgst_pk", "bldrgstPk", "건축물대장pk"],
  ufid: ["ufid", "UFID"],
  pnu: ["pnu", "PNU"],
  gid: ["gid", "GID"],
  address: ["address", "addr", "jibun_addr", "road_addr", "plat_plc", "소재지", "주소"],
  buildingName: ["buildingName", "bldg_nm", "buld_nm", "bld_nm", "건물명"],
  primaryUse: ["primaryUse", "main_use", "main_use_nm", "mainpurpscdnm", "main_purps_cd_nm", "mainPurpsCdNm", "bldg_use", "주용도", "용도"],
  secondaryUses: ["secondaryUses", "detail_use", "detail_use_nm", "etc_use", "etcuse", "세부용도", "기타용도"],
  aboveGroundFloors: ["aboveGroundFloors", "gro_flo_co", "grnd_flr", "ground_floor", "ground_floors", "지상층수"],
  belowGroundFloors: ["belowGroundFloors", "ugrnd_flr", "ugrnd_flr_co", "underground_floor", "지하층수"],
  heightMeters: ["heightMeters", "height", "buld_height", "bldg_height", "hght", "높이"],
  buildingAreaSqm: ["buildingAreaSqm", "arch_area", "archarea", "building_area", "건축면적"],
  grossFloorAreaSqm: ["grossFloorAreaSqm", "totarea", "total_area", "total_floor_area", "gross_floor_area", "연면적"],
  coverageRatio: ["coverageRatio", "bc_rat", "building_coverage_ratio", "건폐율"],
  floorAreaRatio: ["floorAreaRatio", "vl_rat", "floor_area_ratio", "용적률"],
  structure: ["structure", "strct_cd_nm", "strct_nm", "struct", "구조"],
  approvalDate: ["approvalDate", "permit_date", "허가일"],
  completionDate: ["completionDate", "use_apr_date", "useaprdate", "사용승인일"],
  demolitionDate: ["demolitionDate", "demolition_date", "말소일", "철거일"],
};

function key(value: string) { return value.toLowerCase().replace(/[\s_-]/g, ""); }
function readProperty(properties: Record<string, unknown>, field: BuildingFieldName) {
  const wanted = aliases[field].map(key);
  const entry = Object.entries(properties).find(([name, value]) => wanted.includes(key(name)) && value !== undefined && value !== null && String(value).trim() !== "");
  return entry ? { name: entry[0], value: entry[1] } : undefined;
}
export function normalizeBuildingAttributes(feature: VworldWfsFeature, sourceRefId: string): NormalizedBuildingAttributes {
  const properties = feature.properties ?? {};
  const identity = buildingIdentityFromProperties(properties, feature.id);
  const fields: Partial<Record<BuildingFieldName, BuildingValue>> = {};
  (Object.keys(aliases) as BuildingFieldName[]).forEach(field => {
    const raw = readProperty(properties, field);
    if (!raw) return;
    fields[field] = normalizeBuildingField(field, raw.value, sourceRefId, raw.name);
  });
  return { sourceRefId, identity, fields, rawFieldNames: Object.keys(properties) };
}

function equalValue(left: unknown, right: unknown) {
  return typeof left === "number" && typeof right === "number" ? left === right : String(left).trim() === String(right).trim();
}

export function mergeBuildingAttributeFields(existing: Partial<Record<BuildingFieldName, BuildingValue>>, incoming: Partial<Record<BuildingFieldName, BuildingValue>>) {
  const merged: Partial<Record<BuildingFieldName, BuildingValue>> = { ...existing };
  let conflictingFields = 0;
  (Object.keys(incoming) as BuildingFieldName[]).forEach(field => {
    const next = incoming[field];
    if (!next) return;
    const current = merged[field];
    if (!current || current.status === "unknown" || current.status === "candidate") { merged[field] = next; return; }
    if (equalValue(current.value, next.value)) {
      merged[field] = {
        ...current,
        sourceRefIds: Array.from(new Set([...current.sourceRefIds, ...next.sourceRefIds])),
        rawFieldNames: Array.from(new Set([...(current.rawFieldNames ?? []), ...(next.rawFieldNames ?? [])])),
        status: current.status === "conflict" ? "conflict" : "verified",
      };
      return;
    }
    conflictingFields += 1;
    merged[field] = { value: current.value, status: "conflict", sourceRefIds: Array.from(new Set([...current.sourceRefIds, ...next.sourceRefIds])), rawFieldNames: Array.from(new Set([...(current.rawFieldNames ?? []), ...(next.rawFieldNames ?? [])])), note: `충돌값 보존: ${String(current.value)} ↔ ${String(next.value)}` };
  });
  return { fields: merged, conflictingFields };
}

function recordIdentity(record: BuildingRecord): BuildingIdentityInput {
  const value = (field: BuildingFieldName) => record.fields[field]?.value;
  return { sourceRecordId: record.id, buildingManagementNo: value("buildingManagementNo"), bldrgstPk: value("bldrgstPk"), ufid: value("ufid"), pnu: value("pnu"), gid: value("gid"), featureId: record.id, address: value("address") };
}

export function enrichBuildingRecords(records: BuildingRecord[], features: VworldWfsFeature[], sourceRefId: string): BuildingAttributeEnrichmentResult {
  const attributes = features.map(feature => normalizeBuildingAttributes(feature, sourceRefId));
  const masters = records.map(record => ({ ...recordIdentity(record), masterBuildingId: record.id }));
  const index = buildBuildingIdentityIndex(masters);
  const decisions = attributes.map(attribute => matchBuildingIdentity(attribute.identity, masters, index));
  const mutableRecords = records.map(record => ({ ...record, fields: { ...record.fields }, sourceRefIds: [...record.sourceRefIds] }));
  let enrichedRecords = 0;
  let conflictingFields = 0;
  decisions.forEach((decision, index) => {
    if (!decision.masterBuildingId || decision.status !== "matched" || !["exact", "strong"].includes(decision.confidence)) return;
    const target = mutableRecords.find(record => record.id === decision.masterBuildingId);
    if (!target) return;
    const merged = mergeBuildingAttributeFields(target.fields, attributes[index].fields);
    target.fields = merged.fields;
    target.sourceRefIds = Array.from(new Set([...target.sourceRefIds, sourceRefId]));
    target.matchStatus = "matched";
    target.matchConfidence = decision.confidence;
    enrichedRecords += 1;
    conflictingFields += merged.conflictingFields;
  });
  return { records: mutableRecords, attributes, decisions, summary: { totalSources: decisions.length, matchedExact: decisions.filter(item => item.confidence === "exact").length, matchedStrong: decisions.filter(item => item.confidence === "strong").length, matchedPartial: decisions.filter(item => item.confidence === "partial").length, candidates: decisions.filter(item => item.status === "candidate").length, unmatched: decisions.filter(item => item.status === "unmatched").length, conflicts: decisions.filter(item => item.status === "conflict").length, enrichedRecords, conflictingFields } };
}
