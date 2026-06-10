import { describe, expect, it } from "vitest";
import { createVersionSourceKey } from "../src/index.js";

describe("createVersionSourceKey", () => {
  it("adds a unique per-attempt suffix to version source keys", () => {
    const input = {
      ownerUserId: "user_1",
      artifactId: "artifact_1",
      versionNumber: 2
    };

    const first = createVersionSourceKey(input);
    const second = createVersionSourceKey(input);

    expect(first).not.toBe(second);
    expect(first).toMatch(/^users\/user_1\/artifacts\/artifact_1\/versions\/2\/source-/);
  });

  it("supports explicit attempt ids for deterministic callers", () => {
    expect(
      createVersionSourceKey({
        ownerUserId: "user_1",
        artifactId: "artifact_1",
        versionNumber: 2,
        attemptId: "attempt_1"
      })
    ).toBe("users/user_1/artifacts/artifact_1/versions/2/source-attempt_1");
  });
});
