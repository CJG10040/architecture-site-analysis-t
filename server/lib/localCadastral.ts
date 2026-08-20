import { gunzipSync } from "node:zlib";
import * as db from "../db";

type Position = [number, number];
export type Geometry = { type: "Polygon" | "MultiPolygon"; coordinates: Position[][] | Position[][][] };
type LocalParcelRecord = Awaited<ReturnType<typeof db.findActiveCadastralParcelsNearPoint>>[number];

const earthRadiusMeters = 6_371_008.8;
const radians = (value: number) => (value * Math.PI) / 180;

function ringLengthMeters(ring: Position[]) {
  return ring.reduce((total, [longitude, latitude], index) => {
    const [nextLongitude, nextLatitude] = ring[(index + 1) % ring.length] ?? [longitude, latitude];
    const dLatitude = radians(nextLatitude - latitude);
    const dLongitude = radians(nextLongitude - longitude);
    const a = Math.sin(dLatitude / 2) ** 2 + Math.cos(radians(latitude)) * Math.cos(radians(nextLatitude)) * Math.sin(dLongitude / 2) ** 2;
    return total + 2 * earthRadiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }, 0);
}

function bearingDegrees(from: Position, to: Position) {
  const [fromLongitude, fromLatitude] = from;
  const [toLongitude, toLatitude] = to;
  const longitudeDifference = radians(toLongitude - fromLongitude);
  const fromLatitudeRadians = radians(fromLatitude);
  const toLatitudeRadians = radians(toLatitude);
  return (((Math.atan2(Math.sin(longitudeDifference) * Math.cos(toLatitudeRadians), Math.cos(fromLatitudeRadians) * Math.sin(toLatitudeRadians) - Math.sin(fromLatitudeRadians) * Math.cos(toLatitudeRadians) * Math.cos(longitudeDifference)) * 180) / Math.PI) + 360) % 360;
}

function compassLabel(degrees: number) {
  return ["북", "북동", "동", "남동", "남", "남서", "서", "북서"][Math.round(degrees / 45) % 8];
}

function ringAreaSqMeters(ring: Position[]) {
  if (ring.length < 3) return 0;
  const referenceLatitude = ring.reduce((total, [, latitude]) => total + latitude, 0) / ring.length;
  const metersPerDegreeLatitude = 111_132;
  const metersPerDegreeLongitude = 111_320 * Math.cos(radians(referenceLatitude));
  return Math.abs(ring.reduce((total, [longitude, latitude], index) => {
    const [nextLongitude, nextLatitude] = ring[(index + 1) % ring.length] ?? [longitude, latitude];
    return total + longitude * metersPerDegreeLongitude * nextLatitude * metersPerDegreeLatitude - nextLongitude * metersPerDegreeLongitude * latitude * metersPerDegreeLatitude;
  }, 0) / 2);
}

function polygonRings(geometry: Geometry) {
  return geometry.type === "Polygon" ? [geometry.coordinates as Position[][]] : geometry.coordinates as Position[][][];
}

export function getLocalGeometryMetrics(geometry: Geometry) {
  const polygons = polygonRings(geometry);
  const exteriorRings = polygons.map(polygon => polygon[0] ?? []).filter(ring => ring.length >= 3);
  const positions = exteriorRings.flat();
  if (!positions.length) return null;
  const areaSqMeters = polygons.reduce((total, polygon) => total + ringAreaSqMeters(polygon[0] ?? []) - polygon.slice(1).reduce((holes, ring) => holes + ringAreaSqMeters(ring), 0), 0);
  const perimeterMeters = exteriorRings.reduce((total, ring) => total + ringLengthMeters(ring), 0);
  const longestEdge = exteriorRings.flatMap(ring => ring.map((point, index) => {
    const next = ring[(index + 1) % ring.length] ?? point;
    return { lengthMeters: ringLengthMeters([point, next]), bearingDegrees: bearingDegrees(point, next) };
  })).sort((a, b) => b.lengthMeters - a.lengthMeters)[0];
  const bounds = positions.reduce((current, [longitude, latitude]) => ({ minLongitude: Math.min(current.minLongitude, longitude), minLatitude: Math.min(current.minLatitude, latitude), maxLongitude: Math.max(current.maxLongitude, longitude), maxLatitude: Math.max(current.maxLatitude, latitude) }), { minLongitude: positions[0][0], minLatitude: positions[0][1], maxLongitude: positions[0][0], maxLatitude: positions[0][1] });
  return { areaSqMeters: Math.abs(areaSqMeters), perimeterMeters, centroid: { latitude: (bounds.minLatitude + bounds.maxLatitude) / 2, longitude: (bounds.minLongitude + bounds.maxLongitude) / 2 }, longestEdge: longestEdge ? { ...longestEdge, direction: compassLabel(longestEdge.bearingDegrees) } : undefined };
}

