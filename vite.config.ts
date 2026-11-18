import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// The site lives at https://<user>.github.io/Ai-toll/, so every address
// (assets and page links) starts with /Ai-toll/. Change it if the repo is renamed.
export default defineConfig({
  base: "/Ai-toll/",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
})
