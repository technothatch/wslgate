import { describe, expect, it } from "vitest";

import { buildProxyArgs, proxyCwd, runProxy } from "../src/proxy.js";

describe("mcp-proxy", () => {
  it("builds wsl.exe args with distro, translated cwd and a quoted command", () => {
    const args = buildProxyArgs(["npx", "-y", "pkg", "--flag"], {
      distro: "Ubuntu",
      cwd: "C:\\proj\\my app",
    });
    expect(args).toEqual([
      "-d",
      "Ubuntu",
      "--cd",
      "/mnt/c/proj/my app",
      "--exec",
      "bash",
      "-lc",
      "'npx' '-y' 'pkg' '--flag'",
    ]);
  });

  it("passes WSL and relative cwds through untouched", () => {
    expect(proxyCwd("/home/me/src")).toBe("/home/me/src");
    expect(proxyCwd(".")).toBe(".");
    expect(buildProxyArgs(["true"], { cwd: "." })).toContain("--cd");
    expect(buildProxyArgs(["true"], {})).not.toContain("--cd");
    expect(buildProxyArgs(["true"], {})).not.toContain("-d");
  });

  it("quotes arguments so paths with spaces survive bash -lc", () => {
    const args = buildProxyArgs(["cat", "/tmp/a b.txt"]);
    expect(args.at(-1)).toBe("'cat' '/tmp/a b.txt'");
  });

  it("inherits stdio and returns the remote exit code", async () => {
    const calls: { cmd: string; args: string[]; opts: Record<string, unknown> }[] = [];
    const spawnFn = ((cmd: string, args: string[], opts: Record<string, unknown>) => {
      calls.push({ cmd, args, opts });
      const handlers: Record<string, (...a: unknown[]) => void> = {};
      const child = {
        on(event: string, cb: (...a: unknown[]) => void) {
          handlers[event] = cb;
          return child;
        },
      };
      queueMicrotask(() => handlers.close?.(3));
      return child;
    }) as unknown as typeof spawn;

    const code = await runProxy(["--exec", "bash", "-lc", "'false'"], { spawnFn });
    expect(code).toBe(3);
    expect(calls[0].cmd).toBe("wsl.exe");
    expect(calls[0].opts.stdio).toEqual(["inherit", "inherit", "inherit"]);
  });

  it("reports a missing wsl.exe instead of a stack trace", async () => {
    const spawnFn = (() => {
      const handlers: Record<string, (...a: unknown[]) => void> = {};
      const child = {
        on(event: string, cb: (...a: unknown[]) => void) {
          handlers[event] = cb;
          return child;
        },
      };
      queueMicrotask(() =>
        handlers.error?.(Object.assign(new Error("spawn ENOENT"), { code: "ENOENT" })),
      );
      return child;
    }) as unknown as typeof spawn;

    await expect(runProxy([], { spawnFn })).rejects.toThrow(/WSL installed/);
  });
});
