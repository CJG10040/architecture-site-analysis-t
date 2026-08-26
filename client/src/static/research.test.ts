import { describe, expect, it } from "vitest";
import { sourceAvailability, sourceCatalog, suggestedSources } from "./research";

describe("approved research sources", () => {
  it("recommends terrain sources for a terrain lens", () => expect(suggestedSources(["지형·레벨"]).map(item => item.id)).toContain("terrain"));
  it("keeps zoning and PNU regulation as selectable research sources", () => {
    const ids = suggestedSources([], ["land-use-zoning", "land-regulation"]).map(item => item.id);
    expect(ids).toEqual(expect.arrayContaining(["vworldZoning", "landRegulation"]));
  });
  it("does not claim a keyed source is available without its key", () => expect(sourceAvailability(sourceCatalog.find(item => item.id === "vworldParcel")!, { vworldKey: "", dataGoKrKey: "", naverMapsClientId: "" })).toBe(false));
});
