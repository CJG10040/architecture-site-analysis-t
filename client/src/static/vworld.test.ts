import { describe, expect, it } from "vitest";
import { normalizeVworldBrowserCandidates, normalizeVworldWfsFeatures } from "./vworld";

describe("normalizeVworldBrowserCandidates", () => {
  it("reads parcel metadata without preserving a browser key", () => {
    const candidates = normalizeVworldBrowserCandidates({ response: { result: { featureCollection: { features: [{ properties: { pnu: "2911010100100010000", jibun: "1-1", jimok: "대", area: 121.5 } }] } } } });
    expect(candidates).toEqual([{ pnu: "2911010100100010000", parcelNumber: "1-1", landCategory: "대", areaSqm: "121.5" }]);
  });
});

describe("normalizeVworldWfsFeatures", () => {
  it("normalizes a GeoJSON feature collection for source evidence", () => {
    const features = normalizeVworldWfsFeatures({ type: "FeatureCollection", features: [{ id: "road.1", geometry: { type: "LineString", coordinates: [] }, properties: { ROAD_RANK: "104", LANES: "4" } }] });
    expect(features).toHaveLength(1);
    expect(features[0]).toMatchObject({ id: "road.1", properties: { ROAD_RANK: "104", LANES: "4" } });
  });
});
