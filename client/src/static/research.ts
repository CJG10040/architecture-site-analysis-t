import type { PublicServiceSettings, ResearchNote, SiteRecord } from "./model";
import { fetchVworldBrowserParcel } from "./vworld";

export type SourceId = "terrain" | "air" | "vworldParcel" | "cityParks";
export type SourceDefinition = { id: SourceId; title: string; source: string; lenses: string[]; needs: "none" | "vworldKey" | "dataGoKrKey"; limitation: string };
export const sourceCatalog: SourceDefinition[] = [
  { id: "terrain", title: "고도·지형 표본", source: "Open-Meteo Elevation API", lenses: ["지형·레벨"], needs: "none", limitation: "격자 고도는 옹벽·계단·정확한 설계 레벨을 대체하지 않습니다." },
  { id: "air", title: "대기질·기상 표본", source: "Open-Meteo Air Quality API", lenses: ["지역 생활", "녹지·생태"], needs: "none", limitation: "예보·격자 표본이며 현장 체감·공식 측정소 확정값과 다를 수 있습니다." },
  { id: "vworldParcel", title: "연속지적도 필지 후보", source: "VWorld", lenses: ["지형·레벨", "프로그램·상권"], needs: "vworldKey", limitation: "브라우저 키 도메인 등록과 필지 후보의 사용자 확인이 필요합니다." },
  { id: "cityParks", title: "도시공원·녹지 목록", source: "공공데이터포털 전국도시공원", lenses: ["녹지·생태", "보행·접근"], needs: "dataGoKrKey", limitation: "브라우저 CORS·서비스 활용 승인에 따라 원본 파일 불러오기로 대체될 수 있습니다." },
];

const id = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const note = (source: string, title: string, summary: string, url: string): ResearchNote => ({ id: id(), source, title, summary, url, createdAt: new Date().toISOString() });

export function suggestedSources(lenses: string[]) { return sourceCatalog.filter(source => source.lenses.some(lens => lenses.includes(lens))); }
export function sourceAvailability(source: SourceDefinition, settings: PublicServiceSettings) { return source.needs === "none" || Boolean(settings[source.needs]); }

export async function collectSource(source: SourceDefinition, site: SiteRecord, settings: PublicServiceSettings): Promise<ResearchNote> {
  if (source.id === "terrain") {
    const url = new URL("https://api.open-meteo.com/v1/elevation"); url.search = new URLSearchParams({ latitude: String(site.latitude), longitude: String(site.longitude) }).toString();
    const response = await fetch(url); if (!response.ok) throw new Error(`Open-Meteo ${response.status} 응답`); const payload = await response.json(); const elevation = Array.isArray(payload.elevation) ? payload.elevation[0] : payload.elevation;
    return note(source.source, source.title, `대지 중심점(${site.latitude.toFixed(5)}, ${site.longitude.toFixed(5)})의 DEM 고도 표본은 ${elevation ?? "미확인"}m입니다. ${source.limitation}`, "https://open-meteo.com/");
  }
  if (source.id === "air") {
    const url = new URL("https://air-quality-api.open-meteo.com/v1/air-quality"); url.search = new URLSearchParams({ latitude: String(site.latitude), longitude: String(site.longitude), current: "pm10,pm2_5,carbon_monoxide,nitrogen_dioxide", timezone: "Asia/Seoul" }).toString();
    const response = await fetch(url); if (!response.ok) throw new Error(`Open-Meteo 대기질 ${response.status} 응답`); const payload = await response.json(); const current = payload.current ?? {};
    return note(source.source, source.title, `대지 중심 격자 표본: PM10 ${current.pm10 ?? "미확인"} μg/m³, PM2.5 ${current.pm2_5 ?? "미확인"} μg/m³, NO₂ ${current.nitrogen_dioxide ?? "미확인"} μg/m³. ${source.limitation}`, "https://open-meteo.com/en/docs/air-quality-api");
  }
  if (source.id === "vworldParcel") {
    const candidates = await fetchVworldBrowserParcel({ key: settings.vworldKey, latitude: site.latitude, longitude: site.longitude });
    const first = candidates[0]; if (!first) throw new Error("현재 중심점의 VWorld 필지 후보를 찾지 못했습니다.");
    return note(source.source, source.title, `PNU ${first.pnu ?? "미확인"}, 지번 ${first.parcelNumber ?? "미확인"}, 지목 ${first.landCategory ?? "미확인"}, 면적 ${first.areaSqm ? `${first.areaSqm}㎡` : "미확인"}. ${source.limitation}`, "https://www.vworld.kr/");
  }
  const url = new URL("https://api.data.go.kr/openapi/tn_pubr_public_cty_park_info_api");
  url.search = new URLSearchParams({ serviceKey: settings.dataGoKrKey, pageNo: "1", numOfRows: "5", type: "json" }).toString();
  const response = await fetch(url); if (!response.ok) throw new Error(`공공데이터포털 ${response.status} 응답`); const payload = await response.json(); const items = payload?.response?.body?.items ?? [];
  const names = (Array.isArray(items) ? items : []).slice(0, 5).map((item: any) => item.parkNm ?? item.공원명).filter(Boolean);
  return note(source.source, source.title, `수집 응답의 공원 표본 ${names.length ? names.join(", ") : "없음"}. 대지 주변성은 좌표·주소 필터가 있는 원본 응답으로 추가 확인하세요. ${source.limitation}`, "https://www.data.go.kr/");
}

export async function researchNoteFromFile(file: File): Promise<ResearchNote> {
  const text = await file.text(); const preview = text.replace(/\s+/g, " ").trim().slice(0, 900);
  return note(`사용자 원본 파일 · ${file.name}`, "외부 데이터 응답 가져오기", `${file.size.toLocaleString("ko-KR")} bytes · ${file.type || "알 수 없는 형식"}. 원문 앞부분: ${preview || "내용 없음"}`, "");
}
