import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const repoRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  root: "app",
  resolve: {
    alias: {
      "@": path.join(repoRoot, "app", "src")
    }
  },
  envDir: "..",
  build: {
    outDir: "../dist",
    emptyOutDir: true
  }
});
