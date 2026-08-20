import type { TerrainAnalysisResult, TerrainProfilePoint } from "@shared/terrainAnalysis";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isProfilePoint(value: unknown): value is TerrainProfilePoint {
  return isRecord(value)
    && isFiniteNumber(value.latitude)
    && isFiniteNumber(value.longitude)
    && isFiniteNumber(value.elevationMeters)
    && isFiniteNumber(value.distanceMeters);
}

/** 오래되었거나 잘린 DB 스냅샷을 지도·카드 렌더링 전에 확인한다. */
export function isTerrainAnalysisResult(value: unknown): value is TerrainAnalysisResult {
  if (!isRecord(value) || !isRecord(value.source) || !isRecord(value.elevation) || !isRecord(value.slope) || !isRecord(value.section)) return false;
  const { source, elevation, slope, section } = value;
  return typeof source.provider === "string"
    && typeof source.dataset === "string"
    && isFiniteNumber(source.resolutionMeters)
    && typeof source.sourceUrl === "string"
    && typeof source.requestedAt === "string"
    && isFiniteNumber(value.sampleCount)
    && isFiniteNumber(elevation.minimumMeters)
    && isFiniteNumber(elevation.maximumMeters)
    && isFiniteNumber(elevation.meanMeters)
    && isFiniteNumber(elevation.rangeMeters)
    && isFiniteNumber(slope.degrees)
    && isFiniteNumber(slope.percent)
    && isFiniteNumber(slope.downhillBearingDegrees)
    && typeof slope.downhillDirection === "string"
    && ["flat", "gentle", "moderate", "steep"].includes(String(slope.classification))
    && ["east_west", "north_south"].includes(String(section.axis))
    && typeof section.label === "string"
    && Array.isArray(section.points)
    && section.points.every(isProfilePoint)
    && Array.isArray(value.limitations)
    && value.limitations.every(item => typeof item === "string");
}

export function parseTerrainAnalysisSnapshot(serializedPayload: string | null | undefined): TerrainAnalysisResult | null {
  if (!serializedPayload) return null;
  try {
    const parsed: unknown = JSON.parse(serializedPayload);
    return isTerrainAnalysisResult(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
