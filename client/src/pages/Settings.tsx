import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { credentialGroups, type CredentialGroup } from "@shared/integrations";
import { ArrowLeft, CheckCircle2, FileArchive, KeyRound, Loader2, LockKeyhole, ShieldCheck, Upload, XCircle } from "lucide-react";
import { FormEvent, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

type KeyValues = { primary: string; secondary?: string };

export default function Settings() {
  const { user, loading } = useAuth();
  const [values, setValues] = useState<Partial<Record<CredentialGroup, KeyValues>>>({});
  const credentials = trpc.admin.apiCredentials.list.useQuery(undefined, { enabled: user?.role === "admin" });
  const cadastralImports = trpc.admin.cadastral.list.useQuery(undefined, { enabled: user?.role === "admin" });
  const upsert = trpc.admin.apiCredentials.upsert.useMutation({
    onSuccess: (_, variables) => {
      setValues(current => ({ ...current, [variables.group]: { primary: "", secondary: "" } }));
      void credentials.refetch();
      toast.success("제공기관 공통 키가 암호화되어 저장되었습니다.");
    },
    onError: error => toast.error(error.message),
  });
  const disable = trpc.admin.apiCredentials.disable.useMutation({
    onSuccess: () => { void credentials.refetch(); toast.success("제공기관 키 연결이 비활성화되었습니다."); },
    onError: error => toast.error(error.message),
  });
  const validate = trpc.admin.apiCredentials.validate.useMutation({
    onSuccess: result => { void credentials.refetch(); result.success ? toast.success(result.message) : toast.error(result.message); },
    onError: error => toast.error(error.message),
  });
  const cadastralUpload = trpc.admin.cadastral.upload.useMutation({
    onSuccess: result => { void cadastralImports.refetch(); toast.success(`${result.districtName} ${result.datasetReference} 연속지적도 ${result.featureCount.toLocaleString("ko-KR")}필지를 활성화했습니다.`); },
    onError: error => toast.error(error.message),
  });
  const updateValue = (group: CredentialGroup, key: keyof KeyValues, value: string) => setValues(current => ({ ...current, [group]: { ...current[group], primary: current[group]?.primary ?? "", [key]: value } }));
  const submit = (event: FormEvent<HTMLFormElement>, group: CredentialGroup, requiresSecondary: boolean) => {
    event.preventDefault();
    const value = values[group];
    if (!value?.primary?.trim() || (requiresSecondary && !value.secondary?.trim())) return toast.error("필수 키 항목을 모두 입력해 주세요.");
    upsert.mutate({ group, primary: value.primary, secondary: value.secondary, isEnabled: true });
  };
  const uploadCadastral = (file?: File) => {
    if (!file) return;
    if (!/\.zip$/i.test(file.name) || file.size > 35 * 1024 * 1024) { toast.error("35MB 이하의 연속지적도 ZIP 파일만 업로드할 수 있습니다."); return; }
    const reader = new FileReader();
    reader.onerror = () => toast.error("선택한 파일을 읽지 못했습니다.");
    reader.onload = () => typeof reader.result === "string" ? cadastralUpload.mutate({ originalName: file.name, dataUrl: reader.result }) : toast.error("선택한 파일을 읽지 못했습니다.");
    reader.readAsDataURL(file);
  };

  if (loading) return <main className="min-h-screen bg-[#f4f0e8] p-6"><div className="mx-auto max-w-5xl border border-stone-300 bg-[#fbfaf7] p-8 shadow-[6px_6px_0_rgba(120,100,75,0.12)]"><p className="font-mono text-xs tracking-[0.18em] text-[#8b4a38]">SECURE INTEGRATIONS</p><h1 className="mt-3 font-serif text-4xl text-stone-900">API 연결 설정</h1><p className="mt-4 max-w-2xl leading-7 text-stone-600">보안 권한을 확인하고 있습니다. API 키 원문은 화면·소스코드·일반 로그에 표시되지 않습니다.</p></div></main>;
  if (user?.role !== "admin") return <main className="grid min-h-screen place-items-center bg-[#f4f0e8] p-6"><section className="max-w-lg border border-stone-300 bg-white p-10 text-center shadow-[8px_8px_0_#d9c7ad]"><ShieldCheck className="mx-auto mb-5 h-10 w-10 text-[#8b4a38]" /><p className="font-mono text-xs tracking-[0.18em] text-stone-500">ACCESS RESTRICTED</p><h1 className="mt-3 font-serif text-3xl text-stone-900">관리자 전용 설정</h1><p className="mt-4 leading-7 text-stone-600">외부 API 키는 관리자 계정에서만 등록·교체·비활성화할 수 있습니다. 키 원문은 등록 후 다시 표시되지 않습니다.</p><Button asChild className="mt-7 bg-[#2d332d] text-white hover:bg-[#485145]"><Link href="/">작업대로 돌아가기</Link></Button></section></main>;

  return <main className="min-h-screen bg-[#f4f0e8] text-stone-800"><div className="mx-auto max-w-5xl px-5 py-10 lg:px-8"><header className="flex flex-col gap-5 border-b border-stone-300 pb-7 sm:flex-row sm:items-end sm:justify-between"><div><Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-stone-600 hover:text-stone-900"><ArrowLeft className="h-4 w-4" /> 종합분석 작업대로</Link><p className="mt-8 font-mono text-xs tracking-[0.18em] text-[#8b4a38]">SECURE INTEGRATIONS</p><h1 className="mt-2 font-serif text-4xl tracking-tight text-stone-900">제공기관별 API 연결</h1><p className="mt-3 max-w-2xl leading-7 text-stone-600">서비스별 키를 중복 보관하지 않습니다. 제공기관 단위로 한 번만 암호화해 저장하고, 승인된 서비스에서만 재사용합니다. 호출 직전에만 서버에서 복호화되며 브라우저·소스코드·일반 로그에는 기록되지 않습니다.</p></div><div className="flex items-center gap-2 border border-[#9aac8a] bg-[#e9efdf] px-4 py-3 text-sm text-[#465c3a]"><LockKeyhole className="h-4 w-4" /> 관리자 암호화 보관함</div></header>
  <section className="mt-8 grid gap-5">{credentialGroups.map(group => {
    const saved = credentials.data?.find(item => item.group === group.id);
    const live = group.activeServices.length > 0;
    return <article key={group.id} className="border border-stone-300 bg-white p-6 shadow-[4px_4px_0_rgba(120,100,75,0.12)]"><div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div><div className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-[#8b4a38]" /><h2 className="font-serif text-2xl text-stone-900">{group.name}</h2></div><p className="mt-2 text-sm leading-6 text-stone-600">{group.description}</p></div>{saved?.isEnabled ? <span className="inline-flex items-center gap-1.5 self-start bg-[#e9efdf] px-3 py-1.5 text-xs font-semibold text-[#465c3a]"><CheckCircle2 className="h-4 w-4" /> 등록됨 · 키 원문 비공개</span> : <span className="inline-flex items-center gap-1.5 self-start bg-stone-100 px-3 py-1.5 text-xs font-semibold text-stone-500"><XCircle className="h-4 w-4" /> 미등록 또는 비활성</span>}</div>
      <div className="mt-5 grid gap-3 border-y border-stone-100 py-4 text-sm sm:grid-cols-2"><p><span className="font-semibold text-stone-700">현재 연결</span><br /><span className="text-stone-500">{live ? group.activeServices.join(" · ") : "아직 분석 작업대에 연결하지 않음"}</span></p><p><span className="font-semibold text-stone-700">연결 예정</span><br /><span className="text-stone-500">{group.plannedServices.join(" · ")}</span></p></div>
      <form className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto]" onSubmit={event => submit(event, group.id, group.fields.some(field => field.id === "secondary"))}>{group.fields.map(field => <div key={field.id} className={group.fields.length === 1 ? "sm:col-span-2" : ""}><Label htmlFor={`${group.id}-${field.id}`} className="sr-only">{field.label}</Label><Input id={`${group.id}-${field.id}`} type="password" autoComplete="off" placeholder={field.placeholder} value={values[group.id]?.[field.id] ?? ""} onChange={event => updateValue(group.id, field.id, event.target.value)} className="h-11 border-stone-300 bg-[#fbfaf7]" /></div>)}<div className="flex flex-wrap gap-2"><Button type="submit" disabled={upsert.isPending} className="h-11 bg-[#2d332d] px-5 text-white hover:bg-[#485145]">{saved?.isEnabled ? "키 교체" : "암호화 저장"}</Button>{saved?.isEnabled && <><Button type="button" variant="outline" disabled={validate.isPending} onClick={() => validate.mutate({ group: group.id })} className="h-11 border-[#8b4a38] text-[#8b4a38]">{validate.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}원천 연결 확인</Button><Button type="button" variant="outline" disabled={disable.isPending} onClick={() => disable.mutate({ group: group.id })} className="h-11 border-stone-300">비활성화</Button></>}</div></form>{saved?.lastValidatedAt && <p className="mt-3 text-xs text-stone-500">마지막 실제 검증: {new Date(saved.lastValidatedAt).toLocaleString("ko-KR")}</p>}{saved?.lastValidationError && <p className="mt-2 text-sm text-[#a23b30]">최근 확인: {saved.lastValidationError}</p>}{group.id === "vworld" && <p className="mt-3 border-l-4 border-[#7894a2] bg-[#edf5f7] p-3 text-xs leading-5 text-[#355969]">VWorld 원천 연결은 이 버튼으로만 판정합니다. 원천 장애·빈 응답이어도 작업대의 필지 후보 조회는 <strong>활성 로컬 연속지적도</strong>로 자동 대체될 수 있으며, 이는 원천 API 정상 응답과 별도로 표시됩니다.</p>}{group.id === "sgis" && <p className="mt-3 border-l-4 border-[#7894a2] bg-[#edf5f7] p-3 text-xs leading-5 text-[#355969]">SGIS는 Consumer Key·Secret 인증과 시·군·구 통계의 실제 경량 요청을 함께 확인합니다. 통계는 확정 PNU가 있을 때 사전 자동조사에 추가됩니다.</p>}{group.id === "safeMap" && <p className="mt-2 text-xs leading-5 text-stone-500">보안등 WMS 등 개별 레이어는 키 발급과 별도로 활용 신청이 필요할 수 있습니다. <a href="https://www.safemap.go.kr/opna/data/dataViewRenew.do?objtId=220" target="_blank" rel="noreferrer" className="font-medium text-[#8b4a38] underline underline-offset-4">공식 서비스 신청 확인</a></p>}</article>;
  })}</section><section className="mt-8 border border-stone-300 bg-white p-6 shadow-[4px_4px_0_rgba(120,100,75,0.12)]"><div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div><div className="flex items-center gap-2"><FileArchive className="h-5 w-5 text-[#8b4a38]" /><h2 className="font-serif text-2xl text-stone-900">로컬 연속지적도 갱신</h2></div><p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">VWorld 연속지적도 조회가 장애·빈 응답·키 미등록일 때 광주 5개 구의 활성 SHP ZIP을 좌표 기반 후보 조회에 사용합니다. 새 기준일 ZIP을 올리면 원본은 안전하게 보관하고, 같은 구의 이전 활성본은 이력으로 남깁니다.</p></div><label className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 bg-[#2d332d] px-5 text-sm font-medium text-white hover:bg-[#485145]">{cadastralUpload.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}{cadastralUpload.isPending ? "검증·적재 중" : "최신 ZIP 업로드"}<input type="file" accept=".zip,application/zip,application/x-zip-compressed" className="sr-only" disabled={cadastralUpload.isPending} onChange={event => { uploadCadastral(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label></div><div className="mt-5 overflow-x-auto border border-stone-200"><table className="min-w-full text-left text-sm"><thead className="bg-[#f4f0e8] text-xs tracking-wide text-stone-600"><tr><th className="px-4 py-3 font-semibold">구</th><th className="px-4 py-3 font-semibold">기준일</th><th className="px-4 py-3 font-semibold">상태</th><th className="px-4 py-3 font-semibold">필지 수</th><th className="px-4 py-3 font-semibold">적재 시각·원본</th></tr></thead><tbody>{cadastralImports.isLoading ? <tr><td colSpan={5} className="px-4 py-6 text-center text-stone-500">연속지적도 이력을 불러오는 중입니다.</td></tr> : cadastralImports.data?.length ? cadastralImports.data.map(item => <tr key={item.id} className="border-t border-stone-100"><td className="px-4 py-3 font-medium text-stone-800">{item.districtName}</td><td className="px-4 py-3 font-mono text-xs text-stone-600">{item.datasetReference}</td><td className="px-4 py-3"><span className={item.status === "active" ? "bg-[#e9efdf] px-2 py-1 text-xs font-semibold text-[#465c3a]" : item.status === "failed" ? "bg-[#fbebe8] px-2 py-1 text-xs font-semibold text-[#a23b30]" : "bg-stone-100 px-2 py-1 text-xs font-semibold text-stone-600"}>{item.status === "active" ? "활성 · 자동 대체 사용" : item.status === "superseded" ? "이전 기준일" : item.status === "processing" ? "처리 중" : "실패"}</span>{item.safeError ? <p className="mt-1 max-w-xs text-xs text-[#a23b30]">{item.safeError}</p> : null}</td><td className="px-4 py-3 text-stone-700">{item.featureCount.toLocaleString("ko-KR")}</td><td className="px-4 py-3 text-xs text-stone-500">{new Date(item.importedAt).toLocaleString("ko-KR")}{item.sourceFileUrl ? <a href={item.sourceFileUrl} target="_blank" rel="noreferrer" className="ml-2 font-medium text-[#8b4a38] underline underline-offset-4">원본</a> : <span className="ml-2">{item.sourceFileName}</span>}</td></tr>) : <tr><td colSpan={5} className="px-4 py-6 text-center text-stone-500">아직 적재 이력이 없습니다.</td></tr>}</tbody></table></div><p className="mt-4 text-xs leading-5 text-stone-500">검증 항목: ZIP 형식·35MB 이하·광주 구 코드·6자리 기준일·19자리 PNU·Polygon/MultiPolygon·WGS84 경위도 범위. 이 데이터는 조사 대상 후보와 도면 보조 근거이며, 측량·소유·인허가의 최종 증명에는 사용할 수 없습니다.</p></section><aside className="mt-8 border-l-4 border-[#a9684f] bg-[#fbf3eb] p-5 text-sm leading-6 text-stone-700"><strong>공공데이터포털 주의:</strong> 동일한 ServiceKey는 여러 공공데이터 서비스에서 재사용할 수 있지만, 토지이용규제·에어코리아·광주 BIS·사회복지시설 등 각 서비스의 활용승인, 사용량 제한, IP·이용 조건은 별도로 적용됩니다. 키 원문을 채팅·문서·소스코드에 공유하지 마세요.</aside></div></main>;
}
