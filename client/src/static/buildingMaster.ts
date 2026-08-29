import { createBuildingRecord, type BuildingFieldName, type BuildingRawReference, type BuildingRecord, type BuildingValueStatus } from "./buildingDataModel";
import { enrichBuildingRecords } from "./buildingAttributeEnrichment";
import { attachBuildingLifecycle } from "./buildingLifecycle";
import { auditBuildingFootprints, usableBuildingFootprintFeatures } from "./buildingFootprintQuality";
import { geometryAreaSqm, type VworldWfsFeature } from "./vworld";
import type { BuildingScopeConfig } from "./buildingScope";

export type BuildingFeatureSource = { sourceRefId: string; features: VworldWfsFeature[]; distanceToSiteMetersByFeatureId?: Record<string, number>; rawReference?: BuildingRawReference };
export type BuildingMasterInputs = { footprints: BuildingFeatureSource; attributes?: BuildingFeatureSource[]; lifecycle?: BuildingFeatureSource[]; scopeConfig?: Partial<BuildingScopeConfig>; mapLimit?: number };

export type BuildingFieldCoverage = { present: number; verified: number; calculated: number; estimated: number; unknown: number; conflict: number; coverageRate: number; sampleCount: number };
export type BuildingSourceQuality = { sourceRefId: string; sampleCount: number; matched: number; candidate: number; unmatched: number; conflict: number; matchedRate: number; candidateRate: number; unmatchedRate: number; conflictRate: number };
export type BuildingMasterQuality = { totalRecords: number; usableFootprints: number; invalidFootprints: number; duplicateIdentityGroups: number; matchStatusCounts: Record<BuildingRecord["matchStatus"], number>; matchConfidenceCounts: Record<BuildingRecord["matchConfidence"], number>; fieldCoverage: Partial<Record<BuildingFieldName, BuildingFieldCoverage>>; sourceQuality: BuildingSourceQuality[]; analysisRecordCount: number; mapRecordCount: number };
export type BuildingMasterBuildResult = { records: BuildingRecord[]; mapRecords: BuildingRecord[]; rawReferences: BuildingRawReference[]; quality: BuildingMasterQuality };

const fieldNames: BuildingFieldName[] = ["buildingManagementNo", "bldrgstPk", "ufid", "pnu", "gid", "address", "buildingName", "primaryUse", "secondaryUses", "aboveGroundFloors", "belowGroundFloors", "heightMeters", "buildingAreaSqm", "grossFloorAreaSqm", "coverageRatio", "floorAreaRatio", "structure", "approvalDate", "completionDate", "demolitionDate"];

function coordinate(value: unknown): value is [number, number] { return Array.isArray(value) && value.length >= 2 && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1])); }
function outerCoordinates(feature: VworldWfsFeature) {
  const geometry = feature.geometry;
  if (!geometry || !Array.isArray(geometry.coordinates)) return [] as [number, number][];
  if (geometry.type === "Polygon") return Array.isArray(geometry.coordinates[0]) ? geometry.coordinates[0].filter(coordinate).map(point => [Number(point[0]), Number(point[1])] as [number, number]) : [];
  if (geometry.type === "MultiPolygon") return geometry.coordinates.flatMap(polygon => Array.isArray(polygon) && Array.isArray(polygon[0]) ? polygon[0].filter(coordinate).map(point => [Number(point[0]), Number(point[1])] as [number, number]) : []);
  return [];
}
function centroid(feature: VworldWfsFeature) {
  const points = outerCoordinates(feature);
  if (!points.length) return null;
  return { longitude: points.reduce((sum, point) => sum + point[0], 0) / points.length, latitude: points.reduce((sum, point) => sum + point[1], 0) / points.length };
}
function featureId(feature: VworldWfsFeature, index: number) { return feature.id?.trim() || `footprint-${index + 1}`; }
function distanceToSite(feature: VworldWfsFeature, id: string, distances?: Record<string, number>) {
  const supplied = distances?.[id];
  if (Number.isFinite(supplied)) return Number(supplied);
  const property = feature.properties.distanceToSiteMeters;
  const parsed = Number(property);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}
function rate(count: number, sampleCount: number) { return sampleCount ? count / sampleCount : 0; }

