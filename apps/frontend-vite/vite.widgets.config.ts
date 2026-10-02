import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import path from "node:path";
const fixture = path.resolve(__dirname, "e2e/widgets/context-fixtures.ts");
export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: { entries: ["e2e/widgets/index.html"] },
  resolve: {
    alias: [
      { find: "@/contexts/metrics", replacement: fixture },
      { find: "@/contexts/users", replacement: fixture },
      { find: "@/contexts/theme/useTheme", replacement: fixture },
      { find: "@", replacement: path.resolve(__dirname, "src") },
    ],
  },
});
