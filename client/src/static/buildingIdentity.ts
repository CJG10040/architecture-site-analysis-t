export type BuildingIdentityField = "buildingManagementNo" | "bldrgstPk" | "ufid" | "pnu" | "gid" | "featureId";

export type BuildingIdentityInput = {
  sourceRecordId?: string;
  buildingManagementNo?: unknown;
  bldrgstPk?: unknown;
  ufid?: unknown;
  pnu?: unknown;
  gid?: unknown;
  featureId?: unknown;
  address?: unknown;
};

export type MasterBuildingIdentity = BuildingIdentityInput & { masterBuildingId: string };
export type BuildingMatchStatus = "matched" | "candidate" | "unmatched" | "conflict";
export type BuildingMatchConfidence = "unknown" | "candidate" | "partial" | "strong" | "exact";

export type BuildingMatchEvidence = {
  field: BuildingIdentityField | "address";
  value: string;
  masterBuildingIds: string[];
};

export type BuildingMatchDecision = {
  sourceRecordId?: string;
  masterBuildingId?: string;
  status: BuildingMatchStatus;
  confidence: BuildingMatchConfidence;
  matchedFields: BuildingIdentityField[];
  matchEvidence: BuildingMatchEvidence[];
  conflictRecordIds: string[];
  unmatchedFields: BuildingIdentityField[];
  notes: string[];
};

export const buildingIdentityPriority: BuildingIdentityField[] = ["buildingManagementNo", "bldrgstPk", "ufid", "pnu", "gid", "featureId"];
const exactIdentityFields: BuildingIdentityField[] = ["buildingManagementNo", "bldrgstPk", "ufid"];

function normalizedKey(value: unknown) {
  if (value === undefined || value === null) return "";
  return String(value).trim().toUpperCase().replace(/[\s_-]/g, "");
}

export function normalizeBuildingIdentity(value: unknown) {
  return normalizedKey(value);
}

export function normalizeBuildingAddress(value: unknown) {
  if (value === undefined || value === null) return "";
  return String(value).trim().replace(/\s+/g, " ");
}

export function buildingIdentityFromProperties(properties: Record<string, unknown>, sourceRecordId?: string): BuildingIdentityInput {
  const aliases: Record<BuildingIdentityField | "address", string[]> = {
    buildingManagementNo: ["buildingManagementNo", "bd_mgt_sn", "bld_mng_no", "bldg_mng_no", "building_management_no", "건축물대장관리번호"],
    bldrgstPk: ["bldrgst_pk", "bldrgstPk", "건축물대장pk"],
    ufid: ["ufid", "UFID"],
    pnu: ["pnu", "PNU"],
    gid: ["gid", "GID"],
    featureId: ["featureId", "feature_id", "id"],
    address: ["address", "addr", "jibun_addr", "road_addr", "plat_plc", "주소", "소재지"],
  };
  const normalizedProperties = Object.entries(properties).map(([key, value]) => [key.toLowerCase().replace(/[\s_-]/g, ""), value] as const);
  const read = (field: keyof typeof aliases) => {
    const keys = aliases[field].map(key => key.toLowerCase().replace(/[\s_-]/g, ""));
    return normalizedProperties.find(([key, value]) => keys.includes(key) && String(value ?? "").trim() !== "")?.[1];
  };
  return { sourceRecordId, buildingManagementNo: read("buildingManagementNo"), bldrgstPk: read("bldrgstPk"), ufid: read("ufid"), pnu: read("pnu"), gid: read("gid"), featureId: read("featureId"), address: read("address") };
}

export function buildBuildingIdentityIndex(records: MasterBuildingIdentity[]) {
  const identityIndex = new Map<string, Set<string>>();
  const addressIndex = new Map<string, Set<string>>();
  records.forEach(record => {
    buildingIdentityPriority.forEach(field => {
      const value = normalizeBuildingIdentity(record[field]);
      if (!value) return;
      const key = `${field}:${value}`;
      const ids = identityIndex.get(key) ?? new Set<string>();
      ids.add(record.masterBuildingId);
      identityIndex.set(key, ids);
    });
    const address = normalizeBuildingAddress(record.address);
    if (address) {
      const ids = addressIndex.get(address) ?? new Set<string>();
      ids.add(record.masterBuildingId);
      addressIndex.set(address, ids);
    }
  });
  return { identityIndex, addressIndex };
}

