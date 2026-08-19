import { gunzipSync } from "node:zlib";
import * as db from "../db";

type Position = [number, number];
type Geometry = { type: "Polygon" | "MultiPolygon"; coordinates: Position[][] | Position[][][] };

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

export async function findLocalCadastralCandidates(input: { latitude: number; longitude: number }) {
  const rows = await db.findActiveCadastralParcelsAtPoint(input.latitude, input.longitude);
  const point: Position = [input.longitude, input.latitude];
  return rows.flatMap(row => {
    try {
      const geometry = unpackGeometry(row.geometryGzipBase64);
      if (!includesPoint(geometry, point)) return [];
      return [{ pnu: row.pnu, parcelNumber: row.jibun ?? undefined, landCategory: row.landIndicator ?? undefined, officialAreaSqm: undefined, boundaryGeoJson: JSON.stringify({ type: "Feature", properties: { PNU: row.pnu, JIBUN: row.jibun, BCHK: row.landIndicator, COL_ADM_SE: row.localAdminCode }, geometry }), sourceProvider: "사용자 제공 광주 연속지적도", sourceLayer: `LSMD_CONT_LDREG / ${row.districtName}`, sourceUrl: row.sourceFileUrl ?? undefined, sourceUpdatedAt: row.datasetReference, districtName: row.districtName }];
    } catch {
      return [];
    }
  });
}
