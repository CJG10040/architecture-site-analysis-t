import type { BoundaryPoint } from "./model";

const earthRadius = 6_371_000;
const radians = (value: number) => value * Math.PI / 180;

export function boundaryGeoJson(points: BoundaryPoint[]) {
  if (points.length < 3) return null;
  const ring = points.map(point => [point.lng, point.lat]);
  ring.push([points[0].lng, points[0].lat]);
  return { type: "Polygon" as const, coordinates: [ring] };
}

export function boundaryMetrics(points: BoundaryPoint[]) {
  if (points.length < 3) return { areaSqm: 0, perimeterMeters: 0 };
  let perimeterMeters = 0;
  for (let index = 0; index < points.length; index += 1) {
    const from = points[index];
    const to = points[(index + 1) % points.length];
    const dLat = radians(to.lat - from.lat);
    const dLng = radians(to.lng - from.lng);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(dLng / 2) ** 2;
    perimeterMeters += 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  const meanLat = points.reduce((sum, point) => sum + point.lat, 0) / points.length;
  const coordinates = points.map(point => ({ x: radians(point.lng) * earthRadius * Math.cos(radians(meanLat)), y: radians(point.lat) * earthRadius }));
  const doubledArea = coordinates.reduce((sum, point, index) => {
    const next = coordinates[(index + 1) % coordinates.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0);
  return { areaSqm: Math.abs(doubledArea) / 2, perimeterMeters };
}

export function distanceMeters(from: BoundaryPoint, to: BoundaryPoint) {
  const dLat = radians(to.lat - from.lat);
  const dLng = radians(to.lng - from.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
