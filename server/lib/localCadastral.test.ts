import { gzipSync } from "node:zlib";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../db", () => ({
  findActiveCadastralParcelsAtPoint: vi.fn(),
  findActiveCadastralParcelsNearPoint: vi.fn(),
  haversineMeters: vi.fn(() => 32),
  getApiCredential: vi.fn(),
}));

import * as db from "../db";
import { fetchVworldParcelCandidates } from "./dataAdapters";
import { findLocalCadastralContext, getLocalGeometryMetrics, includesPoint, pointInPolygon } from "./localCadastral";

const square: [[number, number], [number, number], [number, number], [number, number], [number, number]] = [[126.9, 35.1], [127, 35.1], [127, 35.2], [126.9, 35.2], [126.9, 35.1]];

describe("로컬 연속지적도 도형 판정", () => {
  it("외곽 링 내부는 포함하고 외부는 제외한다", () => {
    expect(pointInPolygon([126.95, 35.15], [square])).toBe(true);
    expect(pointInPolygon([127.02, 35.15], [square])).toBe(false);
  });

  it("폴리곤 내부의 구멍과 다중 폴리곤을 올바르게 구분한다", () => {
    const withHole = { type: "Polygon" as const, coordinates: [square, [[126.93, 35.13], [126.97, 35.13], [126.97, 35.17], [126.93, 35.17], [126.93, 35.13]]] };
    const multi = { type: "MultiPolygon" as const, coordinates: [[square], [[[127.1, 35.1], [127.2, 35.1], [127.2, 35.2], [127.1, 35.2], [127.1, 35.1]]]] };
    expect(includesPoint(withHole, [126.95, 35.15])).toBe(false);
    expect(includesPoint(multi, [127.15, 35.15])).toBe(true);
  });

  it("WGS84 도형에서 양의 면적·둘레와 중심점을 계산한다", () => {
    const metrics = getLocalGeometryMetrics({ type: "Polygon", coordinates: [square] });
    expect(metrics?.areaSqMeters).toBeGreaterThan(1);
    expect(metrics?.perimeterMeters).toBeGreaterThan(1);
    expect(metrics?.longestEdge?.lengthMeters).toBeGreaterThan(1);
    expect(metrics?.longestEdge?.direction).toMatch(/북|남|동|서/);
    expect(metrics?.centroid.latitude).toBeCloseTo(35.15, 6);
    expect(metrics?.centroid.longitude).toBeCloseTo(126.95, 6);
  });
});

describe("인접 로컬 필지 맥락", () => {
  it("확정 PNU를 제외하고 거리순 인접 후보와 도형 계산 면적을 제공한다", async () => {
    vi.mocked(db.findActiveCadastralParcelsNearPoint).mockResolvedValue([
      { pnu: "1221010100100010000", jibun: "1", landIndicator: "1", localAdminCode: "12210", geometryGzipBase64: gzipSync(Buffer.from(JSON.stringify({ type: "Polygon", coordinates: [square] }))).toString("base64"), importId: 1, districtName: "동구", datasetReference: "202608", sourceFileName: "dong-gu.zip", sourceFileUrl: null },
      { pnu: "1221010100100020000", jibun: "2", landIndicator: "1", localAdminCode: "12210", geometryGzipBase64: gzipSync(Buffer.from(JSON.stringify({ type: "Polygon", coordinates: [square] }))).toString("base64"), importId: 1, districtName: "동구", datasetReference: "202608", sourceFileName: "dong-gu.zip", sourceFileUrl: null },
    ]);
    const result = await findLocalCadastralContext({ latitude: 35.15, longitude: 126.95, selectedPnu: "1221010100100010000" });
    expect(result.nearbyCount).toBe(1);
    expect(result.candidates[0]).toMatchObject({ pnu: "1221010100100020000", distanceMeters: 32 });
    expect(Number(result.candidates[0]?.officialAreaSqm)).toBeGreaterThan(0);
  });
});

describe("VWorld 연속지적도 대체", () => {
  beforeEach(() => {
    vi.mocked(db.getApiCredential).mockResolvedValue(undefined);
    vi.mocked(db.findActiveCadastralParcelsAtPoint).mockResolvedValue([{ pnu: "1221010100100960000", jibun: "96", landIndicator: "대", localAdminCode: "12210", geometryGzipBase64: gzipSync(Buffer.from(JSON.stringify({ type: "Polygon", coordinates: [square] }))).toString("base64"), importId: 1, districtName: "동구", datasetReference: "202608", sourceFileName: "dong-gu.zip", sourceFileUrl: "https://example.test/dong-gu.zip" }]);
  });

  it("VWorld 키가 없거나 사용할 수 없으면 같은 좌표의 활성 로컬 필지를 반환한다", async () => {
    const result = await fetchVworldParcelCandidates({ latitude: 35.15, longitude: 126.95 });
    expect(result.source).toBe("local");
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({ pnu: "1221010100100960000", parcelNumber: "96", sourceProvider: "사용자 제공 광주 연속지적도", sourceLayer: "LSMD_CONT_LDREG / 동구" });
  });
});
