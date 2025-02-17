import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  let proxyConfig = {};
  if (env.VITE_SITE_NAME && env.VITE_SITE_PORT) {
    proxyConfig = {
      "^/(app|api|assets|files|private)": {
        target: `http://localhost:${env.VITE_SITE_PORT}`,
        ws: true,
        changeOrigin: true,
        secure: false,
        router: function () {
          return `http://${env.VITE_SITE_NAME}:${env.VITE_SITE_PORT}`;
        },
      },
    };
  }
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: proxyConfig,
    },
    build: {
      outDir: "../frappe_appointment/public/frontend",
      emptyOutDir: true,
      target: "es2015",
    },
    resolve: {
      alias: {
        // eslint-disable-next-line no-undef
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
