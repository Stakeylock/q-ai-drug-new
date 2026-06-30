import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      "/auth": "http://127.0.0.1:8000",
      "/health": "http://127.0.0.1:8000",
      "/ready": "http://127.0.0.1:8000",
      "/v1": "http://127.0.0.1:8000",
      "/projects": "http://127.0.0.1:8000",
      "/jobs": "http://127.0.0.1:8000",
      "/research": "http://127.0.0.1:8000",
      "/artifacts": "http://127.0.0.1:8000",
      "/structures": "http://127.0.0.1:8000",
      "/structures-havetosee": "http://127.0.0.1:8000",
    },
  },
});
