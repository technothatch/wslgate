# wslgate

**The bridge AI agents on Windows need to reach WSL — MCP server + CLI in one package.**

Agents like Claude Code run on Windows, but the code lives in WSL. The maintainers know it:
[anthropics/claude-code#3396](https://github.com/anthropics/claude-code/issues/3396)
("execute commands in WSL instead of Windows") has been one of the most-upvoted feature requests
on that repo. Until every agent ships native WSL support, `wslgate` gives any MCP-compatible
client the same capability — and gives you a CLI for the same operations by hand.

## Tools (MCP)

| Tool | Description |
|------|-------------|
| `wsl_exec` | run a bash command in WSL, get stdout/stderr/exit code |
| `wsl_read_file` | read a file (accepts `C:\...` or `/mnt/c/...`) |
| `wsl_write_file` | write a file (base64-safe, no quoting bugs) |
| `wsl_list_dir` | list a directory |
| `wsl_path_translate` | convert paths `C:\` ↔ `/mnt/c` |
| `wsl_list_distros` | list installed distributions |

All file/exec tools take an optional `distro` (`Ubuntu`, `Debian`, …) — **multi-distro**,
default distro when omitted. Start with `--read-only` to disable `wsl_exec`/`wsl_write_file`.

## Install / run

```
npx wslgate-mcp                 # MCP stdio server
npx wslgate-mcp --read-only     # read-only mode
```

Claude Desktop / Claude Code config:

```json
{
  "mcpServers": {
    "wsl": { "command": "npx", "args": ["-y", "wslgate-mcp"] }
  }
}
```

Or install globally for the CLI: `npm install -g wslgate`

```
wslgate distros
wslgate exec --distro Ubuntu -- "ls -la /mnt/c/Users/me"
wslgate read C:\Users\me\.bashrc
wslgate translate C:\Projects\app
wslgate ls /mnt/c/Windows
echo "hi" | wslgate write /tmp/hello.txt
wslgate mcp --read-only
```

## Honest technical notes

- Every operation is a `wsl.exe --exec bash -lc ...` invocation — one process, real exit codes,
  no `\\wsl$` UNC tricks.
- `wsl --list` output is UTF-16LE on Windows; `wslgate` detects and decodes it (BOM or heuristic).
- Files are written via `base64 -d` so content with quotes, `$` or newlines survives the trip.
- Paths are validated/quoted with strict single-quote shell escaping before hitting bash.
- On machines without WSL you get a clear "is WSL installed?" error instead of a stack trace.

## Development

```
npm install
npm test        # vitest: path translation, wsl decoding, MCP protocol (in-memory transport)
npm run build
```

## License

[MIT](LICENSE)
