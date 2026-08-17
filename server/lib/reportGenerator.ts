import { invokeLLM, listLLMModels } from "../_core/llm";

const reportSchema = {
  name: "site_interpretation_report",
  strict: true,
  schema: {
    type: "object",
    properties: {
      executiveSummary: { type: "string" },
      facts: { type: "array", items: { type: "object", properties: { statement: { type: "string" }, source: { type: "string" }, confidence: { type: "string", enum: ["high", "medium", "low"] } }, required: ["statement", "source", "confidence"], additionalProperties: false } },
      observations: { type: "array", items: { type: "object", properties: { statement: { type: "string" }, status: { type: "string", enum: ["user", "unverified", "conflict"] } }, required: ["statement", "status"], additionalProperties: false } },
      interpretations: { type: "array", items: { type: "object", properties: { title: { type: "string" }, rationale: { type: "string" }, evidence: { type: "array", items: { type: "string" } } }, required: ["title", "rationale", "evidence"], additionalProperties: false } },
      designQuestions: { type: "array", items: { type: "string" } },
      hypotheses: { type: "array", items: { type: "object", properties: { title: { type: "string" }, basis: { type: "string" }, tension: { type: "string" }, spatialAction: { type: "string" }, userExperience: { type: "string" }, benefit: { type: "string" }, risk: { type: "string" }, additionalResearch: { type: "string" } }, required: ["title", "basis", "tension", "spatialAction", "userExperience", "benefit", "risk", "additionalResearch"], additionalProperties: false } },
      unknowns: { type: "array", items: { type: "string" } },
    },
    required: ["executiveSummary", "facts", "observations", "interpretations", "designQuestions", "hypotheses", "unknowns"],
    additionalProperties: false,
  },
};

export async function generateSiteReport(input: { project: unknown; site: unknown; parcel?: unknown; investigationPlan?: unknown; snapshots: unknown[]; observations: unknown[]; attachments?: unknown[]; relationships?: unknown[] }) {
  const { data: models } = await listLLMModels();
  const model = models.find(item => item.id.startsWith("gpt-5-mini"))?.id ?? models.find(item => item.id.startsWith("gpt-5"))?.id;
  const conciseInput = JSON.stringify({
    project: input.project,
    site: input.site,
    confirmedParcel: input.parcel ?? null,
    approvedInvestigationPlan: input.investigationPlan ?? null,
    snapshots: input.snapshots.slice(0, 12),
    observations: input.observations.slice(0, 20),
    fieldMaterials: input.attachments?.slice(0, 20) ?? [],
    userRelationships: input.relationships?.slice(0, 20) ?? [],
  }).slice(0, 50_000);
  const response = await invokeLLM({
    model,
    maxTokens: 4000,
    response_format: { type: "json_schema", json_schema: reportSchema },
    messages: [
      { role: "system", content: "당신은 건축학도생의 대지조사 자료를 설계 사고로 전환하도록 돕는 조심스러운 설계 튜터입니다. 확정 필지, 사용자가 승인한 조사 계획, 공공데이터·현장 자료는 출처와 한계를 포함한 보조 근거일 뿐, 인허가 판단이나 완성된 설계안이 아닙니다. 사실, 사용자 관찰, 해석, 가설, 미확인을 엄격히 분리하십시오. 사실은 제공된 근거에서만 인용하고, 통계의 공간 단위·기준 시점·측정소 거리·필지 경계의 참고 성격을 무시하지 마십시오. 사용자가 기록한 관계·긴장·추가조사는 우선적으로 존중하되 검증되지 않은 내용은 관찰 또는 미확인으로 표기하십시오. 최소 3개의 서로 다른 해석과 3개의 상이한 설계 가설을 한국어로 생성하며, 각 가설의 공간적 행동·예상 사용자 경험·위험·추가조사를 구체적으로 제시하되 근거 없는 수치·시설·조건을 절대 만들어내지 마십시오." },
      { role: "user", content: `다음은 사용자가 명시적으로 AI 분석을 요청하며 제공한 대지조사 스냅샷입니다. 구조화된 JSON만 반환하십시오.\n${conciseInput}` },
    ],
  });
  const content = response.choices[0]?.message?.content;
  if (!content || typeof content !== "string") throw new Error("AI 보고서가 비어 있습니다.");
  return { modelId: model ?? "default", report: JSON.parse(content) };
}
