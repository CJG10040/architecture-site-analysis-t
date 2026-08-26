import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Download, FileUp, MapPinned, NotebookPen, Plus, Ruler, Save, Settings2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SiteMapPicker } from "@/components/SiteMapPicker";
import { OpenStreetMapPicker } from "@/components/OpenStreetMapPicker";
import { PreflightPanel } from "@/components/PreflightPanel";
import { AiDesignPanel } from "@/components/AiDesignPanel";
import { ParcelCandidatePanel } from "@/components/ParcelCandidatePanel";
import { ResearchCatalogPanel } from "@/components/ResearchCatalogPanel";
import { toast } from "sonner";
import { boundaryGeoJson, boundaryMetrics } from "@/static/siteGeometry";
import { createLocalProject, getActiveProject, normalizeWorkspace, projectSnapshot, type LocalProject, updateProject } from "@/static/model";
import { loadPublicServices, loadWorkspace, saveWorkspace } from "@/static/store";
import { loadMapProvider, saveMapProvider, type MapProvider } from "@/static/mapProvider";
import { candidateBoundary, parcelCandidateKey, parcelGroupGeoJson, type VworldParcelCandidate } from "@/static/vworld";

const lenses = ["보행·접근", "지형·레벨", "일조·차폐", "지역 생활", "녹지·생태", "프로그램·상권"];
const newId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function downloadText(name: string, text: string) {
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(new Blob([text], { type: "application/json;charset=utf-8" }));
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}

