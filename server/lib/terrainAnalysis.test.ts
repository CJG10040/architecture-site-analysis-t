import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeTerrainPlan, buildTerrainFallbackBoundary, buildTerrainSamplingPlan, fetchTerrainAnalysis } from "./terrainAnalysis";

const boundary = JSON.stringify({ type: "Feature", geometry: { type: "Polygon", coordinates: [[[126.92, 35.14], [126.922, 35.14], [126.922, 35.141], [126.92, 35.141], [126.92, 35.14]]] } });

afterEach(() => vi.unstubAllGlobals());

describe("지형 고도·경사·단면 분석", () => {
  it("경계에서 표본·장축 단면을 만들고 동쪽이 높은 고도 입력에서 서향 하강 경사를 계산한다", () => {
    const plan = buildTerrainSamplingPlan(boundary);
    expect(plan.surfaceLocations.length).toBeGreaterThanOrEqual(12);
    expect(plan.crossSectionLocations).toHaveLength(11);
    expect(plan.axis).toBe("east_west");
    const result = analyzeTerrainPlan(plan, plan.surfaceLocations.map(point => 20 + (point.longitude - 126.92) * 10_000), plan.crossSectionLocations.map(point => 20 + (point.longitude - 126.92) * 10_000));
    expect(result.elevation.rangeMeters).toBeGreaterThan(10);
    expect(result.slope.degrees).toBeGreaterThan(0);
    expect(result.slope.downhillDirection).toMatch(/서/);
    expect(result.section.points.at(-1)?.distanceMeters).toBeGreaterThan(100);
  });

  it("유효한 폴리곤이 없으면 조사 경계 저장을 요청한다", () => {
    expect(() => buildTerrainSamplingPlan("{}")) .toThrow("대지 경계");
  });

  it("필지 확정 전 대지 중심점에서 150m × 150m 임시 분석 범위를 만든다", () => {
    const fallback = JSON.parse(buildTerrainFallbackBoundary({ latitude: 35.1467, longitude: 126.921 })) as { geometry: { coordinates: number[][][] }; properties: { analysisExtent: string; halfSpanMeters: number } };
    expect(fallback.properties).toEqual({ analysisExtent: "site_center_fallback", halfSpanMeters: 75 });
    expect(fallback.geometry.coordinates[0]).toHaveLength(5);
    expect(buildTerrainSamplingPlan(JSON.stringify(fallback)).surfaceLocations.length).toBeGreaterThanOrEqual(12);
  });

  it("공개 DEM 응답의 다중 표본을 고도·단면 결과로 정규화한다", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: URL) => {
      const sampleCount = url.searchParams.get("latitude")?.split(",").length ?? 0;
      return { ok: true, json: async () => ({ elevation: Array.from({ length: sampleCount }, (_, index) => 30 + index) }) };
    }));
    const result = await fetchTerrainAnalysis(boundary);
    expect(result.source).toMatchObject({ provider: "Open-Meteo", resolutionMeters: 90 });
    expect(result.sampleCount).toBeGreaterThan(20);
    expect(result.section.points).toHaveLength(11);
  });
});
