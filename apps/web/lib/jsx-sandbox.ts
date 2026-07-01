/** CSP for the isolated JSX sandbox document (iframe src, not srcDoc). */
export const JSX_SANDBOX_CSP = [
  "default-src 'none'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://esm.sh https://cdn.jsdelivr.net",
  "style-src 'unsafe-inline'",
  "img-src data: blob: https:",
  "font-src data: https:",
  "connect-src https://esm.sh https://cdn.jsdelivr.net",
  "base-uri 'none'",
  "form-action 'none'"
].join("; ");

// Builds a self-contained HTML page that:
//  1. Loads Preact 10 + preact/compat as ESM from esm.sh
//  2. Aliases `react` and `react-dom` to preact/compat inside the sandbox
//  3. Loads @babel/standalone for JSX transpilation
//  4. Transpiles user source (classic React runtime → React.createElement → preact h)
//  5. Renders the default export into #root
export function buildJsxSandboxHtml(source: string): string {
  const encodedSource = JSON.stringify(source);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="Content-Security-Policy" content="${JSX_SANDBOX_CSP}" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: ui-sans-serif, system-ui, sans-serif; background: #09090b; color: #f4f4f5; }
    #root { padding: 1.5rem; }
    #error-display { color: #f87171; font-family: monospace; font-size: 0.85rem; white-space: pre-wrap; padding: 1.5rem; }
  </style>
  <!-- Alias react/react-dom to preact/compat so agent-emitted React imports resolve to Preact. -->
  <script type="importmap">
  {
    "imports": {
      "preact": "https://esm.sh/preact@10",
      "preact/hooks": "https://esm.sh/preact@10/hooks",
      "preact/compat": "https://esm.sh/preact@10/compat",
      "react": "https://esm.sh/preact@10/compat",
      "react-dom": "https://esm.sh/preact@10/compat",
      "react-dom/client": "https://esm.sh/preact@10/compat"
    }
  }
  </script>
</head>
<body>
  <div id="root"></div>
  <div id="error-display"></div>

  <script src="https://cdn.jsdelivr.net/npm/@babel/standalone@7/babel.min.js"></script>
  <script type="module">
    import * as PreactCompat from "https://esm.sh/preact@10/compat";
    const React = PreactCompat;
    const ReactDOM = PreactCompat;
    window.React = React;
    window.ReactDOM = ReactDOM;

    (function () {
      var source = ${encodedSource};
      try {
        var result = Babel.transform(source, {
          presets: [
            ["react", { runtime: "classic" }],
            ["typescript", { allExtensions: true, isTSX: true }],
            ["env", { targets: { browsers: ["last 2 chrome versions"] }, modules: "commonjs" }]
          ],
          filename: "component.tsx"
        });

        var module2 = { exports: {} };
        var fn2 = new Function("React", "ReactDOM", "module", "exports", "require", result.code);
        fn2(React, ReactDOM, module2, module2.exports, function (name) {
          if (name === "react" || name === "react-dom" || name === "react-dom/client") return PreactCompat;
          throw new Error("Module not allowed in sandbox: " + name);
        });

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
