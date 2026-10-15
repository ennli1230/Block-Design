import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [vue()],
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    lib: {
      entry: { "blockdesign-editor": "src/index.ts", "blockdesign-forms": "src/forms-entry.ts", "blockdesign-runtime": "src/runtime-entry.ts" },
      formats: ["es"],
      fileName: (_format, entryName) => `${entryName}.js`,
      cssFileName: "blockdesign-editor",
    },
    cssCodeSplit: false,
    sourcemap: true,
    outDir: "../../dist/esm",
    emptyOutDir: true,
    // GrapesJS is a single upstream module; its compressed size is enforced by measure:bundle.
    chunkSizeWarningLimit: 1500,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "grapesjs",
              test: /node_modules[\\/]grapesjs[\\/]/,
              priority: 20,
            },
            {
              name: "postcss",
              test: /node_modules[\\/]postcss[\\/]/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
});
