import { spawn } from "node:child_process";

export type SpawnFn = typeof spawn;

export interface WslResult {
  stdout: string;
  stderr: string;
  code: number;
}

export function decodeWslOutput(buf: Buffer): string {
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return buf.subarray(2).toString("utf16le");
  }
  if (
    buf.length >= 4 &&
    buf[1] === 0 &&
    buf[3] === 0 &&
    (buf.length < 6 || buf[5] === 0)
  ) {
    return buf.toString("utf16le");
  }
  return buf.toString("utf8");
}

export function looksLikeUtf16(buf: Buffer): boolean {
  return (
    (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) ||
    (buf.length >= 4 && buf[1] === 0 && buf[3] === 0)
  );
}

export async function runWsl(
  args: string[],
  opts: { timeoutMs?: number; spawnFn?: SpawnFn } = {},
): Promise<WslResult> {
  const spawnFn = opts.spawnFn ?? spawn;
  const timeoutMs = opts.timeoutMs ?? 60_000;
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawnFn("wsl.exe", args, { windowsHide: true });
    } catch (e) {
      reject(new Error(`failed to spawn wsl.exe: ${String(e)}`));
      return;
    }
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new Error(`wsl.exe timed out after ${timeoutMs}ms: wsl ${args.join(" ")}`));
    }, timeoutMs);
    child.stdout.on("data", (d: Buffer) => out.push(d));
    child.stderr.on("data", (d: Buffer) => err.push(d));
    child.on("error", (e: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(
        new Error(
          `failed to run wsl.exe (is WSL installed?): ${e.message}`,
        ),
      );
    });
    child.on("close", (code: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        stdout: decodeWslOutput(Buffer.concat(out)),
        stderr: decodeWslOutput(Buffer.concat(err)),
        code: code ?? -1,
      });
    });
  });
}

export function parseDistros(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.replace(/^\*\s*/, "").trim())
    .filter((line) => line.length > 0);
}