export function buildingRecordMatchState(decision: BuildingMatchDecision) {
  return { matchStatus: decision.status === "matched" ? "matched" as const : decision.status, matchConfidence: decision.confidence };
}

export function matchBuildingIdentity(source: BuildingIdentityInput, masters: MasterBuildingIdentity[], indexes = buildBuildingIdentityIndex(masters)): BuildingMatchDecision {
  const sourceFields = buildingIdentityPriority.filter(field => normalizeBuildingIdentity(source[field]));
  const matchedByMaster = new Map<string, BuildingIdentityField[]>();
  const evidence: BuildingMatchEvidence[] = [];
  sourceFields.forEach(field => {
    const value = normalizeBuildingIdentity(source[field]);
    const ids = Array.from(indexes.identityIndex.get(`${field}:${value}`) ?? []);
    if (!ids.length) return;
    ids.forEach(id => matchedByMaster.set(id, [...(matchedByMaster.get(id) ?? []), field]));
    evidence.push({ field, value, masterBuildingIds: ids });
  });
  const matchedIds = Array.from(matchedByMaster.keys());
  const unmatchedFields = sourceFields.filter(field => !evidence.some(item => item.field === field));
  if (matchedIds.length > 1) {
    return { sourceRecordId: source.sourceRecordId, status: "conflict", confidence: "unknown", matchedFields: Array.from(new Set(matchedIds.flatMap(id => matchedByMaster.get(id) ?? []))), matchEvidence: evidence, conflictRecordIds: matchedIds, unmatchedFields, notes: ["서로 다른 식별자가 여러 master 건축물에 연결됩니다.", "어느 건축물로도 자동 확정하지 않았습니다."] };
  }
  if (matchedIds.length === 1) {
    const matchedFields = matchedByMaster.get(matchedIds[0]) ?? [];
    const exact = matchedFields.some(field => exactIdentityFields.includes(field));
    const confidence: BuildingMatchConfidence = exact ? "exact" : matchedFields.length >= 2 ? "strong" : "partial";
    return { sourceRecordId: source.sourceRecordId, masterBuildingId: matchedIds[0], status: "matched", confidence, matchedFields, matchEvidence: evidence, conflictRecordIds: [], unmatchedFields, notes: exact ? ["강한 건축물 식별자가 하나의 master에 정확히 일치합니다."] : ["보조 식별자로 일치했으며 주 식별자 확인이 필요합니다."] };
  }
  const address = normalizeBuildingAddress(source.address);
  const addressIds = address ? Array.from(indexes.addressIndex.get(address) ?? []) : [];
  if (addressIds.length > 1) {
    return { sourceRecordId: source.sourceRecordId, status: "conflict", confidence: "candidate", matchedFields: [], matchEvidence: [{ field: "address", value: address, masterBuildingIds: addressIds }], conflictRecordIds: addressIds, unmatchedFields, notes: ["동일 주소에 여러 master 건축물 후보가 있어 주소만으로 확정할 수 없습니다."] };
  }
  if (addressIds.length === 1) {
    return { sourceRecordId: source.sourceRecordId, masterBuildingId: addressIds[0], status: "candidate", confidence: "candidate", matchedFields: [], matchEvidence: [{ field: "address", value: address, masterBuildingIds: addressIds }], conflictRecordIds: [], unmatchedFields, notes: ["주소만 일치한 후보입니다.", "geometry 또는 주 식별자 검증 전에는 확정하지 않습니다."] };
  }
  return { sourceRecordId: source.sourceRecordId, status: "unmatched", confidence: "unknown", matchedFields: [], matchEvidence: [], conflictRecordIds: [], unmatchedFields, notes: ["일치하는 master 건축물을 찾지 못했습니다."] };
}
