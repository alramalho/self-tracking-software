// Serves e2e/coach: the real web components with stand-in data, for screenshots without signing in.
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import path from "node:path";
const fixture = path.resolve(__dirname, "e2e/coach/contexts.ts");
export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: { entries: ["e2e/coach/index.html"] },
  resolve: {
    alias: [
      { find: /^@\/api$/, replacement: fixture },
      { find: /^@\/contexts\/plans$/, replacement: fixture },
      { find: /^@\/contexts\/activities\/useActivities$/, replacement: fixture },
      { find: /^@\/contexts\/metrics$/, replacement: fixture },
      { find: /^@\/contexts\/users$/, replacement: fixture },
      { find: /^@\/contexts\/theme\/useTheme$/, replacement: fixture },
      { find: /^@\/hooks\/useNotifications$/, replacement: fixture },
      { find: /^@\/contexts\/upgrade\/useUpgrade$/, replacement: fixture },
      { find: "@", replacement: path.resolve(__dirname, "src") },
    ],
  },
});
