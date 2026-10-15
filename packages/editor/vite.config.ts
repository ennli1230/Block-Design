import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [vue()],
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    lib: {
      entry: "src/vanilla.ts",
      name: "BlockDesign",
      formats: ["iife"],
      fileName: () => "blockdesign-editor.iife.js",
    },
    cssCodeSplit: false,
    sourcemap: true,
    outDir: "../../dist/vanilla",
    emptyOutDir: true,
  },
});
