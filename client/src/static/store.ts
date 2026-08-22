import type { LlmProvider, PublicServiceSettings, StoredWorkspace } from "./model";
import { createWorkspace, normalizeWorkspace, settingsStorageKey, workspaceStorageKey } from "./model";

const emptyPublicServices: PublicServiceSettings = { googleMapsKey: "", vworldKey: "", dataGoKrKey: "", sgisClientId: "", sgisClientSecret: "" };
const llmSessionPrefix = "site-study-static-llm-";

export function loadWorkspace(): StoredWorkspace {
  try { return normalizeWorkspace(JSON.parse(localStorage.getItem(workspaceStorageKey) ?? "")) ?? createWorkspace(); } catch { return createWorkspace(); }
}

export function saveWorkspace(workspace: StoredWorkspace) {
  localStorage.setItem(workspaceStorageKey, JSON.stringify(workspace));
}

export function loadPublicServices(): PublicServiceSettings {
  try { return { ...emptyPublicServices, ...JSON.parse(sessionStorage.getItem(settingsStorageKey) ?? "{}") }; } catch { return emptyPublicServices; }
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
