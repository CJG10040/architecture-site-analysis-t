import { buildingIdentityFromProperties, buildBuildingIdentityIndex, matchBuildingIdentity, type BuildingIdentityInput, type BuildingMatchDecision } from "./buildingIdentity";
import type { BuildingDatePrecision, BuildingFieldName, BuildingLifecycleEvent, BuildingLifecycleEventType, BuildingRecord } from "./buildingDataModel";
import type { VworldWfsFeature } from "./vworld";

export type NormalizedBuildingLifecycle = {
  sourceRefId: string;
  identity: BuildingIdentityInput;
  events: BuildingLifecycleEvent[];
  rawFieldNames: string[];
};

export type BuildingLifecycleSummary = {
  totalSources: number;
  eventsFound: number;
  linkedRecords: number;
  exactMatches: number;
  strongMatches: number;
  candidates: number;
  unmatched: number;
  conflicts: number;
  invalidDates: number;
  conflictingEvents: number;
};

export type BuildingLifecycleResult = {
  records: BuildingRecord[];
  normalized: NormalizedBuildingLifecycle[];
  decisions: BuildingMatchDecision[];
  summary: BuildingLifecycleSummary;
};

type LifecycleAlias = { type: BuildingLifecycleEventType; field: BuildingFieldName | null; aliases: string[] };
const lifecycleAliases: LifecycleAlias[] = [
  { type: "permit", field: "approvalDate", aliases: ["permit_date", "permitDate", "arch_permit_date", "허가일", "허가일자"] },
  { type: "start", field: null, aliases: ["start_date", "groundbreaking_date", "착공일", "착공일자"] },
  { type: "completion", field: "completionDate", aliases: ["use_apr_date", "useaprdate", "completion_date", "completionDate", "준공일", "사용승인일", "사용승인일자"] },
  { type: "change", field: null, aliases: ["change_date", "alteration_date", "대수선일", "증축일", "개축일", "용도변경일"] },
  { type: "demolition", field: "demolitionDate", aliases: ["demolition_date", "demolitionDate", "말소일", "말소일자", "철거일", "멸실일"] },
  { type: "constructionYear", field: null, aliases: ["construction_year", "build_year", "built_year", "건축연도", "건축년도"] },
];

function key(value: string) { return value.toLowerCase().replace(/[\s_-]/g, ""); }
function readRaw(properties: Record<string, unknown>, aliases: string[]) {
  const wanted = aliases.map(key);
  return Object.entries(properties).find(([name, value]) => wanted.includes(key(name)) && value !== undefined && value !== null && String(value).trim() !== "");
}

