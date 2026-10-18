import { describe, expect, it } from "vitest";

import { shellQuote, toWslPath, toWindowsPath } from "../src/paths.js";

describe("toWslPath", () => {
  it("converts drive letters", () => {
    expect(toWslPath("C:\\Users\\me\\file.txt")).toBe("/mnt/c/Users/me/file.txt");
    expect(toWslPath("D:/data/x")).toBe("/mnt/d/data/x");
    expect(toWslPath("C:")).toBe("C:");
  });
  it("leaves unix paths alone", () => {
    expect(toWslPath("/home/user/f")).toBe("/home/user/f");
  });
});

describe("toWindowsPath", () => {
  it("converts /mnt/<drive>", () => {
    expect(toWindowsPath("/mnt/c/Users/me")).toBe("C:\\Users\\me");
    expect(toWindowsPath("/mnt/d")).toBe("D:\\");
  });
  it("leaves other paths alone", () => {
    expect(toWindowsPath("/home/user")).toBe("/home/user");
    expect(toWindowsPath("C:\\x")).toBe("C:\\x");
  });
});

describe("shellQuote", () => {
  it("wraps in single quotes", () => {
    expect(shellQuote("simple")).toBe("'simple'");
  });
  it("escapes embedded single quotes", () => {
    expect(shellQuote("it's")).toBe("'it'\\''s'");
  });
});
