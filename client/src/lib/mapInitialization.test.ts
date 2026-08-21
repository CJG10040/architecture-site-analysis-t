import { describe, expect, it } from "vitest";
import { getMapInitializationAction } from "./mapInitialization";

describe("getMapInitializationAction", () => {
  it("waits when the SDK is ready but the map container has not mounted", () => {
    expect(getMapInitializationAction({ isActive: true, hasContainer: false, hasMapsSdk: true })).toBe("retry-container");
  });

  it("does not initialize after the map component unmounts", () => {
    expect(getMapInitializationAction({ isActive: false, hasContainer: true, hasMapsSdk: true })).toBe("stop");
  });

  it("initializes only when the active DOM container and SDK are available", () => {
    expect(getMapInitializationAction({ isActive: true, hasContainer: true, hasMapsSdk: true })).toBe("initialize");
  });
});
