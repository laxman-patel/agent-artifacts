export interface HtmlIframeConfig {
  sandbox: string;
  csp: string;
}

export function getHtmlIframeConfig(opts?: { allowExternalNetwork?: boolean }): HtmlIframeConfig {
  const sandbox = [
    "allow-scripts",
    "allow-forms",
    "allow-popups"
  ].join(" ");

  const connectSrc = opts?.allowExternalNetwork ? "'self' https:" : "'none'";

  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    `connect-src ${connectSrc}`,
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'"
  ].join("; ");

  return { sandbox, csp };
}

export function wrapHtmlFragment(content: string): string {
  if (/^\s*<!DOCTYPE\s+html/i.test(content) || /^\s*<html/i.test(content)) {
    return content;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { margin: 0; padding: 16px; font-family: system-ui, sans-serif; }
</style>
</head>
<body>
${content}
</body>
</html>`;
}
