// End-to-end check: the wsl_doctor MCP tool answers over a real session.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["dist/cli.js", "mcp"],
  stderr: "pipe",
});
transport.stderr?.on("data", (d) => process.stderr.write("[server] " + d));

const client = new Client({ name: "doctor-e2e", version: "0.0.0" });
await client.connect(transport);

const { tools } = await client.listTools();
console.log("tools:", tools.map((t) => t.name).join(","));

const res = await client.callTool({
  name: "wsl_doctor",
  arguments: { distro: "Ubuntu" },
});
const text = res.content[0].text;
console.log("---- wsl_doctor output ----");
console.log(text.split("\n").slice(0, 8).join("\n"));
console.log("...");

if (!text.includes("distribution:")) {
  console.log("NO_REPORT");
  process.exit(1);
}
await client.close();
console.log("E2E_DOCTOR_OK");
