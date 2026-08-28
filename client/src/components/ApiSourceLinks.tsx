import { ExternalLink, KeyRound, PlugZap } from "lucide-react";

const sourceGroups = [
  { title: "지도·공간 API", items: [
    ["VWorld Open API 발급·도메인 등록", "https://www.vworld.kr/"],
    ["VWorld WMS/WFS 레이어 목록", "https://www.vworld.kr/dev/v4dv_wmsguide2_s001.do"],
    ["국토부 토지임야정보·토지속성", "https://www.data.go.kr/data/15123884/openapi.do"],
    ["국토부 건축물·용도별건물정보", "https://www.data.go.kr/data/15123458/openapi.do"],
    ["국토부 용도지역지구도", "https://www.data.go.kr/data/15058773/openapi.do"],
    ["토지이용규제정보서비스", "https://www.data.go.kr/data/15058410/openapi.do"],
  ] },
  { title: "통계·교통·환경 자료", items: [
    ["SGIS 개발자센터·Client 발급", "https://sgis.mods.go.kr/developer/html/newOpenApi/api/intro.html"],
    ["공공데이터포털 ServiceKey 발급", "https://www.data.go.kr/"],
    ["ITS 표준노드링크·교통 원자료", "https://www.its.go.kr/nodelink/"],
    ["국가수자원관리종합정보시스템(WAMIS)", "https://www.wamis.go.kr/"],
    ["국가소음정보시스템", "https://www.noiseinfo.or.kr/"],
    ["에어코리아 측정자료·Open API", "https://www.airkorea.or.kr/web/"],
  ] },
  { title: "원본·무키 자료", items: [
    ["Open-Meteo 고도·대기질 API · 키 불필요", "https://open-meteo.com/"],
    ["OpenStreetMap·Overpass 수계 API · 키 불필요", "https://overpass-api.de/"],
    ["VWorld 오픈마켓 공간 원본", "https://www.vworld.kr/v4po_intbiz_a001.do"],
    ["생활안전지도 재해·침수 참고", "https://safemap.go.kr/"],
  ] },
  { title: "지도 SDK·AI", items: [
    ["NAVER Cloud Maps 콘솔·Web Dynamic Map", "https://console.ncloud.com/maps"],
    ["OpenAI API 키 발급", "https://platform.openai.com/api-keys"],
    ["Google Gemini API 키 발급", "https://aistudio.google.com/app/apikey"],
    ["Anthropic API 키 발급", "https://console.anthropic.com/settings/keys"],
  ] },
] as const;

export function ApiSourceLinks() {
  return <section className="mt-6 border border-[#c9d1c3] bg-[#f5f8f2] p-5"><div className="flex items-start gap-3"><PlugZap className="mt-1 h-5 w-5 text-[#46603e]" /><div><p className="font-mono text-[10px] tracking-[.18em] text-[#46603e]">DATA CONNECTION DIRECTORY</p><h2 className="mt-1 font-serif text-2xl text-stone-900">자료별 발급·연결 사이트</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">링크에서 키·활용 신청·원본자료를 준비한 뒤 위 설정 카드에 입력하세요. 키가 필요 없는 자료는 자동 연결되며, 소음·침수·항공 시계열처럼 공식 원본 확인이 필요한 자료는 파일 가져오기로 연결합니다. <a href="https://github.com/CJG10040/architecture-site-analysis-t/blob/main/docs/data-connection-guide.md" target="_blank" rel="noreferrer" className="text-[#46603e] underline underline-offset-4">전체 연결 절차 문서</a></p></div></div><div className="mt-4 grid gap-4 md:grid-cols-2">{sourceGroups.map(group => <div key={group.title} className="border border-[#d4dccf] bg-white p-3"><p className="text-sm font-medium text-stone-900">{group.title}</p><div className="mt-2 space-y-1.5">{group.items.map(([label, url]) => <a key={url} href={url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs leading-5 text-[#46603e] underline decoration-[#b7c4af] underline-offset-4 hover:text-[#283126]"><ExternalLink className="h-3.5 w-3.5 shrink-0" />{label}</a>)}</div></div>)}</div><p className="mt-4 flex items-start gap-1.5 text-[11px] leading-5 text-stone-500"><KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#a9684f]" />API 키는 저장소·프로젝트 JSON에 저장하지 않고 이 브라우저 세션에서만 사용합니다. 활용 승인, 허용 domain, 브라우저 CORS는 서비스별로 별도 확인해야 합니다.</p></section>;
}
