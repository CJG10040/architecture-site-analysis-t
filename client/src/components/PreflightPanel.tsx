import { useRef, useState } from "react";
import { CheckSquare, FileUp, Loader2, Play, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LocalProject, PublicServiceSettings, ResearchNote } from "@/static/model";
import { collectSource, researchNoteFromFile, sourceAvailability, suggestedSources, type SourceId } from "@/static/research";
import { toast } from "sonner";

export function PreflightPanel({ project, settings, onCollected }: { project: LocalProject; settings: PublicServiceSettings; onCollected: (notes: ResearchNote[]) => void }) {
  const suggested = suggestedSources(project.lenses);
  const [selected, setSelected] = useState<SourceId[]>(suggested.map(source => source.id));
  const [running, setRunning] = useState(false);
  const [messages, setMessages] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const toggle = (id: SourceId) => setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  const collect = async () => {
    if (project.site.boundary.length < 3) return toast.error("지도에서 3개 이상의 경계 정점을 확정한 뒤 자동 읽기를 시작하세요.");
    if (!selected.length) return toast.error("수집할 데이터원을 하나 이상 선택하세요.");
    setRunning(true); const notes: ResearchNote[] = [];
    for (const source of suggested.filter(item => selected.includes(item.id))) {
      if (!sourceAvailability(source, settings)) { setMessages(previous => ({ ...previous, [source.id]: "키 없음: 설정 화면에서 연결하세요." })); continue; }
      try { const result = await collectSource(source, project.site, settings); notes.push(result); setMessages(previous => ({ ...previous, [source.id]: "수집 완료" })); }
      catch (error) { setMessages(previous => ({ ...previous, [source.id]: error instanceof Error ? error.message : "수집 실패" })); }
    }
    if (notes.length) { onCollected(notes); toast.success(`${notes.length}개 조사 근거를 저장했습니다.`); }
    setRunning(false);
  };
  const importFile = async (file?: File) => { if (!file) return; try { onCollected([await researchNoteFromFile(file)]); toast.success("원본 응답 파일을 조사 근거로 추가했습니다."); } catch { toast.error("원본 파일을 읽지 못했습니다."); } };
  return <section className="mt-5 border border-[#d9c3ae] bg-[#fbf3eb] p-4"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-mono text-[10px] tracking-[.16em] text-[#a9684f]">03 · PRE-FIELD READING</p><h2 className="mt-1 font-serif text-2xl text-stone-900">현장 전에 자동으로 읽기</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">조사 렌즈와 확정 경계에 맞는 데이터원만 선택해 수집합니다. 각 항목의 출처·제한·현장 검증 필요성을 기록으로 남깁니다.</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => fileRef.current?.click()} className="border-[#a9684f] bg-white"><FileUp className="mr-2 h-4 w-4" />원본 파일 가져오기</Button><Button onClick={collect} disabled={running} className="bg-[#a9684f] text-white hover:bg-[#8b523e]">{running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}{running ? "수집 중…" : "선택 항목 수집"}</Button><input ref={fileRef} type="file" accept="application/json,text/csv,text/xml,.json,.csv,.xml" className="hidden" onChange={event => importFile(event.target.files?.[0])} /></div></div><div className="mt-4 grid gap-3 md:grid-cols-2">{suggested.length ? suggested.map(source => <label key={source.id} className="flex cursor-pointer items-start gap-3 border border-[#d9c3ae] bg-white p-3"><input type="checkbox" checked={selected.includes(source.id)} onChange={() => toggle(source.id)} className="mt-1" /><span className="min-w-0"><span className="flex items-center gap-1 font-medium text-stone-900"><CheckSquare className="h-3.5 w-3.5 text-[#a9684f]" />{source.title}</span><span className="mt-1 block text-xs text-stone-500">{source.source}</span><span className="mt-2 block text-xs leading-5 text-stone-600">{source.limitation}</span><span className={`mt-2 block text-[11px] ${sourceAvailability(source, settings) ? "text-[#42633d]" : "text-[#8b3a2d]"}`}>{messages[source.id] ?? (sourceAvailability(source, settings) ? "수집 준비됨" : "API 키 또는 설정 필요")}</span></span></label>) : <p className="text-sm text-stone-600">조사 렌즈를 하나 이상 선택하면 권장 데이터원이 나타납니다.</p>}</div><p className="mt-4 text-xs leading-5 text-stone-500"><ShieldAlert className="mr-1 inline h-3.5 w-3.5 text-[#a9684f]" />브라우저에서 직접 요청이 차단되면 실패 사유를 남기고, 제공기관에서 받은 JSON·CSV·XML 파일을 가져와 동일한 조사 보드에 기록하세요.</p></section>;
}
