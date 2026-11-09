# Contributing to wslgate

Thanks for helping improve a small Windows ↔ WSL bridge.

## Ground rules

- Search [existing issues](https://github.com/technothatch/wslgate/issues) before opening a new one.
- One problem per issue, please.
- Be kind. This is maintained in spare time; assume good intent.

## Reporting a bug

Use the **Bug report** template. The details that matter most:

1. The exact command or MCP tool call.
2. Its output **including the `[stderr]` and `[exit N]` lines**.
3. `wslgate distros` output and your `wsl.exe --version`.

If it's an MCP problem, say which client and how the server is configured
(`.mcp.json` / `mcp.json` snippet), and whether you used `--read-only`.

## Suggesting a feature

Use the **Feature request** template. Describe the workflow across the
Windows/WSL boundary you're stuck on, not just the flag you want. The design
goal is one `wsl.exe` process per operation with real exit codes and no
`\\wsl$` UNC paths — requests that keep that property are easiest to act on.

## Sending a pull request

1. Fork and branch from `main`.
2. Run the checks locally:

   ```
   npm install
   npm test
   npm run build
   ```

3. If you touch `dist/`, rebuild it — the built output is committed so that
   `npm install -g github:technothatch/wslgate` works without a compiler.
4. Open a PR that references the issue it fixes and explains *why* the change
   is correct, not just what it does.

Small, focused PRs merge fastest.

## Releases

Publishing to npm is a maintainer step. Until then, install from GitHub with
`npm install -g --install-links github:technothatch/wslgate`.
