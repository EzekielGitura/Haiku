import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

export default defineConfig(({ mode }) => {
  // Runtime secrets stay in process.env; only VITE_ values can enter browser code.
  const localEnv = loadEnv(mode, process.cwd(), "");
  for (const [key, value] of Object.entries(localEnv)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
  return {
    plugins: [
      tsconfigPaths(),
      tailwindcss(),
      tanstackStart({ server: { entry: "server" } }),
      nitro({
        preset: process.env["NITRO_PRESET"] || (process.env["VERCEL"] ? "vercel" : "node-server"),
        vercel: { functions: { maxDuration: 120 } },
      }),
      react(),
    ],
    server: { host: "127.0.0.1", port: 3000 },
    resolve: { dedupe: ["react", "react-dom"] },
  };
});
