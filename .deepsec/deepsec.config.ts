import { defineConfig } from "deepsec/config";

export default defineConfig({
  projects: [
    { id: "agent-artifacts", root: ".." },
    // <deepsec:projects-insert-above>
  ],
});
