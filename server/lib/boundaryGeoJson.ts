type Position = [number, number];

type PolygonGeometry = { type: "Polygon"; coordinates: Position[][] };
type GeoJsonBoundary = PolygonGeometry | { type: "Feature"; geometry: PolygonGeometry | null; properties?: Record<string, unknown> };

function samePosition(a: Position, b: Position) {
  return a[0] === b[0] && a[1] === b[1];
}

export function normalizeBoundaryGeoJson(value?: string) {
  if (!value?.trim()) return undefined;
  let parsed: GeoJsonBoundary;
  try {
    parsed = JSON.parse(value) as GeoJsonBoundary;
  } catch {
    throw new Error("대지 경계는 유효한 GeoJSON 문자열이어야 합니다.");
  }

  const geometry = parsed.type === "Feature" ? parsed.geometry : parsed;
  if (!geometry || geometry.type !== "Polygon" || !Array.isArray(geometry.coordinates?.[0])) {
    throw new Error("대지 경계는 하나의 Polygon GeoJSON이어야 합니다.");
  }

  const ring = geometry.coordinates[0].map((position): Position => [Number(position?.[0]), Number(position?.[1])]);
  if (ring.length < 3 || ring.some(([longitude, latitude]) => !Number.isFinite(longitude) || !Number.isFinite(latitude) || longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90)) {
    throw new Error("대지 경계에는 유효한 경도·위도 좌표가 최소 3개 필요합니다.");
  }

  const closedRing = samePosition(ring[0], ring[ring.length - 1]) ? ring : [...ring, ring[0]];
  const uniqueVertices = new Set(closedRing.slice(0, -1).map(([longitude, latitude]) => `${longitude},${latitude}`));
  if (uniqueVertices.size < 3) throw new Error("대지 경계에는 서로 다른 정점이 최소 3개 필요합니다.");

  return JSON.stringify({
    type: "Feature",
    properties: { source: "user_drawn_boundary", coordinateReferenceSystem: "WGS84" },
    geometry: { type: "Polygon", coordinates: [closedRing] },
  });
}
