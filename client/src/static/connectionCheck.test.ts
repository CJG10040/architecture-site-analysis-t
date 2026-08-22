import { describe, expect, it } from "vitest";
import { classifyBrowserError } from "./connectionCheck";

describe("connection error classification", () => {
  it("separates CORS errors from API failures", () => expect(classifyBrowserError(new Error("Failed to fetch")).status).toBe("cors"));
  it("separates approval errors from generic failures", () => expect(classifyBrowserError(new Error("403 denied")).status).toBe("approval"));
});
