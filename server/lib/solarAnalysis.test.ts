import { describe, expect, it } from "vitest";
import { analyzeSolarAccess, calculateSolarPosition } from "./solarAnalysis";

describe("일조·일영 분석", () => {
  it("광주 하지 12시에는 태양이 남동~남쪽 높은 고도에 있고 그림자는 반대 방향으로 향한다", () => {
    const result = calculateSolarPosition({ latitude: 35.1467, longitude: 126.921, year: 2026, month: 6, day: 21, hour: 12, timeZoneOffsetHours: 9 });
    expect(result.isAboveHorizon).toBe(true);
    expect(result.solarElevationDegrees).toBeGreaterThan(65);
    expect(result.solarAzimuthDegrees).toBeGreaterThan(130);
    expect(result.solarAzimuthDegrees).toBeLessThan(210);
    expect(result.shadowBearingDegrees).toBeGreaterThan(300);
  });

  it("춘·추분·하지·동지의 09·12·15시 비교 표본과 분석 한계를 만든다", () => {
    const result = analyzeSolarAccess({ latitude: 35.1467, longitude: 126.921, year: 2026 });
    expect(result.moments).toHaveLength(9);
    expect(result.moments.filter(item => item.label === "동지")).toHaveLength(3);
    expect(result.moments.find(item => item.label === "하지" && item.localTime === "12:00")?.solarElevationDegrees).toBeGreaterThan(result.moments.find(item => item.label === "동지" && item.localTime === "12:00")?.solarElevationDegrees ?? 0);
    expect(result.limitations.join(" ")).toContain("차폐");
  });
});
