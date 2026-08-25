import { useState } from "react";
import { Loader2, MapPinned, SquareCheckBig } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SiteRecord } from "@/static/model";
import { fetchVworldBrowserParcel, parcelCandidateKey, type VworldParcelCandidate } from "@/static/vworld";
import { toast } from "sonner";

type Props = { site: SiteRecord; vworldKey: string; vworldDomain?: string; radiusMeters: number; candidates: VworldParcelCandidate[]; selectedKeys: string[]; onCandidatesChange: (candidates: VworldParcelCandidate[]) => void; onToggle: (candidate: VworldParcelCandidate) => void; onConfirm: (candidates: VworldParcelCandidate[]) => void; onOpenSettings: () => void };

export function ParcelCandidatePanel({ site, vworldKey, vworldDomain, radiusMeters, candidates, selectedKeys, onCandidatesChange, onToggle, onConfirm, onOpenSettings }: Props) {
  const [loading, setLoading] = useState(false);
  const lookup = async () => {
    if (!vworldKey.trim()) { toast.error("VWorld 인증키를 API 설정에서 불러오세요."); onOpenSettings(); return; }
    try { setLoading(true); const results = await fetchVworldBrowserParcel({ key: vworldKey, domain: vworldDomain, latitude: site.latitude, longitude: site.longitude, radiusMeters, boundary: site.boundary }); onCandidatesChange(results); if (results[0] && !selectedKeys.includes(parcelCandidateKey(results[0]))) onToggle(results[0]); if (!results.length) toast.error(site.boundary.length >= 3 ? "그린 대지경계와 겹치는 필지를 찾지 못했습니다." : "현재 조사 반경에서 필지 후보를 찾지 못했습니다."); }
    catch (error) { toast.error(error instanceof Error ? error.message : "필지 후보 조회에 실패했습니다."); }
    finally { setLoading(false); }
  };
  const selectedCandidates = candidates.filter(candidate => selectedKeys.includes(parcelCandidateKey(candidate)));
  return <section className="mt-3 border border-[#d9c3ae] bg-[#fbf3eb] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-[10px] tracking-[.16em] text-[#a9684f]">PARCEL CONFIRMATION · OPTIONAL</p><h2 className="mt-1 flex items-center gap-2 font-serif text-xl text-stone-900"><MapPinned className="h-4 w-4 text-[#a9684f]" />지도 중심점의 필지 후보 확인</h2><p className="mt-1 text-xs leading-5 text-stone-600">{site.boundary.length >= 3 ? "직접 그린 대지경계와 겹치는 연속지적도 Polygon만 지도에 표시합니다." : `조사 반경 ${radiusMeters}m의 연속지적도 Polygon을 지도에 표시합니다.`} 지도에서 필지를 직접 클릭하거나 목록에서 선택한 뒤 실제 필지와 일치하는 항목만 확정하세요.</p></div><Button size="sm" onClick={lookup} disabled={loading} className="bg-[#a9684f] text-white hover:bg-[#8b523e]">{loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <MapPinned className="mr-1.5 h-4 w-4" />}{loading ? "조회 중…" : "필지 후보 조회"}</Button></div>{candidates.length > 0 && <div className="mt-3"><div className="space-y-2">{candidates.map(candidate => <label key={parcelCandidateKey(candidate)} className={`flex cursor-pointer items-start gap-2 border p-3 ${selectedKeys.includes(parcelCandidateKey(candidate)) ? "border-[#a9684f] bg-white" : "border-[#d9c3ae] bg-[#fffaf5]"}`}><input type="checkbox" name="parcel" checked={selectedKeys.includes(parcelCandidateKey(candidate))} onChange={() => onToggle(candidate)} /><span className="text-sm"><strong>{candidate.parcelNumber ?? "지번 미확인"}</strong><span className="ml-2 text-stone-600">PNU {candidate.pnu ?? "미확인"} · 지목 {candidate.landCategory ?? "미확인"} · 면적 {candidate.areaSqm ? `${candidate.areaSqm}㎡` : "미확인"}</span></span></label>)}</div><div className="mt-3 text-xs text-stone-600">선택된 필지: <strong>{selectedCandidates.length}개</strong>{selectedCandidates.length > 1 ? " · 여러 필지를 하나의 설계 대상 묶음으로 확정할 수 있습니다." : ""}</div><Button size="sm" disabled={!selectedCandidates.length} onClick={() => onConfirm(selectedCandidates)} className="mt-3 bg-[#283126] text-white hover:bg-[#42503d]"><SquareCheckBig className="mr-1.5 h-4 w-4" />선택 필지 확정</Button></div>}{site.pnu && <p className="mt-3 text-xs text-[#46603e]">확정 필지: {site.parcelLabel ?? "지번 미확인"} · PNU {site.pnu}</p>}</section>;
}
