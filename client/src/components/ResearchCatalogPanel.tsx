import { useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, ClipboardCheck, ExternalLink, LibraryBig, MapPinned } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { LocalProject } from "@/static/model";
import { goalAlignment, priorityLabels, researchCatalog, statusLabels, type ResearchCatalogStatus } from "@/static/researchCatalog";

const statusStyles: Record<ResearchCatalogStatus, string> = {
  implemented: "bg-[#e8f0e4] text-[#42633d]",
  partial: "bg-[#fff5dd] text-[#8a621c]",
  planned: "bg-[#fff0eb] text-[#8b3a2d]",
  field: "bg-[#edf1f7] text-[#4a617f]",
};

const alignmentStyles = {
  ready: "border-[#bfcdb5] bg-[#f3f8f0]",
  partial: "border-[#e8d5ae] bg-[#fffaf0]",
  missing: "border-[#e1c1b6] bg-[#fff7f4]",
};

const alignmentLabels = { ready: "확인", partial: "부분", missing: "미완료" };

export function ResearchCatalogPanel({ project }: { project: LocalProject }) {
  const [filter, setFilter] = useState<"all" | ResearchCatalogStatus>("all");
  const [category, setCategory] = useState("전체");
  const alignment = goalAlignment(project);
  const categories = useMemo(() => ["전체", ...Array.from(new Set(researchCatalog.map(item => item.category)))], []);
  const visibleItems = researchCatalog.filter(item => (filter === "all" || item.status === filter) && (category === "전체" || item.category === category));
  const implementedCount = researchCatalog.filter(item => item.status === "implemented").length;
  const plannedCount = researchCatalog.filter(item => item.status === "planned").length;

  return <section className="mt-5 border border-stone-300 bg-[#fbfaf7] p-4">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="font-mono text-[10px] tracking-[.16em] text-[#a9684f]">RESEARCH DATA MAP</p>
        <h2 className="mt-1 flex items-center gap-2 font-serif text-2xl text-stone-900"><LibraryBig className="h-5 w-5 text-[#a9684f]" />조사 가능한 자료와 보충 목록</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">현재 연결된 자료와 아직 보충해야 할 자료를 한 기준으로 확인합니다. 보충 예정 자료는 수집 완료로 표시하지 않으며, 출처·공간 단위·한계를 함께 기록합니다.</p>
      </div>
      <div className="flex gap-2 text-xs"><Badge className="border-0 bg-[#e8f0e4] text-[#42633d]">사용 가능 {implementedCount}</Badge><Badge className="border-0 bg-[#fff0eb] text-[#8b3a2d]">보충 필요 {plannedCount}</Badge></div>
    </div>

    <div className="mt-4 border border-[#d9c3ae] bg-[#fffaf5] p-3">
      <div className="flex flex-wrap items-start gap-2"><ClipboardCheck className="mt-0.5 h-4 w-4 text-[#a9684f]" /><div><p className="text-sm font-medium text-stone-900">초기 목표 부합 여부</p><p className="mt-1 text-xs leading-5 text-stone-600">필지 확정 → 조사 주제 선택 → 출처 있는 수집 → 공간 관계 → 현장 검증 → 설계 질문·가설의 순서로 점검합니다.</p></div></div>
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{alignment.map(item => <div key={item.id} className={`border p-3 ${alignmentStyles[item.status]}`}><div className="flex items-center justify-between gap-2"><p className="text-xs font-medium text-stone-900">{item.title}</p><span className="text-[10px] font-medium text-stone-500">{alignmentLabels[item.status]}</span></div><p className="mt-1 text-[11px] leading-5 text-stone-600">{item.detail}</p></div>)}</div>
    </div>

    <div className="mt-4 flex flex-wrap gap-2"><span className="mr-1 self-center text-xs text-stone-500">상태</span>{(["all", "implemented", "partial", "planned", "field"] as const).map(value => <button key={value} type="button" onClick={() => setFilter(value)} className={`border px-2.5 py-1.5 text-xs ${filter === value ? "border-[#a9684f] bg-[#fbf0e5] text-[#7a422f]" : "border-stone-300 bg-white text-stone-600"}`}>{value === "all" ? "전체" : statusLabels[value]}</button>)}<select value={category} onChange={event => setCategory(event.target.value)} className="border border-stone-300 bg-white px-2.5 py-1.5 text-xs text-stone-600"><option value="전체">모든 조사 영역</option>{categories.slice(1).map(item => <option key={item} value={item}>{item}</option>)}</select></div>

    <div className="mt-3 grid gap-3 lg:grid-cols-2">{visibleItems.map(item => <article key={item.id} className="border border-stone-300 bg-white p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-mono tracking-[.12em] text-stone-500">{item.category}</span><Badge className={`border-0 px-2 py-0.5 text-[10px] ${statusStyles[item.status]}`}>{statusLabels[item.status]}</Badge><span className="text-[10px] text-stone-400">{priorityLabels[item.priority]}</span></div><h3 className="mt-1 font-medium text-stone-900">{item.title}</h3></div>{item.officialUrl && <a href={item.officialUrl} target="_blank" rel="noreferrer" aria-label={`${item.title} 공식 출처 열기`} className="shrink-0 text-stone-400 hover:text-[#a9684f]"><ExternalLink className="h-4 w-4" /></a>}</div><p className="mt-2 text-xs leading-5 text-stone-700"><strong>활용:</strong> {item.role}</p><div className="mt-2 grid gap-2 text-[11px] leading-5 text-stone-500 sm:grid-cols-2"><p><strong className="text-stone-600">출처</strong><br />{item.source}</p><p><strong className="text-stone-600">공간 단위</strong><br />{item.unit}</p></div><p className="mt-2 border-t border-stone-100 pt-2 text-[11px] leading-5 text-stone-500"><strong className="text-stone-600">한계·보완:</strong> {item.limitation}</p></article>)}</div>
    {!visibleItems.length && <p className="border border-dashed border-stone-300 bg-white p-5 text-center text-sm text-stone-500">현재 필터에 해당하는 자료가 없습니다.</p>}
    <p className="mt-3 text-[11px] leading-5 text-stone-500"><MapPinned className="mr-1 inline h-3.5 w-3.5 text-[#a9684f]" />자료의 존재만으로 설계 결론을 만들지 않습니다. API 응답 시점·공간 단위·측정 한계를 조사 근거에 남기고, 소리·빛·냄새·체류·실제 접근은 현장에서 보완합니다.</p>
  </section>;
}

export function GoalAlignmentIcon({ status }: { status: "ready" | "partial" | "missing" }) {
  return status === "ready" ? <CheckCircle2 className="h-3.5 w-3.5 text-[#42633d]" /> : <CircleAlert className={`h-3.5 w-3.5 ${status === "partial" ? "text-[#8a621c]" : "text-[#8b3a2d]"}`} />;
}