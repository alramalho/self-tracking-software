#!/usr/bin/env tsx

import listEndpoints from "express-list-endpoints";
import * as fs from "fs";
import * as path from "path";

// Suppress console output during app import
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
};

// Disable console during import
console.log = console.error = console.warn = console.info = () => {};

async function getAllRoutes(simplify: boolean = false): Promise<string[]> {
  // Import the Express app
  const appModule = await import("../src/index.js");
  const app = appModule.default;

  // Use express-list-endpoints to get all routes
  const endpoints = listEndpoints(app);

  // Convert :param to {param} and flatten
  let routes = endpoints.map((endpoint: any) =>
    endpoint.path.replace(/:([^/]+)/g, "{$1}")
  );

  if (simplify) {
    // Simplify routes to just base path + {any}
    routes = routes.map((route: string) => {
      const segments = route.split('/');
      const basePath = segments[1]; // Get first segment after /
      
      // If route has parameters or multiple segments, simplify to /{basePath}/{any}
      if (segments.length > 2 || route.includes('{')) {
        return `/${basePath}/{any}`;
      }
      return route;
    });
  }

  return Array.from(new Set(routes)).sort();
}

// Main execution
async function main() {
  try {
    // Restore console for output
    Object.assign(console, originalConsole);

    // Check for --simplify flag
    const simplify = process.argv.includes('--simplify');
    
    console.log(`🔍 Extracting routes from Express.js backend-node${simplify ? ' (simplified)' : ''}...`);

    // Get all routes
    const routes = await getAllRoutes(simplify);
    console.log(`📊 Found ${routes.length} routes`);

    // Filter out excluded routes (FastAPI specific routes that don't apply to Express)
    const excludedRoutes = new Set([
      "/docs",
      "/openapi.json",
      "/docs/oauth2-redirect",
      "/redoc",
    ]);

    const filteredRoutes = routes.filter(
      (route: string) => !excludedRoutes.has(route)
    );

    // Write to allowed-routes.txt in the aws-infrastructure directory
    const scriptDir = __dirname;
    const outputPath = path.join(
      scriptDir,
      "..",
      "..",
      "..",
      "aws-infrastructure",
      "allowed-routes.txt"
    );

    const content =
      [
        "# This is a generated file, do not edit!",
        "# Generated from backend-node Express.js routes",
        "# Run: npm run update-routes (from backend-node directory)",
        "",
        ...filteredRoutes,
      ].join("\n") + "\n";

    fs.writeFileSync(outputPath, content, "utf8");

    console.log(
      `✅ Successfully wrote ${filteredRoutes.length} routes to ${outputPath}`
    );
    console.log("🎯 Sample routes:");
    filteredRoutes
      .slice(0, 8)
      .forEach((route: string) => console.log(`   ${route}`));
    if (filteredRoutes.length > 8) {
      console.log(`   ... and ${filteredRoutes.length - 8} more`);
    }

    console.log("\n💡 Next steps:");
    console.log(
      "   1. Review the generated routes in aws-infrastructure/allowed-routes.txt"
    );
    console.log("   2. Deploy your infrastructure to update the WAF rules");
  } catch (error) {
    // Restore console for error reporting
    Object.assign(console, originalConsole);
    console.error("❌ Error extracting routes:", error);
    process.exit(1);
  }
}

// Run the main function
main();
