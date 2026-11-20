import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// base "./" so the build works from any sub-folder (e.g. a portfolio's projects/02-mindspace/)
export default defineConfig({ plugins: [react()], base: "./", build: { outDir: "dist", assetsInlineLimit: 0 } });