function fieldCoverage(records: BuildingRecord[]): Partial<Record<BuildingFieldName, BuildingFieldCoverage>> {
  return Object.fromEntries(fieldNames.map(field => {
    const values = records.map(record => record.fields[field]).filter(Boolean);
    const count = (status: BuildingValueStatus) => values.filter(value => value?.status === status).length;
    return [field, { present: values.filter(value => value?.value !== null && value?.value !== undefined).length, verified: count("verified"), calculated: count("calculated"), estimated: count("estimated"), unknown: count("unknown"), conflict: count("conflict"), coverageRate: rate(values.filter(value => value?.value !== null && value?.value !== undefined).length, records.length), sampleCount: records.length }];
  }));
}

function sourceQuality(sourceRefId: string, decisions: { status: "matched" | "candidate" | "unmatched" | "conflict"; confidence: string }[]): BuildingSourceQuality {
  const sampleCount = decisions.length;
  const matched = decisions.filter(item => item.status === "matched" && ["exact", "strong"].includes(item.confidence)).length;
  const candidate = decisions.filter(item => item.status === "candidate" || (item.status === "matched" && item.confidence === "partial")).length;
  const unmatched = decisions.filter(item => item.status === "unmatched").length;
  const conflict = decisions.filter(item => item.status === "conflict").length;
  return { sourceRefId, sampleCount, matched, candidate, unmatched, conflict, matchedRate: rate(matched, sampleCount), candidateRate: rate(candidate, sampleCount), unmatchedRate: rate(unmatched, sampleCount), conflictRate: rate(conflict, sampleCount) };
}

export function buildBuildingMaster(inputs: BuildingMasterInputs): BuildingMasterBuildResult {
  const footprintAudit = auditBuildingFootprints(inputs.footprints.features);
  const usable = usableBuildingFootprintFeatures(inputs.footprints.features);
  let records = usable.map((feature, index) => {
    const id = featureId(feature, index);
    const baseFields = enrichBuildingRecords([], [feature], inputs.footprints.sourceRefId).attributes[0]?.fields ?? {};
    return { ...createBuildingRecord({ id, geometry: feature.geometry, centroid: centroid(feature), footprintAreaSqm: geometryAreaSqm(feature.geometry), sourceRefIds: [inputs.footprints.sourceRefId], distanceToSiteMeters: distanceToSite(feature, id, inputs.footprints.distanceToSiteMetersByFeatureId), scopeConfig: inputs.scopeConfig }), fields: baseFields };
  });
  const decisionsBySource: BuildingSourceQuality[] = [];
  (inputs.attributes ?? []).forEach(source => { const enriched = enrichBuildingRecords(records, source.features, source.sourceRefId); records = enriched.records; decisionsBySource.push(sourceQuality(source.sourceRefId, enriched.decisions)); });
  (inputs.lifecycle ?? []).forEach(source => { const attached = attachBuildingLifecycle(records, source.features, source.sourceRefId); records = attached.records; decisionsBySource.push(sourceQuality(source.sourceRefId, attached.decisions)); });
  const statusValues: BuildingRecord["matchStatus"][] = ["unmatched", "candidate", "matched", "conflict"];
  const confidenceValues: BuildingRecord["matchConfidence"][] = ["unknown", "candidate", "partial", "strong", "exact"];
  const matchStatusCounts = Object.fromEntries(statusValues.map(status => [status, records.filter(record => record.matchStatus === status).length])) as Record<BuildingRecord["matchStatus"], number>;
  const matchConfidenceCounts = Object.fromEntries(confidenceValues.map(confidence => [confidence, records.filter(record => record.matchConfidence === confidence).length])) as Record<BuildingRecord["matchConfidence"], number>;
  const mapLimit = Number.isFinite(inputs.mapLimit) ? Math.max(0, Number(inputs.mapLimit)) : 300;
  return { records, mapRecords: records.slice(0, mapLimit), rawReferences: [inputs.footprints.rawReference, ...(inputs.attributes ?? []).map(source => source.rawReference), ...(inputs.lifecycle ?? []).map(source => source.rawReference)].filter((reference): reference is BuildingRawReference => Boolean(reference)), quality: { totalRecords: records.length, usableFootprints: usable.length, invalidFootprints: footprintAudit.invalidGeometryCount, duplicateIdentityGroups: footprintAudit.duplicateIdentityGroups.length, matchStatusCounts, matchConfidenceCounts, fieldCoverage: fieldCoverage(records), sourceQuality: decisionsBySource, analysisRecordCount: records.length, mapRecordCount: Math.min(records.length, mapLimit) } };
}
