export type LlmProvider = "openai" | "gemini" | "anthropic";

export type BoundaryPoint = { lat: number; lng: number };
export type SiteRecord = { address: string; latitude: number; longitude: number; boundary: BoundaryPoint[]; areaSqm?: number; perimeterMeters?: number; geoJson?: { type: "Polygon"; coordinates: number[][][] }; pnu?: string; parcelLabel?: string };
export type Observation = { id: string; title: string; note: string; category: string; createdAt: string };
export type ResearchNote = { id: string; source: string; title: string; summary: string; url?: string; latitude?: number; longitude?: number; spatialLayer?: SpatialLayer; createdAt: string };
export type MapOverlay = { id: string; source: string; title: string; summary: string; latitude: number; longitude: number; kind: "research" | "file" };
export type SpatialGeometry = { type: string; coordinates?: unknown; geometries?: SpatialGeometry[] };
export type SpatialFeature = { id: string; geometry: SpatialGeometry; properties: Record<string, unknown> };
export type SpatialLayer = { id: string; title: string; source: string; fetchedAt: string; features: SpatialFeature[]; totalFeatureCount: number; truncated: boolean };
export type DesignNote = { id: string; question: string; evidence: string; spatialIdea: string; createdAt: string };

export type LocalProject = {
  schemaVersion: 1;
  id: string;
  title: string;
  lenses: string[];
  site: SiteRecord;
  observations: Observation[];
  researchNotes: ResearchNote[];
  studyRadiusMeters: number;
  overlays: MapOverlay[];
  spatialLayers: SpatialLayer[];
  designNotes: DesignNote[];
  createdAt: string;
  updatedAt: string;
};

export type PublicServiceSettings = { naverMapsClientId?: string; vworldKey: string; dataGoKrKey: string; sgisClientId?: string; sgisClientSecret?: string; sgisKey?: string };
export type StoredWorkspace = { schemaVersion: 1; activeProjectId: string | null; projects: LocalProject[] };

export const workspaceStorageKey = "site-study-static-workspace-v1";
export const settingsStorageKey = "site-study-static-settings-v1";

const now = () => new Date().toISOString();
const createId = () => globalThis.crypto?.randomUUID?.() ?? `site-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function createLocalProject(title = "새 대지조사"): LocalProject {
  const timestamp = now();
  return { schemaVersion: 1, id: createId(), title, lenses: [], site: { address: "", latitude: 35.1467, longitude: 126.921, boundary: [] }, observations: [], researchNotes: [], studyRadiusMeters: 300, overlays: [], spatialLayers: [], designNotes: [], createdAt: timestamp, updatedAt: timestamp };
}

export function createWorkspace(project = createLocalProject()): StoredWorkspace {
  return { schemaVersion: 1, activeProjectId: project.id, projects: [project] };
}

function isPoint(value: unknown): value is BoundaryPoint {
  return typeof value === "object" && value !== null && typeof (value as BoundaryPoint).lat === "number" && typeof (value as BoundaryPoint).lng === "number";
}

export function normalizeWorkspace(value: unknown): StoredWorkspace | null {
  if (!value || typeof value !== "object" || (value as { schemaVersion?: unknown }).schemaVersion !== 1 || !Array.isArray((value as StoredWorkspace).projects)) return null;
  const projects = (value as StoredWorkspace).projects.filter((project): project is LocalProject => Boolean(project && typeof project.id === "string" && typeof project.title === "string" && project.site && Array.isArray(project.site.boundary) && project.site.boundary.every(isPoint))).map(project => ({ ...project, lenses: Array.isArray(project.lenses) ? project.lenses.filter(item => typeof item === "string") : [], observations: Array.isArray(project.observations) ? project.observations : [], researchNotes: Array.isArray(project.researchNotes) ? project.researchNotes : [], studyRadiusMeters: Number.isFinite(project.studyRadiusMeters) ? Math.min(3000, Math.max(50, project.studyRadiusMeters)) : 300, overlays: Array.isArray(project.overlays) ? project.overlays.filter(item => item && Number.isFinite(item.latitude) && Number.isFinite(item.longitude)) : [], spatialLayers: Array.isArray(project.spatialLayers) ? project.spatialLayers.filter(item => item && typeof item.id === "string" && Array.isArray(item.features)) : [], designNotes: Array.isArray(project.designNotes) ? project.designNotes : [] }));
  if (!projects.length) return null;
  const activeProjectId = projects.some(project => project.id === (value as StoredWorkspace).activeProjectId) ? (value as StoredWorkspace).activeProjectId : projects[0].id;
  return { schemaVersion: 1, activeProjectId, projects };
}

export function getActiveProject(workspace: StoredWorkspace) {
  return workspace.projects.find(project => project.id === workspace.activeProjectId) ?? workspace.projects[0];
}

export function updateProject(workspace: StoredWorkspace, nextProject: LocalProject): StoredWorkspace {
  return { ...workspace, projects: workspace.projects.map(project => project.id === nextProject.id ? { ...nextProject, updatedAt: now() } : project) };
}

export function projectSnapshot(project: LocalProject) {
  return JSON.stringify({ app: "대지해석 개인용 정적 도구", exportedAt: now(), project }, null, 2);
}
