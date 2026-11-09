---
name: Bug report
about: A command, file op or MCP tool failed across the Windows/WSL boundary
title: "[bug] "
labels: bug
assignees: ''
---

**Command or tool call**

```
wslgate exec --distro Ubuntu -- "…"
```

**Full output, including the `[stderr]` and `[exit N]` lines**

**Expected behaviour**

**Environment**

- `wslgate distros`:
- `wsl.exe --version`:
- Windows version:
- MCP client and how the server is configured (if relevant):

```json
{ "mcpServers": { "wsl": { "command": "wslgate-mcp" } } }
```
