import { useState } from "react";
import { Bot, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LlmProvider, LocalProject } from "@/static/model";
import { requestLlm } from "@/static/llm";
import { loadLlmKey } from "@/static/store";
import { toast } from "sonner";

const label: Record<LlmProvider, string> = { openai: "OpenAI", gemini: "Google Gemini", anthropic: "Anthropic" };
const id = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function AiDesignPanel({ project, onSave, onOpenSettings }: { project: LocalProject; onSave: (text: string, provider: LlmProvider) => void; onOpenSettings: () => void }) {
  const [provider, setProvider] = useState<LlmProvider>("openai");
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState("");
  const run = async () => {
    if (!project.researchNotes.length && !project.observations.length) return toast.error("먼저 조사 근거 또는 현장 관찰을 하나 이상 저장하세요.");
    const key = loadLlmKey(provider);
    if (!key) { toast.error(`${label[provider]} 키를 API 설정에서 불러오세요.`); onOpenSettings(); return; }
    try { setLoading(true); const result = await requestLlm(provider, key, project); setOutput(result); onSave(result, provider); toast.success("AI 설계 전환을 프로젝트에 저장했습니다."); }
    catch (error) { toast.error(error instanceof Error ? error.message : "AI 요청에 실패했습니다."); }
    finally { setLoading(false); }
  };
  return <section className="mt-5 border border-[#bfcdb5] bg-[#eef3eb] p-4"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-mono text-[10px] tracking-[.16em] text-[#46603e]">04 · AI DESIGN TURN</p><h2 className="mt-1 flex items-center gap-2 font-serif text-2xl text-stone-900"><Bot className="h-5 w-5 text-[#46603e]" />근거에서 설계 관점으로</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">저장된 상세 조사 원자료·공간 속성·현장 관찰을 함께 전송합니다. 거시·중간·대지·미시 순서의 분석과 사실·해석·추가 조사·공간 가설을 구분하는 초안을 받고, 최종 설계 판단은 사용자가 합니다.</p></div><div className="flex rounded-sm border border-[#bfcdb5] bg-white p-1">{(["openai", "gemini", "anthropic"] as LlmProvider[]).map(item => <button key={item} onClick={() => setProvider(item)} className={`px-2.5 py-1.5 text-xs ${provider === item ? "bg-[#46603e] text-white" : "text-stone-600"}`}>{label[item]}</button>)}</div></div><p className="mt-3 text-xs text-stone-600">AI 입력 대기자료: 상세 조사 {project.researchNotes.filter(note => note.detail || note.rawData).length}개 · 현장 관찰 {project.observations.length}개 · 공간 레이어 {project.spatialLayers.length}개</p><div className="mt-4 flex flex-wrap gap-2"><Button onClick={run} disabled={loading} className="bg-[#46603e] text-white hover:bg-[#354e31]">{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}{loading ? "설계 관점 정리 중…" : "AI 설계 관점 얻기"}</Button><Button variant="outline" onClick={onOpenSettings} className="border-[#9fb497] bg-white">키·연결 설정</Button></div>{output && <div className="mt-4 whitespace-pre-wrap border border-[#bfcdb5] bg-white p-4 text-sm leading-6 text-stone-700">{output}</div>}{project.designNotes.length > 0 && <div className="mt-4 border-t border-[#bfcdb5] pt-4"><p className="font-mono text-[10px] tracking-[.14em] text-[#46603e]">SAVED DESIGN TURNS · {project.designNotes.length}</p><div className="mt-2 space-y-2">{project.designNotes.map(note => <article key={note.id} className="border border-[#cbd9c4] bg-white p-3"><p className="text-xs text-stone-500">{note.question} · {new Date(note.createdAt).toLocaleString("ko-KR")}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-stone-700">{note.spatialIdea}</p></article>)}</div></div>}<p className="mt-3 text-[11px] leading-5 text-stone-500">AI 출력은 설계 사고의 출발점이며 법규·안전·인허가의 확정 판단으로 사용하지 마세요.</p></section>;
}
