export const SESSION_COOKIE_NAMES = [
  "__Secure-better-auth.session_token",
  "better-auth.session_token"
] as const;

interface CookieReader {
  get(name: string): { value?: string } | string | undefined;
}

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

export function readSessionCookie(source: string | null | undefined | CookieReader): string | undefined {
  if (!source) {
    return undefined;
  }

  if (typeof source === "string") {
    for (const name of SESSION_COOKIE_NAMES) {
      const value = readCookie(source, name);
      if (value) {
        return value;
      }
    }
    return undefined;
  }

  for (const name of SESSION_COOKIE_NAMES) {
    const cookie = source.get(name);
    const value = typeof cookie === "string" ? cookie : cookie?.value;
    if (value) {
      return value;
    }
  }

  return undefined;
}
