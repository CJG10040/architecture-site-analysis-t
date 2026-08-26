import { describe, expect, it } from "vitest";
import { analyzeRoadLayer, analyzeSiteEvidence, roadBoundaryRelation, summarizeSpatialLayer } from "./spatialAnalysis";

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

describe("site evidence digest", () => {
  it("turns parcel, building, and road data into local facts and relations", () => {
    const digest = analyzeSiteEvidence({ address: "테스트", latitude: 35.1, longitude: 126.9, boundary: [{ lat: 35.1, lng: 126.9 }, { lat: 35.101, lng: 126.9 }, { lat: 35.101, lng: 126.901 }], areaSqm: 10000, parcels: [{ pnu: "1", areaSqm: "9000" }] }, [
      { id: "vworldBuildings", title: "건축물", source: "test", fetchedAt: "2026-01-01", totalFeatureCount: 1, truncated: false, features: [{ id: "b1", geometry: { type: "Polygon", coordinates: [[[126.9, 35.1], [126.9002, 35.1], [126.9002, 35.1002], [126.9, 35.1002], [126.9, 35.1]]] }, properties: {} }] },
      { id: "vworldRoads", title: "도로", source: "test", fetchedAt: "2026-01-01", totalFeatureCount: 1, truncated: false, features: [{ id: "r1", geometry: { type: "LineString", coordinates: [[126.9001, 35.1001], [126.901, 35.1001]] }, properties: {} }] },
    ]);
    expect(digest.parcelCount).toBe(1);
    expect(digest.buildingFootprintSqm).toBeGreaterThan(0);
    expect(digest.relations.join(" ")).toContain("건폐율이 아닙니다");
    expect(digest.unknowns.join(" ")).toContain("교통량");
  });
});

describe("road analysis", () => {
  it("separates actual width, lane-based estimate, and missing traffic", () => {
    const features = [
      { id: "r1", geometry: { type: "LineString", coordinates: [[126.9, 35.1], [126.901, 35.1]] }, properties: { ROAD_RANK: "104", ROAD_WIDTH: "12", TRAFFIC_VOLUME: "1000" } },
      { id: "r2", geometry: { type: "LineString", coordinates: [[126.9, 35.101], [126.901, 35.101]] }, properties: { ROAD_RANK: "107", LANES: "2" } },
    ];
    const result = analyzeRoadLayer(features);
    expect(result.widthAttributeCount).toBe(1);
    expect(result.widthEstimatedCount).toBe(1);
    expect(result.widthUnknownCount).toBe(0);
    expect(result.trafficAttributeCount).toBe(1);
    expect(result.categoryCounts["주간선·대로"]).toBe(1);
  });

  it("reports a reference distance without calling it a legal access decision", () => {
    const features = [{ id: "r1", geometry: { type: "LineString", coordinates: [[126.9001, 35.1001], [126.901, 35.1001]] }, properties: {} }];
    const result = roadBoundaryRelation(features, [{ lat: 35.1, lng: 126.9 }, { lat: 35.1, lng: 126.902 }, { lat: 35.102, lng: 126.902 }]);
    expect(result.nearestDistanceMeters).not.toBeNull();
    expect(result.within60m).toBe(1);
    expect(result.note).toContain("확정하지 않습니다");
  });
});
