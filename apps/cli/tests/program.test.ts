import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { runCli } from "../src/program.js";

describe("runCli help", () => {
  const stdout: string[] = [];
  const exitCodes: number[] = [];

  beforeEach(() => {
    stdout.length = 0;
    exitCodes.length = 0;
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      stdout.push(String(chunk));
      return true;
    });
    vi.spyOn(process, "exit").mockImplementation((code) => {
      exitCodes.push(Number(code));
      throw new Error(`exit:${code}`);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prints top-level help when invoked with no subcommand", async () => {
    await runCli(["node", "artifacts"]);
    const help = stdout.join("");
    expect(help).toContain("artifacts schema");
    expect(help).toContain("Examples:");
    expect(exitCodes).toEqual([]);
  });

  it("includes Examples on subcommand help", async () => {
    await expect(runCli(["node", "artifacts", "whoami", "--help"])).rejects.toThrow("exit:0");
    const help = stdout.join("");
    expect(help).toContain("Examples:");
    expect(help).toContain("artifacts whoami");
  });
});
