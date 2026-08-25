import type { LlmProvider, LocalProject } from "./model";
import { researchThemes } from "./researchCatalog";

export function buildDesignPrompt(project: LocalProject) {
  const observations = project.observations.map(item => `- ${item.title} [${item.category}]\n  ${item.note}`).join("\n") || "(현장 관찰 없음)";
  const selectedIds = project.researchPlan?.selectedCatalogIds ?? [];
  const themes = researchThemes.filter(theme => project.researchPlan?.selectedThemeIds?.includes(theme.id) ?? true).map(theme => `${theme.title}: ${theme.description}`).join("\n") || "(조사 테마 없음)";
  const researchBlocks = project.researchNotes.map(item => {
    const detailed = item.detail || item.rawData || "(상세 원자료 없음)";
    const raw = item.rawData && item.rawData !== detailed ? `\n원자료:\n${item.rawData}` : "";
    return `### ${item.source} / ${item.title}${item.catalogId ? ` [자료 ID: ${item.catalogId}]` : ""}\n요약(색인용): ${item.summary}\n상세 조사·속성·공간 근거:\n${detailed}${raw}${item.rawDataTruncated ? "\n[주의: 저장 한도로 원자료 일부가 잘렸음]" : ""}`;
  }).join("\n\n") || "(수집 메모 없음)";
  const research = researchBlocks.length > 320000 ? `${researchBlocks.slice(0, 320000)}\n\n[AI 입력 한도에 따라 이후 자료는 다음 요청에서 별도 검토 필요]` : researchBlocks;
  return `당신은 건축학도 대지조사를 돕는 설계 튜터입니다. 조사자료를 다시 짧게 요약하지 말고 아래 상세 원자료·속성·geometry·현장관찰을 근거로 분석하세요. 확정된 사실(FACT), 사용자의 관찰(OBSERVATION), 자료 사이의 관계(RELATION), 해석(INTERPRETATION), 모르는 것·데이터 공백(UNKNOWN/DATA GAP)을 엄격히 구분하세요. 자료에 없는 교통량·소음·법규 수치·보행량을 만들어내지 마세요. 거시→중간→대지→미시 순서로 분석 범위를 좁히고, 각 단계의 근거가 다음 단계의 설계 질문으로 어떻게 연결되는지 설명하세요. 마지막에는 서로 다른 방향의 설계 가설을 최소 3개 제시하고 각 가설의 장점·위험·검증할 현장조사를 적으세요. 법규 확정이나 인허가 판단은 하지 마세요.\n\n프로젝트: ${project.title}\n주소: ${project.site.address || "미입력"}\n대지 중심: ${project.site.latitude}, ${project.site.longitude}\n조사 렌즈: ${project.lenses.join(", ") || "미선택"}\n선택된 자료 ID: ${selectedIds.join(", ") || "미선택"}\n\n조사 테마\n${themes}\n\n공공데이터·조사자료의 상세 원문\n${research}\n\n현장 관찰\n${observations}\n\n출력 형식\n1. 거시 분석: 지역·도시 구조와 시간적 변화\n2. 중간 분석: 생활권·접근·시설·활동 관계\n3. 대지 분석: 필지·법규·건축물·도로·지형의 직접 관계\n4. 미시 분석: 경계·접촉면·감각·시간대·현장 검증\n5. 사실/관찰/해석/데이터 공백 표\n6. 설계 질문\n7. 서로 다른 설계 가설 3개 이상(핵심 공간 전략, 장점, 위험, 검증 항목)\n8. 다음 조사 순서`;
}

export async function requestLlm(provider: LlmProvider, apiKey: string, project: LocalProject) {
  if (!apiKey.trim()) throw new Error("선택한 제공자의 API 키를 먼저 입력하세요.");
  const prompt = buildDesignPrompt(project);
  if (provider === "openai") {
    const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model: "gpt-4.1-mini", input: prompt }) });
    const json = await response.json();
    if (!response.ok) throw new Error(json?.error?.message ?? "OpenAI 요청에 실패했습니다.");
    return json.output_text ?? "응답 텍스트를 찾지 못했습니다.";
  }
  if (provider === "gemini") {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
    const json = await response.json();
    if (!response.ok) throw new Error(json?.error?.message ?? "Gemini 요청에 실패했습니다.");
    return json.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? "").join("") || "응답 텍스트를 찾지 못했습니다.";
  }
  const response = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" }, body: JSON.stringify({ model: "claude-3-5-haiku-latest", max_tokens: 3000, messages: [{ role: "user", content: prompt }] }) });
  const json = await response.json();
  if (!response.ok) throw new Error(json?.error?.message ?? "Anthropic 요청에 실패했습니다.");
  return json.content?.filter((item: { type: string }) => item.type === "text").map((item: { text?: string }) => item.text ?? "").join("\n") || "응답 텍스트를 찾지 못했습니다.";
}
