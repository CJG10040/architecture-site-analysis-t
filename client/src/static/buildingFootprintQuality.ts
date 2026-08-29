import { buildingIdentityFromProperties, normalizeBuildingIdentity, type BuildingIdentityField } from "./buildingIdentity";
import type { SpatialGeometry } from "./model";
import type { VworldWfsFeature } from "./vworld";

export type BuildingFootprintDuplicateGroup = {
  key: string;
  featureIds: string[];
  count: number;
};

export type BuildingFootprintQuality = {
  totalFeatures: number;
  polygonFeatures: number;
  usablePolygonFeatures: number;
  invalidGeometryCount: number;
  missingIdentityCount: number;
  duplicateIdentityGroups: BuildingFootprintDuplicateGroup[];
  duplicateIdentityFeatureCount: number;
  duplicateGeometryCount: number;
  propertyFieldNames: string[];
  geometryTypes: string[];
};

const identityFields: BuildingIdentityField[] = ["buildingManagementNo", "bldrgstPk", "ufid", "pnu", "gid", "featureId"];

function coordinatePair(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length >= 2 && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1]));
}

function validRing(value: unknown) {
  if (!Array.isArray(value) || value.length < 3) return false;
  const points = value.filter(coordinatePair);
  return points.length >= 3 && new Set(points.map(point => `${Number(point[0]).toFixed(7)},${Number(point[1]).toFixed(7)}`)).size >= 3;
}

export function isUsableBuildingFootprint(geometry?: SpatialGeometry) {
  if (!geometry || !Array.isArray(geometry.coordinates)) return false;
  if (geometry.type === "Polygon") return validRing(geometry.coordinates[0]);
  if (geometry.type === "MultiPolygon") return geometry.coordinates.some(polygon => Array.isArray(polygon) && validRing(polygon[0]));
  return false;
}

function identityKey(feature: VworldWfsFeature) {
  const identity = buildingIdentityFromProperties(feature.properties, feature.id);
  for (const field of identityFields) {
    const value = normalizeBuildingIdentity(identity[field]);
    if (value) return `${field}:${value}`;
  }
  return "";
}

function featureId(feature: VworldWfsFeature, index: number) {
  return feature.id?.trim() || `feature-${index + 1}`;
}

function geometryKey(geometry?: SpatialGeometry) {
  if (!geometry || !Array.isArray(geometry.coordinates)) return "";
  const round = (value: unknown): unknown => Array.isArray(value) ? value.map(round) : typeof value === "number" ? Number(value.toFixed(7)) : value;
  return `${geometry.type}:${JSON.stringify(round(geometry.coordinates))}`;
}

export function auditBuildingFootprints(features: VworldWfsFeature[]): BuildingFootprintQuality {
  const duplicateIdentityMap = new Map<string, string[]>();
  const duplicateGeometryMap = new Map<string, string[]>();
  const fields = new Set<string>();
  const geometryTypes = new Set<string>();
  let polygonFeatures = 0;
  let usablePolygonFeatures = 0;
  let invalidGeometryCount = 0;
  let missingIdentityCount = 0;
  features.forEach((feature, index) => {
    Object.keys(feature.properties).forEach(field => fields.add(field));
    if (feature.geometry?.type) geometryTypes.add(feature.geometry.type);
    const isPolygon = feature.geometry?.type === "Polygon" || feature.geometry?.type === "MultiPolygon";
    if (isPolygon) polygonFeatures += 1;
    if (isUsableBuildingFootprint(feature.geometry)) usablePolygonFeatures += 1;
    else invalidGeometryCount += 1;
    const idKey = identityKey(feature);
    if (!idKey) missingIdentityCount += 1;
    else duplicateIdentityMap.set(idKey, [...(duplicateIdentityMap.get(idKey) ?? []), featureId(feature, index)]);
    const shapeKey = geometryKey(feature.geometry);
    if (shapeKey) duplicateGeometryMap.set(shapeKey, [...(duplicateGeometryMap.get(shapeKey) ?? []), featureId(feature, index)]);
  });
  const duplicateIdentityGroups = Array.from(duplicateIdentityMap.entries()).filter(([, ids]) => ids.length > 1).map(([key, ids]) => ({ key, featureIds: ids, count: ids.length }));
  const duplicateGeometryGroups = Array.from(duplicateGeometryMap.values()).filter(ids => ids.length > 1);
  return { totalFeatures: features.length, polygonFeatures, usablePolygonFeatures, invalidGeometryCount, missingIdentityCount, duplicateIdentityGroups, duplicateIdentityFeatureCount: duplicateIdentityGroups.reduce((sum, group) => sum + group.count, 0), duplicateGeometryCount: duplicateGeometryGroups.reduce((sum, ids) => sum + ids.length, 0), propertyFieldNames: Array.from(fields).sort(), geometryTypes: Array.from(geometryTypes).sort() };
}

export function usableBuildingFootprintFeatures(features: VworldWfsFeature[]) {
  return features.filter(feature => isUsableBuildingFootprint(feature.geometry));
}
