import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";

import { createOps, type WslOps } from "../src/ops.js";
import { createServer, translatePath } from "../src/tools.js";

function fakeWsl(canned: { stdout?: string; code?: number } = {}) {
  const calls: string[][] = [];
  const wsl: WslOps = {
    run: async (args) => {
      calls.push(args);
      return { stdout: canned.stdout ?? "", stderr: "", code: canned.code ?? 0 };
    },
  };
  return { wsl, calls };
}

describe("createOps", () => {
  it("builds exec command with distro and bash -lc", async () => {
    const { wsl, calls } = fakeWsl({ stdout: "hi\n" });
    const ops = createOps(wsl, translatePath);
    const out = await ops.exec("ls -la /tmp", "Ubuntu", 5000);
    expect(calls[0]).toEqual(["-d", "Ubuntu", "--exec", "bash", "-lc", "ls -la /tmp"]);
    expect(out).toContain("hi");
    expect(out).toContain("[exit 0]");
  });
  it("omits -d for default distro", async () => {
    const { wsl, calls } = fakeWsl();
    const ops = createOps(wsl, translatePath);
    await ops.exec("true", undefined, 1000);
    expect(calls[0][0]).toBe("--exec");
  });
  it("reports stderr and non-zero exit", async () => {
    const wslOps = { run: async () => ({ stdout: "partial", stderr: "boom", code: 1 }) };
    const ops = createOps(wslOps, translatePath);
    const out = await ops.exec("false", undefined, 1000);
    expect(out).toContain("[stderr] boom");
    expect(out).toContain("[exit 1]");
  });
  it("writeFile uses base64 pipeline", async () => {
    const { wsl, calls } = fakeWsl();
    const ops = createOps(wsl, translatePath);
    const out = await ops.writeFile("/tmp/f.txt", "hello", undefined);
    expect(calls[0].at(-1)).toContain("base64 -d >");
    expect(calls[0].at(-1)).toContain(Buffer.from("hello").toString("base64"));
    expect(out).toContain("5 bytes");
  });
  it("readFile failure throws with detail", async () => {
    const ops = createOps({ run: async () => ({ stdout: "", stderr: "cat: nope", code: 1 }) }, translatePath);
    await expect(ops.readFile("/tmp/missing", undefined)).rejects.toThrow(/cat: nope/);
  });
  it("listDistros parses wsl --list --quiet", async () => {
    const { wsl, calls } = fakeWsl({ stdout: "* Ubuntu\r\nDebian\r\n" });
    const ops = createOps(wsl, translatePath);
    expect(await ops.listDistros()).toEqual(["Ubuntu", "Debian"]);
    expect(calls[0]).toEqual(["--list", "--quiet"]);
  });
});

async function connected(readOnly: boolean) {
  const { server } = createServer({ readOnly });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "0.0.0" });
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return client;
}

describe("MCP server", () => {
  it("registers the six tools", async () => {
    const client = await connected(false);
    const { tools } = await client.listTools();
    expect(new Set(tools.map((t) => t.name))).toEqual(
      new Set([
        "wsl_list_distros",
        "wsl_exec",
        "wsl_read_file",
        "wsl_write_file",
        "wsl_list_dir",
        "wsl_path_translate",
      ]),
    );
    await client.close();
  });

  it("blocks write tools in read-only mode", async () => {
    const client = await connected(true);
    const exec = await client.callTool({ name: "wsl_exec", arguments: { command: "rm -rf /" } });
    expect(exec.isError).toBe(true);
    expect(JSON.stringify(exec.content)).toContain("read-only");
    const write = await client.callTool({
      name: "wsl_write_file",
      arguments: { path: "/tmp/x", content: "y" },
    });
    expect(write.isError).toBe(true);
    await client.close();
  });

  it("translates paths through wsl_path_translate", async () => {
    const client = await connected(false);
    const res = await client.callTool({
      name: "wsl_path_translate",
      arguments: { path: "C:\\Users\\me\\proj" },
    });
    expect(JSON.stringify(res.content)).toContain("/mnt/c/Users/me/proj");
    await client.close();
  });
});
