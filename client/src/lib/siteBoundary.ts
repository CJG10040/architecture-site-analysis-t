export type BoundaryPoint = { lat: number; lng: number };
export type BoundaryMetrics = { vertices: number; areaSqMeters: number; perimeterMeters: number; centroid: BoundaryPoint };

const earthRadiusMeters = 6_371_008.8;
const radians = (value: number) => (value * Math.PI) / 180;

function haversineMeters(a: BoundaryPoint, b: BoundaryPoint) {
  const dLat = radians(b.lat - a.lat);
  const dLng = radians(b.lng - a.lng);
  const latA = radians(a.lat);
  const latB = radians(b.lat);
  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(Math.sin(dLat / 2) ** 2 + Math.cos(latA) * Math.cos(latB) * Math.sin(dLng / 2) ** 2));
}

export function createBoundaryGeoJson(points: BoundaryPoint[]) {
  const ring = points.map(point => [point.lng, point.lat]);
  if (ring.length > 0) ring.push([...ring[0]]);
  return JSON.stringify({ type: "Feature", properties: { source: "user_drawn_boundary", coordinateReferenceSystem: "WGS84" }, geometry: { type: "Polygon", coordinates: [ring] } });
}

export function parseBoundaryGeoJson(value?: string | null): BoundaryPoint[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as { type?: string; geometry?: { type?: string; coordinates?: number[][][] }; coordinates?: number[][][] };
    const coordinates = parsed.type === "Feature" ? parsed.geometry?.coordinates?.[0] : parsed.coordinates?.[0];
    if (!coordinates?.length) return [];
    const points = coordinates.map(([lng, lat]) => ({ lat: Number(lat), lng: Number(lng) })).filter(point => Number.isFinite(point.lat) && Number.isFinite(point.lng));
    return points.length > 1 && points[0].lat === points.at(-1)?.lat && points[0].lng === points.at(-1)?.lng ? points.slice(0, -1) : points;
  } catch {
    return [];
  }
}

export function getBoundaryMetrics(value?: string | null): BoundaryMetrics | null {
  const points = parseBoundaryGeoJson(value);
  if (points.length < 3) return null;
  const referenceLatitude = points.reduce((sum, point) => sum + point.lat, 0) / points.length;
  const metersPerDegreeLat = 111_132;
  const metersPerDegreeLng = 111_320 * Math.cos(radians(referenceLatitude));
  const projected = points.map(point => ({ x: point.lng * metersPerDegreeLng, y: point.lat * metersPerDegreeLat }));
  const area = Math.abs(projected.reduce((sum, point, index) => {
    const next = projected[(index + 1) % projected.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0) / 2);
  const perimeter = points.reduce((sum, point, index) => sum + haversineMeters(point, points[(index + 1) % points.length]), 0);
  const bounds = points.reduce((value, point) => ({ minLat: Math.min(value.minLat, point.lat), maxLat: Math.max(value.maxLat, point.lat), minLng: Math.min(value.minLng, point.lng), maxLng: Math.max(value.maxLng, point.lng) }), { minLat: points[0].lat, maxLat: points[0].lat, minLng: points[0].lng, maxLng: points[0].lng });
  return { vertices: points.length, areaSqMeters: area, perimeterMeters: perimeter, centroid: { lat: (bounds.minLat + bounds.maxLat) / 2, lng: (bounds.minLng + bounds.maxLng) / 2 } };
}
