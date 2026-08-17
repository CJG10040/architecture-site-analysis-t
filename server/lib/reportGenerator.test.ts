import { describe, expect, it, vi } from "vitest";

const invokeLLM = vi.fn(async () => ({ choices: [{ message: { content: JSON.stringify({ executiveSummary: "요약", facts: [], observations: [], interpretations: [], designQuestions: [], hypotheses: [], unknowns: [] }) } }] }));

vi.mock("../_core/llm", () => ({
  listLLMModels: vi.fn(async () => ({ data: [{ id: "gpt-5-mini" }] })),
  invokeLLM,
}));

const { generateSiteReport } = await import("./reportGenerator");

describe("generateSiteReport", () => {
  it("passes the confirmed parcel and approved investigation plan to the structured AI input", async () => {
    await generateSiteReport({
      project: { title: "필지 조사" },
      site: { address: "광주광역시 동구" },
      parcel: { pnu: "2911010800100010000", parcelNumber: "광산동 1-1" },
      investigationPlan: { selectedLenses: "[\"parcel_regulation\"]", status: "collected" },
      snapshots: [{ sourceName: "VWorld 연속지적도" }],
      observations: [],
    });

    const request = invokeLLM.mock.calls[0]?.[0];
    const inputMessage = request.messages[1].content as string;
    expect(inputMessage).toContain("confirmedParcel");
    expect(inputMessage).toContain("2911010800100010000");
    expect(inputMessage).toContain("approvedInvestigationPlan");
  });
});
