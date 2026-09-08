import { afterEach, describe, expect, it, vi } from "vitest";
import { copyText } from "./copy-text";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("copyText", () => {
  it("copies with the Clipboard API", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    vi.stubGlobal("document", undefined);

    expect(await copyText("https://example.com/artifact")).toBe(true);
    expect(writeText).toHaveBeenCalledWith("https://example.com/artifact");
  });

  it("falls back when the Clipboard API rejects and returns the fallback result", async () => {
    const node = { value: "", setAttribute: vi.fn(), style: {}, select: vi.fn(), remove: vi.fn() };
    const execCommand = vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false);
    const appendChild = vi.fn();
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("Denied")) } });
    vi.stubGlobal("document", { createElement: vi.fn().mockReturnValue(node), body: { appendChild }, execCommand });

    expect(await copyText("artifact link")).toBe(true);
    expect(node.value).toBe("artifact link");
    expect(appendChild).toHaveBeenCalledWith(node);
    expect(node.select).toHaveBeenCalled();
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(node.remove).toHaveBeenCalledOnce();
    expect(await copyText("another link")).toBe(false);
    expect(node.remove).toHaveBeenCalledTimes(2);
  });
});
