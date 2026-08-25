import { describe, expect, it } from "vitest";
import { summarizeSpatialLayer } from "./spatialAnalysis";

describe("spatial layer summaries", () => {
  it("calculates line length and context density without inventing traffic data", () => {
    const summary = summarizeSpatialLayer({ id: "roads", title: "도로", source: "test", fetchedAt: "2026-01-01", totalFeatureCount: 1, truncated: false, features: [{ id: "r1", geometry: { type: "LineString", coordinates: [[126, 35], [126.001, 35]] }, properties: { ROAD_RANK: "104" } }] }, 300);
    expect(summary.featureCount).toBe(1);
    expect(summary.totalLengthMeters).toBeGreaterThan(80);
    expect(summary.totalLengthMeters).toBeLessThan(110);
    expect(summary.densityPerSqKm).toBeGreaterThan(0);
  });

  it("calculates polygon footprint area and subtracts inner rings", () => {
    const summary = summarizeSpatialLayer({ id: "buildings", title: "건축물", source: "test", fetchedAt: "2026-01-01", totalFeatureCount: 1, truncated: false, features: [{ id: "b1", geometry: { type: "Polygon", coordinates: [[[126, 35], [126.001, 35], [126.001, 35.001], [126, 35.001], [126, 35]]] }, properties: {} }] }, 300);
    expect(summary.totalAreaSqm).toBeGreaterThan(9000);
    expect(summary.totalAreaSqm).toBeLessThan(11000);
  });
});
