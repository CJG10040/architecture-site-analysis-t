import type { SpatialGeometry } from "./model";
import { buildingScopeMembership, defaultBuildingScopeConfig, normalizeBuildingScopeConfig, type BuildingScope, type BuildingScopeConfig } from "./buildingScope";

export type BuildingValueStatus = "verified" | "calculated" | "estimated" | "candidate" | "unknown" | "conflict";
export type BuildingFieldName = "buildingManagementNo" | "bldrgstPk" | "ufid" | "pnu" | "gid" | "address" | "buildingName" | "primaryUse" | "secondaryUses" | "aboveGroundFloors" | "belowGroundFloors" | "heightMeters" | "buildingAreaSqm" | "grossFloorAreaSqm" | "coverageRatio" | "floorAreaRatio" | "structure" | "approvalDate" | "completionDate" | "demolitionDate";
export type BuildingLifecycleEventType = "permit" | "start" | "completion" | "change" | "demolition" | "constructionYear";
export type BuildingDatePrecision = "day" | "year";
export type BuildingLifecycleEvent = { id: string; type: BuildingLifecycleEventType; date: string | null; rawDate: string; precision: BuildingDatePrecision; status: "verified" | "conflict" | "unknown"; matchStatus: "matched" | "candidate" | "unmatched" | "conflict"; sourceRefIds: string[]; rawFieldNames: string[]; note?: string };

export type BuildingValue = {
  value: unknown;
  status: BuildingValueStatus;
  sourceRefIds: string[];
  rawValue?: unknown;
  unit?: string;
  normalizationMethod?: string;
  rawFieldNames?: string[];
  note?: string;
};

export type BuildingRawReference = {
  id: string;
  source: string;
  dataset: string;
  sourceUrl?: string;
  featureId?: string;
  retrievedAt: string;
  dataDate?: string;
  originalCrs?: string;
  rawLocation: "researchNote" | "file" | "inline";
  rawFieldNames: string[];
};

export type BuildingRecord = {
  id: string;
  geometry: SpatialGeometry | null;
  centroid: { latitude: number; longitude: number } | null;
  footprintAreaSqm: BuildingValue;
  scopeMembership: BuildingScope[];
  fields: Partial<Record<BuildingFieldName, BuildingValue>>;
  sourceRefIds: string[];
  matchStatus: "unmatched" | "candidate" | "matched" | "conflict";
  matchConfidence: "unknown" | "candidate" | "partial" | "strong" | "exact";
  observationIds: string[];
  lifecycleEvents: BuildingLifecycleEvent[];
};

export type BuildingRelation = {
  id: string;
  buildingId: string;
  siteDistanceMeters: number | null;
  boundaryDistanceMeters: number | null;
  nearestBoundarySide: "north" | "east" | "south" | "west" | "unknown";
  overlapWithSite: boolean;
  nearestBuildingIds: string[];
  scopeMembership: BuildingScope[];
  relationStatus: "calculated" | "unknown" | "conflict";
  calculatedAt: string;
};

export type BuildingObservationLink = {
  observationId: string;
  buildingId: string;
  relationType: "entrance" | "frontage" | "facade" | "window" | "canopy" | "vacancy" | "material" | "activity" | "boundary" | "contradiction";
  photoId?: string;
  overlayId?: string;
};

export type BuildingAnalysisClaim = {
  id: string;
  text: string;
  evidenceIds: string[];
  status: "fact" | "relation" | "interpretation" | "unknown" | "hypothesis";
  scope?: BuildingScope;
};

export type BuildingHypothesis = {
  id: string;
  title: string;
  evidenceIds: string[];
  interpretation: string;
  spatialAction: string;
  experience: string;
  advantages: string[];
  risks: string[];
  verificationQuestions: string[];
};

export type BuildingAnalysis = {
  id: string;
  catalogId: "buildings";
  scopeSummary: Partial<Record<BuildingScope, string>>;
  verifiedFacts: BuildingAnalysisClaim[];
  relations: BuildingAnalysisClaim[];
  interpretations: BuildingAnalysisClaim[];
  unknowns: BuildingAnalysisClaim[];
  keywords: string[];
  issues: BuildingAnalysisClaim[];
  fieldQuestions: string[];
  designQuestions: string[];
  hypotheses: BuildingHypothesis[];
  sourceEvidenceIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type BuildingStudy = {
  scopeConfig: BuildingScopeConfig;
  rawReferences: BuildingRawReference[];
  records: BuildingRecord[];
  relations: BuildingRelation[];
  observationLinks: BuildingObservationLink[];
  analyses: BuildingAnalysis[];
  updatedAt: string;
};

const emptyValue = (status: BuildingValueStatus = "unknown"): BuildingValue => ({ value: null, status, sourceRefIds: [] });

export function createEmptyBuildingStudy(config: Partial<BuildingScopeConfig> = {}): BuildingStudy {
  return { scopeConfig: normalizeBuildingScopeConfig(config), rawReferences: [], records: [], relations: [], observationLinks: [], analyses: [], updatedAt: new Date().toISOString() };
}

export function createBuildingRecord(input: { id: string; geometry?: SpatialGeometry | null; centroid?: { latitude: number; longitude: number } | null; distanceToSiteMeters?: number; footprintAreaSqm?: number | null; sourceRefIds?: string[]; matchStatus?: BuildingRecord["matchStatus"]; matchConfidence?: BuildingRecord["matchConfidence"]; scopeConfig?: Partial<BuildingScopeConfig> }): BuildingRecord {
  const sourceRefIds = input.sourceRefIds ?? [];
  const footprint = input.footprintAreaSqm !== undefined && input.footprintAreaSqm !== null && Number.isFinite(input.footprintAreaSqm) ? { value: input.footprintAreaSqm, status: "calculated" as const, sourceRefIds } : emptyValue();
  return { id: input.id, geometry: input.geometry ?? null, centroid: input.centroid ?? null, footprintAreaSqm: footprint, scopeMembership: input.distanceToSiteMeters === undefined ? [] : buildingScopeMembership(input.distanceToSiteMeters, input.scopeConfig), fields: {}, sourceRefIds, matchStatus: input.matchStatus ?? "unmatched", matchConfidence: input.matchConfidence ?? "unknown", observationIds: [], lifecycleEvents: [] };
}

export function normalizeBuildingStudy(value: unknown): BuildingStudy {
  if (!value || typeof value !== "object") return createEmptyBuildingStudy(defaultBuildingScopeConfig);
  const input = value as Partial<BuildingStudy>;
  const records = Array.isArray(input.records) ? input.records.map(record => ({ ...record, lifecycleEvents: Array.isArray(record.lifecycleEvents) ? record.lifecycleEvents : [] })) : [];
  return { scopeConfig: normalizeBuildingScopeConfig(input.scopeConfig ?? defaultBuildingScopeConfig), rawReferences: Array.isArray(input.rawReferences) ? input.rawReferences : [], records, relations: Array.isArray(input.relations) ? input.relations : [], observationLinks: Array.isArray(input.observationLinks) ? input.observationLinks : [], analyses: Array.isArray(input.analyses) ? input.analyses : [], updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : new Date().toISOString() };
}
