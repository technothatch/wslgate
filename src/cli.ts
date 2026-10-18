#!/usr/bin/env node
import { createServer } from "./tools.js";
import { defaultOps, createOps } from "./ops.js";
import { translatePath } from "./tools.js";

const USAGE = `wslgate - Windows <-> WSL bridge for humans and AI agents

Usage:
  wslgate distros                       list WSL distributions
  wslgate translate <path>              convert a path between C:\\\\ and /mnt/c
  wslgate exec [--distro d] [--timeout ms] -- <bash command...>
  wslgate read [--distro d] <path>      read a file (stdout)
  wslgate write [--distro d] <path>     write stdin to a file
  wslgate ls [--distro d] <path>        list a directory
  wslgate mcp [--read-only]             run the MCP stdio server (same as wslgate-mcp)
`;

function takeFlag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv.shift();
  if (!cmd || cmd === "-h" || cmd === "--help") {
    process.stdout.write(USAGE);
    return;
  }

  if (cmd === "mcp") {
    process.argv = [process.argv[0], process.argv[1], ...argv];
    await import("./mcp.js");
    return;
  }

  const distro = takeFlag(argv, "--distro");
  const timeoutStr = takeFlag(argv, "--timeout");
  const timeoutMs = timeoutStr ? parseInt(timeoutStr, 10) : 60_000;
  const ops = createOps(defaultOps(), translatePath);

  if (cmd === "distros") {
    process.stdout.write((await ops.listDistros()).join("\n") + "\n");
    return;
  }
  if (cmd === "translate") {
    const p = argv[0];
    if (!p) throw new Error("usage: wslgate translate <path>");
    process.stdout.write(translatePath(p) + "\n");
    return;
  }
  if (cmd === "exec") {
    const sep = argv.indexOf("--");
    const command = (sep === -1 ? argv : argv.slice(sep + 1)).join(" ");
    if (!command) throw new Error("usage: wslgate exec [--distro d] -- <command...>");
    process.stdout.write(await ops.exec(command, distro, timeoutMs) + "\n");
    return;
  }
  if (cmd === "read") {
    const p = argv[0];
    if (!p) throw new Error("usage: wslgate read <path>");
    process.stdout.write(await ops.readFile(p, distro));
    return;
  }
  if (cmd === "write") {
    const p = argv[0];
    if (!p) throw new Error("usage: wslgate write <path>  (content on stdin)");
    const content = await readStdin();
    process.stdout.write((await ops.writeFile(p, content, distro)) + "\n");
    return;
  }
  if (cmd === "ls") {
    const p = argv[0];
    if (!p) throw new Error("usage: wslgate ls <path>");
    process.stdout.write(await ops.listDir(p, distro) + "\n");
    return;
  }
  process.stderr.write(`unknown command: ${cmd}\n\n` + USAGE);
  process.exit(2);
}

main().catch((e) => {
  console.error("error:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
