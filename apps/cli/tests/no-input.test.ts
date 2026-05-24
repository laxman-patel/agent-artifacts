import { describe, expect, it } from "vitest";
import { runCli } from "../src/program.js";
import { CliError } from "../src/errors.js";

describe("--no-input flag", () => {
  it("propagates --no-input to login and fails without prompting", async () => {
    await expect(runCli(["node", "artifacts", "login", "--no-input", "--format", "json"])).rejects.toMatchObject({
      kind: "invalid_request"
    });
    await expect(runCli(["node", "artifacts", "login", "--no-input", "--format", "json"])).rejects.toBeInstanceOf(
      CliError
    );
  });
});
