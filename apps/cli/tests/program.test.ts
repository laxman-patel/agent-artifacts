import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { runCli } from "../src/program.js";

describe("runCli help", () => {
  const output: string[] = [];
  const exitCodes: number[] = [];

  beforeEach(() => {
    output.length = 0;
    exitCodes.length = 0;
    const capture = (chunk: string | Uint8Array) => {
      output.push(String(chunk));
      return true;
    };
    vi.spyOn(process.stdout, "write").mockImplementation(capture);
    vi.spyOn(process.stderr, "write").mockImplementation(capture);
    vi.spyOn(process, "exit").mockImplementation((code) => {
      exitCodes.push(Number(code));
      throw new Error(`exit:${code}`);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prints top-level help when invoked with no subcommand", async () => {
    await expect(runCli(["node", "artifacts"])).rejects.toThrow("exit:1");
    const help = output.join("");
    expect(help).toContain("artifacts schema");
    expect(help).toContain("Commands:");
    expect(help).toContain("Examples:");
  });

  it("includes Examples on subcommand help", async () => {
    await expect(runCli(["node", "artifacts", "whoami", "--help"])).rejects.toThrow("exit:0");
    const help = output.join("");
    expect(help).toContain("Examples:");
    expect(help).toContain("artifacts whoami");
  });
});
