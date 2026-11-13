/**
 * Diagnose a mixed Windows/WSL toolchain.
 *
 * The classic symptom: inside WSL, `node` is the Linux one but `npm` is the
 * Windows one, so a tool that shells out to npm fails with a UNC path it
 * cannot open. The cause is usually a toolchain set up in `~/.bashrc` (fnm,
 * nvm, asdf, ...): Ubuntu's default `~/.bashrc` returns early for
 * non-interactive shells, so the setup never runs - while the Windows
 * interop directories that WSL appends to PATH still contain an `npm`.
 *
 * A login shell does not help (`bash -lc` is still non-interactive), which is
 * why the usual advice ("use a login shell") does not fix it. An interactive
 * shell does (`bash -ic`), because that is what a human terminal gets.
 *
 * This module reports both, so the difference is visible instead of
 * guessed at.
 */

/** Tools worth resolving inside the distribution. */
export const TOOLS = [
  "bash",
  "git",
  "node",
  "npm",
  "npx",
  "python3",
  "pip3",
  "jq",
  "make",
  "gcc",
  "go",
  "cargo",
  "dotnet",
] as const;

/**
 * The script run inside WSL.
 *
 * It prints `D<TAB>key<TAB>value` lines for data and `I<TAB>tool<TAB>path`
 * lines for the tools an interactive shell would resolve.
 */
export const DOCTOR_SCRIPT = `set +e
export TOOLS="${TOOLS.join(" ")}"
emit() { printf 'D\\t%s\\t%s\\n' "$1" "$2"; }

if [ -r /etc/os-release ]; then
  . /etc/os-release
  emit distro "\${PRETTY_NAME:-unknown}"
else
  emit distro unknown
fi
emit kernel "$(uname -r 2>/dev/null)"
emit home "\${HOME:-unknown}"

# Where the Windows interop directories sit on PATH. A low index means the
# Windows copies of a tool win over the distribution's own.
path_report() {
  printf '%s' "$1" | tr ':' '\\n' | grep -n '^/mnt/[a-z]' | head -1 | cut -d: -f1
}
emit first_windows_path_index "$(path_report "$PATH")"
emit windows_path_entries "$(printf '%s' "$PATH" | tr ':' '\\n' | grep -c '^/mnt/[a-z]')"

for t in $TOOLS; do
  p=$(command -v "$t" 2>/dev/null)
  printf 'T\\t%s\\t%s\\n' "$t" "\${p:--}"
done

# The same tools as an interactive shell resolves them. One interactive shell
# for all of them: starting one per tool is slow and noisy.
bash -ic 'for t in $TOOLS; do p=$(command -v "$t" 2>/dev/null); printf "I\\t%s\\t%s\\n" "$t" "\${p:--}"; done' 2>/dev/null

emit first_windows_path_index_interactive "$(bash -ic 'printf "%s" "$PATH" | tr ":" "\\n" | grep -n "^/mnt/[a-z]" | head -1 | cut -d: -f1' 2>/dev/null)"
exit 0
`;

export interface DoctorReport {
  /** Key/value data reported by the distribution. */
  data: Record<string, string>;
  /** Tool path resolved by a non-interactive (login) shell. */
  tools: Record<string, string>;
  /** Tool path resolved by an interactive shell. */
  interactiveTools: Record<string, string>;
}

/** Parse the script output. Unknown lines are ignored. */
export function parseDoctorOutput(raw: string): DoctorReport {
  const report: DoctorReport = { data: {}, tools: {}, interactiveTools: {} };
  for (const line of raw.split("\n")) {
    if (!line) continue;
    const parts = line.split("\t");
    if (parts.length < 3) continue;
    const value = parts.slice(2).join("\t");
    if (parts[0] === "D") {
      report.data[parts[1]] = value;
    } else if (parts[0] === "T") {
      report.tools[parts[1]] = value;
    } else if (parts[0] === "I") {
      report.interactiveTools[parts[1]] = value;
    }
  }
  return report;
}

/** True when a path comes from the Windows filesystem (through /mnt). */
export function isWindowsPath(p: string): boolean {
  return /^\/mnt\/[a-z]/i.test(p);
}

/**
 * Tools that resolve differently depending on whether the shell is
 * interactive - the sign of a toolchain that only a login profile sets up.
 */
export function divergentTools(report: DoctorReport): string[] {
  const names = new Set([...Object.keys(report.tools), ...Object.keys(report.interactiveTools)]);
  const out: string[] = [];
  for (const name of [...names].sort()) {
    const a = report.tools[name];
    const b = report.interactiveTools[name];
    if (a && b && a !== b) out.push(name);
  }
  return out;
}

/** Tools that resolve to a Windows program rather than a Linux one. */
export function windowsTools(report: DoctorReport): string[] {
  const out: string[] = [];
  for (const [name, path] of Object.entries(report.tools)) {
    if (isWindowsPath(path)) out.push(name);
  }
  return out.sort();
}

/** Render the report for a terminal or an MCP client. */
export function formatDoctor(report: DoctorReport): string {
  const lines: string[] = [];
  const d = report.data;
  lines.push(`distribution: ${d.distro ?? "unknown"}`);
  if (d.kernel) lines.push(`kernel:      ${d.kernel}`);

  const winIndex = d.first_windows_path_index;
  const winCount = d.windows_path_entries;
  if (winCount && winCount !== "0") {
    const where = winIndex && winIndex !== "0" ? `first at position ${winIndex}` : "position unknown";
    lines.push(`windows interop on PATH: ${winCount} entries (${where})`);
  } else {
    lines.push("windows interop on PATH: none");
  }

  const windows = windowsTools(report);
  const divergent = divergentTools(report);

  lines.push("");
  lines.push("resolved in a non-interactive shell (what an MCP client gets):");
  const names = [...new Set([...Object.keys(report.tools), ...Object.keys(report.interactiveTools)])].sort();
  for (const name of names) {
    const path = report.tools[name] ?? "-";
    const mark = isWindowsPath(path) ? "  <-- windows program" : "";
    lines.push(`  ${name.padEnd(9)}${path}${mark}`);
  }

  if (divergent.length > 0) {
    lines.push("");
    lines.push("resolved differently in an interactive shell (what your terminal gets):");
    for (const name of divergent) {
      lines.push(`  ${name.padEnd(9)}${report.interactiveTools[name]}`);
    }
    lines.push("");
    lines.push(
      "The difference means a toolchain set up in ~/.bashrc is not being applied:",
    );
    lines.push(
      "Ubuntu's default ~/.bashrc returns early for non-interactive shells, so a",
    );
    lines.push(
      "login shell (bash -lc) does not pick it up either. Run the server with an",
    );
    lines.push(
      "interactive shell (bash -ic) or source the profile explicitly.",
    );
  }

  if (windows.length > 0) {
    lines.push("");
    lines.push(
      `Note: ${windows.join(", ")} resolve to a Windows program. Windows directories`,
    );
    lines.push(
      "are on PATH, so a Windows build can win over the distribution's own.",
    );
  }

  return lines.join("\n");
}
