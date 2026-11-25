import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    target: "es2020",
    sourcemap: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/node_modules/three/")) return "three-vendor";
          if (id.includes("/node_modules/three-stdlib/")) return "three-stdlib";
          if (id.includes("/node_modules/@react-three/fiber/")) return "fiber-vendor";
          if (id.includes("/node_modules/@react-three/drei/")) return "drei-vendor";
        },
      },
    },
  },
});
