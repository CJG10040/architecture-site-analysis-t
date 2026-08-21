import { beforeEach, describe, expect, it, vi } from "vitest";

const { getProjectForOwner, resetProjectResearchData } = vi.hoisted(() => ({
  getProjectForOwner: vi.fn(),
  resetProjectResearchData: vi.fn(),
}));

vi.mock("./db", () => ({ getProjectForOwner, resetProjectResearchData }));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createContext(userId = 4): TrpcContext {
  return {
    user: { id: userId, openId: `user-${userId}`, name: "테스트", email: null, loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("projects.resetResearchData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getProjectForOwner.mockResolvedValue({ id: 7, ownerId: 4, title: "현재 대지조사" });
  });

  it("clears only an owned project after an ownership check", async () => {
    const result = await appRouter.createCaller(createContext()).projects.resetResearchData({ projectId: 7 });
    expect(result).toEqual({ success: true });
    expect(getProjectForOwner).toHaveBeenCalledWith(7, 4);
    expect(resetProjectResearchData).toHaveBeenCalledWith(7);
  });

  it("refuses to reset a project that the current user does not own", async () => {
    getProjectForOwner.mockResolvedValue(undefined);
    await expect(appRouter.createCaller(createContext()).projects.resetResearchData({ projectId: 99 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(resetProjectResearchData).not.toHaveBeenCalled();
  });
});
