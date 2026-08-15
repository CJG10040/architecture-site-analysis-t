import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import * as schema from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: schema.InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: schema.InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(schema.users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(schema.users).where(eq(schema.users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("데이터베이스에 연결할 수 없습니다.");
  return db;
}

export async function createProject(input: { ownerId: number; title: string; architecturalProgram?: string; expectedScale?: string; assignmentTheme?: string; interestLens?: string; firstQuestion?: string; siteVisitStatus?: "planned" | "completed" | "unknown" }) {
  const db = await requireDb();
  const result = await db.insert(schema.projects).values(input);
  return Number(result[0]?.insertId);
}

export async function listProjects(ownerId: number) {
  const db = await requireDb();
  return db.select().from(schema.projects).where(eq(schema.projects.ownerId, ownerId)).orderBy(desc(schema.projects.updatedAt));
}

export async function getProject(projectId: number) {
  const db = await requireDb();
  return (await db.select().from(schema.projects).where(eq(schema.projects.id, projectId)).limit(1))[0];
}

export async function getProjectForOwner(projectId: number, ownerId: number) {
  const db = await requireDb();
  return (await db.select().from(schema.projects).where(and(eq(schema.projects.id, projectId), eq(schema.projects.ownerId, ownerId))).limit(1))[0];
}

export async function saveSite(input: { projectId: number; address?: string; latitude: string; longitude: string; analysisRadiusMeters: number; boundaryGeoJson?: string }) {
  const db = await requireDb();
  const existing = (await db.select().from(schema.sites).where(eq(schema.sites.projectId, input.projectId)).limit(1))[0];
  if (existing) {
    await db.update(schema.sites).set(input).where(eq(schema.sites.id, existing.id));
    return existing.id;
  }
  const result = await db.insert(schema.sites).values(input);
  return Number(result[0]?.insertId);
}

export async function getSiteForProject(projectId: number) {
  const db = await requireDb();
  return (await db.select().from(schema.sites).where(eq(schema.sites.projectId, projectId)).limit(1))[0];
}

export async function createSnapshot(input: { projectId: number; siteId?: number; category: "regulation" | "environment" | "transport" | "parking" | "facility" | "manual"; sourceName: string; sourceUrl?: string; rawPayload?: string; normalizedPayload?: string; spatialScope?: string; limitations?: string; status: "success" | "empty" | "unavailable" | "error" }) {
  const db = await requireDb();
  const result = await db.insert(schema.analysisSnapshots).values(input);
  return Number(result[0]?.insertId);
}

export async function listSnapshots(projectId: number) {
  const db = await requireDb();
  return db.select().from(schema.analysisSnapshots).where(eq(schema.analysisSnapshots.projectId, projectId)).orderBy(desc(schema.analysisSnapshots.retrievedAt));
}

export async function createObservation(input: { projectId: number; title: string; note: string; observationType: "movement" | "sound" | "light" | "material" | "boundary" | "activity" | "other"; latitude?: string; longitude?: string; direction?: string }) {
  const db = await requireDb();
  const result = await db.insert(schema.fieldObservations).values(input);
  return Number(result[0]?.insertId);
}

export async function listObservations(projectId: number) {
  const db = await requireDb();
  return db.select().from(schema.fieldObservations).where(eq(schema.fieldObservations.projectId, projectId)).orderBy(desc(schema.fieldObservations.createdAt));
}

export async function createDesignCard(input: { projectId: number; cardType: "fact" | "observation" | "interpretation" | "hypothesis" | "unknown"; keyword: string; claim: string; evidence?: string; designApplication?: string; sourceSnapshotIds?: string }) {
  const db = await requireDb();
  const result = await db.insert(schema.designCards).values(input);
  return Number(result[0]?.insertId);
}

export async function listDesignCards(projectId: number) {
  const db = await requireDb();
  return db.select().from(schema.designCards).where(eq(schema.designCards.projectId, projectId)).orderBy(desc(schema.designCards.updatedAt));
}

export async function createAiReport(input: { projectId: number; inputSnapshotIds: string; modelId: string; reportJson: string }) {
  const db = await requireDb();
  const result = await db.insert(schema.aiReports).values(input);
  return Number(result[0]?.insertId);
}

export async function listAiReports(projectId: number) {
  const db = await requireDb();
  return db.select().from(schema.aiReports).where(eq(schema.aiReports.projectId, projectId)).orderBy(desc(schema.aiReports.createdAt));
}

export async function getApiCredential(provider: string) {
  const db = await requireDb();
  return (await db.select().from(schema.apiCredentials).where(eq(schema.apiCredentials.provider, provider)).limit(1))[0];
}

export async function listApiCredentials() {
  const db = await requireDb();
  return db.select().from(schema.apiCredentials).orderBy(schema.apiCredentials.provider);
}

export async function upsertApiCredential(input: { provider: string; encryptedValue: string; initializationVector: string; authenticationTag: string; keyVersion: string; updatedBy: number; isEnabled: boolean }) {
  const db = await requireDb();
  const existing = await getApiCredential(input.provider);
  if (existing) {
    await db.update(schema.apiCredentials).set({ ...input, lastValidationError: null }).where(eq(schema.apiCredentials.id, existing.id));
    return existing.id;
  }
  const result = await db.insert(schema.apiCredentials).values(input);
  return Number(result[0]?.insertId);
}

export async function disableApiCredential(provider: string) {
  const db = await requireDb();
  await db.update(schema.apiCredentials).set({ isEnabled: false }).where(eq(schema.apiCredentials.provider, provider));
}

export async function recordApiAudit(input: { provider: string; operation: string; success: boolean; responseStatus?: number; safeMessage?: string; initiatedBy?: number }) {
  const db = await requireDb();
  await db.insert(schema.apiAuditLogs).values(input);
}

const toRadians = (value: number) => (value * Math.PI) / 180;
export function haversineMeters(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) {
  const radius = 6_371_000;
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function nearbyParking(latitude: number, longitude: number, radiusMeters: number) {
  const db = await requireDb();
  const all = await db.select().from(schema.parkingFacilities);
  return all.map(item => ({ ...item, distanceMeters: Math.round(haversineMeters({ latitude, longitude }, { latitude: Number(item.latitude), longitude: Number(item.longitude) })) })).filter(item => item.distanceMeters <= radiusMeters).sort((a, b) => a.distanceMeters - b.distanceMeters);
}

export async function getProjectBundle(projectId: number) {
  const project = await getProject(projectId);
  const site = await getSiteForProject(projectId);
  const snapshots = await listSnapshots(projectId);
  const observations = await listObservations(projectId);
  const cards = await listDesignCards(projectId);
  const reports = await listAiReports(projectId);
  return { project, site, snapshots, observations, cards, reports };
}
