import type { TerrainAnalysisResult, TerrainCoordinate, TerrainProfilePoint, TerrainSample } from "../../shared/terrainAnalysis";

type BoundaryPoint = TerrainCoordinate;
type TerrainSamplingPlan = { surfaceLocations: TerrainCoordinate[]; crossSectionLocations: TerrainCoordinate[]; axis: "east_west" | "north_south"; label: string; center: TerrainCoordinate };

const OPEN_METEO_ELEVATION_URL = "https://api.open-meteo.com/v1/elevation";
const metersPerDegreeLatitude = 111_132;
const radians = (value: number) => (value * Math.PI) / 180;
const MAX_BOUNDARY_ELEVATION_SAMPLES = 20;

export class TerrainAnalysisError extends Error {}

export function buildTerrainFallbackBoundary(center: TerrainCoordinate, halfSpanMeters = 75) {
  if (!Number.isFinite(center.latitude) || !Number.isFinite(center.longitude) || center.latitude < -90 || center.latitude > 90 || center.longitude < -180 || center.longitude > 180) throw new TerrainAnalysisError("대지 중심 좌표가 유효하지 않아 지형 분석 범위를 만들지 못했습니다.");
  const latitudeDelta = halfSpanMeters / metersPerDegreeLatitude;
  const longitudeDelta = halfSpanMeters / Math.max(111_320 * Math.cos(radians(center.latitude)), 1);
  const ring = [
    [center.longitude - longitudeDelta, center.latitude - latitudeDelta],
    [center.longitude + longitudeDelta, center.latitude - latitudeDelta],
    [center.longitude + longitudeDelta, center.latitude + latitudeDelta],
    [center.longitude - longitudeDelta, center.latitude + latitudeDelta],
    [center.longitude - longitudeDelta, center.latitude - latitudeDelta],
  ];
  return JSON.stringify({ type: "Feature", properties: { analysisExtent: "site_center_fallback", halfSpanMeters }, geometry: { type: "Polygon", coordinates: [ring] } });
}

function parseBoundary(value: string): BoundaryPoint[] {
  try {
    const parsed = JSON.parse(value) as { type?: string; geometry?: { type?: string; coordinates?: number[][][] }; coordinates?: number[][][] };
    const coordinates = parsed.type === "Feature" ? parsed.geometry?.coordinates?.[0] : parsed.coordinates?.[0];
    const points = (coordinates ?? []).map(([longitude, latitude]) => ({ latitude: Number(latitude), longitude: Number(longitude) })).filter(point => Number.isFinite(point.latitude) && Number.isFinite(point.longitude));
    const openRing = points.length > 1 && points[0].latitude === points.at(-1)?.latitude && points[0].longitude === points.at(-1)?.longitude ? points.slice(0, -1) : points;
    if (openRing.length < 3) throw new Error("boundary has fewer than three valid points");
    return openRing;
  } catch {
    throw new TerrainAnalysisError("지형 분석을 하려면 먼저 유효한 대지 경계를 저장해야 합니다.");
  }
}

function boundsOf(points: BoundaryPoint[]) {
  return points.reduce((bounds, point) => ({ minLatitude: Math.min(bounds.minLatitude, point.latitude), maxLatitude: Math.max(bounds.maxLatitude, point.latitude), minLongitude: Math.min(bounds.minLongitude, point.longitude), maxLongitude: Math.max(bounds.maxLongitude, point.longitude) }), { minLatitude: points[0].latitude, maxLatitude: points[0].latitude, minLongitude: points[0].longitude, maxLongitude: points[0].longitude });
}

function evenlySampleBoundary(points: BoundaryPoint[], maximum = MAX_BOUNDARY_ELEVATION_SAMPLES) {
  if (points.length <= maximum) return points;
  return Array.from({ length: maximum }, (_, index) => points[Math.round(index * (points.length - 1) / (maximum - 1))]);
}

