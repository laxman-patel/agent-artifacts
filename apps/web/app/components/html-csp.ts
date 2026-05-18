const DEFAULT_HTML_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src data: blob:",
  "font-src data:",
  "base-uri 'none'",
  "form-action 'none'"
].join("; ");

export function wrapHtmlWithCsp(source: string, csp = DEFAULT_HTML_CSP): string {
  const cspMeta = `<meta http-equiv="Content-Security-Policy" content="${csp}">`;
  const trimmed = source.trimStart();
  const looksLikeFullDocument = /^(<!doctype\s+html|<html[\s>])/i.test(trimmed);

  if (!looksLikeFullDocument) {
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
${cspMeta}
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body>
${source}
</body>
</html>`;
  }

  const headOpenMatch = source.match(/<head[^>]*>/i);
  if (headOpenMatch && headOpenMatch.index !== undefined) {
    const insertAt = headOpenMatch.index + headOpenMatch[0].length;
    return source.slice(0, insertAt) + "\n" + cspMeta + source.slice(insertAt);
  }

  const htmlOpenMatch = source.match(/<html[^>]*>/i);
  if (htmlOpenMatch && htmlOpenMatch.index !== undefined) {
    const insertAt = htmlOpenMatch.index + htmlOpenMatch[0].length;
    return source.slice(0, insertAt) + `\n<head>${cspMeta}</head>` + source.slice(insertAt);
  }

  return cspMeta + source;
}
