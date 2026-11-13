import { describe, expect, it } from "vitest";

import {
  DOCTOR_SCRIPT,
  divergentTools,
  formatDoctor,
  isWindowsPath,
  parseDoctorOutput,
  windowsTools,
} from "../src/doctor.js";

const raw = [
  "D\tdistro\tUbuntu 24.04",
  "D\tkernel\t6.8.0-microsoft-standard-WSL2",
  "D\tfirst_windows_path_index\t3",
  "D\twindows_path_entries\t32",
  "T\tbash\t/usr/bin/bash",
  "T\tnpm\t/mnt/c/Users/me/AppData/Roaming/npm/npm",
  "T\tnode\t/usr/local/bin/node",
  "I\tbash\t/usr/bin/bash",
  "I\tnpm\t/home/me/.local/share/fnm/aliases/default/bin/npm",
  "I\tnode\t/usr/local/bin/node",
].join("\n");

describe("doctor", () => {
  it("parses data, tools and interactive tools separately", () => {
    const report = parseDoctorOutput(raw);
    expect(report.data.distro).toBe("Ubuntu 24.04");
    expect(report.data.windows_path_entries).toBe("32");
    expect(report.tools.npm).toBe("/mnt/c/Users/me/AppData/Roaming/npm/npm");
    expect(report.interactiveTools.npm).toBe("/home/me/.local/share/fnm/aliases/default/bin/npm");
  });

  it("ignores noise and malformed lines", () => {
    const report = parseDoctorOutput(
      ["To run a command as administrator", "", "garbage", "D\tonly-one-field"].join("\n"),
    );
    expect(report.data.only).toBeUndefined();
    expect(Object.keys(report.tools)).toHaveLength(0);
  });

  it("spots a tool that resolves differently per shell", () => {
    const report = parseDoctorOutput(raw);
    expect(divergentTools(report)).toEqual(["npm"]);
  });

  it("spots a tool that resolves to a Windows program", () => {
    const report = parseDoctorOutput(raw);
    expect(windowsTools(report)).toEqual(["npm"]);
    expect(isWindowsPath("/mnt/c/Users/me/npm")).toBe(true);
    expect(isWindowsPath("/usr/bin/npm")).toBe(false);
  });

  it("explains both findings in the rendered report", () => {
    const text = formatDoctor(parseDoctorOutput(raw));
    expect(text).toContain("Ubuntu 24.04");
    expect(text).toContain("windows interop on PATH: 32 entries (first at position 3)");
    expect(text).toContain("<-- windows program");
    expect(text).toContain("resolved differently in an interactive shell");
    expect(text).toContain("bash -ic");
  });

  it("says nothing about divergence when there is none", () => {
    const clean = [
      "D\tdistro\tUbuntu 24.04",
      "D\twindows_path_entries\t0",
      "T\tnpm\t/usr/bin/npm",
      "I\tnpm\t/usr/bin/npm",
    ].join("\n");
    const text = formatDoctor(parseDoctorOutput(clean));
    expect(text).not.toContain("resolved differently");
    expect(text).toContain("windows interop on PATH: none");
  });

  it("exports the tool list into the script", () => {
    expect(DOCTOR_SCRIPT).toContain("npm");
    expect(DOCTOR_SCRIPT).toContain("bash -ic");
  });
});
