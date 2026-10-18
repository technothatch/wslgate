import { shellQuote } from "./paths.js";
import { parseDistros, runWsl, type SpawnFn } from "./wsl.js";

export interface WslOps {
  run(args: string[], timeoutMs?: number): Promise<{ stdout: string; stderr: string; code: number }>;
}

export function defaultOps(spawnFn?: SpawnFn): WslOps {
  return {
    run: (args, timeoutMs) => runWsl(args, { spawnFn, timeoutMs }),
  };
}

export interface Ops {
  listDistros(): Promise<string[]>;
  exec(command: string, distro: string | undefined, timeoutMs: number): Promise<string>;
  readFile(path: string, distro: string | undefined): Promise<string>;
  writeFile(path: string, content: string, distro: string | undefined): Promise<string>;
  listDir(path: string, distro: string | undefined): Promise<string>;
  translate(path: string): string;
}

export function createOps(wsl: WslOps, translate: (p: string) => string): Ops {
  const distroArgs = (distro: string | undefined) =>
    distro ? ["-d", distro] : [];

  const ensureOk = (label: string, res: { stdout: string; stderr: string; code: number }) => {
    if (res.code !== 0) {
      const detail = (res.stderr || res.stdout || "").trim();
      throw new Error(`${label} failed (exit ${res.code}): ${detail || "no output"}`);
    }
    return res.stdout;
  };

  return {
    async listDistros() {
      const res = await wsl.run(["--list", "--quiet"]);
      return parseDistros(res.stdout);
    },
    async exec(command, distro, timeoutMs) {
      const res = await wsl.run(
        [...distroArgs(distro), "--exec", "bash", "-lc", command],
        timeoutMs,
      );
      const out = res.stdout.trimEnd();
      const err = res.stderr.trimEnd();
      let text = out;
      if (err) text += (text ? "\n" : "") + `[stderr] ${err}`;
      text += (text ? "\n" : "") + `[exit ${res.code}]`;
      return text;
    },
    async readFile(path, distro) {
      const res = await wsl.run(
        [...distroArgs(distro), "--exec", "bash", "-lc", `cat -- ${shellQuote(path)}`],
      );
      return ensureOk("read", res);
    },
    async writeFile(path, content, distro) {
      const b64 = Buffer.from(content, "utf8").toString("base64");
      const script = `printf '%s' ${shellQuote(b64)} | base64 -d > ${shellQuote(path)}`;
      const res = await wsl.run([...distroArgs(distro), "--exec", "bash", "-lc", script]);
      ensureOk("write", res);
      return `wrote ${Buffer.byteLength(content, "utf8")} bytes to ${path}`;
    },
    async listDir(path, distro) {
      const res = await wsl.run(
        [...distroArgs(distro), "--exec", "bash", "-lc", `ls -la -- ${shellQuote(path)}`],
      );
      return ensureOk("ls", res);
    },
    translate(path) {
      return translate(path);
    },
  };
}