export function normalizeBuildingDate(value: unknown): { date: string | null; precision: BuildingDatePrecision; valid: boolean } {
  const raw = String(value ?? "").trim();
  if (/^\d{4}$/.test(raw)) return { date: raw, precision: "year", valid: true };
  const compact = raw.match(/^(\d{4})[./-]?(\d{1,2})[./-]?(\d{1,2})$/) ?? raw.match(/^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일$/);
  if (!compact) return { date: null, precision: "day", valid: false };
  const year = Number(compact[1]); const month = Number(compact[2]); const day = Number(compact[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  const valid = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return { date: valid ? `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}` : null, precision: "day", valid };
}

export function normalizeBuildingLifecycle(feature: VworldWfsFeature, sourceRefId: string): NormalizedBuildingLifecycle {
  const properties = feature.properties ?? {};
  const identity = buildingIdentityFromProperties(properties, feature.id);
  const events: BuildingLifecycleEvent[] = [];
  lifecycleAliases.forEach(alias => {
    const raw = readRaw(properties, alias.aliases);
    if (!raw) return;
    const normalized = normalizeBuildingDate(raw[1]);
    events.push({ id: `${sourceRefId}:${alias.type}:${feature.id ?? "feature"}:${raw[0]}`, type: alias.type, date: normalized.date, rawDate: String(raw[1]).trim(), precision: normalized.precision, status: normalized.valid ? "verified" : "unknown", matchStatus: "unmatched", sourceRefIds: [sourceRefId], rawFieldNames: [raw[0]], note: normalized.valid ? undefined : "날짜 형식을 해석하지 못했습니다." });
  });
  return { sourceRefId, identity, events, rawFieldNames: Object.keys(properties) };
}

const singletonEventTypes: BuildingLifecycleEventType[] = ["completion", "demolition", "constructionYear"];

export function mergeBuildingLifecycleEvents(existing: BuildingLifecycleEvent[], incoming: BuildingLifecycleEvent[]) {
  const all = [...existing, ...incoming];
  const byType = new Map<BuildingLifecycleEventType, BuildingLifecycleEvent[]>();
  all.forEach(event => byType.set(event.type, [...(byType.get(event.type) ?? []), event]));
  let conflictingEvents = 0;
  const events = Array.from(byType.entries()).flatMap(([type, items]) => {
    const distinctDates = Array.from(new Set(items.filter(item => item.date).map(item => `${item.date}:${item.precision}`)));
    const conflict = singletonEventTypes.includes(type) && distinctDates.length > 1;
    if (conflict) conflictingEvents += items.length;
    const unique = new Map<string, BuildingLifecycleEvent>();
    items.forEach(item => {
      const keyValue = `${item.type}:${item.date ?? item.rawDate}:${item.rawDate}`;
      const current = unique.get(keyValue);
      unique.set(keyValue, current ? { ...current, sourceRefIds: Array.from(new Set([...current.sourceRefIds, ...item.sourceRefIds])), rawFieldNames: Array.from(new Set([...current.rawFieldNames, ...item.rawFieldNames])), status: current.status === "conflict" ? "conflict" : item.status } : { ...item, status: conflict ? "conflict" : item.status, note: conflict ? "동일 이벤트 유형의 날짜가 출처별로 충돌합니다." : item.note });
    });
    return Array.from(unique.values());
  });
  return { events, conflictingEvents };
}

function recordIdentity(record: BuildingRecord): BuildingIdentityInput {
  const value = (field: BuildingFieldName) => record.fields[field]?.value;
  return { sourceRecordId: record.id, buildingManagementNo: value("buildingManagementNo"), bldrgstPk: value("bldrgstPk"), ufid: value("ufid"), pnu: value("pnu"), gid: value("gid"), featureId: record.id, address: value("address") };
}

export function attachBuildingLifecycle(records: BuildingRecord[], features: VworldWfsFeature[], sourceRefId: string): BuildingLifecycleResult {
  const normalized = features.map(feature => normalizeBuildingLifecycle(feature, sourceRefId));
  const masters = records.map(record => ({ ...recordIdentity(record), masterBuildingId: record.id }));
  const index = buildBuildingIdentityIndex(masters);
  const decisions = normalized.map(item => matchBuildingIdentity(item.identity, masters, index));
  const mutableRecords = records.map(record => ({ ...record, fields: { ...record.fields }, sourceRefIds: [...record.sourceRefIds], lifecycleEvents: [...(record.lifecycleEvents ?? [])] }));
  let linkedRecords = 0; let conflictingEvents = 0;
  decisions.forEach((decision, index) => {
    if (!decision.masterBuildingId || decision.status !== "matched" || !["exact", "strong"].includes(decision.confidence)) return;
    const record = mutableRecords.find(item => item.id === decision.masterBuildingId);
    if (!record) return;
    const events = normalized[index].events.map(event => ({ ...event, matchStatus: "matched" as const }));
    const merged = mergeBuildingLifecycleEvents(record.lifecycleEvents, events);
    record.lifecycleEvents = merged.events;
    record.sourceRefIds = Array.from(new Set([...record.sourceRefIds, sourceRefId]));
    record.matchStatus = "matched";
    record.matchConfidence = decision.confidence;
    linkedRecords += 1;
    conflictingEvents += merged.conflictingEvents;
  });
  const allEvents = normalized.flatMap(item => item.events);
  return { records: mutableRecords, normalized, decisions, summary: { totalSources: normalized.length, eventsFound: allEvents.length, linkedRecords, exactMatches: decisions.filter(item => item.confidence === "exact").length, strongMatches: decisions.filter(item => item.confidence === "strong").length, candidates: decisions.filter(item => item.status === "candidate").length, unmatched: decisions.filter(item => item.status === "unmatched").length, conflicts: decisions.filter(item => item.status === "conflict").length, invalidDates: allEvents.filter(item => !item.date).length, conflictingEvents } };
}
