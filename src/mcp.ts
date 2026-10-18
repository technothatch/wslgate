#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createServer } from "./tools.js";

async function main() {
  const readOnly = process.argv.includes("--read-only");
  const { server } = createServer({ readOnly });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `wslgate MCP server running (stdio)${readOnly ? " [read-only]" : ""}`,
  );
}

main().catch((e) => {
  console.error("fatal:", e);
  process.exit(1);
});
