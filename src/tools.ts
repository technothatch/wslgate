import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { toWslPath, toWindowsPath } from "./paths.js";
import { createOps, defaultOps, type Ops } from "./ops.js";
import type { SpawnFn } from "./wsl.js";

export const READ_ONLY_MSG =
  "error: read-only mode; restart the server without --read-only to enable this tool";

export function createServer(opts: {
  readOnly?: boolean;
  ops?: Ops;
  spawnFn?: SpawnFn;
} = {}): { server: McpServer; ops: Ops } {
  const readOnly = opts.readOnly ?? false;
  const ops = opts.ops ?? createOps(defaultOps(opts.spawnFn), translatePath);

  const server = new McpServer({ name: "wslgate", version: "0.1.0" });
  const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });

  server.registerTool(
    "wsl_list_distros",
    {
      description: "List installed WSL distributions (marks the default with *)",
      inputSchema: {},
    },
    async () => {
      try {
        const distros = await ops.listDistros();
        return text(distros.length ? distros.join("\n") : "(no distros found)");
      } catch (e) {
        return { ...text(String(e)), isError: true };
      }
    },
  );

  server.registerTool(
    "wsl_exec",
    {
      description:
        "Run a bash command inside WSL (default distro unless specified) and return stdout/stderr/exit code",
      inputSchema: {
        command: z.string().describe("bash command line to run"),
        distro: z.string().optional().describe("distribution name, e.g. Ubuntu"),
        timeout_ms: z.number().int().positive().max(600_000).optional(),
      },
    },
    async ({ command, distro, timeout_ms }) => {
      if (readOnly) return { ...text(READ_ONLY_MSG), isError: true };
      try {
        return text(await ops.exec(command, distro, timeout_ms ?? 60_000));
      } catch (e) {
        return { ...text(String(e)), isError: true };
      }
    },
  );

  server.registerTool(
    "wsl_read_file",
    {
      description:
        "Read a file from the WSL filesystem (accepts /mnt/c/... or C:\\\\... paths)",
      inputSchema: {
        path: z.string(),
        distro: z.string().optional(),
      },
    },
    async ({ path, distro }) => {
      try {
        return text(await ops.readFile(toWslPath(path), distro));
      } catch (e) {
        return { ...text(String(e)), isError: true };
      }
    },
  );

  server.registerTool(
    "wsl_write_file",
    {
      description:
        "Write a UTF-8 file inside WSL (base64-safe, no shell quoting issues). Requires write access.",
      inputSchema: {
        path: z.string(),
        content: z.string(),
        distro: z.string().optional(),
      },
    },
    async ({ path, content, distro }) => {
      if (readOnly) return { ...text(READ_ONLY_MSG), isError: true };
      try {
        return text(await ops.writeFile(toWslPath(path), content, distro));
      } catch (e) {
        return { ...text(String(e)), isError: true };
      }
    },
  );

  server.registerTool(
    "wsl_list_dir",
    {
      description: "List a directory inside WSL (accepts Windows or WSL paths)",
      inputSchema: {
        path: z.string(),
        distro: z.string().optional(),
      },
    },
    async ({ path, distro }) => {
      try {
        return text(await ops.listDir(toWslPath(path), distro));
      } catch (e) {
        return { ...text(String(e)), isError: true };
      }
    },
  );

  server.registerTool(
    "wsl_path_translate",
    {
      description:
        "Translate a path between Windows and WSL forms (C:\\\\ -> /mnt/c/ and back)",
      inputSchema: {
        path: z.string(),
        direction: z.enum(["auto", "to-wsl", "to-windows"]).optional(),
      },
    },
    async ({ path, direction }) => {
      const dir = direction ?? "auto";
      if (dir === "to-wsl") return text(toWslPath(path));
      if (dir === "to-windows") return text(toWindowsPath(path));
      const wsl = toWslPath(path);
      if (wsl !== path) return text(wsl);
      return text(toWindowsPath(path));
    },
  );

  return { server, ops };
}

export function translatePath(p: string): string {
  const wsl = toWslPath(p);
  if (wsl !== p) return wsl;
  return toWindowsPath(p);
}
