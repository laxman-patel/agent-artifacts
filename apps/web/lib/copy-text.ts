// Clipboard API can reject (focus loss, embedded webviews); fall back to a
// transient textarea and report whether the copy succeeded.
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const node = document.createElement("textarea");
    node.value = text;
    node.setAttribute("readonly", "");
    node.style.position = "fixed";
    node.style.opacity = "0";
    document.body.appendChild(node);
    node.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    node.remove();
    return ok;
  }
}
