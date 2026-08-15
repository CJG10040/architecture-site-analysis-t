import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, CheckCircle2, KeyRound, LockKeyhole, ShieldCheck, XCircle } from "lucide-react";
import { FormEvent, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

const providers = [
  { id: "landuse", name: "토지이음·토지이용규제", description: "용도지역·지구·구역 및 행위제한 정보" },
  { id: "airkorea", name: "에어코리아", description: "PM10·PM2.5·NO₂ 인근 측정소 현황" },
  { id: "gwangjuBus", name: "광주 BIS", description: "광주 버스 정류장·노선·도착정보" },
  { id: "welfare", name: "사회복지시설", description: "한국사회보장정보원 시설 명부·상세정보" },
] as const;

export default function Settings() {
  const { user, loading } = useAuth();
  const [values, setValues] = useState<Record<string, string>>({});
  const credentials = trpc.admin.apiCredentials.list.useQuery(undefined, { enabled: user?.role === "admin" });
  const upsert = trpc.admin.apiCredentials.upsert.useMutation({
    onSuccess: (_, variables) => {
      setValues(current => ({ ...current, [variables.provider]: "" }));
      void credentials.refetch();
      toast.success("API 키가 암호화되어 저장되었습니다.");
    },
    onError: error => toast.error(error.message),
  });
  const disable = trpc.admin.apiCredentials.disable.useMutation({
    onSuccess: () => { void credentials.refetch(); toast.success("API 연결이 비활성화되었습니다."); },
    onError: error => toast.error(error.message),
  });

  const submit = (event: FormEvent<HTMLFormElement>, provider: (typeof providers)[number]["id"]) => {
    event.preventDefault();
    const value = values[provider]?.trim();
    if (!value) return toast.error("서비스 키를 입력해 주세요.");
    upsert.mutate({ provider, value, isEnabled: true });
  };

  if (loading) return <main className="min-h-screen bg-[#f4f0e8] p-6"><div className="mx-auto max-w-5xl border border-stone-300 bg-[#fbfaf7] p-8 shadow-[6px_6px_0_rgba(120,100,75,0.12)]"><p className="font-mono text-xs tracking-[0.18em] text-[#8b4a38]">SECURE INTEGRATIONS</p><h1 className="mt-3 font-serif text-4xl text-stone-900">API 연결 설정</h1><p className="mt-4 max-w-2xl leading-7 text-stone-600">보안 권한을 확인하고 있습니다. API 키 원문은 화면·소스코드·일반 로그에 표시되지 않습니다.</p></div></main>;
  if (user?.role !== "admin") {
    return <main className="min-h-screen grid place-items-center bg-[#f4f0e8] p-6"><section className="max-w-lg border border-stone-300 bg-white p-10 text-center shadow-[8px_8px_0_#d9c7ad]"><ShieldCheck className="mx-auto mb-5 h-10 w-10 text-[#8b4a38]" /><p className="font-mono text-xs tracking-[0.18em] text-stone-500">ACCESS RESTRICTED</p><h1 className="mt-3 font-serif text-3xl text-stone-900">관리자 전용 설정</h1><p className="mt-4 leading-7 text-stone-600">외부 API 키는 관리자 계정에서만 등록·교체·비활성화할 수 있습니다. 키 원문은 등록 후 다시 표시되지 않습니다.</p><Button asChild className="mt-7 bg-[#2d332d] text-white hover:bg-[#485145]"><Link href="/">작업대로 돌아가기</Link></Button></section></main>;
  }

  return <main className="min-h-screen bg-[#f4f0e8] text-stone-800"><div className="mx-auto max-w-5xl px-5 py-10 lg:px-8"><header className="flex flex-col gap-5 border-b border-stone-300 pb-7 sm:flex-row sm:items-end sm:justify-between"><div><Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-stone-600 hover:text-stone-900"><ArrowLeft className="h-4 w-4" /> 종합분석 작업대로</Link><p className="mt-8 font-mono text-xs tracking-[0.18em] text-[#8b4a38]">SECURE INTEGRATIONS</p><h1 className="mt-2 font-serif text-4xl tracking-tight text-stone-900">API 연결 설정</h1><p className="mt-3 max-w-2xl leading-7 text-stone-600">공공데이터 키는 서버에서 AES-256-GCM으로 암호화해 보관하며, 실제 호출 직전에만 안전하게 복호화됩니다. 브라우저·소스코드·일반 로그에는 저장되지 않습니다.</p></div><div className="flex items-center gap-2 border border-[#9aac8a] bg-[#e9efdf] px-4 py-3 text-sm text-[#465c3a]"><LockKeyhole className="h-4 w-4" /> 관리자 암호화 보관함</div></header>
  <section className="mt-8 grid gap-5">{providers.map(provider => {
    const saved = credentials.data?.find(item => item.provider === provider.id);
    return <article key={provider.id} className="border border-stone-300 bg-white p-6 shadow-[4px_4px_0_rgba(120,100,75,0.12)]"><div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div><div className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-[#8b4a38]" /><h2 className="font-serif text-2xl text-stone-900">{provider.name}</h2></div><p className="mt-2 text-sm text-stone-600">{provider.description}</p></div>{saved?.isEnabled ? <span className="inline-flex items-center gap-1.5 self-start bg-[#e9efdf] px-3 py-1.5 text-xs font-semibold text-[#465c3a]"><CheckCircle2 className="h-4 w-4" /> 등록됨 · 키 원문 비공개</span> : <span className="inline-flex items-center gap-1.5 self-start bg-stone-100 px-3 py-1.5 text-xs font-semibold text-stone-500"><XCircle className="h-4 w-4" /> 미등록 또는 비활성</span>}</div><form className="mt-6 flex flex-col gap-3 sm:flex-row" onSubmit={event => submit(event, provider.id)}><div className="flex-1"><Label htmlFor={provider.id} className="sr-only">{provider.name} 서비스 키</Label><Input id={provider.id} type="password" autoComplete="off" placeholder="활용 승인된 서비스 키 입력" value={values[provider.id] ?? ""} onChange={event => setValues(current => ({ ...current, [provider.id]: event.target.value }))} className="h-11 border-stone-300 bg-[#fbfaf7]" /></div><Button type="submit" disabled={upsert.isPending} className="h-11 bg-[#2d332d] px-5 text-white hover:bg-[#485145]">{saved?.isEnabled ? "키 교체" : "암호화 저장"}</Button>{saved?.isEnabled && <Button type="button" variant="outline" disabled={disable.isPending} onClick={() => disable.mutate({ provider: provider.id })} className="h-11 border-stone-300">비활성화</Button>}</form>{saved?.lastValidationError && <p className="mt-3 text-sm text-[#a23b30]">최근 확인: {saved.lastValidationError}</p>}</article>;
  })}</section><aside className="mt-8 border-l-4 border-[#a9684f] bg-[#fbf3eb] p-5 text-sm leading-6 text-stone-700"><strong>입력 전 확인:</strong> 이 화면에는 서비스별 활용승인이 완료된 공공데이터포털 키를 입력합니다. Google Maps는 플랫폼 통합 지도 기능을 사용하므로 별도 키를 넣지 않습니다. 키 원문을 채팅, 문서, 소스코드에 공유하지 마세요.</aside></div></main>;
}
