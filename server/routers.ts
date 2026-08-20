import { TRPCError } from "@trpc/server";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import shp from "shpjs";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { encryptSecret, maskSecret } from "./lib/credentialCrypto";
import { ExternalDataError, fetchAirQuality, fetchAirStations, fetchCityParks, fetchCommerceInRadius, fetchGwangjuArrivals, fetchGwangjuStations, fetchLandUse, fetchSgisCensusSummary, fetchVworldParcelCandidates, fetchWelfareFacilities, validateProviderCredential } from "./lib/dataAdapters";
import { generateSiteReport } from "./lib/reportGenerator";
import { analyzeSolarAccess, SolarAnalysisError } from "./lib/solarAnalysis";
import { buildTerrainFallbackBoundary, fetchTerrainAnalysis, TerrainAnalysisError } from "./lib/terrainAnalysis";
import { credentialGroupIds } from "../shared/integrations";
import { investigationLenses, recommendContextScopes, recommendInvestigationDatasets } from "../shared/investigationPlan";
import { normalizeBoundaryGeoJson } from "./lib/boundaryGeoJson";
import { summarizeEvidence } from "./lib/evidenceSummary";
import { findLocalCadastralContext } from "./lib/localCadastral";
import { storageGetSignedUrl, storagePut } from "./storage";
import { transcribeAudio } from "./_core/voiceTranscription";
import { decodeFieldMaterialPayload, isAllowedFieldMaterialMimeType, MAX_FIELD_MATERIAL_BYTES, sanitizeFieldMaterialName } from "./lib/fieldMaterials";

const providers = credentialGroupIds;
const categories = ["regulation", "environment", "transport", "parking", "facility", "commerce", "park"] as const;
const observationTypes = ["movement", "sound", "light", "material", "boundary", "activity", "other"] as const;
const attachmentTypes = ["photo", "sketch", "drawing", "document", "audio", "other"] as const;
const relationshipTypes = ["adjacency", "access", "density", "time", "conflict", "repetition", "disconnection", "coexistence", "exclusion", "preservation", "other"] as const;
const reviewStatuses = ["undecided", "agree", "partial", "different", "not_important", "research", "counter", "develop"] as const;
const cadastralDistrictNames: Record<string, string> = { "12210": "동구", "12240": "서구", "12270": "남구", "12300": "북구", "12330": "광산구" };
const MAX_CADASTRAL_ARCHIVE_BYTES = 35 * 1024 * 1024;

type CadastralGeometry = { type: "Polygon" | "MultiPolygon"; coordinates: unknown };
type CadastralFeature = { properties?: Record<string, unknown>; geometry?: CadastralGeometry };

function cadastralCoordinateExtent(geometry: CadastralGeometry) {
  const positions: Array<[number, number]> = [];
  const visit = (value: unknown): void => {
    if (!Array.isArray(value)) return;
    if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") positions.push([value[0], value[1]]);
    else value.forEach(visit);
  };
  visit(geometry.coordinates);
  if (!positions.length) throw new Error("도형 좌표가 없습니다.");
  return positions.reduce<[number, number, number, number]>(([minLongitude, minLatitude, maxLongitude, maxLatitude], [longitude, latitude]) => [Math.min(minLongitude, longitude), Math.min(minLatitude, latitude), Math.max(maxLongitude, longitude), Math.max(maxLatitude, latitude)], [Infinity, Infinity, -Infinity, -Infinity]);
}

async function parseCadastralArchive(input: { originalName: string; dataUrl: string }) {
  const encoded = input.dataUrl.match(/^data:application\/(?:zip|x-zip-compressed);base64,([A-Za-z0-9+/=]+)$/i)?.[1];
  if (!encoded) throw new Error("ZIP 형식의 연속지적도 파일만 업로드할 수 있습니다.");
  const buffer = Buffer.from(encoded, "base64");
  if (!buffer.byteLength || buffer.byteLength > MAX_CADASTRAL_ARCHIVE_BYTES) throw new Error("연속지적도 ZIP은 비어 있지 않고 35MB 이하여야 합니다.");
  const parsed = await shp(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
  const collection = (Array.isArray(parsed) ? parsed[0] : parsed) as { fileName?: string; features?: CadastralFeature[] };
  const features = collection.features ?? [];
  const first = features[0];
  const districtCode = String(first?.properties?.COL_ADM_SE ?? "");
  const districtName = cadastralDistrictNames[districtCode];
  const datasetReference = collection.fileName?.match(/_(\d{6})$/)?.[1] ?? input.originalName.match(/_(\d{6})\.zip$/i)?.[1];
  if (!districtName || !datasetReference || !/^\d{6}$/.test(datasetReference) || !features.length || features.length > 200_000) throw new Error("광주 5개 구의 기준일이 포함된 연속지적도 ZIP인지 확인할 수 없습니다.");
  const rows: db.CadastralParcelRow[] = features.map(feature => {
    const pnu = String(feature.properties?.PNU ?? "");
    const geometry = feature.geometry;
    if (!/^\d{19}$/.test(pnu) || !geometry || !["Polygon", "MultiPolygon"].includes(geometry.type)) throw new Error("모든 레코드에 19자리 PNU와 Polygon 또는 MultiPolygon 도형이 있어야 합니다.");
    const [minLongitude, minLatitude, maxLongitude, maxLatitude] = cadastralCoordinateExtent(geometry);
    if (![minLongitude, minLatitude, maxLongitude, maxLatitude].every(Number.isFinite) || minLongitude < 120 || maxLongitude > 135 || minLatitude < 30 || maxLatitude > 40) throw new Error("도형 좌표계가 WGS84 경위도 범위인지 확인할 수 없습니다.");
    return { pnu, jibun: String(feature.properties?.JIBUN ?? "") || undefined, landIndicator: String(feature.properties?.BCHK ?? "") || undefined, localAdminCode: districtCode, minLongitude, minLatitude, maxLongitude, maxLatitude, geometryGzipBase64: gzipSync(Buffer.from(JSON.stringify(geometry))).toString("base64") };
  });
  return { buffer, districtCode, districtName, datasetReference, rows };
}

async function ensureProjectAccess(projectId: number, userId: number, isAdmin = false) {
  const project = isAdmin ? await db.getProject(projectId) : await db.getProjectForOwner(projectId, userId);
  if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "프로젝트를 찾을 수 없거나 접근 권한이 없습니다." });
  return project;
}

function safeExternalError(error: unknown) {
  if (error instanceof ExternalDataError) return { code: error.code, message: error.message, status: error.status };
  return { code: "UNAVAILABLE", message: "외부 데이터 처리 중 오류가 발생했습니다." };
}

function readJsonArray(value: string) {
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed as string[] : []; }
  catch { return []; }
}

function districtFromAddress(address?: string | null) {
  return address?.match(/(.*?(?:특별시|광역시|특별자치시|도)\s+.*?(?:시|군|구))/)?.[1];
}

function firstStationName(data: unknown) {
  const source = data && typeof data === "object" ? data as Record<string, unknown> : {};
  const response = source.response && typeof source.response === "object" ? source.response as Record<string, unknown> : source;
  const body = response.body && typeof response.body === "object" ? response.body as Record<string, unknown> : response;
  const items = body.items && typeof body.items === "object" ? body.items as Record<string, unknown> : body;
  const raw = items.item ?? items.items;
  const first = Array.isArray(raw) ? raw[0] : raw;
  return first && typeof first === "object" ? String((first as Record<string, unknown>).stationName ?? "") || undefined : undefined;
}