export function buildTerrainSamplingPlan(boundaryGeoJson: string): TerrainSamplingPlan {
  const boundary = parseBoundary(boundaryGeoJson);
  const bounds = boundsOf(boundary);
  const center = { latitude: (bounds.minLatitude + bounds.maxLatitude) / 2, longitude: (bounds.minLongitude + bounds.maxLongitude) / 2 };
  const longitudeSpanMeters = (bounds.maxLongitude - bounds.minLongitude) * 111_320 * Math.cos(radians(center.latitude));
  const latitudeSpanMeters = (bounds.maxLatitude - bounds.minLatitude) * metersPerDegreeLatitude;
  const axis = longitudeSpanMeters >= latitudeSpanMeters ? "east_west" as const : "north_south" as const;
  const fractions = [0.15, 0.5, 0.85];
  const grid = fractions.flatMap(latitudeFraction => fractions.map(longitudeFraction => ({ latitude: bounds.minLatitude + (bounds.maxLatitude - bounds.minLatitude) * latitudeFraction, longitude: bounds.minLongitude + (bounds.maxLongitude - bounds.minLongitude) * longitudeFraction })));
  const crossSectionLocations = Array.from({ length: 11 }, (_, index) => {
    const fraction = index / 10;
    return axis === "east_west" ? { latitude: center.latitude, longitude: bounds.minLongitude + (bounds.maxLongitude - bounds.minLongitude) * fraction } : { latitude: bounds.minLatitude + (bounds.maxLatitude - bounds.minLatitude) * fraction, longitude: center.longitude };
  });
  return { surfaceLocations: [...evenlySampleBoundary(boundary), ...grid], crossSectionLocations, axis, label: axis === "east_west" ? "대지 장축 단면 · 동서" : "대지 장축 단면 · 남북", center };
}

function compassLabel(bearingDegrees: number) {
  return ["북", "북동", "동", "남동", "남", "남서", "서", "북서"][Math.round(bearingDegrees / 45) % 8];
}

