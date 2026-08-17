import { describe, expect, it } from "vitest";
import { summarizeEvidence } from "./evidenceSummary";

describe("summarizeEvidence", () => {
  it("extracts row count and compact primitive samples from common public-data response nesting", () => {
    const summary = summarizeEvidence({ response: { body: { items: { item: [{ name: "공원 A", area: 1200, internal: { ignore: true } }, { name: "공원 B", area: 700 }] } } } }, "도시공원", "생활권 800m");
    expect(summary.recordCount).toBe(2);
    expect(summary.sampleFields).toEqual(expect.arrayContaining(["name", "area"]));
    expect(summary.sampleRows[0]).toEqual({ name: "공원 A", area: 1200 });
    expect(summary.narrative).toContain("생활권 800m");
  });
});
