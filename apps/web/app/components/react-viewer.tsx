"use client";

import { useMemo } from "react";

// Builds a self-contained HTML page that:
//  1. Loads React 19 + ReactDOM 19 as UMD globals from esm.sh CDN
//  2. Loads @babel/standalone from jsDelivr
//  3. Transpiles the user's JSX inline (classic runtime → global React)
//  4. Renders the default export into #root
function buildSandboxHtml(source: string): string {
  const encodedSource = JSON.stringify(source);

  const csp = [
    "default-src 'none'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://esm.sh https://cdn.jsdelivr.net",
    "style-src 'unsafe-inline'",
    "img-src data: blob: https:",
    "font-src data: https:",
    "connect-src https://esm.sh https://cdn.jsdelivr.net",
    "base-uri 'none'",
    "form-action 'none'"
  ].join("; ");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: ui-sans-serif, system-ui, sans-serif; background: #09090b; color: #f4f4f5; }
    #root { padding: 1.5rem; }
    #error-display { color: #f87171; font-family: monospace; font-size: 0.85rem; white-space: pre-wrap; padding: 1.5rem; }
  </style>
</head>
<body>
  <div id="root"></div>
  <div id="error-display"></div>

  <!-- React 19 UMD (global React + ReactDOM) -->
  <script crossorigin src="https://esm.sh/react@19/umd/react.development.js"></script>
  <script crossorigin src="https://esm.sh/react-dom@19/umd/react-dom.development.js"></script>
  <!-- Babel standalone for in-browser JSX transpilation -->
  <script src="https://cdn.jsdelivr.net/npm/@babel/standalone@7/babel.min.js"></script>

  <script>
    (function () {
      var source = ${encodedSource};
      try {
        var result = Babel.transform(source, {
          presets: [
            ["react", { runtime: "classic" }],
            ["env", { targets: { browsers: ["last 2 chrome versions"] }, modules: false }]
          ],
          filename: "component.jsx"
        });

        // Execute the transpiled code in a function scope where React is available
        var fn = new Function("React", "ReactDOM", result.code + "\\nreturn typeof exports !== 'undefined' ? exports : (typeof module !== 'undefined' ? module.exports : null);");
        var exports = {};
        fn(React, ReactDOM, exports);

        // The component file likely uses export default; Babel's "modules: false"
        // keeps ES export syntax, so we need to handle that. Re-transpile with commonjs.
        var result2 = Babel.transform(source, {
          presets: [
            ["react", { runtime: "classic" }],
            ["env", { targets: { browsers: ["last 2 chrome versions"] }, modules: "commonjs" }]
          ],
          filename: "component.jsx"
        });

        var module2 = { exports: {} };
        var fn2 = new Function("React", "ReactDOM", "module", "exports", "require", result2.code);
        fn2(React, ReactDOM, module2, module2.exports, function () { return {}; });

        var Component = module2.exports.default || module2.exports[Object.keys(module2.exports)[0]];
        if (!Component) throw new Error("No exported component found. Make sure your file has a default export.");

        var container = document.getElementById("root");
        ReactDOM.createRoot(container).render(React.createElement(Component));
      } catch (err) {
        document.getElementById("error-display").textContent = String(err && err.stack ? err.stack : err);
      }
    })();
  </script>
</body>
</html>`;
}

export function ReactViewer({ content }: { content: string }) {
  const srcDoc = useMemo(() => buildSandboxHtml(content), [content]);

  return (
    <iframe
      className="artifact-frame"
      referrerPolicy="no-referrer"
      sandbox="allow-scripts"
      srcDoc={srcDoc}
      title="React component preview"
    />
  );
}
