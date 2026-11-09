#!/usr/bin/env node
// End-to-end check: MCP client on Windows -> wslgate mcp-proxy -> WSL -> tiny MCP server.
// The server is dependency-free so the test needs no network inside WSL.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const serverJs = [
  "const readline=require('node:readline');",
  "const rl=readline.createInterface({input:process.stdin});",
  "rl.on('line',(line)=>{",
  "  if(!line.trim())return;",
  "  let m;try{m=JSON.parse(line)}catch(e){return}",
  "  const send=(o)=>process.stdout.write(JSON.stringify(o)+'\\n');",
  "  if(m.method==='initialize')return send({jsonrpc:'2.0',id:m.id,result:{protocolVersion:m.params.protocolVersion,capabilities:{tools:{}},serverInfo:{name:'mini',version:'0'}}});",
  "  if(m.method==='tools/list')return send({jsonrpc:'2.0',id:m.id,result:{tools:[{name:'echo',description:'echo',inputSchema:{type:'object',properties:{text:{type:'string'}}}}]}});",
  "  if(m.method==='tools/call')return send({jsonrpc:'2.0',id:m.id,result:{content:[{type:'text',text:'echoed:'+(m.params.arguments.text||'')}]}});",
  "  if(m.id!==undefined)send({jsonrpc:'2.0',id:m.id,result:{}});",
  "});",
].join("");

const args = process.argv.slice(2);
const distro = args[0] ?? "Ubuntu";
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [
    args[1] ?? "dist/cli.js",
    "mcp-proxy",
    "--distro",
    distro,
    "--",
    "node",
    "-e",
    serverJs,
  ],
  stderr: "pipe",
});
transport.stderr?.on("data", (d) => process.stderr.write("[proxy stderr] " + d));

const client = new Client({ name: "e2e", version: "0.0.0" });
await client.connect(transport);
const { tools } = await client.listTools();
console.log("tools:", tools.map((t) => t.name).join(","));
const res = await client.callTool({ name: "echo", arguments: { text: "hello wsl" } });
console.log("result:", res.content[0].text);
await client.close();
console.log("E2E_OK");
