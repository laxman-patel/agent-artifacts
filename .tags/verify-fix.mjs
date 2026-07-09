import { readFileSync } from "node:fs";

const src = readFileSync("apps/web/app/page.tsx", "utf8");
const mcpLinks = (src.match(/docsHref}\/surfaces\/mcp/g) || []).length;
const oldLinks = (src.match(/href="\/cli\/login"/g) || []).length;
const newTabs = (src.match(/target="_blank"/g) || []).length;

console.log("MCP links -> /surfaces/mcp:", mcpLinks);
console.log("Links still -> /cli/login:", oldLinks);
console.log("Links opening new tab:", newTabs);

if (mcpLinks === 2 && oldLinks === 0 && newTabs >= 2) {
  console.log("PASS: Both MCP links fixed — open docsUrl()/surfaces/mcp in new tab");
} else {
  console.error("FAIL: expected 2 mcp links, 0 old links, >=2 new-tab links");
  process.exit(1);
}
