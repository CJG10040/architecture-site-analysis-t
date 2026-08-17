import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { encryptSecret, maskSecret } from "./lib/credentialCrypto";
import { ExternalDataError, fetchAirQuality, fetchAirStations, fetchCityParks, fetchCommerceInRadius, fetchGwangjuArrivals, fetchGwangjuStations, fetchLandUse, fetchSgisCensusSummary, fetchVworldParcelCandidates, fetchWelfareFacilities } from "./lib/dataAdapters";
import { generateSiteReport } from "./lib/reportGenerator";
import { credentialGroupIds } from "../shared/integrations";
import { investigationLenses, recommendContextScopes, recommendInvestigationDatasets } from "../shared/investigationPlan";
import { normalizeBoundaryGeoJson } from "./lib/boundaryGeoJson";
import { summarizeEvidence } from "./lib/evidenceSummary";
import { storageGetSignedUrl, storagePut } from "./storage";
import { transcribeAudio } from "./_core/voiceTranscription";
import { decodeFieldMaterialPayload, isAllowedFieldMaterialMimeType, MAX_FIELD_MATERIAL_BYTES, sanitizeFieldMaterialName } from "./lib/fieldMaterials";

const providers = credentialGroupIds;
const categories = ["regulation", "environment", "transport", "parking", "facility", "commerce", "park"] as const;
const observationTypes = ["movement", "sound", "light", "material", "boundary", "activity", "other"] as const;
const attachmentTypes = ["photo", "sketch", "drawing", "document", "audio", "other"] as const;
const relationshipTypes = ["adjacency", "access", "density", "time", "conflict", "repetition", "disconnection", "coexistence", "exclusion", "preservation", "other"] as const;
const reviewStatuses = ["undecided", "agree", "partial", "different", "not_important", "research", "counter", "develop"] as const;

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
      const [dataGoKr, sgis, vworld] = await Promise.all([db.getApiCredential("dataGoKr"), db.getApiCredential("sgis"), db.getApiCredential("vworld")]);
      return {
        datasets: recommendInvestigationDatasets(input.lenses),
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
            if (!parcel?.pnu) { results.push({ id, status: "unavailable", message: "SGIS 통계 수집에는 확정 필지의 PNU가 필요합니다. 연속지적도 후보 또는 PNU 직접 입력으로 필지를 먼저 확정하세요." }); continue; }
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
  }),
  observations: router({
    list: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).query(async ({ ctx, input }) => { await ensureProjectAccess(input.projectId, ctx.user.id, ctx.user.role === "admin"); return db.listObservations(input.projectId); }),
    create: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), title: z.string().min(1).max(160), note: z.string().min(1).max(5000), observationType: z.enum(observationTypes), latitude: z.number().min(-90).max(90).optional(), longitude: z.number().min(-180).max(180).optional(), observedAt: z.coerce.date().optional(), direction: z.string().max(32).optional(), verificationStatus: z.enum(["unverified", "confirmed", "conflicts"]).optional() })).mutation(async ({ ctx, input }) => {
      await ensureProjectAccess(input.projectId, ctx.user.id, ctx.user.role === "admin");
      return { id: await db.createObservation({ ...input, latitude: input.latitude?.toString(), longitude: input.longitude?.toString() }) };
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
      disable: adminProcedure.input(z.object({ group: z.enum(providers) })).mutation(async ({ ctx, input }) => { await db.disableApiCredential(input.group); await db.recordApiAudit({ provider: input.group, operation: "credential_disable", success: true, initiatedBy: ctx.user.id }); return { success: true }; }),
    }),
  }),
});

export type AppRouter = typeof appRouter;
