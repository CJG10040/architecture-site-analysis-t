import type { SpatialFeature, SpatialGeometry, SpatialLayer } from "./model";

const earthRadiusMeters = 6371008.8;
const asPair = (value: unknown): [number, number] | null => Array.isArray(value) && value.length >= 2 && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1])) ? [Number(value[0]), Number(value[1])] : null;
const haversine = (a: [number, number], b: [number, number]) => {
  const lat1 = a[1] * Math.PI / 180;
  const lat2 = b[1] * Math.PI / 180;
  const dLat = (b[1] - a[1]) * Math.PI / 180;
  const dLng = (b[0] - a[0]) * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusMeters * Math.asin(Math.min(1, Math.sqrt(h)));
};

function lineLength(coordinates: unknown): number {
  if (!Array.isArray(coordinates)) return 0;
  const points = coordinates.map(asPair).filter((point): point is [number, number] => Boolean(point));
  return points.slice(1).reduce((total, point, index) => total + haversine(points[index], point), 0);
}

function ringArea(coordinates: unknown): number {
  if (!Array.isArray(coordinates)) return 0;
  const points = coordinates.map(asPair).filter((point): point is [number, number] => Boolean(point));
  if (points.length < 3) return 0;
  const latitude = points.reduce((total, point) => total + point[1], 0) / points.length * Math.PI / 180;
  const scaleX = earthRadiusMeters * Math.PI / 180 * Math.cos(latitude);
  const scaleY = earthRadiusMeters * Math.PI / 180;
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const next = points[(index + 1) % points.length];
    area += (points[index][0] * scaleX) * (next[1] * scaleY) - (next[0] * scaleX) * (points[index][1] * scaleY);
  }
  return Math.abs(area / 2);
}

function geometryStats(geometry: SpatialGeometry): { lengthMeters: number; areaSqm: number } {
  if (geometry.type === "LineString") return { lengthMeters: lineLength(geometry.coordinates), areaSqm: 0 };
  if (geometry.type === "MultiLineString") return { lengthMeters: Array.isArray(geometry.coordinates) ? geometry.coordinates.reduce((total, line) => total + lineLength(line), 0) : 0, areaSqm: 0 };
  if (geometry.type === "Polygon") {
    const rings = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
    return { lengthMeters: 0, areaSqm: Math.max(0, ringArea(rings[0]) - rings.slice(1).reduce((total, ring) => total + ringArea(ring), 0)) };
  }
  if (geometry.type === "MultiPolygon") {
    const polygons = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
    return polygons.reduce((total, polygon) => {
      const rings = Array.isArray(polygon) ? polygon : [];
      return { lengthMeters: total.lengthMeters, areaSqm: total.areaSqm + Math.max(0, ringArea(rings[0]) - rings.slice(1).reduce((sum, ring) => sum + ringArea(ring), 0)) };
    }, { lengthMeters: 0, areaSqm: 0 });
  }
  return { lengthMeters: 0, areaSqm: 0 };
}

export type SpatialLayerSummary = {
  featureCount: number;
  geometryTypes: string;
  totalLengthMeters: number;
  totalAreaSqm: number;
  densityPerSqKm: number;
  propertyCount: number;
};

export function summarizeSpatialLayer(layer: SpatialLayer, radiusMeters: number): SpatialLayerSummary {
  const stats = layer.features.reduce((total: { lengthMeters: number; areaSqm: number }, feature: SpatialFeature) => {
    const next = geometryStats(feature.geometry);
    return { lengthMeters: total.lengthMeters + next.lengthMeters, areaSqm: total.areaSqm + next.areaSqm };
  }, { lengthMeters: 0, areaSqm: 0 });
  const radiusKm = Math.max(0.05, Math.min(3, radiusMeters) / 1000);
  const contextAreaSqKm = Math.PI * radiusKm ** 2;
  return { featureCount: layer.features.length, geometryTypes: Array.from(new Set(layer.features.map(feature => feature.geometry.type))).join(", ") || "미확인", totalLengthMeters: stats.lengthMeters, totalAreaSqm: stats.areaSqm, densityPerSqKm: layer.features.length / contextAreaSqKm, propertyCount: new Set(layer.features.flatMap(feature => Object.keys(feature.properties))).size };
}
