import { describe, expect, it } from "vitest";
import { isTerrainAnalysisResult, parseTerrainAnalysisSnapshot } from "./terrainSnapshot";

const validTerrain = {
  source: { provider: "Open-Meteo", dataset: "Copernicus DEM GLO-90", resolutionMeters: 90, sourceUrl: "https://api.open-meteo.com", requestedAt: "2026-08-20T00:00:00.000Z" },
  sampleCount: 11,
  elevation: { minimumMeters: 12, maximumMeters: 20, meanMeters: 16, rangeMeters: 8 },
  slope: { degrees: 4.2, percent: 7.3, downhillBearingDegrees: 180, downhillDirection: "남", classification: "gentle" },
  section: { axis: "north_south", label: "남북 단면", points: [{ latitude: 35.1, longitude: 126.9, elevationMeters: 12, distanceMeters: 0 }] },
  limitations: ["참고용"],
};

describe("terrainSnapshot", () => {
  it("accepts the complete terrain-analysis contract", () => {
    expect(isTerrainAnalysisResult(validTerrain)).toBe(true);
    expect(parseTerrainAnalysisSnapshot(JSON.stringify(validTerrain))?.section.points).toHaveLength(1);
  });

  it("rejects legacy or truncated snapshots without section points", () => {
    const withoutSection = { ...validTerrain, section: undefined };
    const malformedPoints = { ...validTerrain, section: { ...validTerrain.section, points: [{ latitude: 35.1 }] } };
    expect(isTerrainAnalysisResult(withoutSection)).toBe(false);
    expect(parseTerrainAnalysisSnapshot(JSON.stringify(withoutSection))).toBeNull();
    expect(isTerrainAnalysisResult(malformedPoints)).toBe(false);
  });
});
