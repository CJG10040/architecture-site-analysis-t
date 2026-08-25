import { describe, expect, it } from "vitest";
import { buildDesignPrompt } from "./llm";
import { createLocalProject } from "./model";

describe("AI design prompt", () => {
  it("includes project evidence but never expects an API key inside project data", () => {
    const project = createLocalProject("테스트 대지");
    project.researchNotes = [{ id: "r1", source: "공공데이터", title: "공원", summary: "인근 공원 1곳", detail: "2026년 8월 25일 조사. 공원 경계와 접근 경로를 확인함.", rawData: "{\"items\":[{\"name\":\"테스트 공원\"}]}", createdAt: "2026-01-01" }];
    const prompt = buildDesignPrompt(project);
    expect(prompt).toContain("인근 공원 1곳");
    expect(prompt).toContain("공원 경계와 접근 경로를 확인함");
    expect(prompt).toContain("거시 분석");
    expect(prompt.toLowerCase()).not.toContain("api key");
  });
});