function haversineMeters(first: TerrainCoordinate, second: TerrainCoordinate) {
  const latitudeDelta = radians(second.latitude - first.latitude);
  const longitudeDelta = radians(second.longitude - first.longitude);
  const a = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(radians(first.latitude)) * Math.cos(radians(second.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * 6_371_008.8 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fitPlaneSlope(samples: TerrainSample, rest: TerrainSample[] = []) {
  const values = [samples, ...rest];
  const centerLatitude = values.reduce((sum, item) => sum + item.latitude, 0) / values.length;
  const centerLongitude = values.reduce((sum, item) => sum + item.longitude, 0) / values.length;
  const longitudeScale = 111_320 * Math.cos(radians(centerLatitude));
  const coordinates = values.map(item => ({ x: (item.longitude - centerLongitude) * longitudeScale, y: (item.latitude - centerLatitude) * metersPerDegreeLatitude, z: item.elevationMeters }));
  const sums = coordinates.reduce<{ xx: number; yy: number; xy: number; xz: number; yz: number }>((total, item) => ({ xx: total.xx + item.x * item.x, yy: total.yy + item.y * item.y, xy: total.xy + item.x * item.y, xz: total.xz + item.x * item.z, yz: total.yz + item.y * item.z }), { xx: 0, yy: 0, xy: 0, xz: 0, yz: 0 });
  const determinant = sums.xx * sums.yy - sums.xy ** 2;
  if (Math.abs(determinant) < 1e-8) return { degrees: 0, percent: 0, downhillBearingDegrees: 0, downhillDirection: "북" };
  const slopeX = (sums.xz * sums.yy - sums.xy * sums.yz) / determinant;
  const slopeY = (sums.xx * sums.yz - sums.xy * sums.xz) / determinant;
  const gradient = Math.sqrt(slopeX ** 2 + slopeY ** 2);
  const downhillBearingDegrees = (Math.atan2(-slopeX, -slopeY) * 180 / Math.PI + 360) % 360;
  return { degrees: Math.atan(gradient) * 180 / Math.PI, percent: gradient * 100, downhillBearingDegrees, downhillDirection: compassLabel(downhillBearingDegrees) };
}

function slopeClassification(degrees: number): TerrainAnalysisResult["slope"]["classification"] {
  if (degrees < 2) return "flat";
  if (degrees < 8) return "gentle";
  if (degrees < 15) return "moderate";
  return "steep";
}

export function analyzeTerrainPlan(plan: TerrainSamplingPlan, surfaceElevations: number[], sectionElevations: number[]): TerrainAnalysisResult {
  if (surfaceElevations.length !== plan.surfaceLocations.length || sectionElevations.length !== plan.crossSectionLocations.length || [...surfaceElevations, ...sectionElevations].some(value => !Number.isFinite(value))) throw new TerrainAnalysisError("고도 표본이 불완전해 지형 분석을 만들지 못했습니다.");
  const surfaceSamples = plan.surfaceLocations.map((point, index) => ({ ...point, elevationMeters: surfaceElevations[index] }));
  const sectionPoints: TerrainProfilePoint[] = plan.crossSectionLocations.map((point, index) => ({ ...point, elevationMeters: sectionElevations[index], distanceMeters: index === 0 ? 0 : 0 }));
  for (let index = 1; index < sectionPoints.length; index += 1) sectionPoints[index].distanceMeters = sectionPoints[index - 1].distanceMeters + haversineMeters(sectionPoints[index - 1], sectionPoints[index]);
  const elevations = surfaceSamples.map(item => item.elevationMeters);
  const slope = fitPlaneSlope(surfaceSamples[0], surfaceSamples.slice(1));
  return { source: { provider: "Open-Meteo", dataset: "Copernicus DEM 2021 GLO-90", resolutionMeters: 90, sourceUrl: "https://open-meteo.com/en/docs/elevation-api", requestedAt: new Date().toISOString() }, sampleCount: surfaceSamples.length + sectionPoints.length, elevation: { minimumMeters: Math.min(...elevations), maximumMeters: Math.max(...elevations), meanMeters: elevations.reduce((sum, value) => sum + value, 0) / elevations.length, rangeMeters: Math.max(...elevations) - Math.min(...elevations) }, slope: { ...slope, classification: slopeClassification(slope.degrees) }, section: { axis: plan.axis, label: plan.label, points: sectionPoints }, limitations: ["Copernicus DEM GLO-90의 약 90m 해상도 고도 표본입니다.", "도심의 작은 필지에서는 미세 레벨차·옹벽·계단·배수구를 충분히 표현하지 못할 수 있습니다.", "현황측량·경계측량·인허가용 설계 레벨을 대체하지 않습니다."] };
}

async function requestElevations(locations: TerrainCoordinate[]) {
  const url = new URL(OPEN_METEO_ELEVATION_URL);
  url.searchParams.set("latitude", locations.map(item => item.latitude.toFixed(7)).join(","));
  url.searchParams.set("longitude", locations.map(item => item.longitude.toFixed(7)).join(","));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    const body = await response.json() as { elevation?: unknown };
    if (!response.ok || !Array.isArray(body.elevation)) throw new TerrainAnalysisError("공개 고도 데이터원이 현재 지형 표본을 제공하지 못했습니다.");
    const elevations = body.elevation.map(value => Number(value));
    if (elevations.length !== locations.length || elevations.some(value => !Number.isFinite(value))) throw new TerrainAnalysisError("공개 고도 데이터의 표본 형식이 예상과 다릅니다.");
    return elevations;
  } catch (error) {
    if (error instanceof TerrainAnalysisError) throw error;
    throw new TerrainAnalysisError("지형 고도 데이터를 불러오지 못했습니다. 잠시 후 다시 시도하세요.");
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchTerrainAnalysis(boundaryGeoJson: string) {
  const plan = buildTerrainSamplingPlan(boundaryGeoJson);
  const elevations = await requestElevations([...plan.surfaceLocations, ...plan.crossSectionLocations]);
  return analyzeTerrainPlan(plan, elevations.slice(0, plan.surfaceLocations.length), elevations.slice(plan.surfaceLocations.length));
}
