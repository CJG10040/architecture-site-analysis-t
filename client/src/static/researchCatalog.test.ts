import { describe, expect, it } from "vitest";
import { createLocalProject } from "./model";
import { defaultResearchPlan, goalAlignment, researchCatalog, researchThemes, toggleResearchTheme } from "./researchCatalog";

describe("research catalog", () => {
  it("keeps planned data separate from currently implemented data", () => {
    expect(researchCatalog.some(item => item.id === "buildings" && item.status === "partial")).toBe(true);
    expect(researchCatalog.some(item => item.id === "field-observation" && item.status === "implemented")).toBe(true);
  });

  it("provides a default macro-to-micro plan without requiring manual source discovery", () => {
    const plan = defaultResearchPlan();
    expect(researchThemes.map(theme => theme.scale)).toEqual(["macro", "meso", "site", "micro"]);
    expect(plan.selectedThemeIds).toHaveLength(4);
    expect(plan.selectedCatalogIds).toContain("population-households");
    expect(plan.selectedCatalogIds).toContain("land-use-zoning");
    expect(plan.selectedCatalogIds).toContain("field-observation");
  });

  it("keeps child selections synchronized with theme toggles", () => {
    const plan = defaultResearchPlan();
    const withoutMacro = toggleResearchTheme(plan, "macro-region");
    expect(withoutMacro.selectedThemeIds).not.toContain("macro-region");
    expect(withoutMacro.selectedCatalogIds).not.toContain("population-households");
    expect(withoutMacro.selectedCatalogIds).toContain("transit");
    const withMacro = toggleResearchTheme(withoutMacro, "macro-region");
    expect(withMacro.selectedCatalogIds).toContain("population-households");
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
