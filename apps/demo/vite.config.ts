import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [vue()],
  server: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
    proxy: {
      "/api": { target: "http://127.0.0.1:8080", changeOrigin: false },
    },
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
  },
  build: {
    sourcemap: true,
    emptyOutDir: true,
    // GrapesJS is a single upstream module; its compressed size is enforced by measure:bundle.
    chunkSizeWarningLimit: 1500,
    rolldownOptions: {
      input: {index:'index.html', interactive:'interactive-examples.html'},
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
