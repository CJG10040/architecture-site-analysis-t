import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { encryptSecret, maskSecret } from "./lib/credentialCrypto";
import { ExternalDataError, fetchAirQuality, fetchGwangjuArrivals, fetchGwangjuStations, fetchLandUse, fetchWelfareFacilities } from "./lib/dataAdapters";
import { generateSiteReport } from "./lib/reportGenerator";
import { credentialGroupIds } from "../shared/integrations";

const providers = credentialGroupIds;
const categories = ["regulation", "environment", "transport", "parking", "facility"] as const;
const observationTypes = ["movement", "sound", "light", "material", "boundary", "activity", "other"] as const;

async function ensureProjectAccess(projectId: number, userId: number, isAdmin = false) {
  const project = isAdmin ? await db.getProject(projectId) : await db.getProjectForOwner(projectId, userId);
  if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "프로젝트를 찾을 수 없거나 접근 권한이 없습니다." });
  return project;
}

function safeExternalError(error: unknown) {
  if (error instanceof ExternalDataError) return { code: error.code, message: error.message, status: error.status };
  return { code: "UNAVAILABLE", message: "외부 데이터 처리 중 오류가 발생했습니다." };
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
    create: protectedProcedure.input(z.object({ title: z.string().min(2).max(160), architecturalProgram: z.string().max(2000).optional(), expectedScale: z.string().max(160).optional(), assignmentTheme: z.string().max(2000).optional(), interestLens: z.string().max(160).optional(), firstQuestion: z.string().max(2000).optional(), siteVisitStatus: z.enum(["planned", "completed", "unknown"]).optional() })).mutation(async ({ ctx, input }) => ({ id: await db.createProject({ ...input, ownerId: ctx.user.id }) })),
    get: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).query(async ({ ctx, input }) => db.getProjectBundle((await ensureProjectAccess(input.projectId, ctx.user.id, ctx.user.role === "admin")).id)),
  }),
  sites: router({
    save: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), address: z.string().max(600).optional(), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), analysisRadiusMeters: z.number().int().min(100).max(5000), boundaryGeoJson: z.string().max(100_000).optional() })).mutation(async ({ ctx, input }) => {
      await ensureProjectAccess(input.projectId, ctx.user.id, ctx.user.role === "admin");
      return { id: await db.saveSite({ ...input, latitude: String(input.latitude), longitude: String(input.longitude) }) };
    }),
  }),
  observations: router({
    list: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).query(async ({ ctx, input }) => { await ensureProjectAccess(input.projectId, ctx.user.id, ctx.user.role === "admin"); return db.listObservations(input.projectId); }),
    create: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), title: z.string().min(1).max(160), note: z.string().min(1).max(5000), observationType: z.enum(observationTypes), latitude: z.number().min(-90).max(90).optional(), longitude: z.number().min(-180).max(180).optional(), direction: z.string().max(32).optional() })).mutation(async ({ ctx, input }) => {
      await ensureProjectAccess(input.projectId, ctx.user.id, ctx.user.role === "admin");
      return { id: await db.createObservation({ ...input, latitude: input.latitude?.toString(), longitude: input.longitude?.toString() }) };
    }),
  }),
  designCards: router({
    list: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).query(async ({ ctx, input }) => { await ensureProjectAccess(input.projectId, ctx.user.id, ctx.user.role === "admin"); return db.listDesignCards(input.projectId); }),
    create: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), cardType: z.enum(["fact", "observation", "interpretation", "hypothesis", "unknown"]), keyword: z.string().min(1).max(80), claim: z.string().min(1).max(3000), evidence: z.string().max(3000).optional(), designApplication: z.string().max(3000).optional() })).mutation(async ({ ctx, input }) => { await ensureProjectAccess(input.projectId, ctx.user.id, ctx.user.role === "admin"); return { id: await db.createDesignCard(input) }; }),
  }),
  analysis: router({
    collect: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), category: z.enum(categories), pnu: z.string().max(32).optional(), stationName: z.string().max(100).optional(), districtName: z.string().max(120).optional(), busStopId: z.string().max(32).optional() })).mutation(async ({ ctx, input }) => {
      await ensureProjectAccess(input.projectId, ctx.user.id, ctx.user.role === "admin");
      const site = await db.getSiteForProject(input.projectId);
      try {
        let upstream: { data: unknown; sourceUrl: string; status: number };
        let sourceName = "";
        let limitations = "";
        if (input.category === "regulation") { upstream = await fetchLandUse(input.pnu ?? ""); sourceName = "토지이용규제정보"; limitations = "법적 인허가 가능성의 최종 판단이 아니며, 원문과 관할 행정기관 확인이 필요합니다."; }
        else if (input.category === "environment") { upstream = await fetchAirQuality(input.stationName ?? ""); sourceName = "에어코리아"; limitations = "대지 직접 측정값이 아닌 인근 측정소 관측값입니다."; }
        else if (input.category === "transport") { upstream = input.busStopId ? await fetchGwangjuArrivals(input.busStopId) : await fetchGwangjuStations(); sourceName = "광주광역시 BIS"; limitations = "광주광역시 버스 정보 범위이며 실시간 정보는 조회 시점에 달라질 수 있습니다."; }
        else if (input.category === "facility") { upstream = await fetchWelfareFacilities(input.districtName ?? ""); sourceName = "한국사회보장정보원 사회복지시설"; limitations = "원천 데이터에 좌표가 없어 주소 지오코딩 품질을 확인한 결과만 지도·반경 분석에 사용해야 합니다."; }
        else {
          if (!site) throw new ExternalDataError("BAD_REQUEST", "주차 분석 전 먼저 대지 위치를 저장해야 합니다.");
          const data = await db.nearbyParking(Number(site.latitude), Number(site.longitude), site.analysisRadiusMeters);
          upstream = { data, sourceUrl: "사용자 제공 광주교통공사 역 인근 주차장 현황 CSV", status: 200 };
          sourceName = "광주교통공사 역 인근 주차장 현황";
          limitations = "2022-12-08 기준 제공 CSV이며 광주 지역에 한정됩니다.";
        }
        const id = await db.createSnapshot({ projectId: input.projectId, siteId: site?.id, category: input.category, sourceName, sourceUrl: upstream.sourceUrl, rawPayload: JSON.stringify(upstream.data).slice(0, 500_000), normalizedPayload: JSON.stringify(upstream.data).slice(0, 500_000), spatialScope: site ? `${site.analysisRadiusMeters}m 반경` : undefined, limitations, status: "success" });
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
  }),
  reports: router({
    list: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).query(async ({ ctx, input }) => { await ensureProjectAccess(input.projectId, ctx.user.id, ctx.user.role === "admin"); return db.listAiReports(input.projectId); }),
    generate: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await ensureProjectAccess(input.projectId, ctx.user.id, ctx.user.role === "admin");
      const bundle = await db.getProjectBundle(input.projectId);
      if (!bundle.site) throw new TRPCError({ code: "BAD_REQUEST", message: "AI 보고서 전에 대지 위치를 저장하세요." });
      if (bundle.snapshots.length === 0 && bundle.observations.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "AI 보고서 전에 최소 하나의 데이터 수집 또는 현장 관찰을 추가하세요." });
      const generated = await generateSiteReport(bundle);
      const id = await db.createAiReport({ projectId: input.projectId, inputSnapshotIds: JSON.stringify(bundle.snapshots.map(item => item.id)), modelId: generated.modelId, reportJson: JSON.stringify(generated.report) });
      return { id, ...generated };
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