type PreflightResult = { id: string; label: string; status: "collected" | "unavailable" | "fieldwork"; message: string };

async function runPublicDataPreflight(input: { projectId: number; userId: number }) {
  const [site, parcel] = await Promise.all([db.getSiteForProject(input.projectId), db.getSiteParcel(input.projectId)]);
  if (!site) throw new TRPCError({ code: "BAD_REQUEST", message: "사전 자동조사 전에 대지 위치를 저장하세요." });
  const results: PreflightResult[] = [];
  const save = async (id: string, label: string, category: "parcel" | "environment" | "transport" | "parking" | "facility" | "commerce" | "park" | "demographics" | "terrain" | "solar", upstream: { data: unknown; sourceUrl: string }, spatialScope: string, limitations: string, dataUnit: string, reliability: "low" | "medium" | "high" = "medium") => {
    const summary = summarizeEvidence(upstream.data, label, spatialScope);
    await db.createSnapshot({ projectId: input.projectId, siteId: site.id, category, sourceName: label, sourceUrl: upstream.sourceUrl, rawPayload: JSON.stringify(upstream.data).slice(0, 500_000), normalizedPayload: JSON.stringify(summary), spatialScope, dataUnit, reliability, limitations, status: "success" });
    results.push({ id, label, status: "collected", message: `${label}를 수집해 조사 이력에 저장했습니다.` });
  };
  const attempt = async (id: string, label: string, work: () => Promise<void>) => {
    try { await work(); }
    catch (error) { const failure = safeExternalError(error); results.push({ id, label, status: "unavailable", message: failure.message }); }
  };
  const boundary = parcel?.boundaryGeoJson ?? site.boundaryGeoJson ?? buildTerrainFallbackBoundary({ latitude: Number(site.latitude), longitude: Number(site.longitude) });
  const spatialScope = parcel?.boundaryGeoJson || site.boundaryGeoJson ? "그린 대지 경계 및 주변 맥락" : "대지 중심 150m × 150m 사전 표본 범위";

  await attempt("terrain", "고도·경사·단면", async () => {
    const terrain = await fetchTerrainAnalysis(boundary);
    await save("terrain", "Open-Meteo 고도 표본 · Copernicus DEM GLO-90", "terrain", { data: terrain, sourceUrl: terrain.source.sourceUrl }, spatialScope, "공개 DEM의 약 90m 표본이며 미세 레벨차·옹벽·계단은 현장에서 확인해야 합니다.", "고도 m · 경사 °/%", "low");
  });
  await attempt("solar", "대표일 일조·일영", async () => {
    const solar = analyzeSolarAccess({ latitude: Number(site.latitude), longitude: Number(site.longitude) });
    await save("solar", "NOAA 태양 위치 근사 · 대표 계절 비교", "solar", { data: solar, sourceUrl: solar.source.sourceUrl }, spatialScope, "인접 건물·수목의 실제 차폐와 법정 일조시간은 포함하지 않습니다.", "태양 방위·고도 ° · 그림자 방향", "medium");
  });
  await attempt("gw-bus", "광주 버스 정류장", async () => {
    const upstream = await fetchGwangjuStations();
    await save("gw-bus", "전남광주통합특별시 광주버스정보", "transport", upstream, `대지 중심 ${Math.min(site.analysisRadiusMeters, 800)}m 사전 맥락`, "정류장 목록이며 실제 보행 접근성과 시간대별 승하차는 현장에서 필요한 경우에만 확인합니다.", "정류장 레코드");
  });
  await attempt("parking-context", "주차장 맥락", async () => {
    const data = await db.nearbyParking(Number(site.latitude), Number(site.longitude), Math.min(site.analysisRadiusMeters, 800));
    await save("parking-context", "광주교통공사 역 인근 주차장 현황", "parking", { data, sourceUrl: "사용자 제공 광주교통공사 역 인근 주차장 현황 CSV" }, `대지 중심 ${Math.min(site.analysisRadiusMeters, 800)}m`, "2022-12-08 기준 제공 CSV이며 광주 지역에 한정됩니다.", "시설·수용대수");
  });
  await attempt("commerce-radius", "상가·상권", async () => {
    const upstream = await fetchCommerceInRadius(Number(site.latitude), Number(site.longitude), Math.min(site.analysisRadiusMeters, 800));
    await save("commerce-radius", "소상공인시장진흥공단 상가(상권)정보", "commerce", upstream, `대지 중심 ${Math.min(site.analysisRadiusMeters, 800)}m`, "상가 목록은 영업 상태·시간대·보행 점유를 보장하지 않아 현장에서는 필요한 항목만 대조합니다.", "반경 내 상가업소");
  });
  await attempt("parks-open-space", "도시공원·녹지", async () => {
    const upstream = await fetchCityParks();
    await save("parks-open-space", "전국도시공원정보표준데이터", "park", upstream, `대지 중심 ${Math.min(site.analysisRadiusMeters, 800)}m 후보`, "원천 좌표·주소 품질에 따라 실제 거리와 접근성만 현장에서 대조합니다.", "도시공원 표준 레코드");
  });
  await attempt("welfare-facilities", "사회복지시설", async () => {
    const district = districtFromAddress(site.address);
    if (!district) throw new ExternalDataError("BAD_REQUEST", "주소에서 시·군·구를 찾지 못했습니다. 대지 주소를 보완하면 시설 데이터를 자동 수집할 수 있습니다.");
    const upstream = await fetchWelfareFacilities(district);
    await save("welfare-facilities", "한국사회보장정보원 사회복지시설", "facility", upstream, `${district} 생활권 후보`, "원천 시설 주소·좌표 품질과 실제 이용 가능 여부만 현장에서 대조합니다.", "시설 목록");
  });
  await attempt("air-quality", "인근 대기질", async () => {
    const stations = await fetchAirStations(site.address ?? "");
    const stationName = firstStationName(stations.data);
    if (!stationName) throw new ExternalDataError("UNAVAILABLE", "주소에서 인근 대기질 측정소를 찾지 못했습니다.");
    const upstream = await fetchAirQuality(stationName);
    await save("air-quality", "에어코리아 인근 측정소 대기질", "environment", upstream, `인근 측정소 ${stationName}`, "대지 직접 측정값이 아닌 측정소 관측값이며 관측 시각·거리만 현장에서 필요 시 대조합니다.", "측정소 관측 농도", "high");
  });
  if (parcel) await attempt("parcel-context", "확정·로컬 대체 필지", async () => {
    await save("parcel-context", "확정 필지·연속지적도 근거", "parcel", { data: parcel, sourceUrl: parcel.sourceUrl ?? "https://www.vworld.kr/" }, "확정 필지", "VWorld 원천 장애 시에는 광주 로컬 연속지적도 대체 데이터일 수 있으며, 측량·인허가 증명은 아닙니다.", "필지 도형·PNU·지목·면적");
  });
  const parcelPnu = parcel?.pnu;
  if (parcelPnu) await attempt("sgis-demographics", "SGIS 인구·가구·사업체", async () => {
    const upstream = await fetchSgisCensusSummary({ pnu: parcelPnu });
    await save("sgis-demographics", "SGIS 인구·가구·사업체", "demographics", upstream, `시·군·구 ${upstream.data.administrativeCode}`, `개별 필지가 아닌 시·군·구 통계이며 기준연도(인구 ${upstream.data.baseYears.population ?? "미확인"}·가구 ${upstream.data.baseYears.household ?? "미확인"}·사업체 ${upstream.data.baseYears.company ?? "미확인"})를 함께 읽어야 합니다.`, "인구·가구·사업체 통계");
  });
  else results.push({ id: "sgis-demographics", label: "SGIS 인구·가구·사업체", status: "unavailable", message: "PNU가 아직 없어 시·군·구 통계는 보류했습니다. 필지 확정 뒤 자동조사를 다시 실행하면 수집합니다." });

  results.push({ id: "verify-levels", label: "경계·레벨차 검증", status: "fieldwork", message: "자동 DEM 결과와 실제 옹벽·계단·접도 레벨차가 맞는지만 짧게 확인하세요." });
  results.push({ id: "verify-activity", label: "운영·보행 흐름 검증", status: "fieldwork", message: "자동 수집한 상권·교통·시설 목록 중 실제 운영·이용·접근이 다른 지점만 확인하세요." });
  results.push({ id: "verify-shadow", label: "차폐·그늘 검증", status: "fieldwork", message: "자동 일조 방향과 주변 건물·수목의 실제 차폐가 다른 지점만 확인하세요." });
  await db.createSnapshot({ projectId: input.projectId, siteId: site.id, category: "manual", sourceName: "공공데이터 중심 사전 자동조사 요약", rawPayload: JSON.stringify(results), normalizedPayload: JSON.stringify(results), spatialScope, dataUnit: "수집·보류·현장 검증 상태", reliability: "medium", limitations: "이 요약은 사전 자동조사 결과입니다. 현장에서는 원천 데이터로 확정할 수 없는 레벨차·차폐·운영 상태만 검증합니다.", status: "success" });
  await db.recordApiAudit({ provider: "preflight", operation: "public_data_preflight", success: results.some(item => item.status === "collected"), responseStatus: 200, safeMessage: `사전 자동조사: ${results.filter(item => item.status === "collected").length}건 수집`, initiatedBy: input.userId });
  return { results, collectedCount: results.filter(item => item.status === "collected").length, fieldVerificationCount: results.filter(item => item.status === "fieldwork").length };
}


