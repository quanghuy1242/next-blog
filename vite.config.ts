/// <reference types="vitest/config" />
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/postcss";
import { defineConfig } from "vite";
import path from "node:path";

const isTest = !!process.env.VITEST;

export default defineConfig({
  plugins: isTest
    ? [react()]
    : [
        vinext({
          react: {
            babel: {
              plugins: [["babel-plugin-react-compiler", {}]],
            },
          } as Record<string, unknown>,
        }),
        cloudflare({
          viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        }),
      ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  css: {
    postcss: {
      plugins: [tailwindcss()],
    },
  },
  // vitest reads `test` from vite config
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: path.resolve(import.meta.dirname, "tests/setup.ts"),
    passWithNoTests: true,
    coverage: {
      reporter: ["text", "lcov"],
    },
  },
});
