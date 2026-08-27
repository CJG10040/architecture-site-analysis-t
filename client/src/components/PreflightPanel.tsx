import { useEffect, useRef, useState } from "react";
import { CheckSquare, FileUp, Loader2, Play, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { LocalProject, PublicServiceSettings, ResearchNote } from "@/static/model";
import { collectSource, detailedResearchNote, researchNoteFromFile, sourceAvailability, suggestedSources, type SourceId } from "@/static/research";
import { defaultResearchPlan, researchCatalog } from "@/static/researchCatalog";
import { toast } from "sonner";

const manualGuide = (catalogId: string) => ({
  hydrology: "하천명·수계 유형·자료 기준일·대지와의 관계·침수/배수 근거·확인하지 못한 레벨을 기록하세요.",
  noise: "측정 날짜·시각·위치·측정기기/앱·단위·값·날씨·차량/사람 활동·반복 측정 여부를 기록하세요. 측정하지 않은 값은 미확인으로 두세요.",
  "imagery-change": "영상 촬영일·출처·비교한 시점·신축/철거/녹지/유휴 변화·판독 불확실성을 기록하세요.",
  "land-regulation": "PNU·열람일·토지이음 지역지구·행위제한 문구·건폐율/용적률/높이·건축선/도로조건·원문 링크·관할 확인 여부를 기록하세요.",
  "population-households": "기준연도·행정구역/집계구 코드·인구·가구·주택·연령 항목·통계 단위·대지와 직접값이 아닌 이유를 기록하세요.",
  businesses: "기준연도·행정구역/상권 범위·업종 분류·사업체 수·영업시간 또는 현장 확인·통계와 실제 활동의 차이를 기록하세요.",
}[catalogId] ?? "조사 시점, 공간 범위, 관찰한 사실, 원자료 필드, 수치의 단위와 한계, 확인하지 못한 내용을 자세히 기록하세요.");

export function PreflightPanel({ project, settings, onCollected }: { project: LocalProject; settings: PublicServiceSettings; onCollected: (notes: ResearchNote[]) => void }) {
  const plan = project.researchPlan ?? defaultResearchPlan();
  const suggested = suggestedSources(project.lenses, plan.selectedCatalogIds);
  const autoCatalogIds = new Set(suggested.map(source => source.catalogId));
  const manualSources = researchCatalog.filter(item => plan.selectedCatalogIds.includes(item.id) && (!autoCatalogIds.has(item.id) || ["hydrology", "noise", "imagery-change"].includes(item.id)));
  const [selected, setSelected] = useState<SourceId[]>(suggested.map(source => source.id));
  const [detailDrafts, setDetailDrafts] = useState<Record<string, string>>({});
  const [fileTarget, setFileTarget] = useState("");
  const [running, setRunning] = useState(false);
  const [messages, setMessages] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setSelected(suggested.map(source => source.id)); }, [project.lenses.join("|"), plan.selectedCatalogIds.join("|")]);
  const toggle = (id: SourceId) => setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  const collect = async () => {
    if (project.site.boundary.length < 3) return toast.error("지도에서 3개 이상의 경계 정점을 확정한 뒤 자동 읽기를 시작하세요.");
    if (!selected.length) return toast.error("수집할 데이터원을 하나 이상 선택하세요.");
    setRunning(true); const notes: ResearchNote[] = [];
    for (const source of suggested.filter(item => selected.includes(item.id))) {
      if (!sourceAvailability(source, settings)) { setMessages(previous => ({ ...previous, [source.id]: "키 없음: 설정 화면에서 연결하세요." })); continue; }
      try { const result = await collectSource(source, project.site, settings, project.studyRadiusMeters); notes.push(result); setMessages(previous => ({ ...previous, [source.id]: "수집 완료" })); }
      catch (error) { setMessages(previous => ({ ...previous, [source.id]: error instanceof Error ? error.message : "수집 실패" })); }
    }
    if (notes.length) { onCollected(notes); toast.success(`${notes.length}개 조사 근거를 저장했습니다.`); }
    setRunning(false);
  };
  const importFile = async (file?: File) => { if (!file) return; try { const item = researchCatalog.find(entry => entry.id === fileTarget); onCollected([await researchNoteFromFile(file, { catalogId: fileTarget || undefined, title: item ? `${item.title} · 원본 파일` : undefined, site: project.site })]); toast.success("원본 파일의 상세 내용을 조사 근거로 저장했습니다."); } catch { toast.error("원본 파일을 읽지 못했습니다."); } finally { setFileTarget(""); } };
  const saveDetail = (catalogId: string) => { const text = detailDrafts[catalogId]?.trim(); const item = researchCatalog.find(entry => entry.id === catalogId); if (!item || !text) return toast.error("상세 조사 내용을 입력하세요."); onCollected([detailedResearchNote(catalogId, item.title, text, project.site)]); setDetailDrafts(previous => ({ ...previous, [catalogId]: "" })); toast.success(`${item.title} 상세 조사를 저장했습니다.`); };
  const chooseFile = (catalogId: string) => { setFileTarget(catalogId); fileRef.current?.click(); };
  return <section className="mt-5 border border-[#d9c3ae] bg-[#fbf3eb] p-4"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-mono text-[10px] tracking-[.16em] text-[#a9684f]">03 · PRE-FIELD READING</p><h2 className="mt-1 font-serif text-2xl text-stone-900">현장 전에 자동으로 읽기</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">조사 렌즈와 확정 경계에 맞는 데이터원만 선택해 수집합니다. 각 항목의 출처·제한·현장 검증 필요성을 기록으로 남깁니다.</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => fileRef.current?.click()} className="border-[#a9684f] bg-white"><FileUp className="mr-2 h-4 w-4" />원본 파일 가져오기</Button><Button onClick={collect} disabled={running} className="bg-[#a9684f] text-white hover:bg-[#8b523e]">{running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}{running ? "수집 중…" : "선택 항목 수집"}</Button><input ref={fileRef} type="file" accept="application/json,text/csv,text/xml,text/plain,.geojson,.json,.csv,.xml,.txt" className="hidden" onChange={event => importFile(event.target.files?.[0])} /></div></div><div className="mt-4 grid gap-3 md:grid-cols-2">{suggested.length ? suggested.map(source => <label key={source.id} className="flex cursor-pointer items-start gap-3 border border-[#d9c3ae] bg-white p-3"><input type="checkbox" checked={selected.includes(source.id)} onChange={() => toggle(source.id)} className="mt-1" /><span className="min-w-0"><span className="flex items-center gap-1 font-medium text-stone-900"><CheckSquare className="h-3.5 w-3.5 text-[#a9684f]" />{source.title}</span><span className="mt-1 block text-xs text-stone-500">{source.source}</span><span className="mt-2 block text-xs leading-5 text-stone-600">{source.limitation}</span><span className={`mt-2 block text-[11px] ${sourceAvailability(source, settings) ? "text-[#42633d]" : "text-[#8b3a2d]"}`}>{messages[source.id] ?? (sourceAvailability(source, settings) ? "수집 준비됨" : "API 키 또는 설정 필요")}</span></span></label>) : <p className="text-sm text-stone-600">조사 렌즈를 하나 이상 선택하면 권장 데이터원이 나타납니다.</p>}</div>{manualSources.length > 0 && <div className="mt-4 border border-[#d9c3ae] bg-white p-3"><div><p className="text-sm font-medium text-stone-900">부분 구현·보충 자료 상세 조사</p><p className="mt-1 text-xs leading-5 text-stone-600">자동 API가 없는 자료도 조사 대상에서 제외하지 않습니다. 원본 파일을 보존하거나, 확인한 사실·범위·시점·관찰·불확실성을 자세히 기록하면 AI가 요약본이 아닌 상세 근거를 읽습니다.</p></div><div className="mt-3 space-y-3">{manualSources.map(item => <div key={item.id} className="border border-stone-200 bg-[#fbfaf7] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-medium text-stone-900">{item.title}</p><p className="mt-1 text-[11px] text-stone-500">{item.source} · {item.status === "field" ? "현장 기록" : "원본 자료 또는 수동 조사"}</p></div><span className="text-[10px] text-stone-400">{project.researchNotes.some(note => note.catalogId === item.id) ? "조사 내용 있음" : "아직 기록 없음"}</span></div><Textarea value={detailDrafts[item.id] ?? ""} onChange={event => setDetailDrafts(previous => ({ ...previous, [item.id]: event.target.value }))} placeholder={manualGuide(item.id)} className="mt-2 min-h-24 border-stone-300 bg-white text-xs leading-5" /><div className="mt-2 flex flex-wrap gap-2"><Button size="sm" onClick={() => saveDetail(item.id)} className="bg-[#46603e] text-white hover:bg-[#354e31]">상세 기록 저장</Button><Button size="sm" variant="outline" onClick={() => chooseFile(item.id)} className="border-stone-300">이 자료의 원본 파일 가져오기</Button>{item.officialUrl && <a href={item.officialUrl} target="_blank" rel="noreferrer" className="self-center text-[11px] text-stone-500 underline">공식 출처 열기</a>}</div></div>)}</div></div>}<p className="mt-4 text-xs leading-5 text-stone-500"><ShieldAlert className="mr-1 inline h-3.5 w-3.5 text-[#a9684f]" />브라우저에서 직접 요청이 차단되면 실패 사유를 남기고, 제공기관에서 받은 JSON·CSV·XML 파일을 가져와 동일한 조사 보드에 기록하세요.</p></section>;
}