export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  projects: router({
    list: protectedProcedure.query(({ ctx }) => db.listProjects(ctx.user.id)),
    create: protectedProcedure.input(z.object({ title: z.string().min(2).max(160), architecturalProgram: z.string().max(2000).optional(), expectedScale: z.string().max(160).optional(), assignmentTheme: z.string().max(2000).optional(), targetUsers: z.string().max(2000).optional(), interestLens: z.string().max(160).optional(), firstQuestion: z.string().max(2000).optional(), deliverableFormat: z.string().max(160).optional(), avoidInterpretations: z.string().max(2000).optional(), siteVisitStatus: z.enum(["planned", "completed", "unknown"]).optional() })).mutation(async ({ ctx, input }) => ({ id: await db.createProject({ ...input, ownerId: ctx.user.id }) })),
    updateBrief: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), title: z.string().min(2).max(160).optional(), architecturalProgram: z.string().max(2000).optional(), expectedScale: z.string().max(160).optional(), assignmentTheme: z.string().max(2000).optional(), targetUsers: z.string().max(2000).optional(), interestLens: z.string().max(160).optional(), firstQuestion: z.string().max(2000).optional(), deliverableFormat: z.string().max(160).optional(), avoidInterpretations: z.string().max(2000).optional(), siteVisitStatus: z.enum(["planned", "completed", "unknown"]).optional() })).mutation(async ({ ctx, input }) => { await ensureProjectAccess(input.projectId, ctx.user.id, ctx.user.role === "admin"); const { projectId, ...values } = input; await db.updateProjectBrief(projectId, values); return { success: true }; }),
    get: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).query(async ({ ctx, input }) => db.getProjectBundle((await ensureProjectAccess(input.projectId, ctx.user.id, ctx.user.role === "admin")).id)),
  }),
  sites: router({
    save: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), address: z.string().max(600).optional(), parcelNumber: z.string().max(64).optional(), roadAddress: z.string().max(600).optional(), landAreaSqm: z.string().max(32).optional(), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), analysisRadiusMeters: z.number().int().min(100).max(5000), boundaryGeoJson: z.string().max(100_000).optional() })).mutation(async ({ ctx, input }) => {
      await ensureProjectAccess(input.projectId, ctx.user.id, ctx.user.role === "admin");
      let boundaryGeoJson: string | undefined;
      try {
        boundaryGeoJson = normalizeBoundaryGeoJson(input.boundaryGeoJson);
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "대지 경계를 처리하지 못했습니다." });
      }
      return { id: await db.saveSite({ ...input, boundaryGeoJson, latitude: String(input.latitude), longitude: String(input.longitude) }) };
    }),
  }),
  terrain: router({
    analyze: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await ensureProjectAccess(input.projectId, ctx.user.id, ctx.user.role === "admin");
      const [site, parcel] = await Promise.all([db.getSiteForProject(input.projectId), db.getSiteParcel(input.projectId)]);
      const boundaryGeoJson = parcel?.boundaryGeoJson ?? site?.boundaryGeoJson;
      if (!site) throw new TRPCError({ code: "BAD_REQUEST", message: "지형 분석을 시작하려면 먼저 대지 위치를 저장하세요." });
      const analysisBoundary = boundaryGeoJson ?? buildTerrainFallbackBoundary({ latitude: Number(site.latitude), longitude: Number(site.longitude) });
      const spatialScope = boundaryGeoJson ? "그린 대지 경계 및 장축 단면" : "대지 중심 150m × 150m 표본 범위 및 장축 단면";
      try {
        const result = await fetchTerrainAnalysis(analysisBoundary);
        const limitations = [...result.limitations, ...(boundaryGeoJson ? [] : ["그린 대지 경계 전에는 저장된 중심점을 기준으로 한 150m × 150m 표본 범위입니다. 경계를 저장한 뒤 다시 실행하면 정확한 대지 범위로 갱신됩니다."])];
        const snapshotId = await db.createSnapshot({ projectId: input.projectId, siteId: site.id, category: "terrain", sourceName: "Open-Meteo 고도 표본 · Copernicus DEM GLO-90", sourceUrl: result.source.sourceUrl, rawPayload: JSON.stringify(result).slice(0, 500_000), normalizedPayload: JSON.stringify({ ...result, limitations }).slice(0, 500_000), spatialScope, dataUnit: "고도 m · 경사 °/%", reliability: "low", limitations: limitations.join(" "), status: "success" });
        await db.recordApiAudit({ provider: "openMeteo", operation: "terrain_analysis", success: true, responseStatus: 200, initiatedBy: ctx.user.id });
        return { status: "success" as const, snapshotId, result };
      } catch (error) {
        const message = error instanceof TerrainAnalysisError ? error.message : "지형 고도 분석을 처리하지 못했습니다. 잠시 후 다시 시도하세요.";
        await db.createSnapshot({ projectId: input.projectId, siteId: site.id, category: "terrain", sourceName: "Open-Meteo 고도 표본", spatialScope, limitations: message, status: "unavailable" });
        await db.recordApiAudit({ provider: "openMeteo", operation: "terrain_analysis", success: false, safeMessage: message, initiatedBy: ctx.user.id });
        return { status: "unavailable" as const, error: { message } };
      }
    }),
  }),
  solar: router({
    analyze: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await ensureProjectAccess(input.projectId, ctx.user.id, ctx.user.role === "admin");
      const [site, parcel] = await Promise.all([db.getSiteForProject(input.projectId), db.getSiteParcel(input.projectId)]);
      const boundaryGeoJson = parcel?.boundaryGeoJson ?? site?.boundaryGeoJson;
      if (!site) throw new TRPCError({ code: "BAD_REQUEST", message: "일조 분석을 시작하려면 먼저 대지 위치를 저장하세요." });
      try {
        const result = analyzeSolarAccess({ latitude: Number(site.latitude), longitude: Number(site.longitude) });
        const snapshotId = await db.createSnapshot({ projectId: input.projectId, siteId: site.id, category: "solar", sourceName: "NOAA 태양 위치 근사 · 대표 계절 비교", sourceUrl: result.source.sourceUrl, rawPayload: JSON.stringify(result), normalizedPayload: JSON.stringify(result), spatialScope: boundaryGeoJson ? "그린 대지 중심 및 경계" : "저장된 대지 중심점", dataUnit: "태양 방위각·고도각 ° · 그림자 방향", reliability: "medium", limitations: result.limitations.join(" "), status: "success" });
        await db.recordApiAudit({ provider: "solarGeometry", operation: "solar_analysis", success: true, responseStatus: 200, initiatedBy: ctx.user.id });
        return { status: "success" as const, snapshotId, result };
      } catch (error) {
        const message = error instanceof SolarAnalysisError ? error.message : "일조·일영 분석을 처리하지 못했습니다. 잠시 후 다시 시도하세요.";
        await db.createSnapshot({ projectId: input.projectId, siteId: site.id, category: "solar", sourceName: "NOAA 태양 위치 근사", spatialScope: "확정 대지 중심", limitations: message, status: "unavailable" });
        await db.recordApiAudit({ provider: "solarGeometry", operation: "solar_analysis", success: false, safeMessage: message, initiatedBy: ctx.user.id });
        return { status: "unavailable" as const, error: { message } };
      }
    }),
  }),
  parcels: router({
    candidates: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) })).mutation(async ({ ctx, input }) => {
      await ensureProjectAccess(input.projectId, ctx.user.id, ctx.user.role === "admin");
      try {
        const result = await fetchVworldParcelCandidates(input);
        await db.recordApiAudit({ provider: "vworld", operation: "parcel_candidates", success: true, responseStatus: result.status, initiatedBy: ctx.user.id });
        return { status: "success" as const, candidates: result.candidates, sourceUrl: result.sourceUrl };
      } catch (error) {
        const failure = safeExternalError(error);
        await db.recordApiAudit({ provider: "vworld", operation: "parcel_candidates", success: false, responseStatus: failure.status, safeMessage: failure.message, initiatedBy: ctx.user.id });
        return { status: "unavailable" as const, error: failure, candidates: [] };
      }
    }),
    context: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), radiusMeters: z.number().int().min(20).max(250).default(80) })).query(async ({ ctx, input }) => {
      await ensureProjectAccess(input.projectId, ctx.user.id, ctx.user.role === "admin");
      const [site, parcel] = await Promise.all([db.getSiteForProject(input.projectId), db.getSiteParcel(input.projectId)]);
      if (!site) return { status: "not_ready" as const, message: "인접 필지를 읽으려면 먼저 대지 위치를 저장하세요.", candidates: [] };
      const context = await findLocalCadastralContext({ latitude: Number(site.latitude), longitude: Number(site.longitude), selectedPnu: parcel?.pnu, radiusMeters: input.radiusMeters });
      if (!context.candidates.length) return { status: "unavailable" as const, message: "현재 위치 주변에서 활성 로컬 연속지적도 필지를 찾지 못했습니다. 광주 5개 구 범위와 기준일을 관리자 설정에서 확인하세요.", ...context };
      return { status: "ready" as const, radiusMeters: input.radiusMeters, ...context };
    }),
    confirm: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), pnu: z.string().regex(/^\d{19}$/, "PNU는 19자리 숫자여야 합니다.").optional(), parcelNumber: z.string().max(96).optional(), landCategory: z.string().max(64).optional(), officialAreaSqm: z.string().max(32).optional(), boundaryGeoJson: z.string().max(100_000).optional(), sourceProvider: z.string().min(2).max(64).default("VWorld"), sourceLayer: z.string().min(2).max(128).default("LP_PA_CBND_BUBUN"), sourceUrl: z.string().url().optional(), sourceUpdatedAt: z.string().max(64).optional(), selectionMethod: z.enum(["map_click", "drawn_boundary", "manual_pnu"]) })).mutation(async ({ ctx, input }) => {
      await ensureProjectAccess(input.projectId, ctx.user.id, ctx.user.role === "admin");
      let boundaryGeoJson: string | undefined;
      try { boundaryGeoJson = normalizeBoundaryGeoJson(input.boundaryGeoJson); }
      catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "필지 경계를 처리하지 못했습니다." }); }
      const { projectId, ...parcel } = input;
      const id = await db.saveSiteParcel({ projectId, ...parcel, boundaryGeoJson });
      const site = await db.getSiteForProject(projectId);
      if (site && boundaryGeoJson) await db.saveSite({ projectId, address: site.address ?? undefined, parcelNumber: input.parcelNumber ?? site.parcelNumber ?? undefined, roadAddress: site.roadAddress ?? undefined, landAreaSqm: input.officialAreaSqm ?? site.landAreaSqm ?? undefined, latitude: site.latitude, longitude: site.longitude, analysisRadiusMeters: site.analysisRadiusMeters, boundaryGeoJson });
      return { id, boundaryGeoJson };
    }),
  }),
  investigation: router({
    preview: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), lenses: z.array(z.enum(investigationLenses)).min(1).max(investigationLenses.length) })).query(async ({ ctx, input }) => {
      await ensureProjectAccess(input.projectId, ctx.user.id, ctx.user.role === "admin");
      const [dataGoKr, sgis, vworld, parcel] = await Promise.all([db.getApiCredential("dataGoKr"), db.getApiCredential("sgis"), db.getApiCredential("vworld"), db.getSiteParcel(input.projectId)]);
      const datasets = recommendInvestigationDatasets(input.lenses).map(dataset => (dataset.id === "sgis-demographics" || dataset.id === "sgis-business") && !parcel?.pnu ? { ...dataset, access: "approval_needed" as const, rationale: `${dataset.rationale} PNU는 필수가 아니며, 현재는 주소·경계 기반 조사를 먼저 진행할 수 있습니다.`, limitation: "PNU가 없으면 SGIS 시군구 통계는 보류됩니다. 다른 공공데이터·현장조사는 계속 수집할 수 있습니다." } : dataset);
      return {
        datasets,
        scopes: recommendContextScopes(input.lenses),
        providerAvailability: { dataGoKr: Boolean(dataGoKr?.isEnabled), sgis: Boolean(sgis?.isEnabled), vworld: Boolean(vworld?.isEnabled) },
      };
    }),
    savePlan: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), selectedLenses: z.array(z.enum(investigationLenses)).min(1).max(investigationLenses.length), priorityOrder: z.array(z.enum(investigationLenses)).min(1).max(investigationLenses.length), approvedDatasetIds: z.array(z.string().min(2).max(120)).max(32), contextScopeIds: z.array(z.string().min(2).max(64)).max(8) })).mutation(async ({ ctx, input }) => {
      await ensureProjectAccess(input.projectId, ctx.user.id, ctx.user.role === "admin");
      const datasets = recommendInvestigationDatasets(input.selectedLenses);
      const allowedIds = new Set(datasets.map(item => item.id));
      if (input.approvedDatasetIds.some(id => !allowedIds.has(id))) throw new TRPCError({ code: "BAD_REQUEST", message: "선택한 조사 렌즈에 포함되지 않는 데이터가 있습니다." });
      const scopes = recommendContextScopes(input.selectedLenses);
      const allowedScopeIds = new Set(scopes.map(item => item.id));
      if (input.contextScopeIds.some(id => !allowedScopeIds.has(id))) throw new TRPCError({ code: "BAD_REQUEST", message: "선택한 조사 렌즈에 맞지 않는 공간 범위가 있습니다." });
      const id = await db.saveInvestigationPlan({ projectId: input.projectId, selectedLenses: JSON.stringify(input.selectedLenses), priorityOrder: JSON.stringify(input.priorityOrder), recommendedDatasets: JSON.stringify(datasets), approvedDatasetIds: JSON.stringify(input.approvedDatasetIds), contextScopes: JSON.stringify(scopes.filter(scope => input.contextScopeIds.includes(scope.id))), status: input.approvedDatasetIds.length ? "approved" : "draft" });
      return { id, datasets, scopes };
    }),
    collectApproved: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await ensureProjectAccess(input.projectId, ctx.user.id, ctx.user.role === "admin");
      const [plan, site, parcel] = await Promise.all([db.getInvestigationPlan(input.projectId), db.getSiteForProject(input.projectId), db.getSiteParcel(input.projectId)]);
      if (!plan) throw new TRPCError({ code: "BAD_REQUEST", message: "먼저 조사 렌즈와 수집할 데이터를 승인하세요." });
      if (!site) throw new TRPCError({ code: "BAD_REQUEST", message: "데이터 수집 전에 대지 위치를 저장하세요." });
      const approved = readJsonArray(plan.approvedDatasetIds);
      if (!approved.length) throw new TRPCError({ code: "BAD_REQUEST", message: "수집하도록 승인한 데이터가 없습니다." });
      const results: Array<{ id: string; status: "collected" | "fieldwork" | "needs_connection" | "unavailable"; message: string }> = [];
      const save = async (id: string, category: "parcel" | "environment" | "transport" | "parking" | "facility" | "commerce" | "park" | "demographics", sourceName: string, upstream: { data: unknown; sourceUrl: string }, spatialScope: string, limitations: string, dataUnit: string) => {
        const summary = summarizeEvidence(upstream.data, sourceName, spatialScope);
        await db.createSnapshot({ projectId: input.projectId, siteId: site.id, category, sourceName, sourceUrl: upstream.sourceUrl, rawPayload: JSON.stringify(upstream.data).slice(0, 500_000), normalizedPayload: JSON.stringify(summary), spatialScope, dataUnit, reliability: "medium", limitations, status: "success" });
        results.push({ id, status: "collected", message: `${sourceName} 수집을 기록했습니다.` });
      };
      for (const id of approved) {
        try {
          if (id === "vworld-cadastre" || id === "adjacent-form") {
            if (!parcel) { results.push({ id, status: "unavailable", message: "먼저 VWorld 연속지적도 후보에서 조사 필지를 확정하세요." }); continue; }
            await save(id, "parcel", id === "vworld-cadastre" ? "VWorld 연속지적도 확정 필지" : "VWorld 인접 필지·경계 조사", { data: parcel, sourceUrl: parcel.sourceUrl ?? "https://www.vworld.kr/" }, id === "vworld-cadastre" ? "확정 필지" : "인접 150m", "지적도와 경계 정보는 조사 참고용이며 측량·소유·인허가의 최종 증명은 아닙니다.", "필지 도형·PNU·지목·면적" );
          } else if (id === "gw-bus") {
            const upstream = await fetchGwangjuStations();
            await save(id, "transport", "전남광주통합특별시 광주버스정보", upstream, "보행권 400m 조사 전 정류장 목록", "광주광역시 버스 정보 범위이며 실제 보행 접근성과 시간대는 별도 확인이 필요합니다.", "정류장 레코드" );
          } else if (id === "parking-context") {
            const data = await db.nearbyParking(Number(site.latitude), Number(site.longitude), 400);
            await save(id, "parking", "광주교통공사 역 인근 주차장 현황", { data, sourceUrl: "사용자 제공 광주교통공사 역 인근 주차장 현황 CSV" }, "보행권 400m", "2022-12-08 기준 제공 CSV이며 광주 지역에 한정됩니다.", "시설·수용대수" );
          } else if (id === "commerce-radius") {
            const upstream = await fetchCommerceInRadius(Number(site.latitude), Number(site.longitude), 400);
            await save(id, "commerce", "소상공인시장진흥공단 상가(상권)정보", upstream, "보행권 400m", "상가 목록은 영업 상태·시간대·보행 점유를 보장하지 않으므로 현장조사가 필요합니다.", "반경 내 상가업소" );
          } else if (id === "parks-open-space") {
            const upstream = await fetchCityParks();
            await save(id, "park", "전국도시공원정보표준데이터", upstream, "생활권 800m 후보", "원천 좌표·주소를 정규화한 뒤 실제 거리와 접근성을 확인해야 합니다.", "도시공원 표준 레코드" );
          } else if (id === "welfare-facilities") {
            const district = districtFromAddress(site.address);
            if (!district) { results.push({ id, status: "unavailable", message: "주소에서 시·군·구를 찾지 못했습니다. 대지 주소를 보완해 다시 수집하세요." }); continue; }
            const upstream = await fetchWelfareFacilities(district);
            await save(id, "facility", "한국사회보장정보원 사회복지시설", upstream, "생활권 800m 후보", "원천 시설 주소·좌표 품질과 실제 이용 가능 여부를 확인해야 합니다.", "시설 목록" );
          } else if (id === "air-quality") {
            const stations = await fetchAirStations(site.address ?? "");
            const stationName = firstStationName(stations.data);
            if (!stationName) { results.push({ id, status: "unavailable", message: "인근 대기질 측정소를 찾지 못했습니다. 주소를 보완하거나 측정소명을 직접 확인하세요." }); continue; }
            const upstream = await fetchAirQuality(stationName);
            await save(id, "environment", "에어코리아 인근 측정소 대기질", upstream, `인근 측정소 ${stationName}`, "대지 직접 측정값이 아닌 인근 측정소 관측값이며, 관측 시각과 거리를 함께 확인해야 합니다.", "측정소 관측 농도" );
          } else if (id === "sgis-demographics" || id === "sgis-business") {
            if (!parcel?.pnu) { results.push({ id, status: "unavailable", message: "PNU가 없어 SGIS 시군구 통계만 보류했습니다. 주소·대지 경계 기반 공공데이터와 현장조사는 계속 진행할 수 있습니다." }); continue; }
            const upstream = await fetchSgisCensusSummary({ pnu: parcel.pnu });
            const data = id === "sgis-business" ? { administrativeCode: upstream.data.administrativeCode, baseYears: upstream.data.baseYears, company: upstream.data.company, unavailableSections: upstream.data.unavailableSections } : { administrativeCode: upstream.data.administrativeCode, baseYears: upstream.data.baseYears, population: upstream.data.population, household: upstream.data.household, unavailableSections: upstream.data.unavailableSections };
            const partialWarning = upstream.data.unavailableSections.length ? ` 응답 보류: ${upstream.data.unavailableSections.join(" / ")}` : "";
            await save(id, "demographics", id === "sgis-business" ? "SGIS 사업체·산업 구조" : "SGIS 인구·가구·주택·연령 구조", { data, sourceUrl: upstream.sourceUrl }, `시·군·구 ${upstream.data.administrativeCode}`, `통계 공간 단위는 개별 필지와 다르고, 실제 응답 기준연도(인구 ${upstream.data.baseYears.population ?? "미확인"}·가구 ${upstream.data.baseYears.household ?? "미확인"}·사업체 ${upstream.data.baseYears.company ?? "미확인"})를 함께 읽어야 합니다.${partialWarning}`, id === "sgis-business" ? "사업체 통계" : "인구·가구 통계" );
          } else if (id === "field-section-survey") {
            const checklist = { title: "현장 단면·높이·빛 기록", tasks: ["대지 접면과 인접 도로의 레벨 차를 사진·스케치와 함께 기록", "대지 경계 양측 인접 건물의 층수·처마·입면 높이를 같은 기준점에서 비교", "오전·정오·오후 중 최소 두 시점의 빛·그늘·시선·소리를 기록", "단면선 위치와 촬영 방향을 지도 또는 스케치에 표시"], scope: "인접 150m" };
            await db.createSnapshot({ projectId: input.projectId, siteId: site.id, category: "manual", sourceName: "현장 단면·높이·빛 조사 체크리스트", sourceUrl: "", rawPayload: JSON.stringify(checklist), normalizedPayload: JSON.stringify(checklist), spatialScope: "인접 150m", dataUnit: "현장 기록 과제", reliability: "unknown", limitations: "이 항목은 공공데이터가 아니라 현장조사가 필요한 보완 과제입니다. 기록을 추가하기 전에는 설계 근거로 사용하지 않습니다.", status: "empty" });
            results.push({ id, status: "fieldwork", message: "현장 단면·높이·빛 기록 과제를 조사 이력에 추가했습니다." });
          } else {
            results.push({ id, status: "needs_connection", message: "이 데이터는 실제 API 계약·공간 단위·권한 확인이 필요해 아직 자동 수집하지 않았습니다." });
          }
        } catch (error) {
          const failure = safeExternalError(error);
          results.push({ id, status: "unavailable", message: failure.message });
        }
      }
      const collectedCount = results.filter(item => item.status === "collected").length;
      await db.saveInvestigationPlan({ projectId: input.projectId, selectedLenses: plan.selectedLenses, priorityOrder: plan.priorityOrder, recommendedDatasets: plan.recommendedDatasets, approvedDatasetIds: plan.approvedDatasetIds, contextScopes: plan.contextScopes, status: collectedCount === approved.length ? "collected" : "partial" });
      return { results, status: collectedCount === approved.length ? "collected" as const : "partial" as const };
    }),
    preflight: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await ensureProjectAccess(input.projectId, ctx.user.id, ctx.user.role === "admin");
      const result = await runPublicDataPreflight({ projectId: input.projectId, userId: ctx.user.id });
      return { status: result.collectedCount ? "success" as const : "partial" as const, ...result };
    }),
  }),
  observations: router({
    list: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).query(async ({ ctx, input }) => { await ensureProjectAccess(input.projectId, ctx.user.id, ctx.user.role === "admin"); return db.listObservations(input.projectId); }),
    create: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), title: z.string().min(1).max(160), note: z.string().min(1).max(5000), observationType: z.enum(observationTypes), latitude: z.number().min(-90).max(90).optional(), longitude: z.number().min(-180).max(180).optional(), observedAt: z.coerce.date().optional(), direction: z.string().max(32).optional(), verificationStatus: z.enum(["unverified", "confirmed", "conflicts"]).optional() })).mutation(async ({ ctx, input }) => {
      await ensureProjectAccess(input.projectId, ctx.user.id, ctx.user.role === "admin");
      return { id: await db.createObservation({ ...input, latitude: input.latitude?.toString(), longitude: input.longitude?.toString() }) };
    }),
  }),
  buildings: router({
    list: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).query(async ({ ctx, input }) => { await ensureProjectAccess(input.projectId, ctx.user.id, ctx.user.role === "admin"); return db.listBuildingSurveys(input.projectId); }),
    create: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), label: z.string().min(1).max(160), floorCount: z.number().int().min(1).max(200).optional(), estimatedHeightMeters: z.number().int().min(1).max(1500).optional(), direction: z.string().max(32).optional(), distanceMeters: z.number().int().min(0).max(10_000).optional(), relationship: z.enum(["adjacent", "across_street", "nearby", "landmark", "other"]), useOrCondition: z.string().max(160).optional(), notes: z.string().max(5000).optional(), verificationStatus: z.enum(["unverified", "estimated", "confirmed"]) })).mutation(async ({ ctx, input }) => {
      await ensureProjectAccess(input.projectId, ctx.user.id, ctx.user.role === "admin");
      return { id: await db.createBuildingSurvey(input) };
    }),
  }),
  materials: router({
    list: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).query(async ({ ctx, input }) => { await ensureProjectAccess(input.projectId, ctx.user.id, ctx.user.role === "admin"); return db.listFieldAttachments(input.projectId); }),
    upload: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), observationId: z.number().int().positive().optional(), attachmentType: z.enum(attachmentTypes), originalName: z.string().min(1).max(255), mimeType: z.string().min(3).max(120), byteSize: z.number().int().positive().max(MAX_FIELD_MATERIAL_BYTES), dataUrl: z.string().min(20).max(23_000_000), latitude: z.number().min(-90).max(90).optional(), longitude: z.number().min(-180).max(180).optional(), observedAt: z.coerce.date().optional(), direction: z.string().max(32).optional(), transcribe: z.boolean().default(false) })).mutation(async ({ ctx, input }) => {
      await ensureProjectAccess(input.projectId, ctx.user.id, ctx.user.role === "admin");
      const decoded = decodeFieldMaterialPayload(input.dataUrl);
      if (decoded.mimeType !== input.mimeType || decoded.buffer.byteLength !== input.byteSize) throw new TRPCError({ code: "BAD_REQUEST", message: "파일 메타데이터가 실제 파일과 일치하지 않습니다." });
      if (!isAllowedFieldMaterialMimeType(input.attachmentType, input.mimeType)) throw new TRPCError({ code: "BAD_REQUEST", message: "지원하지 않는 파일 형식입니다. 사진·스케치·도면(PDF)·음성 파일만 업로드할 수 있습니다." });
      const stored = await storagePut(`projects/${input.projectId}/field-materials/${sanitizeFieldMaterialName(input.originalName)}`, decoded.buffer, input.mimeType);
      let transcription: string | undefined;
      if (input.attachmentType === "audio" && input.transcribe) {
        const signedUrl = await storageGetSignedUrl(stored.key);
        const transcriptionResult = await transcribeAudio({ audioUrl: signedUrl, language: "ko", prompt: "건축 대지조사 현장 음성 메모를 한국어로 전사합니다." });
        if ("error" in transcriptionResult) throw new TRPCError({ code: "BAD_REQUEST", message: `음성 전사에 실패했습니다: ${transcriptionResult.error}` });
        transcription = transcriptionResult.text;
      }
      const id = await db.createFieldAttachment({ projectId: input.projectId, observationId: input.observationId, attachmentType: input.attachmentType, fileKey: stored.key, fileUrl: stored.url, originalName: input.originalName, mimeType: input.mimeType, byteSize: input.byteSize, latitude: input.latitude?.toString(), longitude: input.longitude?.toString(), observedAt: input.observedAt, direction: input.direction, transcription });
      return { id, ...stored, transcription };
    }),
  }),
  relationships: router({
    list: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).query(async ({ ctx, input }) => { await ensureProjectAccess(input.projectId, ctx.user.id, ctx.user.role === "admin"); return db.listRelationshipCards(input.projectId); }),
    create: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), title: z.string().min(2).max(160), relationshipType: z.enum(relationshipTypes), evidence: z.string().min(3).max(5000), tensionOrOpportunity: z.string().max(5000).optional(), additionalResearch: z.string().max(3000).optional() })).mutation(async ({ ctx, input }) => { await ensureProjectAccess(input.projectId, ctx.user.id, ctx.user.role === "admin"); return { id: await db.createRelationshipCard(input) }; }),
    review: protectedProcedure.input(z.object({ id: z.number().int().positive(), projectId: z.number().int().positive(), stance: z.enum(reviewStatuses), userNote: z.string().max(3000).optional() })).mutation(async ({ ctx, input }) => { await ensureProjectAccess(input.projectId, ctx.user.id, ctx.user.role === "admin"); await db.updateRelationshipStance(input.id, input.projectId, input.stance, input.userNote); return { success: true }; }),
  }),
  designCards: router({
    list: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).query(async ({ ctx, input }) => { await ensureProjectAccess(input.projectId, ctx.user.id, ctx.user.role === "admin"); return db.listDesignCards(input.projectId); }),
    create: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), cardType: z.enum(["fact", "observation", "interpretation", "hypothesis", "unknown"]), keyword: z.string().min(1).max(80), claim: z.string().min(1).max(3000), evidence: z.string().max(3000).optional(), designApplication: z.string().max(3000).optional() })).mutation(async ({ ctx, input }) => { await ensureProjectAccess(input.projectId, ctx.user.id, ctx.user.role === "admin"); return { id: await db.createDesignCard(input) }; }),
    review: protectedProcedure.input(z.object({ id: z.number().int().positive(), projectId: z.number().int().positive(), reviewStatus: z.enum(reviewStatuses), reviewNote: z.string().max(3000).optional() })).mutation(async ({ ctx, input }) => { await ensureProjectAccess(input.projectId, ctx.user.id, ctx.user.role === "admin"); await db.reviewDesignCard(input.id, input.projectId, input.reviewStatus, input.reviewNote); return { success: true }; }),
  }),
  analysis: router({
    collect: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), category: z.enum(categories), areaCd: z.string().max(8).optional(), ucodeList: z.string().max(100).optional(), landUseNm: z.string().max(120).optional(), stationName: z.string().max(100).optional(), districtName: z.string().max(120).optional(), busStopId: z.string().max(32).optional() })).mutation(async ({ ctx, input }) => {
      await ensureProjectAccess(input.projectId, ctx.user.id, ctx.user.role === "admin");
      const site = await db.getSiteForProject(input.projectId);
      try {
        let upstream: { data: unknown; sourceUrl: string; status: number };
        let sourceName = "";
        let limitations = "";
        if (input.category === "regulation") { upstream = await fetchLandUse({ areaCd: input.areaCd ?? "", ucodeList: input.ucodeList ?? "", landUseNm: input.landUseNm ?? "" }); sourceName = "토지이용규제 행위제한정보"; limitations = "지역지구 코드와 토지이용행위명 기반의 보조 조회입니다. 용도지역·지구의 최종 확정과 인허가 가능성은 토지이음 원문 및 관할 행정기관 확인이 필요합니다."; }
        else if (input.category === "environment") { upstream = await fetchAirQuality(input.stationName ?? ""); sourceName = "에어코리아"; limitations = "대지 직접 측정값이 아닌 인근 측정소 관측값입니다."; }
        else if (input.category === "transport") { upstream = input.busStopId ? await fetchGwangjuArrivals(input.busStopId) : await fetchGwangjuStations(); sourceName = "광주광역시 BIS"; limitations = "광주광역시 버스 정보 범위이며 실시간 정보는 조회 시점에 달라질 수 있습니다."; }
        else if (input.category === "facility") { upstream = await fetchWelfareFacilities(input.districtName ?? ""); sourceName = "한국사회보장정보원 사회복지시설"; limitations = "원천 데이터에 좌표가 없어 주소 지오코딩 품질을 확인한 결과만 지도·반경 분석에 사용해야 합니다."; }
        else if (input.category === "commerce") { if (!site) throw new ExternalDataError("BAD_REQUEST", "상권 분석 전 먼저 대지 위치를 저장해야 합니다."); upstream = await fetchCommerceInRadius(Number(site.latitude), Number(site.longitude), site.analysisRadiusMeters); sourceName = "소상공인시장진흥공단 상가(상권)정보"; limitations = "대지 중심 반경 내 상가업소 목록입니다. 실제 보행 접근·영업 상태·생활권 영향은 현장 조사로 확인해야 합니다."; }
        else if (input.category === "park") { upstream = await fetchCityParks(); sourceName = "전국도시공원정보표준데이터"; limitations = "전국 표준데이터의 제한된 페이지를 기록합니다. 대지 반경 내 여부는 좌표·주소 품질을 확인한 뒤 별도로 판단해야 합니다."; }
        else {
          if (!site) throw new ExternalDataError("BAD_REQUEST", "주차 분석 전 먼저 대지 위치를 저장해야 합니다.");
          const data = await db.nearbyParking(Number(site.latitude), Number(site.longitude), site.analysisRadiusMeters);
          upstream = { data, sourceUrl: "사용자 제공 광주교통공사 역 인근 주차장 현황 CSV", status: 200 };
          sourceName = "광주교통공사 역 인근 주차장 현황";
          limitations = "2022-12-08 기준 제공 CSV이며 광주 지역에 한정됩니다.";
        }
        const metadata = input.category === "environment" ? { dataUnit: "측정소 관측 농도", reliability: "high" as const } : input.category === "parking" ? { dataUnit: "시설·수용대수", reliability: "medium" as const } : input.category === "commerce" ? { dataUnit: "대지 중심 반경 내 상가업소", reliability: "medium" as const } : input.category === "park" ? { dataUnit: "도시공원 표준 레코드", reliability: "medium" as const } : { dataUnit: "공공 API 원천 레코드", reliability: "medium" as const };
        const id = await db.createSnapshot({ projectId: input.projectId, siteId: site?.id, category: input.category, sourceName, sourceUrl: upstream.sourceUrl, rawPayload: JSON.stringify(upstream.data).slice(0, 500_000), normalizedPayload: JSON.stringify(upstream.data).slice(0, 500_000), spatialScope: site ? `${site.analysisRadiusMeters}m 반경` : undefined, ...metadata, limitations, status: "success" });
        await db.recordApiAudit({ provider: input.category === "parking" ? "parkingCsv" : "dataGoKr", operation: "collect", success: true, responseStatus: upstream.status, initiatedBy: ctx.user.id });
        return { id, status: "success" as const, data: upstream.data, sourceName, sourceUrl: upstream.sourceUrl, limitations };
      } catch (error) {
        const failure = safeExternalError(error);
        await db.createSnapshot({ projectId: input.projectId, siteId: site?.id, category: input.category, sourceName: input.category, limitations: failure.message, status: "unavailable" });
        await db.recordApiAudit({ provider: input.category, operation: "collect", success: false, responseStatus: failure.status, safeMessage: failure.message, initiatedBy: ctx.user.id });
        return { status: "unavailable" as const, error: failure };
      }
    }),
    snapshots: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).query(async ({ ctx, input }) => { await ensureProjectAccess(input.projectId, ctx.user.id, ctx.user.role === "admin"); return db.listSnapshots(input.projectId); }),
    airStations: protectedProcedure.input(z.object({ address: z.string().min(2).max(120) })).query(async ({ input }) => {
      try { return { status: "success" as const, result: await fetchAirStations(input.address) }; }
      catch (error) { return { status: "unavailable" as const, error: safeExternalError(error) }; }
    }),
  }),
  reports: router({
    list: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).query(async ({ ctx, input }) => { await ensureProjectAccess(input.projectId, ctx.user.id, ctx.user.role === "admin"); return db.listAiReports(input.projectId); }),
    generate: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await ensureProjectAccess(input.projectId, ctx.user.id, ctx.user.role === "admin");
      const bundle = await db.getProjectBundle(input.projectId);
      if (!bundle.site) throw new TRPCError({ code: "BAD_REQUEST", message: "AI 보고서 전에 대지 위치를 저장하세요." });
      if (!bundle.investigationPlan || !["partial", "collected"].includes(bundle.investigationPlan.status)) throw new TRPCError({ code: "BAD_REQUEST", message: "AI 설계 전환 전에 조사 계획을 승인하고 최소 한 번의 데이터 수집을 실행하세요." });
      if (!bundle.snapshots.some(snapshot => snapshot.status === "success") && bundle.observations.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "AI 설계 전환 전에 최소 하나의 실제 공공데이터 수집 또는 현장 관찰을 추가하세요." });
      const generated = await generateSiteReport(bundle);
      const id = await db.createAiReport({ projectId: input.projectId, inputSnapshotIds: JSON.stringify(bundle.snapshots.map(item => item.id)), modelId: generated.modelId, reportJson: JSON.stringify(generated.report) });
      return { id, ...generated };
    }),
    review: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), reportId: z.number().int().positive(), stance: z.enum(reviewStatuses), note: z.string().max(5000).optional() })).mutation(async ({ ctx, input }) => {
      await ensureProjectAccess(input.projectId, ctx.user.id, ctx.user.role === "admin");
      const report = (await db.listAiReports(input.projectId)).find(item => item.id === input.reportId);
      if (!report) throw new TRPCError({ code: "NOT_FOUND", message: "AI 보고서를 찾을 수 없습니다." });
      let content: Record<string, unknown>;
      try { content = JSON.parse(report.userEditedJson ?? report.reportJson) as Record<string, unknown>; } catch { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI 보고서 형식을 읽지 못했습니다." }); }
      content.userReview = { stance: input.stance, note: input.note ?? "", reviewedAt: new Date().toISOString() };
      await db.updateAiReportReview(input.reportId, input.projectId, JSON.stringify(content));
      return { success: true };
    }),
  }),
  admin: router({
    apiCredentials: router({
      list: adminProcedure.query(async () => (await db.listApiCredentials()).map(item => ({ group: item.provider, isEnabled: item.isEnabled, keyVersion: item.keyVersion, lastValidatedAt: item.lastValidatedAt, lastValidationError: item.lastValidationError, maskedValue: maskSecret("configured") }))),
      upsert: adminProcedure.input(z.object({ group: z.enum(providers), primary: z.string().min(10).max(1000), secondary: z.string().max(1000).optional(), isEnabled: z.boolean().default(true) })).mutation(async ({ ctx, input }) => {
        const encrypted = encryptSecret(JSON.stringify({ primary: input.primary.trim(), secondary: input.secondary?.trim() || undefined }));
        await db.upsertApiCredential({ provider: input.group, ...encrypted, updatedBy: ctx.user.id, isEnabled: input.isEnabled });
        await db.recordApiAudit({ provider: input.group, operation: "credential_upsert", success: true, safeMessage: "제공기관 공통 키가 암호화되어 저장되었습니다.", initiatedBy: ctx.user.id });
        return { success: true };
      }),
      validate: adminProcedure.input(z.object({ group: z.enum(providers) })).mutation(async ({ ctx, input }) => {
        try {
          const result = await validateProviderCredential(input.group);
          await db.recordApiCredentialValidation(input.group, true);
          await db.recordApiAudit({ provider: input.group, operation: "credential_validate", success: true, responseStatus: result.status, safeMessage: "실제 경량 요청으로 API 키를 검증했습니다.", initiatedBy: ctx.user.id });
          return { success: true as const, message: "실제 제공기관 응답을 확인했습니다." };
        } catch (error) {
          const failure = safeExternalError(error);
          await db.recordApiCredentialValidation(input.group, false, failure.message);
          await db.recordApiAudit({ provider: input.group, operation: "credential_validate", success: false, responseStatus: failure.status, safeMessage: failure.message, initiatedBy: ctx.user.id });
          return { success: false as const, message: failure.message };
        }
      }),
      disable: adminProcedure.input(z.object({ group: z.enum(providers) })).mutation(async ({ ctx, input }) => { await db.disableApiCredential(input.group); await db.recordApiAudit({ provider: input.group, operation: "credential_disable", success: true, initiatedBy: ctx.user.id }); return { success: true }; }),
    }),
    cadastral: router({
      list: adminProcedure.query(() => db.listCadastralImportHistory()),
      upload: adminProcedure.input(z.object({ originalName: z.string().min(5).max(255).regex(/\.zip$/i, "ZIP 파일만 업로드할 수 있습니다."), dataUrl: z.string().min(100).max(48_000_000) })).mutation(async ({ ctx, input }) => {
        let importId: number | undefined;
        try {
          const parsed = await parseCadastralArchive(input);
          const safeName = input.originalName.replace(/[^0-9A-Za-z가-힣._-]/g, "-");
          const stored = await storagePut(`admin/cadastral/${parsed.districtCode}/${parsed.datasetReference}/${Date.now()}-${safeName}`, parsed.buffer, "application/zip");
          importId = await db.beginCadastralImport({ districtCode: parsed.districtCode, districtName: parsed.districtName, datasetReference: parsed.datasetReference, sourceFileName: input.originalName, sourceFileKey: stored.key, sourceFileUrl: stored.url, sha256: createHash("sha256").update(parsed.buffer).digest("hex"), featureCount: parsed.rows.length, coordinateReference: "WGS84 경위도 (SHP PRJ 변환)", importedBy: ctx.user.id });
          for (let start = 0; start < parsed.rows.length; start += 100) await db.insertCadastralParcelBatch(importId, parsed.rows.slice(start, start + 100));
          await db.completeCadastralImport(importId, parsed.rows.length);
          await db.recordApiAudit({ provider: "localCadastral", operation: "cadastral_upload", success: true, responseStatus: 201, safeMessage: `${parsed.districtName} ${parsed.datasetReference} 연속지적도 ${parsed.rows.length.toLocaleString("ko-KR")}필지를 적재했습니다.`, initiatedBy: ctx.user.id });
          return { success: true as const, districtName: parsed.districtName, datasetReference: parsed.datasetReference, featureCount: parsed.rows.length };
        } catch (error) {
          const safeMessage = error instanceof Error ? error.message.slice(0, 280) : "연속지적도 파일을 처리하지 못했습니다.";
          if (importId) await db.failCadastralImport(importId, safeMessage);
          await db.recordApiAudit({ provider: "localCadastral", operation: "cadastral_upload", success: false, safeMessage, initiatedBy: ctx.user.id });
          throw new TRPCError({ code: "BAD_REQUEST", message: safeMessage });
        }
      }),
    }),
  }),
});

export type AppRouter = typeof appRouter;
