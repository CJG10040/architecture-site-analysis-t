import type { SolarAnalysisResult, SolarMoment } from "../../shared/solarAnalysis";

const degreesToRadians = (value: number) => value * Math.PI / 180;
const radiansToDegrees = (value: number) => value * 180 / Math.PI;
const clamp = (value: number) => Math.max(-1, Math.min(1, value));

export class SolarAnalysisError extends Error {}

function dayOfYear(year: number, month: number, day: number) {
  return Math.floor((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 0)) / 86_400_000);
}

function directionLabel(bearing: number) {
  return ["북", "북동", "동", "남동", "남", "남서", "서", "북서"][Math.round(bearing / 45) % 8];
}

export function calculateSolarPosition(input: { latitude: number; longitude: number; year: number; month: number; day: number; hour: number; minute?: number; timeZoneOffsetHours?: number }) {
  const { latitude, longitude, year, month, day, hour, minute = 0, timeZoneOffsetHours = 9 } = input;
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new SolarAnalysisError("일조 분석 좌표가 유효하지 않습니다.");
  const gamma = 2 * Math.PI / 365 * (dayOfYear(year, month, day) - 1 + (hour - 12) / 24 + minute / 1440);
  const equationOfTime = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
  const declination = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma) - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);
  const trueSolarMinutes = ((hour * 60 + minute + equationOfTime + 4 * longitude - 60 * timeZoneOffsetHours) % 1440 + 1440) % 1440;
  const hourAngle = degreesToRadians(trueSolarMinutes / 4 - 180);
  const latitudeRadians = degreesToRadians(latitude);
  const cosineZenith = clamp(Math.sin(latitudeRadians) * Math.sin(declination) + Math.cos(latitudeRadians) * Math.cos(declination) * Math.cos(hourAngle));
  const zenith = Math.acos(cosineZenith);
  const elevation = 90 - radiansToDegrees(zenith);
  const azimuth = (radiansToDegrees(Math.atan2(Math.sin(hourAngle), Math.cos(hourAngle) * Math.sin(latitudeRadians) - Math.tan(declination) * Math.cos(latitudeRadians))) + 180 + 360) % 360;
  return { solarAzimuthDegrees: azimuth, solarElevationDegrees: elevation, shadowBearingDegrees: (azimuth + 180) % 360, isAboveHorizon: elevation > 0 };
}

const representativeMoments = [
  { season: "spring_autumn_equinox" as const, label: "춘·추분", month: 3, day: 21 },
  { season: "summer_solstice" as const, label: "하지", month: 6, day: 21 },
  { season: "winter_solstice" as const, label: "동지", month: 12, day: 21 },
];

export function analyzeSolarAccess(input: { latitude: number; longitude: number; year?: number }): SolarAnalysisResult {
  const year = input.year ?? new Date().getUTCFullYear();
  const moments: SolarMoment[] = representativeMoments.flatMap(reference => [9, 12, 15].map(hour => {
    const result = calculateSolarPosition({ ...input, year, month: reference.month, day: reference.day, hour, timeZoneOffsetHours: 9 });
    return { label: reference.label, season: reference.season, localDate: `${year}-${String(reference.month).padStart(2, "0")}-${String(reference.day).padStart(2, "0")}`, localTime: `${String(hour).padStart(2, "0")}:00`, ...result, shadowDirection: directionLabel(result.shadowBearingDegrees) };
  }));
  return { source: { provider: "NOAA solar geometry approximation", basis: "NOAA solar position equations", sourceUrl: "https://gml.noaa.gov/grad/solcalc/azel.html", timeZone: "Asia/Seoul (UTC+09:00)", calculatedAt: new Date().toISOString() }, location: { latitude: input.latitude, longitude: input.longitude }, moments, limitations: ["태양 위치의 기하학적 계산입니다. 인접 건물·수목·지형·구름에 의한 실제 일조 차폐는 반영하지 않습니다.", "법정 일조권, 실제 일조시간, 에너지 성능 또는 인허가 기준을 판정하지 않습니다.", "대표일(춘·추분, 하지, 동지)의 09:00·12:00·15:00 한국 표준시를 비교합니다."] };
}
