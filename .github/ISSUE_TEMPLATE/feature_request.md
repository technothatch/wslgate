---
name: Feature request
about: Suggest a new command, tool or flag for crossing the boundary
title: "[feature] "
labels: enhancement
assignees: ''
---

**The workflow across Windows/WSL you're stuck on**

<!-- e.g. "I need to start a long-running build in WSL and poll it from Windows". -->

**Proposed command / tool**

**Read-only or execution?**

<!-- wslgate gates wsl_exec / wsl_write_file behind not passing --read-only. -->

**Anything you've tried**

<!-- \\wsl$ UNC paths, wsl.exe by hand, an SSH transport, another bridge… -->

**Notes**

wslgate's design goal is one `wsl.exe` process per operation, real exit codes,
and no `\\wsl$` UNC tricks. Requests that keep that property are easiest to act
on.
