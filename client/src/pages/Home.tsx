import { useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Bot, Download, FileUp, KeyRound, MapPinned, NotebookPen, Plus, Save, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { createLocalProject, createWorkspace, getActiveProject, normalizeWorkspace, projectSnapshot, type LlmProvider, type LocalProject, type PublicServiceSettings, updateProject } from "@/static/model";
import { clearAllSessionKeys, loadLlmKey, loadPublicServices, loadWorkspace, saveLlmKey, savePublicServices, saveWorkspace } from "@/static/store";
import { requestLlm } from "@/static/llm";
import { fetchVworldBrowserParcel } from "@/static/vworld";

const lenses = ["보행·접근", "지형·레벨", "일조·차폐", "지역 생활", "녹지·생태", "프로그램·상권"];
const providerLabel: Record<LlmProvider, string> = { openai: "OpenAI", gemini: "Google Gemini", anthropic: "Anthropic" };

function newId() { return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`; }

function downloadText(name: string, text: string) {
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(new Blob([text], { type: "application/json;charset=utf-8" }));
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}

export default function Home() {
  const [workspace, setWorkspace] = useState(loadWorkspace);
  const [services, setServices] = useState(loadPublicServices);
  const [provider, setProvider] = useState<LlmProvider>("openai");
  const [apiKey, setApiKey] = useState(() => loadLlmKey("openai"));
  const [aiOutput, setAiOutput] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isVworldLoading, setIsVworldLoading] = useState(false);
  const [observationDraft, setObservationDraft] = useState({ title: "", note: "", category: "현장 검증" });
  const [researchDraft, setResearchDraft] = useState({ source: "공공데이터", title: "", summary: "", url: "" });
  const importRef = useRef<HTMLInputElement>(null);
  const project = getActiveProject(workspace);

  const boundaryText = useMemo(() => project.site.boundary.map(point => `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`).join("\n"), [project.site.boundary]);
  const [boundaryDraft, setBoundaryDraft] = useState(boundaryText);

  const commit = (next: LocalProject) => {
    const nextWorkspace = updateProject(workspace, next);
    setWorkspace(nextWorkspace);
    saveWorkspace(nextWorkspace);
  };
  const setProject = (change: Partial<LocalProject>) => commit({ ...project, ...change });
  const setSite = (change: Partial<LocalProject["site"]>) => commit({ ...project, site: { ...project.site, ...change } });

  const createProject = () => {
    const next = createLocalProject(`새 대지조사 ${workspace.projects.length + 1}`);
    const nextWorkspace = { ...workspace, activeProjectId: next.id, projects: [...workspace.projects, next] };
    setWorkspace(nextWorkspace); saveWorkspace(nextWorkspace); setBoundaryDraft(""); toast.success("새 개인 프로젝트를 만들었습니다.");
  };

  const applyBoundary = () => {
    const points = boundaryDraft.split("\n").map(line => line.trim()).filter(Boolean).map(line => line.split(",").map(value => Number(value.trim()))).filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng)).map(([lat, lng]) => ({ lat, lng }));
    if (points.length && points.length < 3) return toast.error("대지 경계는 3개 이상의 좌표가 필요합니다.");
    setSite({ boundary: points }); toast.success(points.length ? `${points.length}개 정점의 경계를 저장했습니다.` : "대지 경계를 비웠습니다.");
  };

  const addObservation = () => {
    if (!observationDraft.title.trim() || !observationDraft.note.trim()) return toast.error("관찰 제목과 내용을 입력하세요.");
    commit({ ...project, observations: [{ id: newId(), ...observationDraft, createdAt: new Date().toISOString() }, ...project.observations] });
    setObservationDraft({ title: "", note: "", category: "현장 검증" });
  };
  const addResearch = () => {
    if (!researchDraft.title.trim() || !researchDraft.summary.trim()) return toast.error("수집 자료 제목과 요약을 입력하세요.");
    commit({ ...project, researchNotes: [{ id: newId(), ...researchDraft, createdAt: new Date().toISOString() }, ...project.researchNotes] });
    setResearchDraft({ source: "공공데이터", title: "", summary: "", url: "" });
  };
  const collectVworldParcel = async () => {
    try {
      setIsVworldLoading(true);
      const candidates = await fetchVworldBrowserParcel({ key: services.vworldKey, latitude: project.site.latitude, longitude: project.site.longitude });
      if (!candidates.length) return toast.message("현재 좌표에서 VWorld 필지 후보를 찾지 못했습니다.");
      const candidate = candidates[0];
      const summary = [`PNU ${candidate.pnu ?? "미확인"}`, `지번 ${candidate.parcelNumber ?? "미확인"}`, `지목 ${candidate.landCategory ?? "미확인"}`, candidate.areaSqm ? `면적 ${candidate.areaSqm}㎡` : ""].filter(Boolean).join(" · ");
      commit({ ...project, researchNotes: [{ id: newId(), source: "VWorld 연속지적도", title: "현재 좌표의 필지 후보", summary, url: "https://www.vworld.kr/", createdAt: new Date().toISOString() }, ...project.researchNotes] });
      toast.success("VWorld 필지 후보를 조사 기록에 추가했습니다.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "VWorld 조회에 실패했습니다."); }
    finally { setIsVworldLoading(false); }
  };
  const removeItem = (type: "observations" | "researchNotes" | "designNotes", id: string) => commit({ ...project, [type]: project[type].filter(item => item.id !== id) });

  const exportProject = () => downloadText(`${project.title.replace(/[^0-9A-Za-z가-힣_-]/g, "-") || "site-study"}.json`, projectSnapshot(project));
  const importProject = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(String(reader.result));
        const imported = normalizeWorkspace(payload?.project ? { schemaVersion: 1, activeProjectId: payload.project.id, projects: [payload.project] } : payload);
        if (!imported) throw new Error();
        const nextWorkspace = { ...workspace, activeProjectId: imported.projects[0].id, projects: [...workspace.projects.filter(item => item.id !== imported.projects[0].id), ...imported.projects] };
        setWorkspace(nextWorkspace); saveWorkspace(nextWorkspace); setBoundaryDraft(imported.projects[0].site.boundary.map(point => `${point.lat}, ${point.lng}`).join("\n")); toast.success("조사 JSON 파일을 불러왔습니다.");
      } catch { toast.error("이 파일은 대지조사 정적 도구의 유효한 JSON 백업이 아닙니다."); }
    };
    reader.readAsText(file);
  };

  const saveKeys = () => { savePublicServices(services); saveLlmKey(provider, apiKey); toast.success("키는 이 브라우저 세션에만 저장했습니다."); };
  const runAi = async () => {
    try { setIsAiLoading(true); saveLlmKey(provider, apiKey); const output = await requestLlm(provider, apiKey, project); setAiOutput(output); commit({ ...project, designNotes: [{ id: newId(), question: `${providerLabel[provider]} 설계 전환`, evidence: "현재 프로젝트의 수집·관찰 기록", spatialIdea: output, createdAt: new Date().toISOString() }, ...project.designNotes] }); }
    catch (error) { toast.error(error instanceof Error ? error.message : "AI 요청에 실패했습니다."); }
    finally { setIsAiLoading(false); }
  };

  return <main className="min-h-screen bg-[#f3f0e8] text-stone-800"><header className="sticky top-0 z-20 flex min-h-16 items-center justify-between border-b border-stone-300 bg-[#fbfaf7]/95 px-4 backdrop-blur lg:px-7"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center bg-[#283126] text-[#f4f0e8]"><MapPinned className="h-5 w-5" /></div><div><p className="font-serif text-lg text-stone-900">대지해석 개인 작업대</p><p className="font-mono text-[10px] tracking-[.16em] text-stone-500">LOCAL · EXPORTABLE · BYOK</p></div></div><div className="flex items-center gap-2"><Badge className="hidden border-0 bg-[#e5eddd] text-[#46603e] sm:inline-flex"><ShieldCheck className="mr-1 h-3.5 w-3.5" />개인 브라우저 보관</Badge><Button variant="outline" size="sm" onClick={() => importRef.current?.click()} className="border-stone-300"><FileUp className="mr-1.5 h-4 w-4" />불러오기</Button><Button size="sm" onClick={exportProject} className="bg-[#283126] text-white hover:bg-[#42503d]"><Download className="mr-1.5 h-4 w-4" />내보내기</Button><input ref={importRef} type="file" accept="application/json" className="hidden" onChange={event => importProject(event.target.files?.[0])} /></div></header>
  <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-[270px_minmax(0,1fr)_340px]"><aside className="border-r border-stone-300 bg-[#f8f5ef] p-4"><p className="font-mono text-[10px] tracking-[.18em] text-stone-500">LOCAL PROJECTS</p><div className="mt-3 space-y-2">{workspace.projects.map(item => <button key={item.id} onClick={() => { const next = { ...workspace, activeProjectId: item.id }; setWorkspace(next); saveWorkspace(next); setBoundaryDraft(item.site.boundary.map(point => `${point.lat}, ${point.lng}`).join("\n")); }} className={`w-full border p-3 text-left transition ${item.id === project.id ? "border-[#a9684f] bg-[#fbf3eb]" : "border-stone-300 bg-white hover:bg-stone-50"}`}><span className="block truncate font-medium text-stone-900">{item.title}</span><span className="mt-1 block text-xs text-stone-500">{item.researchNotes.length} 자료 · {item.observations.length} 관찰</span></button>)}</div><Button variant="outline" onClick={createProject} className="mt-3 w-full border-dashed border-stone-400"><Plus className="mr-2 h-4 w-4" />새 프로젝트</Button><div className="mt-7 border-t border-stone-300 pt-5"><p className="font-mono text-[10px] tracking-[.18em] text-stone-500">SAFE STORAGE</p><p className="mt-2 text-xs leading-5 text-stone-600">프로젝트는 이 브라우저에 저장됩니다. 기기 변경 전에는 반드시 JSON으로 내보내세요. API 키는 JSON에 포함되지 않습니다.</p><Button variant="ghost" onClick={() => { clearAllSessionKeys(); setServices({ vworldKey: "", dataGoKrKey: "", sgisKey: "" }); setApiKey(""); toast.success("이 브라우저 세션의 API 키를 지웠습니다."); }} className="mt-2 h-auto px-0 text-xs text-[#8b4a38] hover:bg-transparent hover:text-[#6f3729]"><Trash2 className="mr-1.5 h-3.5 w-3.5" />세션 키 지우기</Button></div></aside>
  <section className="min-w-0 p-5 lg:p-7"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-mono text-[10px] tracking-[.18em] text-[#a9684f]">01 · SITE & LENSES</p><h1 className="mt-1 font-serif text-3xl text-stone-900">대지와 질문을 정리하세요</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">정확한 경계와 공공데이터·현장 메모를 한 프로젝트 안에 쌓고, 필요할 때 파일로 백업합니다.</p></div><Badge variant="outline" className="border-[#9aac8a] bg-[#edf2e8] text-[#46603e]">서버 계정 없음</Badge></div>
  <div className="mt-6 grid gap-4 rounded-sm border border-stone-300 bg-[#fbfaf7] p-4 shadow-[4px_4px_0_rgba(115,90,65,.08)] md:grid-cols-2"><label className="text-sm font-medium">프로젝트 이름<Input value={project.title} onChange={event => setProject({ title: event.target.value })} className="mt-2 border-stone-300 bg-white" /></label><label className="text-sm font-medium">대지 주소 또는 지번<Input value={project.site.address} onChange={event => setSite({ address: event.target.value })} placeholder="예: 광주광역시 동구…" className="mt-2 border-stone-300 bg-white" /></label><label className="text-sm font-medium">위도<Input type="number" value={project.site.latitude} onChange={event => setSite({ latitude: Number(event.target.value) })} className="mt-2 border-stone-300 bg-white" /></label><label className="text-sm font-medium">경도<Input type="number" value={project.site.longitude} onChange={event => setSite({ longitude: Number(event.target.value) })} className="mt-2 border-stone-300 bg-white" /></label></div>
  <div className="mt-5 rounded-sm border border-stone-300 bg-white p-4"><div className="flex items-center justify-between gap-3"><div><p className="font-mono text-[10px] tracking-[.16em] text-stone-500">SITE BOUNDARY</p><h2 className="mt-1 font-serif text-xl text-stone-900">대지 경계 좌표</h2></div><Badge variant="outline" className="border-stone-300">{project.site.boundary.length} 정점</Badge></div><Textarea value={boundaryDraft} onChange={event => setBoundaryDraft(event.target.value)} placeholder={"한 줄에 좌표 하나씩 입력하세요\n35.146700, 126.921000\n35.146900, 126.921300\n35.146500, 126.921500"} className="mt-3 min-h-32 border-stone-300 font-mono text-xs" /><div className="mt-3 flex justify-end"><Button size="sm" onClick={applyBoundary} className="bg-[#283126] text-white hover:bg-[#42503d]"><Save className="mr-1.5 h-4 w-4" />경계 저장</Button></div></div>
  <div className="mt-5 rounded-sm border border-stone-300 bg-[#fbfaf7] p-4"><p className="font-mono text-[10px] tracking-[.16em] text-stone-500">INVESTIGATION LENSES</p><h2 className="mt-1 font-serif text-xl text-stone-900">이번 조사에서 읽을 관점</h2><div className="mt-3 flex flex-wrap gap-2">{lenses.map(lens => <button key={lens} onClick={() => setProject({ lenses: project.lenses.includes(lens) ? project.lenses.filter(item => item !== lens) : [...project.lenses, lens] })} className={`border px-3 py-2 text-sm transition ${project.lenses.includes(lens) ? "border-[#a9684f] bg-[#fbf0e5] text-[#7a422f]" : "border-stone-300 bg-white text-stone-600 hover:border-stone-500"}`}>{lens}</button>)}</div></div>
  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-[#d9c3ae] bg-[#fbf3eb] p-3"><p className="text-xs leading-5 text-stone-600">VWorld 키를 저장한 뒤 현재 위도·경도에서 연속지적도 필지 후보를 직접 조회합니다. Pages 도메인 등록 전에는 브라우저 요청이 제한될 수 있습니다.</p><Button size="sm" variant="outline" onClick={collectVworldParcel} disabled={isVworldLoading} className="shrink-0 border-[#a9684f] bg-white text-[#7a422f]"><MapPinned className="mr-1.5 h-4 w-4" />{isVworldLoading ? "VWorld 조회 중…" : "VWorld 필지 후보 조회"}</Button></div><div className="mt-5 grid gap-5 xl:grid-cols-2"><RecordPanel title="수집 자료·공공데이터 메모" icon={<NotebookPen className="h-4 w-4" />} draft={researchDraft} setDraft={setResearchDraft} onAdd={addResearch} items={project.researchNotes} onRemove={id => removeItem("researchNotes", id)} type="research" /><RecordPanel title="현장 검증 관찰" icon={<MapPinned className="h-4 w-4" />} draft={observationDraft} setDraft={setObservationDraft} onAdd={addObservation} items={project.observations} onRemove={id => removeItem("observations", id)} type="observation" /></div></section>
  <aside className="border-l border-stone-300 bg-[#f8f5ef] p-4"><div className="border-b border-stone-300 pb-5"><p className="font-mono text-[10px] tracking-[.18em] text-stone-500">02 · BYOK SETTINGS</p><h2 className="mt-1 font-serif text-2xl text-stone-900">개인 키 설정</h2><p className="mt-2 text-xs leading-5 text-stone-600">키는 공개 코드와 내보내기 파일에 포함되지 않고, 이 브라우저 세션에만 남습니다.</p><div className="mt-4 space-y-3"><KeyInput label="VWorld 인증키" value={services.vworldKey} onChange={value => setServices({ ...services, vworldKey: value })} /><KeyInput label="공공데이터포털 ServiceKey" value={services.dataGoKrKey} onChange={value => setServices({ ...services, dataGoKrKey: value })} /><KeyInput label="SGIS 인증 정보" value={services.sgisKey} onChange={value => setServices({ ...services, sgisKey: value })} /><Button variant="outline" size="sm" onClick={saveKeys} className="w-full border-stone-300">설정 저장</Button></div></div><div className="pt-5"><p className="font-mono text-[10px] tracking-[.18em] text-[#a9684f]">03 · AI DESIGN TURN</p><div className="mt-3 flex gap-2">{(["openai", "gemini", "anthropic"] as LlmProvider[]).map(item => <button key={item} onClick={() => { saveLlmKey(provider, apiKey); setProvider(item); setApiKey(loadLlmKey(item)); }} className={`flex-1 border px-2 py-2 text-[11px] ${provider === item ? "border-[#a9684f] bg-[#fbf0e5] text-[#7a422f]" : "border-stone-300 bg-white text-stone-500"}`}>{providerLabel[item]}</button>)}</div><KeyInput label={`${providerLabel[provider]} API 키`} value={apiKey} onChange={setApiKey} /><Button onClick={runAi} disabled={isAiLoading} className="mt-3 w-full bg-[#a9684f] text-white hover:bg-[#8b523e]"><Sparkles className="mr-2 h-4 w-4" />{isAiLoading ? "설계 관점 정리 중…" : "AI 설계 관점 얻기"}</Button>{aiOutput && <div className="mt-4 whitespace-pre-wrap border border-[#d9c3ae] bg-[#fbf3eb] p-3 text-sm leading-6 text-stone-700">{aiOutput}</div>}<p className="mt-4 text-[11px] leading-5 text-stone-500">AI 응답은 설계 판단의 출발점입니다. 법규·안전·인허가 확정 판단으로 사용하지 마세요.</p></div></aside></div></main>;
}

function KeyInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block text-xs font-medium text-stone-700">{label}<Input type="password" value={value} onChange={event => onChange(event.target.value)} placeholder="나중에 직접 입력" className="mt-1.5 border-stone-300 bg-white" /></label>; }

function RecordPanel({ title, icon, draft, setDraft, onAdd, items, onRemove, type }: { title: string; icon: React.ReactNode; draft: any; setDraft: (value: any) => void; onAdd: () => void; items: Array<any>; onRemove: (id: string) => void; type: "research" | "observation" }) {
  return <section className="border border-stone-300 bg-white p-4"><div className="flex items-center gap-2 text-stone-900">{icon}<h2 className="font-serif text-xl">{title}</h2></div>{type === "research" ? <><Input value={draft.source} onChange={event => setDraft({ ...draft, source: event.target.value })} placeholder="출처" className="mt-3 border-stone-300" /><Input value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} placeholder="자료 제목" className="mt-2 border-stone-300" /><Textarea value={draft.summary} onChange={event => setDraft({ ...draft, summary: event.target.value })} placeholder="수집한 사실, 수치, 한계와 설계에 읽을 점" className="mt-2 min-h-24 border-stone-300" /></> : <><Input value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value })} placeholder="관찰 유형" className="mt-3 border-stone-300" /><Input value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} placeholder="관찰 제목" className="mt-2 border-stone-300" /><Textarea value={draft.note} onChange={event => setDraft({ ...draft, note: event.target.value })} placeholder="현장에서 검증한 내용, 소리·빛·보행·레벨차" className="mt-2 min-h-24 border-stone-300" /></>}<Button variant="outline" size="sm" onClick={onAdd} className="mt-2 border-stone-300"><Plus className="mr-1.5 h-4 w-4" />기록 추가</Button><div className="mt-4 space-y-2">{items.length === 0 ? <p className="text-xs text-stone-500">아직 기록이 없습니다.</p> : items.map(item => <article key={item.id} className="group border-l-2 border-[#a9684f] bg-[#fbfaf7] p-3"><div className="flex items-start justify-between gap-2"><div><p className="text-[11px] text-stone-500">{item.source ?? item.category}</p><p className="font-medium text-stone-900">{item.title}</p></div><button onClick={() => onRemove(item.id)} className="opacity-50 hover:text-[#8b4a38] group-hover:opacity-100" aria-label="기록 삭제"><Trash2 className="h-3.5 w-3.5" /></button></div><p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-stone-600">{item.summary ?? item.note}</p></article>)}</div></section>;
}
