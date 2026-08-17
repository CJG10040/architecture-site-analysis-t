import { boolean, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  title: varchar("title", { length: 160 }).notNull(),
  architecturalProgram: text("architecturalProgram"),
  expectedScale: varchar("expectedScale", { length: 160 }),
  assignmentTheme: text("assignmentTheme"),
  targetUsers: text("targetUsers"),
  interestLens: varchar("interestLens", { length: 160 }),
  firstQuestion: text("firstQuestion"),
  deliverableFormat: varchar("deliverableFormat", { length: 160 }),
  avoidInterpretations: text("avoidInterpretations"),
  siteVisitStatus: mysqlEnum("siteVisitStatus", ["planned", "completed", "unknown"]).default("unknown").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const sites = mysqlTable("sites", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull().unique(),
  address: text("address"),
  parcelNumber: varchar("parcelNumber", { length: 64 }),
  roadAddress: text("roadAddress"),
  latitude: varchar("latitude", { length: 32 }).notNull(),
  longitude: varchar("longitude", { length: 32 }).notNull(),
  landAreaSqm: varchar("landAreaSqm", { length: 32 }),
  boundaryGeoJson: text("boundaryGeoJson"),
  analysisRadiusMeters: int("analysisRadiusMeters").default(800).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const analysisSnapshots = mysqlTable("analysisSnapshots", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  siteId: int("siteId"),
  category: mysqlEnum("analysisCategory", ["regulation", "environment", "transport", "parking", "facility", "commerce", "park", "manual"]).notNull(),
  sourceName: varchar("sourceName", { length: 160 }).notNull(),
  sourceUrl: text("sourceUrl"),
  rawPayload: text("rawPayload"),
  normalizedPayload: text("normalizedPayload"),
  retrievedAt: timestamp("retrievedAt").defaultNow().notNull(),
  datasetUpdatedAt: varchar("datasetUpdatedAt", { length: 64 }),
  spatialScope: varchar("spatialScope", { length: 160 }),
  dataUnit: varchar("dataUnit", { length: 120 }),
  reliability: mysqlEnum("snapshotReliability", ["high", "medium", "low", "unknown"]).default("unknown").notNull(),
  limitations: text("limitations"),
  status: mysqlEnum("snapshotStatus", ["success", "empty", "unavailable", "error"]).default("success").notNull(),
});

export const fieldObservations = mysqlTable("fieldObservations", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  title: varchar("title", { length: 160 }).notNull(),
  note: text("note").notNull(),
  observationType: mysqlEnum("observationType", ["movement", "sound", "light", "material", "boundary", "activity", "other"]).default("other").notNull(),
  latitude: varchar("latitude", { length: 32 }),
  longitude: varchar("longitude", { length: 32 }),
  observedAt: timestamp("observedAt"),
  direction: varchar("direction", { length: 32 }),
  attachmentUrl: text("attachmentUrl"),
  verificationStatus: mysqlEnum("verificationStatus", ["unverified", "confirmed", "conflicts"]).default("unverified").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const fieldAttachments = mysqlTable("fieldAttachments", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  observationId: int("observationId"),
  attachmentType: mysqlEnum("attachmentType", ["photo", "sketch", "drawing", "document", "audio", "other"]).notNull(),
  fileKey: text("fileKey").notNull(),
  fileUrl: text("fileUrl").notNull(),
  originalName: varchar("originalName", { length: 255 }).notNull(),
  mimeType: varchar("mimeType", { length: 120 }).notNull(),
  byteSize: int("byteSize").notNull(),
  latitude: varchar("latitude", { length: 32 }),
  longitude: varchar("longitude", { length: 32 }),
  observedAt: timestamp("observedAt"),
  direction: varchar("direction", { length: 32 }),
  transcription: text("transcription"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const relationshipCards = mysqlTable("relationshipCards", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  title: varchar("title", { length: 160 }).notNull(),
  relationshipType: mysqlEnum("relationshipType", ["adjacency", "access", "density", "time", "conflict", "repetition", "disconnection", "coexistence", "exclusion", "preservation", "other"]).notNull(),
  evidence: text("evidence").notNull(),
  tensionOrOpportunity: text("tensionOrOpportunity"),
  additionalResearch: text("additionalResearch"),
  stance: mysqlEnum("relationshipStance", ["undecided", "agree", "partial", "different", "not_important", "research", "counter", "develop"]).default("undecided").notNull(),
  userNote: text("userNote"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const designCards = mysqlTable("designCards", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  cardType: mysqlEnum("designCardType", ["fact", "observation", "interpretation", "hypothesis", "unknown"]).notNull(),
  keyword: varchar("keyword", { length: 80 }).notNull(),
  claim: text("claim").notNull(),
  evidence: text("evidence"),
  designApplication: text("designApplication"),
  sourceSnapshotIds: text("sourceSnapshotIds"),
  reviewStatus: mysqlEnum("designCardReviewStatus", ["undecided", "agree", "partial", "different", "not_important", "research", "counter", "develop"]).default("undecided").notNull(),
  reviewNote: text("reviewNote"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const aiReports = mysqlTable("aiReports", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  inputSnapshotIds: text("inputSnapshotIds").notNull(),
  modelId: varchar("modelId", { length: 128 }).notNull(),
  reportJson: text("reportJson").notNull(),
  userEditedJson: text("userEditedJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const apiCredentials = mysqlTable("apiCredentials", {
  id: int("id").autoincrement().primaryKey(),
  provider: varchar("provider", { length: 64 }).notNull().unique(),
  encryptedValue: text("encryptedValue").notNull(),
  initializationVector: varchar("initializationVector", { length: 64 }).notNull(),
  authenticationTag: varchar("authenticationTag", { length: 64 }).notNull(),
  keyVersion: varchar("keyVersion", { length: 32 }).default("v1").notNull(),
  isEnabled: boolean("isEnabled").default(true).notNull(),
  lastValidatedAt: timestamp("lastValidatedAt"),
  lastValidationError: varchar("lastValidationError", { length: 280 }),
  updatedBy: int("updatedBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const apiAuditLogs = mysqlTable("apiAuditLogs", {
  id: int("id").autoincrement().primaryKey(),
  provider: varchar("provider", { length: 64 }).notNull(),
  operation: varchar("operation", { length: 120 }).notNull(),
  success: boolean("success").notNull(),
  responseStatus: int("responseStatus"),
  safeMessage: varchar("safeMessage", { length: 280 }),
  initiatedBy: int("initiatedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const parkingFacilities = mysqlTable("parkingFacilities", {
  id: int("id").autoincrement().primaryKey(),
  sourceIdentifier: varchar("sourceIdentifier", { length: 64 }).notNull().unique(),
  stationName: varchar("stationName", { length: 80 }),
  name: varchar("name", { length: 160 }).notNull(),
  address: text("address"),
  latitude: varchar("latitude", { length: 32 }).notNull(),
  longitude: varchar("longitude", { length: 32 }).notNull(),
  capacity: int("capacity"),
  feeInfo: varchar("feeInfo", { length: 80 }),
  facilityType: varchar("facilityType", { length: 80 }),
  datasetReferenceDate: varchar("datasetReferenceDate", { length: 32 }).default("2022-12-08").notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
