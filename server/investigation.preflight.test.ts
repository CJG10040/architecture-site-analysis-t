import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const createSnapshot = vi.fn(async () => 1);
const recordApiAudit = vi.fn(async () => undefined);

vi.mock("./db", () => ({
  getProjectForOwner: vi.fn(async () => ({ id: 7, ownerId: 4, title: "사전조사" })),
  getProject: vi.fn(async () => ({ id: 7, ownerId: 4, title: "사전조사" })),
  getSiteForProject: vi.fn(async () => ({ id: 3, projectId: 7, address: "광주광역시 동구", latitude: "35.1467", longitude: "126.921", analysisRadiusMeters: 800, boundaryGeoJson: null })),
  getSiteParcel: vi.fn(async () => null),
  nearbyParking: vi.fn(async () => []),
  createSnapshot,
  recordApiAudit,
}));

vi.mock("./lib/dataAdapters", () => ({
  ExternalDataError: class ExternalDataError extends Error { constructor(public code: string, message: string, public status?: number) { super(message); } },
  fetchAirStations: vi.fn(async () => ({ data: { response: { body: { items: { item: { stationName: "서석동" } } } } }, sourceUrl: "https://example.test/stations", status: 200 })),
  fetchAirQuality: vi.fn(async () => ({ data: { response: { body: { items: [] } } }, sourceUrl: "https://example.test/air", status: 200 })),
  fetchAirQualityNearAddress: vi.fn(async () => ({ data: { response: { body: { items: [{ stationName: "서석동" }] } } }, sourceUrl: "https://example.test/air", status: 200, stationName: "서석동", selectionMethod: "address_station_list" })),
  fetchCityParks: vi.fn(async () => ({ data: { response: { body: { items: [] } } }, sourceUrl: "https://example.test/parks", status: 200 })),
  fetchCommerceInRadius: vi.fn(async () => ({ data: { response: { body: { items: [] } } }, sourceUrl: "https://example.test/commerce", status: 200 })),
  fetchGwangjuArrivals: vi.fn(),
  fetchGwangjuStations: vi.fn(async () => ({ data: { response: { body: { items: [] } } }, sourceUrl: "https://example.test/bus", status: 200 })),
  fetchLandUse: vi.fn(),
  fetchSgisCensusSummary: vi.fn(),
  fetchVworldParcelCandidates: vi.fn(),
  fetchWelfareFacilities: vi.fn(async () => ({ data: { response: { body: { items: [] } } }, sourceUrl: "https://example.test/welfare", status: 200 })),
  validateProviderCredential: vi.fn(),
}));

vi.mock("./lib/terrainAnalysis", () => ({
  TerrainAnalysisError: class TerrainAnalysisError extends Error {},
  buildTerrainFallbackBoundary: vi.fn(() => "fallback-boundary"),
  fetchTerrainAnalysis: vi.fn(async () => ({ source: { sourceUrl: "https://example.test/terrain" }, elevation: { rangeMeters: 1 }, slope: { degrees: 1 }, section: { points: [] } })),
}));

vi.mock("./lib/solarAnalysis", () => ({
  SolarAnalysisError: class SolarAnalysisError extends Error {},
  analyzeSolarAccess: vi.fn(() => ({ source: { sourceUrl: "https://example.test/solar" }, moments: [] })),
}));

const { appRouter } = await import("./routers");

describe("investigation.preflight", () => {
  it("필지 확정 전에도 공공데이터를 우선 수집하고 SGIS·현장 확인만 보류 목록으로 남긴다", async () => {
    const ctx = {
      user: { id: 4, openId: "owner", role: "user", email: null, name: "owner", loginMethod: "manus", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
      req: {} as TrpcContext["req"], res: {} as TrpcContext["res"],
    } as TrpcContext;
    const result = await appRouter.createCaller(ctx).investigation.preflight({ projectId: 7 });

    expect(result.status).toBe("success");
    expect(result.collectedCount).toBe(8);
    expect(result.fieldVerificationCount).toBe(3);
    expect(result.results.find(item => item.id === "sgis-demographics")).toMatchObject({ status: "unavailable" });
    expect(result.results.filter(item => item.status === "fieldwork")).toHaveLength(3);
    expect(createSnapshot).toHaveBeenCalledTimes(9);
    expect(recordApiAudit).toHaveBeenCalledWith(expect.objectContaining({ provider: "preflight", operation: "public_data_preflight" }));
  });
});
