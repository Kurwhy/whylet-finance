import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
    plugins: [react(), tailwindcss()], envDir: false,
    define: { "import.meta.env.VITE_API_URL": JSON.stringify("/api/v1"), "import.meta.env.VITE_GOOGLE_CLIENT_ID": JSON.stringify("") },
    server: { host: "127.0.0.1", port: 5174, strictPort: true, proxy: { "/api": { target: "http://127.0.0.1:5002", changeOrigin: false } } }
});
