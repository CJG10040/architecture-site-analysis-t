import type { SpatialFeature } from "./model";

export type OsmHydrologyElement = { type?: string; id?: number; tags?: Record<string, string>; geometry?: Array<{ lat?: number; lon?: number }> };

export function osmHydrologyQuery(latitude: number, longitude: number, radiusMeters: number) {
  const radius = Math.min(3000, Math.max(50, radiusMeters));
  const latDelta = radius / 111320;
  const lonDelta = radius / (111320 * Math.max(0.2, Math.cos(latitude * Math.PI / 180)));
  const south = (latitude - latDelta).toFixed(6);
  const west = (longitude - lonDelta).toFixed(6);
  const north = (latitude + latDelta).toFixed(6);
  const east = (longitude + lonDelta).toFixed(6);
  return `[out:json][timeout:25];(way["waterway"](${south},${west},${north},${east});way["natural"="water"](${south},${west},${north},${east}););out tags geom;`;
}

export function normalizeOsmHydrology(payload: unknown): SpatialFeature[] {
  const elements = payload && typeof payload === "object" && Array.isArray((payload as { elements?: unknown }).elements) ? (payload as { elements: OsmHydrologyElement[] }).elements : [];
  const features: SpatialFeature[] = [];
  elements.forEach((element, index) => {
    const points = (element.geometry ?? []).map(point => [Number(point.lon), Number(point.lat)]).filter(point => Number.isFinite(point[0]) && Number.isFinite(point[1]));
    if (points.length < 2) return;
    const tags = element.tags ?? {};
    const isClosed = points.length >= 4 && points[0][0] === points[points.length - 1][0] && points[0][1] === points[points.length - 1][1];
    const geometry: SpatialFeature["geometry"] = isClosed && tags.natural === "water" ? { type: "Polygon", coordinates: [points] } : { type: "LineString", coordinates: points };
    features.push({ id: `osm-${element.type ?? "way"}-${element.id ?? index + 1}`, geometry, properties: { ...tags, _source: "OpenStreetMap Overpass", _osmType: element.type ?? "way", _osmId: element.id ?? index + 1 } });
  });
  return features;
}

export async function fetchOsmHydrology(latitude: number, longitude: number, radiusMeters: number) {
  const query = osmHydrologyQuery(latitude, longitude, radiusMeters);
  const endpoints = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
  let lastError = "OpenStreetMap Overpass 응답 없음";
  for (const endpoint of endpoints) {
    try {
      const url = new URL(endpoint);
      url.searchParams.set("data", query);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Overpass ${response.status} 응답`);
      const payload = await response.json();
      const features = normalizeOsmHydrology(payload);
      return { endpoint, features, raw: payload };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Overpass 요청 실패";
    }
  }
  throw new Error(`${lastError}. 브라우저 CORS 또는 일시적인 서버 제한이면 GeoJSON 원본 파일을 가져오세요.`);
}
