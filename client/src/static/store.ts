import type { LlmProvider, PublicServiceSettings, StoredWorkspace } from "./model";
import { createWorkspace, normalizeWorkspace, settingsStorageKey, workspaceStorageKey } from "./model";

const emptyPublicServices: PublicServiceSettings = { naverMapsClientId: "", vworldKey: "", vworldDomain: "", dataGoKrKey: "", sgisClientId: "", sgisClientSecret: "" };
const llmSessionPrefix = "site-study-static-llm-";

export function loadWorkspace(): StoredWorkspace {
  try { return normalizeWorkspace(JSON.parse(localStorage.getItem(workspaceStorageKey) ?? "")) ?? createWorkspace(); } catch { return createWorkspace(); }
}

export function saveWorkspace(workspace: StoredWorkspace) {
  localStorage.setItem(workspaceStorageKey, JSON.stringify(workspace));
}

export function loadPublicServices(): PublicServiceSettings {
  try {
    const stored = JSON.parse(sessionStorage.getItem(settingsStorageKey) ?? "{}") as Record<string, unknown>;
    return { ...emptyPublicServices, naverMapsClientId: typeof stored.naverMapsClientId === "string" ? stored.naverMapsClientId : "", vworldKey: typeof stored.vworldKey === "string" ? stored.vworldKey : "", vworldDomain: typeof stored.vworldDomain === "string" ? stored.vworldDomain : "", dataGoKrKey: typeof stored.dataGoKrKey === "string" ? stored.dataGoKrKey : "", sgisClientId: typeof stored.sgisClientId === "string" ? stored.sgisClientId : "", sgisClientSecret: typeof stored.sgisClientSecret === "string" ? stored.sgisClientSecret : "" };
  } catch { return emptyPublicServices; }
}

export function savePublicServices(settings: PublicServiceSettings) {
  sessionStorage.setItem(settingsStorageKey, JSON.stringify(settings));
}

export function loadLlmKey(provider: LlmProvider) { return sessionStorage.getItem(`${llmSessionPrefix}${provider}`) ?? ""; }
export function saveLlmKey(provider: LlmProvider, key: string) { sessionStorage.setItem(`${llmSessionPrefix}${provider}`, key); }
export function clearAllSessionKeys() {
  sessionStorage.removeItem(settingsStorageKey);
  (["openai", "gemini", "anthropic"] as LlmProvider[]).forEach(provider => sessionStorage.removeItem(`${llmSessionPrefix}${provider}`));
}