export default function Home() {
  const [workspace, setWorkspace] = useState(loadWorkspace);
  const [services] = useState(loadPublicServices);
  const [mapProvider, setMapProvider] = useState<MapProvider>(loadMapProvider);
  const [advancedBoundaryOpen, setAdvancedBoundaryOpen] = useState(false);
  const [researchDraft, setResearchDraft] = useState({ source: "수동 조사", title: "", summary: "", url: "" });
  const [parcelCandidates, setParcelCandidates] = useState<VworldParcelCandidate[]>([]);
  const [selectedParcelKeys, setSelectedParcelKeys] = useState<string[]>([]);
  const [observationDraft, setObservationDraft] = useState({ category: "현장 검증", title: "", note: "" });
  const importRef = useRef<HTMLInputElement>(null);
  const project = getActiveProject(workspace);
  const boundaryText = useMemo(() => project.site.boundary.map(point => `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`).join("\n"), [project.site.boundary]);
  const [boundaryDraft, setBoundaryDraft] = useState(boundaryText);

  const commit = (next: LocalProject) => {
    const updated = updateProject(workspace, next);
    setWorkspace(updated);
    saveWorkspace(updated);
  };
  const updateSite = (change: Partial<LocalProject["site"]>) => {
    const positionChanged = change.latitude !== undefined || change.longitude !== undefined;
    commit({ ...project, site: { ...project.site, ...change, ...(positionChanged ? { parcels: undefined, pnu: undefined, parcelLabel: undefined, areaSqmSource: undefined } : {}) } });
  };
  const updateBoundary = (points: LocalProject["site"]["boundary"]) => {
    const metrics = boundaryMetrics(points);
    updateSite({ boundary: points, geoJson: boundaryGeoJson(points) ?? undefined, areaSqm: metrics.areaSqm || undefined, areaSqmSource: points.length >= 3 ? "geometry" : undefined, perimeterMeters: metrics.perimeterMeters || undefined, parcels: undefined, pnu: undefined, parcelLabel: undefined });
    setBoundaryDraft(points.map(point => `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`).join("\n"));
  };
  const createProject = () => {
    const next = createLocalProject(`새 대지조사 ${workspace.projects.length + 1}`);
    const updated = { ...workspace, activeProjectId: next.id, projects: [...workspace.projects, next] };
    setWorkspace(updated); saveWorkspace(updated); setBoundaryDraft("");
    toast.success("새 대지조사를 만들었습니다.");
  };
  const exportProject = () => downloadText(`${project.title.replace(/[^0-9A-Za-z가-힣_-]/g, "-") || "site-study"}.json`, projectSnapshot(project));
  const importProject = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const imported = normalizeWorkspace(parsed?.project ? { schemaVersion: 1, activeProjectId: parsed.project.id, projects: [parsed.project] } : parsed);
        if (!imported) throw new Error();
        const next = { ...workspace, activeProjectId: imported.projects[0].id, projects: [...workspace.projects.filter(item => item.id !== imported.projects[0].id), ...imported.projects] };
        setWorkspace(next); saveWorkspace(next); setBoundaryDraft(imported.projects[0].site.boundary.map(point => `${point.lat}, ${point.lng}`).join("\n"));
        toast.success("대지조사 JSON을 불러왔습니다. API 키는 포함되지 않습니다.");
      } catch { toast.error("이 파일은 유효한 대지조사 JSON 백업이 아닙니다."); }
    };
    reader.readAsText(file);
  };
  const applyAdvancedBoundary = () => {
    const points = boundaryDraft.split("\n").map(line => line.trim()).filter(Boolean).map(line => line.split(",").map(value => Number(value.trim()))).filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng)).map(([lat, lng]) => ({ lat, lng }));
    if (points.length && points.length < 3) return toast.error("경계 폴리곤은 3개 이상의 정점이 필요합니다.");
    updateBoundary(points); toast.success(points.length ? "텍스트 경계를 지도에 적용했습니다." : "대지 경계를 비웠습니다.");
  };
  const addResearch = () => {
    if (!researchDraft.title.trim() || !researchDraft.summary.trim()) return toast.error("자료 제목과 요약을 입력하세요.");
    commit({ ...project, researchNotes: [{ id: newId(), ...researchDraft, createdAt: new Date().toISOString() }, ...project.researchNotes] });
    setResearchDraft({ source: "수동 조사", title: "", summary: "", url: "" });
  };
  const addObservation = () => {
    if (!observationDraft.title.trim() || !observationDraft.note.trim()) return toast.error("관찰 제목과 내용을 입력하세요.");
    commit({ ...project, observations: [{ id: newId(), ...observationDraft, createdAt: new Date().toISOString() }, ...project.observations] });
    setObservationDraft({ category: "현장 검증", title: "", note: "" });
  };
  const addCollectedResearch = (notes: LocalProject["researchNotes"]) => {
    const overlays = notes.filter(note => Number.isFinite(note.latitude) && Number.isFinite(note.longitude)).map(note => ({ id: note.id, source: note.source, title: note.title, summary: note.summary, latitude: note.latitude!, longitude: note.longitude!, kind: "research" as const }));
    const spatialLayers = notes.map(note => note.spatialLayer).filter((layer): layer is NonNullable<typeof layer> => Boolean(layer));
    commit({ ...project, researchNotes: [...notes, ...project.researchNotes], overlays: [...overlays, ...project.overlays.filter(existing => !overlays.some(next => next.id === existing.id))], spatialLayers: [...spatialLayers, ...project.spatialLayers.filter(existing => !spatialLayers.some(next => next.id === existing.id))] });
  };
  const confirmParcels = (candidates: VworldParcelCandidate[]) => {
    if (!candidates.length) return;
    const first = candidates[0];
    const parcelLabel = candidates.length === 1 ? [first.parcelNumber, first.landCategory, first.areaSqm ? `${first.areaSqm}㎡` : undefined].filter(Boolean).join(" · ") : `${candidates.length}개 필지 묶음 · ${candidates.map(candidate => candidate.parcelNumber ?? "지번 미확인").join(", ")}`;
    const parcelPoints = candidates.length === 1 ? candidateBoundary(first) : [];
    const applyParcelGeometry = parcelPoints.length >= 3 && project.site.boundary.length < 3;
    const parcelMetrics = boundaryMetrics(parcelPoints);
    const attributeAreas = candidates.map(candidate => Number(String(candidate.areaSqm ?? "").replace(/,/g, ""))).filter((value, index) => Number.isFinite(value) && value > 0 && candidates[index].areaSqmSource === "attribute");
    const geometryAreas = candidates.map(candidate => Number(String(candidate.areaSqm ?? "").replace(/,/g, ""))).filter(value => Number.isFinite(value) && value > 0);
    const cadastralAreaSqm = attributeAreas.length ? attributeAreas.reduce((sum, value) => sum + value, 0) : undefined;
    const fallbackParcelAreaSqm = geometryAreas.length ? geometryAreas.reduce((sum, value) => sum + value, 0) : undefined;
    const resolvedAreaSqm = cadastralAreaSqm ?? fallbackParcelAreaSqm ?? (applyParcelGeometry ? parcelMetrics.areaSqm : project.site.areaSqm);
    const resolvedAreaSource = cadastralAreaSqm ? "cadastral" as const : fallbackParcelAreaSqm ? "geometry" as const : project.site.areaSqmSource;
    const areaSummary = resolvedAreaSqm ? `확정 필지 면적 합계 ${Math.round(resolvedAreaSqm).toLocaleString("ko-KR")}㎡ · ${resolvedAreaSource === "cadastral" ? "토지 속성 API 공부면적 합계" : resolvedAreaSource === "geometry" ? "필지 geometry 계산면적 합계" : "면적 출처 미확인"}` : "확정 필지 면적 합계 미확인";
    const groupGeoJson = parcelGroupGeoJson(candidates);
    const nextSite = { ...project.site, pnu: candidates.length === 1 ? first.pnu : undefined, parcelLabel, parcels: candidates, areaSqm: resolvedAreaSqm, areaSqmSource: resolvedAreaSource, geoJson: project.site.geoJson };
    if (groupGeoJson) nextSite.geoJson = candidates.length === 1 && applyParcelGeometry ? boundaryGeoJson(parcelPoints) ?? groupGeoJson : groupGeoJson;
    if (applyParcelGeometry) Object.assign(nextSite, { boundary: parcelPoints, areaSqm: (resolvedAreaSqm ?? parcelMetrics.areaSqm) || undefined, areaSqmSource: resolvedAreaSource ?? (parcelMetrics.areaSqm ? "geometry" : undefined), perimeterMeters: parcelMetrics.perimeterMeters || undefined });
    commit({ ...project, site: nextSite, researchNotes: [{ id: newId(), source: "VWorld 연속지적도", title: candidates.length === 1 ? "사용자 확정 필지" : `사용자 확정 필지 묶음 (${candidates.length}개)`, summary: `${areaSummary}. ${candidates.map(candidate => `PNU ${candidate.pnu ?? "미확인"} · 지번 ${candidate.parcelNumber ?? "미확인"} · 지목 ${candidate.landCategory ?? "속성 미확인"} · 면적 ${candidate.areaSqm ? `${candidate.areaSqm}㎡` : "geometry 면적 미확인"}${candidate.parcelAddress ? ` · 소재지 ${candidate.parcelAddress}` : ""}${candidate.publicPriceWonPerSqm ? ` · 공시지가 ${candidate.publicPriceWonPerSqm}원/㎡` : ""}`).join(" / ")}. 지도 위 연속지적도 Polygon을 사용자가 선택했습니다.${applyParcelGeometry ? " 기존 대지경계가 없어 단일 필지 geometry를 대지경계로 적용했습니다." : " 각 필지 geometry를 묶음으로 저장하고 기존 대지경계는 유지했습니다."}`, latitude: project.site.latitude, longitude: project.site.longitude, createdAt: new Date().toISOString() }, ...project.researchNotes] });
    toast.success(candidates.length === 1 && applyParcelGeometry ? "필지를 확정하고 대지경계를 적용했습니다." : `${candidates.length}개 필지를 하나의 설계 대상 묶음으로 확정했습니다.`);
  };
  const saveDesignTurn = (text: string, provider: "openai" | "gemini" | "anthropic") => commit({ ...project, designNotes: [{ id: newId(), question: `${provider} 설계 전환`, evidence: `${project.researchNotes.length}개 조사 근거·${project.observations.length}개 현장 관찰`, spatialIdea: text, createdAt: new Date().toISOString() }, ...project.designNotes] });
  const removeRecord = (type: "researchNotes" | "observations" | "designNotes", id: string) => commit({ ...project, [type]: project[type].filter(item => item.id !== id) });
  const openSettings = () => { window.location.hash = "settings"; window.dispatchEvent(new HashChangeEvent("hashchange")); };
  const selectMapProvider = (provider: MapProvider) => { setMapProvider(provider); saveMapProvider(provider); };
  useEffect(() => { setParcelCandidates([]); setSelectedParcelKeys([]); }, [project.site.latitude, project.site.longitude, project.site.boundary]);
  const handleParcelToggle = (candidate: VworldParcelCandidate) => { const key = parcelCandidateKey(candidate); setSelectedParcelKeys(keys => keys.includes(key) ? keys.filter(item => item !== key) : [...keys, key]); };

  return <main className="min-h-screen bg-[#f3f0e8] text-stone-800"><header className="sticky top-0 z-30 flex min-h-16 items-center justify-between border-b border-stone-300 bg-[#fbfaf7]/95 px-4 backdrop-blur lg:px-7"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center bg-[#283126] text-[#f4f0e8]"><MapPinned className="h-5 w-5" /></div><div><p className="font-serif text-lg text-stone-900">대지해석 개인 작업대</p><p className="font-mono text-[10px] tracking-[.16em] text-stone-500">MAP · LOCAL · EXPORTABLE</p></div></div><div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={openSettings} className="border-stone-300"><Settings2 className="mr-1.5 h-4 w-4" />API 설정</Button><Button variant="outline" size="sm" onClick={() => importRef.current?.click()} className="border-stone-300"><FileUp className="mr-1.5 h-4 w-4" />불러오기</Button><Button size="sm" onClick={exportProject} className="bg-[#283126] text-white hover:bg-[#42503d]"><Download className="mr-1.5 h-4 w-4" />내보내기</Button><input ref={importRef} type="file" accept="application/json" className="hidden" onChange={event => importProject(event.target.files?.[0])} /></div></header>
  <div className="grid min-h-[calc(100vh-4rem)] xl:grid-cols-[244px_minmax(0,1fr)_340px]"><aside className="border-r border-stone-300 bg-[#f8f5ef] p-4"><p className="font-mono text-[10px] tracking-[.18em] text-stone-500">LOCAL PROJECTS</p><div className="mt-3 space-y-2">{workspace.projects.map(item => <button key={item.id} onClick={() => { const next = { ...workspace, activeProjectId: item.id }; setWorkspace(next); saveWorkspace(next); setBoundaryDraft(item.site.boundary.map(point => `${point.lat}, ${point.lng}`).join("\n")); }} className={`w-full border p-3 text-left transition ${item.id === project.id ? "border-[#a9684f] bg-[#fbf3eb]" : "border-stone-300 bg-white hover:bg-stone-50"}`}><span className="block truncate font-medium text-stone-900">{item.title}</span><span className="mt-1 block text-xs text-stone-500">{item.site.boundary.length} 정점 · {item.researchNotes.length} 자료</span></button>)}</div><Button variant="outline" onClick={createProject} className="mt-3 w-full border-dashed border-stone-400"><Plus className="mr-2 h-4 w-4" />새 프로젝트</Button><div className="mt-7 border-t border-stone-300 pt-5 text-xs leading-5 text-stone-600"><p className="font-mono text-[10px] tracking-[.18em] text-stone-500">SAFE STORAGE</p><p className="mt-2">조사 프로젝트는 이 브라우저에만 저장됩니다. 기기를 바꾸기 전에는 JSON으로 내보내세요. API 키는 백업 파일에 포함되지 않습니다.</p></div></aside>
  <section className="min-w-0 p-5 lg:p-7"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-mono text-[10px] tracking-[.18em] text-[#a9684f]">01 · SITE SELECTION</p><h1 className="mt-1 font-serif text-3xl text-stone-900">지도에서 대지를 선택하세요</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">주소를 검색해 중심점을 정하고, 대지 경계는 지도에서 직접 그린 뒤 정점을 편집해 확정합니다. 좌표 입력은 보조 보정 도구입니다.</p></div><Badge className="border-0 bg-[#e5eddd] text-[#46603e]">개인 브라우저 보관</Badge></div>
  <div className="mt-6 grid gap-4 rounded-sm border border-stone-300 bg-[#fbfaf7] p-4 md:grid-cols-2"><label className="text-sm font-medium">프로젝트 이름<Input value={project.title} onChange={event => commit({ ...project, title: event.target.value })} className="mt-2 border-stone-300 bg-white" /></label><label className="text-sm font-medium">확정 주소·지번<Input value={project.site.address} onChange={event => updateSite({ address: event.target.value })} placeholder="지도 검색 결과가 자동 입력됩니다" className="mt-2 border-stone-300 bg-white" /></label></div>
  <section className="mt-5 border border-stone-300 bg-[#fbfaf7] p-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-mono text-[10px] tracking-[.16em] text-stone-500">MAP PROVIDER</p><p className="mt-1 text-sm text-stone-600">주소 품질과 지도 표시를 비교해 현재 조사에 적합한 지도를 선택하세요.</p></div><div className="flex gap-2"><Button size="sm" variant={mapProvider === "naver" ? "default" : "outline"} onClick={() => selectMapProvider("naver")} className={mapProvider === "naver" ? "bg-[#283126] text-white" : "border-stone-300"}>네이버 지도</Button><Button size="sm" variant={mapProvider === "openstreetmap" ? "default" : "outline"} onClick={() => selectMapProvider("openstreetmap")} className={mapProvider === "openstreetmap" ? "bg-[#283126] text-white" : "border-stone-300"}>OpenStreetMap 백업</Button></div></div></section>
  {mapProvider === "naver" ? <SiteMapPicker clientId={services.naverMapsClientId ?? ""} latitude={project.site.latitude} longitude={project.site.longitude} address={project.site.address} boundary={project.site.boundary} radiusMeters={project.studyRadiusMeters} overlays={project.overlays} spatialLayers={project.spatialLayers} parcelCandidates={parcelCandidates} confirmedParcels={project.site.parcels ?? []} selectedParcelKeys={selectedParcelKeys} onParcelToggle={handleParcelToggle} onSiteChange={updateSite} onBoundaryChange={updateBoundary} onOpenSettings={openSettings} onSwitchToOpenStreetMap={() => selectMapProvider("openstreetmap")} /> : <OpenStreetMapPicker latitude={project.site.latitude} longitude={project.site.longitude} address={project.site.address} boundary={project.site.boundary} radiusMeters={project.studyRadiusMeters} overlays={project.overlays} spatialLayers={project.spatialLayers} parcelCandidates={parcelCandidates} confirmedParcels={project.site.parcels ?? []} selectedParcelKeys={selectedParcelKeys} onParcelToggle={handleParcelToggle} onSiteChange={updateSite} onBoundaryChange={updateBoundary} />}
  <ParcelCandidatePanel site={project.site} vworldKey={services.vworldKey} vworldDomain={services.vworldDomain} radiusMeters={project.studyRadiusMeters} candidates={parcelCandidates} selectedKeys={selectedParcelKeys} onCandidatesChange={setParcelCandidates} onToggle={handleParcelToggle} onConfirm={confirmParcels} onOpenSettings={openSettings} />
  <div className="mt-3 grid gap-3 sm:grid-cols-4"><Metric label="중심 좌표" value={`${project.site.latitude.toFixed(6)}, ${project.site.longitude.toFixed(6)}`} /><Metric label={project.site.areaSqmSource === "cadastral" ? "대지면적 · 필지면적 합계" : project.site.areaSqmSource === "geometry" ? "대지면적 · geometry 계산" : "대지면적"} value={project.site.areaSqm ? `${Math.round(project.site.areaSqm).toLocaleString("ko-KR")}㎡` : "미확정"} /><Metric label="경계 둘레" value={project.site.perimeterMeters ? `${Math.round(project.site.perimeterMeters)}m` : "경계 미확정"} /><label className="border border-stone-300 bg-white px-3 py-2"><span className="font-mono text-[10px] tracking-[.13em] text-stone-500">조사 반경 (m)</span><Input type="number" min="50" max="3000" step="50" value={project.studyRadiusMeters} onChange={event => commit({ ...project, studyRadiusMeters: Math.min(3000, Math.max(50, Number(event.target.value) || 300)) })} className="mt-1 h-7 border-0 p-0 text-sm font-medium shadow-none focus-visible:ring-0" /></label></div>
  <details className="mt-3 border border-dashed border-stone-300 bg-white p-3" open={advancedBoundaryOpen} onToggle={event => setAdvancedBoundaryOpen((event.target as HTMLDetailsElement).open)}><summary className="cursor-pointer text-sm font-medium text-stone-700">고급 보정: 좌표 목록 붙여넣기</summary><Textarea value={boundaryDraft} onChange={event => setBoundaryDraft(event.target.value)} placeholder="한 줄에 위도, 경도" className="mt-3 min-h-28 border-stone-300 font-mono text-xs" /><div className="mt-2 flex justify-end"><Button size="sm" variant="outline" onClick={applyAdvancedBoundary} className="border-stone-300"><Save className="mr-1.5 h-4 w-4" />지도 경계에 적용</Button></div></details>
  <section className="mt-5 border border-stone-300 bg-[#fbfaf7] p-4"><p className="font-mono text-[10px] tracking-[.16em] text-stone-500">02 · INVESTIGATION LENSES</p><h2 className="mt-1 font-serif text-xl text-stone-900">무엇을 우선 읽을까요?</h2><div className="mt-3 flex flex-wrap gap-2">{lenses.map(lens => <button key={lens} onClick={() => commit({ ...project, lenses: project.lenses.includes(lens) ? project.lenses.filter(item => item !== lens) : [...project.lenses, lens] })} className={`border px-3 py-2 text-sm transition ${project.lenses.includes(lens) ? "border-[#a9684f] bg-[#fbf0e5] text-[#7a422f]" : "border-stone-300 bg-white text-stone-600 hover:border-stone-500"}`}>{lens}</button>)}</div></section>
  <ResearchCatalogPanel project={project} onPlanChange={researchPlan => commit({ ...project, researchPlan })} /><PreflightPanel project={project} settings={services} onCollected={addCollectedResearch} /><div className="mt-5 grid gap-5 xl:grid-cols-2"><RecordPanel title="수집 자료·조사 근거" icon={<NotebookPen className="h-4 w-4" />} draft={researchDraft} setDraft={setResearchDraft} onAdd={addResearch} onRemove={id => removeRecord("researchNotes", id)} items={project.researchNotes} type="research" /><RecordPanel title="현장 검증 관찰" icon={<MapPinned className="h-4 w-4" />} draft={observationDraft} setDraft={setObservationDraft} onAdd={addObservation} onRemove={id => removeRecord("observations", id)} items={project.observations} type="observation" /></div><AiDesignPanel project={project} onSave={saveDesignTurn} onOpenSettings={openSettings} /></section>
  <aside className="border-l border-stone-300 bg-[#f8f5ef] p-4"><p className="font-mono text-[10px] tracking-[.18em] text-stone-500">NEXT ACTION</p><h2 className="mt-1 font-serif text-2xl text-stone-900">조사 순서</h2><ol className="mt-4 space-y-3 text-sm leading-6 text-stone-700"><li><span className="mr-2 font-mono text-[#a9684f]">01</span>API 설정에서 지도 키와 필요한 데이터 키를 불러옵니다.</li><li><span className="mr-2 font-mono text-[#a9684f]">02</span>지도에서 주소·중심·폴리곤 경계를 확정합니다.</li><li><span className="mr-2 font-mono text-[#a9684f]">03</span>조사 렌즈를 고르고 현장 전 자동 읽기를 승인합니다.</li><li><span className="mr-2 font-mono text-[#a9684f]">04</span>수집 근거를 확인한 뒤 AI 설계 전환으로 넘어갑니다.</li></ol><Button onClick={openSettings} className="mt-6 w-full bg-[#a9684f] text-white hover:bg-[#8b523e]"><Settings2 className="mr-2 h-4 w-4" />API 설정·연결 확인</Button><a href="https://cjg10040.github.io/architecture-site-analysis-t/" target="_blank" rel="noreferrer" className="mt-3 flex items-center justify-center gap-1 text-xs text-stone-500 underline underline-offset-4">공개 Pages 주소 <ArrowUpRight className="h-3.5 w-3.5" /></a></aside></div></main>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="border border-stone-300 bg-white px-3 py-2"><p className="font-mono text-[10px] tracking-[.13em] text-stone-500">{label}</p><p className="mt-1 flex items-center gap-1 text-sm font-medium text-stone-800"><Ruler className="h-3.5 w-3.5 text-[#a9684f]" />{value}</p></div>; }

function RecordPanel({ title, icon, draft, setDraft, onAdd, onRemove, items, type }: { title: string; icon: React.ReactNode; draft: any; setDraft: (value: any) => void; onAdd: () => void; onRemove: (id: string) => void; items: any[]; type: "research" | "observation" }) { return <section className="border border-stone-300 bg-white p-4"><div className="flex items-center gap-2 text-stone-900">{icon}<h2 className="font-serif text-xl">{title}</h2></div>{type === "research" ? <><Input value={draft.source} onChange={event => setDraft({ ...draft, source: event.target.value })} placeholder="출처 또는 제공기관" className="mt-3 border-stone-300" /><Input value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} placeholder="자료 제목" className="mt-2 border-stone-300" /><Textarea value={draft.summary} onChange={event => setDraft({ ...draft, summary: event.target.value })} placeholder="수집한 사실·수치·한계·설계에 읽을 점" className="mt-2 min-h-24 border-stone-300" /></> : <><Input value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value })} placeholder="관찰 유형" className="mt-3 border-stone-300" /><Input value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} placeholder="관찰 제목" className="mt-2 border-stone-300" /><Textarea value={draft.note} onChange={event => setDraft({ ...draft, note: event.target.value })} placeholder="현장에서 검증한 접근·소리·빛·보행·레벨차" className="mt-2 min-h-24 border-stone-300" /></>}<Button variant="outline" size="sm" onClick={onAdd} className="mt-2 border-stone-300"><Plus className="mr-1.5 h-4 w-4" />기록 추가</Button><div className="mt-4 space-y-2">{items.length === 0 ? <p className="text-xs text-stone-500">아직 기록이 없습니다.</p> : items.map(item => <article key={item.id} className="group border-l-2 border-[#a9684f] bg-[#fbfaf7] p-3"><div className="flex items-start justify-between gap-2"><div><p className="text-[11px] text-stone-500">{item.source ?? item.category}</p><p className="font-medium text-stone-900">{item.title}</p></div><button onClick={() => onRemove(item.id)} className="opacity-60 hover:text-[#8b4a38] group-hover:opacity-100" aria-label="기록 삭제"><Trash2 className="h-3.5 w-3.5" /></button></div><p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-stone-600">{item.summary ?? item.note}</p>{(item.detail || item.rawData) && <details className="mt-2 border-t border-stone-200 pt-2"><summary className="cursor-pointer text-[11px] font-medium text-[#46603e]">상세 원자료·속성 보기</summary><pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words bg-[#f8f5ef] p-2 text-[10px] leading-4 text-stone-600">{item.detail ?? item.rawData}{item.rawDataTruncated ? "\n\n[저장 한도로 일부가 잘렸습니다]" : ""}</pre></details>}</article>)}</div></section>; }
