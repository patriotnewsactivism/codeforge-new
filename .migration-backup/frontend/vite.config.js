import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Basic Vite config for React with TypeScript
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    outDir: "dist",
  },
});
