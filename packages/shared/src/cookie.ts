export function readCookie(header: string | null | undefined, name: string): string | undefined {
  if (!header) {
    return undefined;
  }

  for (const segment of header.split(";")) {
    const trimmed = segment.trim();
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    if (trimmed.slice(0, eq) === name) {
      return decodeURIComponent(trimmed.slice(eq + 1));
    }
  }

  return undefined;
}
