import { describe, expect, it } from "vitest";
import { createLocalProject } from "./model";
import { goalAlignment, researchCatalog } from "./researchCatalog";

describe("research catalog", () => {
  it("keeps planned data separate from currently implemented data", () => {
    expect(researchCatalog.some(item => item.id === "buildings" && item.status === "partial")).toBe(true);
    expect(researchCatalog.some(item => item.id === "field-observation" && item.status === "implemented")).toBe(true);
  });

  it("checks the original investigation sequence from project evidence", () => {
    const project = createLocalProject("목표 점검");
    expect(goalAlignment(project).find(item => item.id === "site")?.status).toBe("missing");
    project.site.boundary = [{ lat: 35, lng: 126 }, { lat: 35, lng: 126.001 }, { lat: 35.001, lng: 126.001 }];
    project.site.pnu = "123";
    project.lenses = ["지형·레벨"];
    project.researchNotes = [{ id: "r1", source: "테스트", title: "근거", summary: "확인된 사실", createdAt: "2026-01-01" }];
    project.observations = [{ id: "o1", title: "관찰", note: "현장 기록", category: "소리", createdAt: "2026-01-01" }];
    const aligned = goalAlignment(project);
    expect(aligned.find(item => item.id === "site")?.status).toBe("ready");
    expect(aligned.find(item => item.id === "collection")?.status).toBe("ready");
    expect(aligned.find(item => item.id === "field")?.status).toBe("ready");
    expect(aligned.find(item => item.id === "design")?.status).toBe("partial");
  });
});
