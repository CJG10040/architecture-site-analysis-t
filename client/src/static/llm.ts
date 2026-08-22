import type { LlmProvider, LocalProject } from "./model";

export function buildDesignPrompt(project: LocalProject) {
  const observations = project.observations.map(item => `- ${item.title}: ${item.note}`).join("\n") || "(현장 관찰 없음)";
  const research = project.researchNotes.map(item => `- ${item.source} / ${item.title}: ${item.summary}`).join("\n") || "(수집 메모 없음)";
  return `당신은 건축학도 대지조사를 돕는 설계 튜터입니다. 다음 개인 프로젝트를 바탕으로 사실·해석·추가조사·공간 가설을 구분해 한국어로 간결하게 제안하세요. 법규 확정이나 인허가 판단은 하지 마세요.\n\n프로젝트: ${project.title}\n주소: ${project.site.address || "미입력"}\n조사 렌즈: ${project.lenses.join(", ") || "미선택"}\n\n공공데이터·조사 메모\n${research}\n\n현장 관찰\n${observations}`;
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
  const response = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" }, body: JSON.stringify({ model: "claude-3-5-haiku-latest", max_tokens: 1200, messages: [{ role: "user", content: prompt }] }) });
  const json = await response.json();
  if (!response.ok) throw new Error(json?.error?.message ?? "Anthropic 요청에 실패했습니다.");
  return json.content?.filter((item: { type: string }) => item.type === "text").map((item: { text?: string }) => item.text ?? "").join("\n") || "응답 텍스트를 찾지 못했습니다.";
}
