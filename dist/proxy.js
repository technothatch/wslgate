import { spawn } from "node:child_process";
import { shellQuote, toWslPath } from "./paths.js";
/**
 * Translate a `--cwd` value for `wsl.exe --cd`.
 * `C:\proj` becomes `/mnt/c/proj`; WSL paths pass through.
 *
 * Relative paths are resolved against the current working directory first.
 * `wsl.exe --cd .` fails with `Wsl/E_INVALIDARG` ("The parameter is
 * incorrect"), so a relative path must never reach `--cd`.
 */
export function proxyCwd(cwd, baseDir = process.cwd()) {
    const translated = toWslPath(cwd);
    if (!isAbsoluteWslPath(translated)) {
        const base = toWslPath(baseDir).replace(/\/+$/, "");
        const rel = translated
            .split("/")
            .filter((part) => part !== "" && part !== ".")
            .join("/");
        return rel ? `${base}/${rel}` : base;
    }
    return translated;
}
/** True for an absolute POSIX path (`/...`) or a Windows drive/UNC path. */
function isAbsoluteWslPath(p) {
    return p.startsWith("/") || /^[A-Za-z]:[\\/]/.test(p) || p.startsWith("\\\\");
}
export function buildProxyArgs(command, spec = {}, baseDir = process.cwd()) {
    const args = [];
    if (spec.distro)
        args.push("-d", spec.distro);
    if (spec.cwd)
        args.push("--cd", proxyCwd(spec.cwd, baseDir));
    args.push("--exec", "bash", "-lc", command.map(shellQuote).join(" "));
    return args;
}
/**
 * Relay stdio to a process running inside WSL and return its exit code.
 *
 * The child inherits this process's stdin/stdout/stderr, so MCP's
 * newline-delimited JSON framing passes through byte for byte with no
 * buffering or re-encoding on our side.
 */
export async function runProxy(args, opts = {}) {
    const spawnFn = opts.spawnFn ?? spawn;
    const child = spawnFn("wsl.exe", args, {
        stdio: ["inherit", "inherit", "inherit"],
        windowsHide: false,
    });
    return new Promise((resolve, reject) => {
        let settled = false;
        child.on("error", (e) => {
            if (settled)
                return;
            settled = true;
            const err = e;
            if (err.code === "ENOENT") {
                reject(new Error("failed to spawn wsl.exe (is WSL installed?)"));
                return;
            }
            reject(e);
        });
        child.on("close", (code) => {
            if (settled)
                return;
            settled = true;
            resolve(typeof code === "number" ? code : 1);
        });
    });
}
