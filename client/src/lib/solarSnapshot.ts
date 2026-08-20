import type { SolarAnalysisResult, SolarMoment } from "@shared/solarAnalysis";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isSolarMoment(value: unknown): value is SolarMoment {
  return isRecord(value)
    && typeof value.label === "string"
    && ["spring_autumn_equinox", "summer_solstice", "winter_solstice"].includes(String(value.season))
    && typeof value.localDate === "string"
    && typeof value.localTime === "string"
    && isFiniteNumber(value.solarAzimuthDegrees)
    && isFiniteNumber(value.solarElevationDegrees)
    && isFiniteNumber(value.shadowBearingDegrees)
    && typeof value.shadowDirection === "string"
    && typeof value.isAboveHorizon === "boolean";
}

/** 잘린 과거 스냅샷이 지도 오버레이 렌더링을 중단시키지 않도록 한다. */
export function parseSolarAnalysisSnapshot(serializedPayload: string | null | undefined): SolarAnalysisResult | null {
  if (!serializedPayload) return null;
  try {
    const parsed: unknown = JSON.parse(serializedPayload);
    if (!isRecord(parsed) || !isRecord(parsed.source) || !isRecord(parsed.location) || !Array.isArray(parsed.moments) || !Array.isArray(parsed.limitations)) return null;
    const { source, location, moments, limitations } = parsed;
    if (typeof source.provider !== "string" || typeof source.basis !== "string" || typeof source.sourceUrl !== "string" || typeof source.timeZone !== "string" || typeof source.calculatedAt !== "string") return null;
    if (!isFiniteNumber(location.latitude) || !isFiniteNumber(location.longitude) || !moments.every(isSolarMoment) || !limitations.every(item => typeof item === "string")) return null;
    return parsed as SolarAnalysisResult;
  } catch {
    return null;
  }
}