export function pointInRing(point: Position, ring: Position[]) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [x, y] = ring[index];
    const [previousX, previousY] = ring[previous];
    const intersects = ((y > point[1]) !== (previousY > point[1])) && point[0] < ((previousX - x) * (point[1] - y)) / (previousY - y) + x;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function pointInPolygon(point: Position, polygon: Position[][]) {
  return pointInRing(point, polygon[0] ?? []) && !polygon.slice(1).some(ring => pointInRing(point, ring));
}

export function includesPoint(geometry: Geometry, point: Position) {
  return geometry.type === "Polygon" ? pointInPolygon(point, geometry.coordinates as Position[][]) : (geometry.coordinates as Position[][][]).some(polygon => pointInPolygon(point, polygon));
}

function unpackGeometry(value: string) {
  return JSON.parse(gunzipSync(Buffer.from(value, "base64")).toString("utf8")) as Geometry;
}

function toCandidate(row: LocalParcelRecord, geometry: Geometry) {
  const metrics = getLocalGeometryMetrics(geometry);
  return { pnu: row.pnu, parcelNumber: row.jibun ?? undefined, landCategory: row.landIndicator ?? undefined, officialAreaSqm: metrics ? Math.round(metrics.areaSqMeters).toString() : undefined, boundaryGeoJson: JSON.stringify({ type: "Feature", properties: { PNU: row.pnu, JIBUN: row.jibun, BCHK: row.landIndicator, COL_ADM_SE: row.localAdminCode }, geometry }), sourceProvider: "사용자 제공 광주 연속지적도", sourceLayer: `LSMD_CONT_LDREG / ${row.districtName}`, sourceUrl: row.sourceFileUrl ?? undefined, sourceUpdatedAt: row.datasetReference, districtName: row.districtName, metrics };
}

export async function findLocalCadastralCandidates(input: { latitude: number; longitude: number }) {
  const rows = await db.findActiveCadastralParcelsAtPoint(input.latitude, input.longitude);
  const point: Position = [input.longitude, input.latitude];
  return rows.flatMap(row => {
    try {
      const geometry = unpackGeometry(row.geometryGzipBase64);
      if (!includesPoint(geometry, point)) return [];
      return [toCandidate(row, geometry)];
    } catch {
      return [];
    }
  });
}

export async function findLocalCadastralContext(input: { latitude: number; longitude: number; selectedPnu?: string | null; radiusMeters?: number }) {
  const rows = await db.findActiveCadastralParcelsNearPoint(input.latitude, input.longitude, input.radiusMeters ?? 80);
  let selected: ReturnType<typeof toCandidate> | undefined;
  const nearby = rows.flatMap(row => {
    try {
      const geometry = unpackGeometry(row.geometryGzipBase64);
      const candidate = toCandidate(row, geometry);
      if (row.pnu === input.selectedPnu) { selected = candidate; return []; }
      const centroid = candidate.metrics?.centroid;
      if (!centroid) return [];
      const distanceMeters = Math.round(db.haversineMeters({ latitude: input.latitude, longitude: input.longitude }, centroid));
      return [{ ...candidate, distanceMeters }];
    } catch {
      return [];
    }
  }).sort((a, b) => a.distanceMeters - b.distanceMeters);
  const first = nearby[0];
  const sourceCandidate = selected ?? first;
  return { selected, candidates: nearby.slice(0, 12), nearbyCount: nearby.length, source: sourceCandidate ? { provider: sourceCandidate.sourceProvider, layer: sourceCandidate.sourceLayer, updatedAt: sourceCandidate.sourceUpdatedAt } : undefined };
}
