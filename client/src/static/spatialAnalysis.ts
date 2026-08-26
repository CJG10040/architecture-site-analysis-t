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

const propertyValue = (feature: SpatialFeature, keys: string[]) => keys.map(key => Object.entries(feature.properties).find(([name]) => name.toLowerCase() === key.toLowerCase())?.[1]).find(value => value !== undefined && value !== null && String(value).trim() !== "");
const numericProperty = (feature: SpatialFeature, keys: string[]) => { const value = propertyValue(feature, keys); if (value === undefined) return null; const number = Number(String(value).replace(/,/g, "")); return Number.isFinite(number) ? number : null; };
const roadRankLabels: Record<string, string> = { "101": "고속국도", "102": "도시고속국도", "103": "일반국도", "104": "특별·광역시도", "105": "국가지원지방도", "106": "지방도", "107": "시·군도", "108": "기타" };
const roadCategory = (feature: SpatialFeature) => { const rank = String(propertyValue(feature, ["ROAD_RANK", "road_rank", "ROAD_RANK_CD", "road_rank_cd"]) ?? ""); const type = String(propertyValue(feature, ["ROAD_TYPE", "road_type", "LINK_TYPE", "link_type"]) ?? "").toLowerCase(); const text = String(propertyValue(feature, ["ROAD_NAME", "road_name", "ROAD_NM", "road_nm", "ROAD_TYPE_NM", "road_type_nm", "ROAD_RANK_NM", "road_rank_nm"]) ?? "").toLowerCase(); if (["101", "102"].includes(rank) || /고속|자동차전용/.test(`${type} ${text}`)) return "고속·자동차전용"; if (["103", "104"].includes(rank) || /주간선|간선|대로|광역/.test(`${type} ${text}`)) return "주간선·대로"; if (["105", "106"].includes(rank) || /보조간선|집산|중로/.test(`${type} ${text}`)) return "보조간선·집산"; if (rank === "107" || /국지|생활|이면|소로/.test(`${type} ${text}`)) return "국지·생활도로"; if (/보행|골목|보도/.test(`${type} ${text}`)) return "보행·골목"; return "기타·미분류"; };
const roadWidth = (feature: SpatialFeature) => { const attribute = numericProperty(feature, ["ROAD_WIDTH", "road_width", "WIDTH", "width", "ROAD_WID", "road_wid", "RD_WIDTH", "road_width_m"]); if (attribute !== null && attribute > 0) return { value: attribute, source: "속성" as const }; const lanes = numericProperty(feature, ["LANES", "lanes", "LANE", "lane", "차로수"]); if (lanes !== null && lanes > 0) return { value: lanes * 3.25, source: "차로수×3.25m 추정" as const }; return null; };
const roadTraffic = (feature: SpatialFeature) => numericProperty(feature, ["AADT", "aadt", "TRAFFIC", "traffic", "TRAFFIC_VOLUME", "traffic_volume", "VOL", "volume", "교통량"]);

export type RoadAnalysis = {
  featureCount: number;
  categoryCounts: Record<string, number>;
  rankCounts: Record<string, number>;
  widthAttributeCount: number;
  widthEstimatedCount: number;
  widthUnknownCount: number;
  laneKnownCount: number;
  trafficAttributeCount: number;
  trafficUnknownCount: number;
  averageWidthMeters: number | null;
};

export function analyzeRoadLayer(features: SpatialFeature[]): RoadAnalysis {
  const categoryCounts: Record<string, number> = {}; const rankCounts: Record<string, number> = {}; let widthAttributeCount = 0; let widthEstimatedCount = 0; let widthUnknownCount = 0; let laneKnownCount = 0; let trafficAttributeCount = 0; let widthTotal = 0; let widthCount = 0;
  features.forEach(feature => { const category = roadCategory(feature); categoryCounts[category] = (categoryCounts[category] ?? 0) + 1; const rank = String(propertyValue(feature, ["ROAD_RANK", "road_rank", "ROAD_RANK_CD", "road_rank_cd"]) ?? "미상"); const rankLabel = roadRankLabels[rank] ? `${rank} · ${roadRankLabels[rank]}` : rank; rankCounts[rankLabel] = (rankCounts[rankLabel] ?? 0) + 1; const width = roadWidth(feature); if (!width) widthUnknownCount += 1; else { widthTotal += width.value; widthCount += 1; if (width.source === "속성") widthAttributeCount += 1; else widthEstimatedCount += 1; } if (numericProperty(feature, ["LANES", "lanes", "LANE", "lane", "차로수"]) !== null) laneKnownCount += 1; if (roadTraffic(feature) !== null) trafficAttributeCount += 1; });
  return { featureCount: features.length, categoryCounts, rankCounts, widthAttributeCount, widthEstimatedCount, widthUnknownCount, laneKnownCount, trafficAttributeCount, trafficUnknownCount: Math.max(0, features.length - trafficAttributeCount), averageWidthMeters: widthCount ? widthTotal / widthCount : null };
}

function geometryPoints(geometry: SpatialGeometry): [number, number][] {
  if (geometry.type === "Point") { const point = asPair(geometry.coordinates); return point ? [point] : []; }
  if (geometry.type === "MultiPoint" || geometry.type === "LineString") return Array.isArray(geometry.coordinates) ? geometry.coordinates.map(asPair).filter((point): point is [number, number] => Boolean(point)) : [];
  if (geometry.type === "MultiLineString" || geometry.type === "Polygon") return Array.isArray(geometry.coordinates) ? geometry.coordinates.flatMap(line => Array.isArray(line) ? line.map(asPair).filter((point): point is [number, number] => Boolean(point)) : []) : [];
  if (geometry.type === "MultiPolygon") return Array.isArray(geometry.coordinates) ? geometry.coordinates.flatMap(polygon => Array.isArray(polygon) ? polygon.flatMap(ring => Array.isArray(ring) ? ring.map(asPair).filter((point): point is [number, number] => Boolean(point)) : []) : []) : [];
  if (geometry.type === "GeometryCollection") return Array.isArray(geometry.geometries) ? geometry.geometries.flatMap(item => geometryPoints(item)) : [];
  return [];
}

export type RoadBoundaryRelation = { nearestDistanceMeters: number | null; within30m: number; within60m: number; note: string };

export function roadBoundaryRelation(features: SpatialFeature[], boundary: { lat: number; lng: number }[]): RoadBoundaryRelation {
  if (boundary.length < 3) return { nearestDistanceMeters: null, within30m: 0, within60m: 0, note: "대지 경계가 없어 도로 접면 참고거리를 계산하지 않았습니다." };
  const target = boundary.map(point => [point.lng, point.lat] as [number, number]);
  const distances = features.map(feature => { const points = geometryPoints(feature.geometry); if (!points.length) return null; return Math.min(...points.flatMap(point => target.map(candidate => haversine(point, candidate)))); }).filter((distance): distance is number => distance !== null && Number.isFinite(distance));
  return { nearestDistanceMeters: distances.length ? Math.min(...distances) : null, within30m: distances.filter(distance => distance <= 30).length, within60m: distances.filter(distance => distance <= 60).length, note: "도로 중심선의 대지 경계 꼭짓점까지의 참고거리입니다. 도로 경계·보도·실제 접도 여부를 확정하지 않습니다." };
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
