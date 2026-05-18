export const REACT_ALLOWED_IMPORTS = [
  "react",
  "react-dom",
  "react-dom/client",
  "lucide-react",
  "date-fns",
  "clsx",
  "classnames",
  "recharts",
  "framer-motion"
] as const;

export type ReactAllowedImport = (typeof REACT_ALLOWED_IMPORTS)[number];

export interface ReactBuildConfig {
  esm_sh_base: string;
  react_version: string;
}

export const DEFAULT_REACT_BUILD_CONFIG: ReactBuildConfig = {
  esm_sh_base: "https://esm.sh",
  react_version: "19"
};

export function buildReactPreviewHtml(source: string, config = DEFAULT_REACT_BUILD_CONFIG): string {
  const importMap: Record<string, string> = {};
  for (const pkg of REACT_ALLOWED_IMPORTS) {
    importMap[pkg] = `${config.esm_sh_base}/${pkg}@${pkg.startsWith("react") ? config.react_version : "latest"}`;
  }

  const importMapJson = JSON.stringify({ imports: importMap }, null, 2);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script type="importmap">${importMapJson}</script>
<style>
  body { margin: 0; padding: 16px; font-family: system-ui, sans-serif; }
  #error-display { color: red; font-family: monospace; white-space: pre-wrap; padding: 16px; background: #fff0f0; border: 1px solid #fcc; border-radius: 4px; }
</style>
</head>
<body>
<div id="root"></div>
<div id="error-display" style="display:none"></div>
<script type="module">
import { createElement, useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createRoot } from "react-dom/client";
// eslint-disable-next-line no-undef
const __source__ = ${JSON.stringify(source)};

async function run() {
  try {
    const { transform } = await import("https://esm.sh/@babel/standalone@7");
    const { code } = transform(__source__, {
      presets: ["react"],
      plugins: [],
      filename: "artifact.jsx"
    });

    const dataUrl = "data:text/javascript;charset=utf-8," + encodeURIComponent(code);
    const mod = await import(dataUrl);
    const Component = mod.default;

    if (typeof Component !== "function") {
      throw new Error("Artifact must export a default React component.");
    }

    const root = createRoot(document.getElementById("root"));
    root.render(createElement(Component));
  } catch (err) {
    const el = document.getElementById("error-display");
    if (el) {
      el.style.display = "block";
      el.textContent = err instanceof Error ? err.message : String(err);
    }
  }
}

run();
</script>
</body>
</html>`;
}
