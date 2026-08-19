import { gzipSync } from "node:zlib";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../db", () => ({
  findActiveCadastralParcelsAtPoint: vi.fn(),
  getApiCredential: vi.fn(),
}));

import * as db from "../db";
import { fetchVworldParcelCandidates } from "./dataAdapters";
import { includesPoint, pointInPolygon } from "./localCadastral";

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
