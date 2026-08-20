import { describe, expect, it } from "vitest";
import { parseSolarAnalysisSnapshot } from "./solarSnapshot";

const validSolar = {
  source: { provider: "NOAA", basis: "태양 위치 근사", sourceUrl: "https://gml.noaa.gov", timeZone: "Asia/Seoul", calculatedAt: "2026-08-20T00:00:00.000Z" },
  location: { latitude: 35.1467, longitude: 126.921 },
  moments: [{ label: "동지 정오", season: "winter_solstice", localDate: "2026-12-21", localTime: "12:00", solarAzimuthDegrees: 180, solarElevationDegrees: 30, shadowBearingDegrees: 0, shadowDirection: "북", isAboveHorizon: true }],
  limitations: ["차폐 미포함"],
};

describe("solarSnapshot", () => {
  it("accepts a complete solar analysis snapshot", () => {
    expect(parseSolarAnalysisSnapshot(JSON.stringify(validSolar))?.moments).toHaveLength(1);
  });

  it("rejects a truncated snapshot without moments before map rendering", () => {
    const { moments: _moments, ...withoutMoments } = validSolar;
    expect(parseSolarAnalysisSnapshot(JSON.stringify(withoutMoments))).toBeNull();
  });
});
