# wslgate

**The bridge AI agents on Windows need to reach WSL — MCP server + CLI in one package.**

Agents like Claude Code run on Windows, but the code lives in WSL. The demand is documented:
[anthropics/claude-code#12506](https://github.com/anthropics/claude-code/issues/12506)
("Option to execute commands in WSL instead of Windows") gathered **147 reactions** before it was
closed, and [microsoft/vscode#289657](https://github.com/microsoft/vscode/issues/289657) is open for
the same problem in Copilot Agent. Until every agent ships native WSL support, `wslgate` gives any
MCP-compatible client the same capability — and gives you a CLI for the same operations by hand.

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

## Run your MCP servers *inside* WSL

Some clients spawn a project's `.mcp.json` on the Windows host even when the project lives in
WSL, so every server fails because `bash`, `node` and `python3` resolve to Windows binaries
([claude-code#102712](https://github.com/anthropics/claude-code/issues/102712) is a detailed
write-up of that). The workaround people hand-roll is a `wsl.exe` dispatcher per entry —
`wslgate mcp-proxy` is that dispatcher, packaged:

```json
{
  "mcpServers": {
    "fs": {
      "command": "wslgate",
      "args": [
        "mcp-proxy", "--distro", "Ubuntu", "--cwd", "C:\\proj", "--",
        "npx", "-y", "@modelcontextprotocol/server-filesystem", "/home/me/proj"
      ]
    }
  }
}
```

`mcp-proxy` spawns `wsl.exe --exec bash -lc …` and relays stdin/stdout/stderr byte for byte
(no buffering or re-encoding), then exits with the server's exit code. `--cwd` accepts a
Windows path and is translated to `/mnt/...` for you; a relative path is resolved against
the current directory first, because `wsl.exe --cd .` fails with `Wsl/E_INVALIDARG`.
It is a CLI subcommand, so `--read-only` (which gates the MCP server's own tools) does not
apply to it — treat it as arbitrary command execution.

> **The story behind it:** [Cross the Windows–WSL boundary with less friction](https://technothatch.iyre.com/blog/wslgate-inside-the-project/)
> — the TechnoThatch journal piece on why every operation is a single `wsl.exe` process.

## Install / run

> **Status:** the npm package is not published yet. Until it is, install straight
> from GitHub. `--install-links` is required: without it npm 10/11 links the
> global install to a temporary clone and then deletes it.
>
> ```
> npm install -g --install-links github:technothatch/wslgate
> ```
>
> The build output in `dist/` is committed, so no TypeScript compiler is needed.
> The `npx wslgate-mcp` / `npm install -g wslgate` forms below will work as soon
> as the package is on npm.

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
wslgate doctor --distro Ubuntu
wslgate mcp-proxy --distro Ubuntu -- npx -y @modelcontextprotocol/server-filesystem /home/me
wslgate mcp --read-only
```

## Diagnose a mixed Windows/WSL toolchain

Inside WSL, `node` can be the Linux one while `npm` is the Windows one — so a
tool that shells out to npm fails with a UNC path it cannot open.

`wslgate doctor` shows which programs are actually resolved, and marks the
ones that come from Windows:

```
$ wslgate doctor --distro Ubuntu
distribution: Ubuntu 24.04
windows interop on PATH: 32 entries (first at position 3)

resolved in a non-interactive shell (what an MCP client gets):
  npm      /mnt/c/Users/me/AppData/Roaming/npm/npm  <-- windows program
  node     /usr/local/bin/node

resolved differently in an interactive shell (what your terminal gets):
  npm      /home/me/.local/share/fnm/aliases/default/bin/npm
```

The difference is the diagnosis. A toolchain set up in `~/.bashrc` (fnm, nvm,
asdf …) is not applied in a non-interactive shell, because Ubuntu's default
`~/.bashrc` returns early for them — and a **login** shell does not help
either, since `bash -lc` is still non-interactive. Only an interactive shell
(`bash -ic`) picks it up. That is why the usual advice to "use a login shell"
leaves the problem exactly where it was.

The same report is available as the `wsl_doctor` MCP tool.

## Honest technical notes

- Every operation is a `wsl.exe --exec bash -lc ...` invocation — one process, real exit codes,
  no `\\wsl$` UNC tricks. `wslgate exec` exits with the remote command's exit code, so it works in
  scripts and CI (`wslgate exec --distro Ubuntu -- "make test" || exit 1`).
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
