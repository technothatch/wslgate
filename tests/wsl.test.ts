import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";

import { decodeWslOutput, parseDistros, runWsl } from "../src/wsl.js";

interface Child extends EventEmitter {
  stdout: EventEmitter;
  stderr: EventEmitter;
  kill: () => void;
}

function fakeSpawn(script: (args: string[]) => { stdout?: string; stderr?: string; code?: number; encoding?: BufferEncoding; never?: boolean }) {
  const calls: string[][] = [];
  const fn = ((_cmd: string, args: string[]) => {
    calls.push(args);
    const child = new EventEmitter() as Child;
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = () => {};
    const r = script(args);
    if (r.never) return child;
    setImmediate(() => {
      if (r.stdout) child.stdout.emit("data", Buffer.from(r.stdout, r.encoding ?? "utf8"));
      if (r.stderr) child.stderr.emit("data", Buffer.from(r.stderr, r.encoding ?? "utf8"));
      child.emit("close", r.code ?? 0);
    });
    return child;
  }) as never;
  return { fn, calls };
}

describe("decodeWslOutput", () => {
  it("decodes UTF-16LE with BOM and strips it", () => {
    const buf = Buffer.concat([
      Buffer.from([0xff, 0xfe]),
      Buffer.from("Ubuntu\r\nDebian\r\n", "utf16le"),
    ]);
    expect(decodeWslOutput(buf)).toBe("Ubuntu\r\nDebian\r\n");
  });
  it("decodes UTF-16LE without BOM (heuristic)", () => {
    expect(decodeWslOutput(Buffer.from("Ubuntu", "utf16le"))).toBe("Ubuntu");
  });
  it("passes UTF-8 through", () => {
    expect(decodeWslOutput(Buffer.from("hello\n"))).toBe("hello\n");
  });
});

describe("parseDistros", () => {
  it("strips default marker, CR and blanks", () => {
    expect(parseDistros("* Ubuntu\r\nDebian\r\n\r\n")).toEqual(["Ubuntu", "Debian"]);
  });
});

describe("runWsl", () => {
  it("spawns wsl.exe and resolves decoded output", async () => {
    const { fn, calls } = fakeSpawn(() => ({
      stdout: "Ubuntu\r\n",
      encoding: "utf16le",
    }));
    const res = await runWsl(["--list", "--quiet"], { spawnFn: fn });
    expect(calls).toEqual([["--list", "--quiet"]]);
    expect(res.stdout).toBe("Ubuntu\r\n");
    expect(res.code).toBe(0);
  });
  it("propagates non-zero exit codes", async () => {
    const { fn } = fakeSpawn(() => ({ stderr: "nope", code: 2 }));
    const res = await runWsl(["x"], { spawnFn: fn });
    expect(res.code).toBe(2);
    expect(res.stderr).toBe("nope");
  });
  it("times out and rejects", async () => {
    const { fn } = fakeSpawn(() => ({ never: true }));
    await expect(runWsl(["x"], { spawnFn: fn, timeoutMs: 30 })).rejects.toThrow(/timed out/);
  });
  it("surfaces spawn errors as friendly message", async () => {
    const fn = ((_cmd: string, _args: string[]) => {
      const child = new EventEmitter() as Child;
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      child.kill = () => {};
      setImmediate(() => child.emit("error", Object.assign(new Error("spawn wsl.exe ENOENT"))));
      return child;
    }) as never;
    await expect(runWsl([], { spawnFn: fn })).rejects.toThrow(/WSL installed/);
  });
});
