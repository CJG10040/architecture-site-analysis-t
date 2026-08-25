import type { LlmProvider, PublicServiceSettings } from "./model";
import { loadNaverMaps } from "./naverMaps";
import { fetchVworldBrowserParcel } from "./vworld";

export type ConnectionStatus = "idle" | "checking" | "connected" | "missing" | "cors" | "approval" | "error";
export type ConnectionResult = { status: ConnectionStatus; message: string; checkedAt?: string };
const success = (message: string): ConnectionResult => ({ status: "connected", message, checkedAt: new Date().toISOString() });
const failure = (message: string): ConnectionResult => ({ status: "error", message, checkedAt: new Date().toISOString() });

export function classifyBrowserError(cause: unknown): ConnectionResult {
  const message = cause instanceof Error ? cause.message : "알 수 없는 오류";
  if (/Failed to fetch|NetworkError|CORS/i.test(message)) return { status: "cors", message: "브라우저 요청이 차단되었습니다. Pages 도메인 등록 또는 원본 파일 불러오기를 사용하세요.", checkedAt: new Date().toISOString() };
  if (/401|403|승인|approval|등록|INCORRECT_KEY|INVALID_KEY|UNAVAILABLE_KEY|인증키|도메인/i.test(message)) return { status: "approval", message: `키·도메인 등록·활용 승인을 확인하세요. 원문: ${message}`, checkedAt: new Date().toISOString() };
  return failure(message);
}

export async function checkPublicService(service: "naverMaps" | "vworld" | "dataGoKr" | "sgis", settings: PublicServiceSettings): Promise<ConnectionResult> {
  try {
    if (service === "naverMaps") {
      if (!settings.naverMapsClientId) return { status: "missing", message: "네이버 지도 Client ID가 없습니다." };
      await loadNaverMaps(settings.naverMapsClientId); return success("네이버 지도 Web Dynamic Map SDK를 불러왔습니다.");
    }
    if (service === "vworld") {
      if (!settings.vworldKey) return { status: "missing", message: "VWorld 인증키가 없습니다." };
      await fetchVworldBrowserParcel({ key: settings.vworldKey, domain: settings.vworldDomain, latitude: 35.1467, longitude: 126.921 }); return success("VWorld 필지 후보 응답을 확인했습니다.");
    }
    if (service === "dataGoKr") {
      if (!settings.dataGoKrKey) return { status: "missing", message: "공공데이터포털 ServiceKey가 없습니다." };
      const url = new URL("https://api.data.go.kr/openapi/tn_pubr_public_cty_park_info_api");
      url.search = new URLSearchParams({ serviceKey: settings.dataGoKrKey, pageNo: "1", numOfRows: "1", type: "json" }).toString();
      const response = await fetch(url); if (!response.ok) throw new Error(`공공데이터포털 ${response.status} 응답`); return success("공공데이터포털 응답을 확인했습니다.");
    }
    if (!settings.sgisClientId || !settings.sgisClientSecret) return { status: "missing", message: "SGIS Client ID와 Secret을 모두 입력하세요." };
    const url = new URL("https://sgisapi.mods.go.kr/OpenAPI3/auth/authentication.json");
    url.search = new URLSearchParams({ consumer_key: settings.sgisClientId, consumer_secret: settings.sgisClientSecret }).toString();
    const response = await fetch(url); if (!response.ok) throw new Error(`SGIS ${response.status} 응답`); return success("SGIS 인증 응답을 확인했습니다.");
  } catch (error) { return classifyBrowserError(error); }
}

export async function checkLlmProvider(provider: LlmProvider, key: string): Promise<ConnectionResult> {
  if (!key.trim()) return { status: "missing", message: `${provider} API 키가 없습니다.` };
  try {
    if (provider === "openai") {
      const response = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${key}` } });
      if (!response.ok) throw new Error(`OpenAI ${response.status} 응답`);
    } else if (provider === "gemini") {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`);
      if (!response.ok) throw new Error(`Gemini ${response.status} 응답`);
    } else {
      const response = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" }, body: JSON.stringify({ model: "claude-3-5-haiku-latest", max_tokens: 1, messages: [{ role: "user", content: "ping" }] }) });
      if (!response.ok) throw new Error(`Anthropic ${response.status} 응답`);
    }
    return success(`${provider} 인증 응답을 확인했습니다.`);
  } catch (error) { return classifyBrowserError(error); }
}
