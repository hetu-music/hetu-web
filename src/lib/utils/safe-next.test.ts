import { describe, expect, it } from "vitest";
import { loginPathFor, safeNextPath } from "./safe-next";

describe("safeNextPath", () => {
  it("keeps same-site paths with query and hash", () => {
    expect(safeNextPath("/profile")).toBe("/profile");
    expect(safeNextPath("/profile?tab=account")).toBe("/profile?tab=account");
    expect(safeNextPath("/song/12#comments")).toBe("/song/12#comments");
  });

  it("falls back to home when missing", () => {
    expect(safeNextPath(undefined)).toBe("/");
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath("")).toBe("/");
  });

  it("uses the first value of a repeated param", () => {
    expect(safeNextPath(["/profile", "//evil.com"])).toBe("/profile");
  });

  it("rejects anything that could leave the site", () => {
    for (const bad of [
      "https://evil.com",
      "//evil.com",
      "/\\evil.com",
      "/\t/evil.com",
      "/\n/evil.com",
      "javascript:alert(1)",
      "evil.com",
      "/a\\b",
    ]) {
      expect(safeNextPath(bad)).toBe("/");
    }
  });
});

describe("loginPathFor", () => {
  it("carries the return path", () => {
    expect(loginPathFor("/admin/imagery")).toBe(
      "/login?next=%2Fadmin%2Fimagery",
    );
    expect(loginPathFor("/profile?tab=account")).toBe(
      "/login?next=%2Fprofile%3Ftab%3Daccount",
    );
  });

  it("drops home and unsafe paths", () => {
    expect(loginPathFor("/")).toBe("/login");
    expect(loginPathFor("//evil.com")).toBe("/login");
  });
});
