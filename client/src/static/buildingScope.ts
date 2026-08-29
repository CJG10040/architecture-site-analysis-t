export type BuildingScope = "macro" | "meso" | "site" | "micro";

export type BuildingScopeConfig = {
  macroMeters: number;
  mesoMeters: number;
  siteMeters: number;
  microMeters: number;
};

export const defaultBuildingScopeConfig: BuildingScopeConfig = { macroMeters: 1000, mesoMeters: 300, siteMeters: 100, microMeters: 30 };

export type BuildingFieldPolicy = {
  required: string[];
  optional: string[];
  aiMode: "aggregate" | "basic-records" | "detailed-records" | "detailed-records-and-field-observation";
};

const commonFields = ["buildingId", "geometry", "footprintAreaSqm", "centroid", "dataDate", "matchConfidence"];

export const buildingFieldPolicies: Record<BuildingScope, BuildingFieldPolicy> = {
  macro: { required: commonFields, optional: ["primaryUse", "aboveGroundFloors", "completionDate"], aiMode: "aggregate" },
  meso: { required: [...commonFields, "distanceToSiteMeters"], optional: ["primaryUse", "secondaryUses", "aboveGroundFloors", "belowGroundFloors", "heightMeters", "completionDate"], aiMode: "basic-records" },
  site: { required: [...commonFields, "distanceToSiteMeters", "address"], optional: ["buildingManagementNo", "pnu", "primaryUse", "secondaryUses", "aboveGroundFloors", "belowGroundFloors", "heightMeters", "buildingAreaSqm", "grossFloorAreaSqm", "approvalDate", "completionDate", "demolitionDate", "structure", "relationToBoundary"], aiMode: "detailed-records" },
  micro: { required: [...commonFields, "distanceToSiteMeters", "address"], optional: ["buildingManagementNo", "pnu", "primaryUse", "secondaryUses", "aboveGroundFloors", "belowGroundFloors", "heightMeters", "buildingAreaSqm", "grossFloorAreaSqm", "approvalDate", "completionDate", "demolitionDate", "structure", "relationToBoundary", "entrance", "frontage", "facade", "vacancy", "fieldObservationIds"], aiMode: "detailed-records-and-field-observation" },
};

export function normalizeBuildingScopeConfig(config: Partial<BuildingScopeConfig> = {}): BuildingScopeConfig {
  const numberOrDefault = (value: number | undefined, fallback: number) => Number.isFinite(value) ? Number(value) : fallback;
  const macroMeters = Math.max(300, numberOrDefault(config.macroMeters, defaultBuildingScopeConfig.macroMeters));
  const mesoMeters = Math.max(100, Math.min(macroMeters, numberOrDefault(config.mesoMeters, defaultBuildingScopeConfig.mesoMeters)));
  const siteMeters = Math.max(30, Math.min(mesoMeters, numberOrDefault(config.siteMeters, defaultBuildingScopeConfig.siteMeters)));
  const microMeters = Math.max(0, Math.min(siteMeters, numberOrDefault(config.microMeters, defaultBuildingScopeConfig.microMeters)));
  return { macroMeters, mesoMeters, siteMeters, microMeters };
}

export function buildingScopeMembership(distanceMeters: number, config: Partial<BuildingScopeConfig> = {}) {
  const distance = Number(distanceMeters);
  if (!Number.isFinite(distance) || distance < 0) return [] as BuildingScope[];
  const limits = normalizeBuildingScopeConfig(config);
  const membership: BuildingScope[] = [];
  if (distance <= limits.macroMeters) membership.push("macro");
  if (distance <= limits.mesoMeters) membership.push("meso");
  if (distance <= limits.siteMeters) membership.push("site");
  if (distance <= limits.microMeters) membership.push("micro");
  return membership;
}

export function primaryBuildingScope(distanceMeters: number, config: Partial<BuildingScopeConfig> = {}): BuildingScope | null {
  const membership = buildingScopeMembership(distanceMeters, config);
  return membership.at(-1) ?? null;
}
