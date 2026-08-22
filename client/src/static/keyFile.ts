import type { LlmProvider, PublicServiceSettings } from "./model";

export type KeyFile = Partial<PublicServiceSettings> & { openaiApiKey?: string; geminiApiKey?: string; anthropicApiKey?: string };
const allowed = ["naverMapsClientId", "vworldKey", "dataGoKrKey", "sgisClientId", "sgisClientSecret", "openaiApiKey", "geminiApiKey", "anthropicApiKey"] as const;

export function parseKeyFile(value: unknown): KeyFile {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("키 파일은 JSON 객체여야 합니다.");
  const source = value as Record<string, unknown>;
  const parsed: KeyFile = {};
  for (const field of allowed) if (typeof source[field] === "string") parsed[field] = source[field].trim();
  if (!Object.values(parsed).some(Boolean)) throw new Error("인식할 수 있는 API 키 항목이 없습니다.");
  return parsed;
}

export function emptyKeyFileTemplate() {
  return JSON.stringify({ schema: "site-analysis-keys-v1", naverMapsClientId: "", vworldKey: "", dataGoKrKey: "", sgisClientId: "", sgisClientSecret: "", openaiApiKey: "", geminiApiKey: "", anthropicApiKey: "" }, null, 2);
}

export function llmKeyFromFile(file: KeyFile, provider: LlmProvider) { return file[`${provider}ApiKey` as keyof KeyFile] ?? ""; }
