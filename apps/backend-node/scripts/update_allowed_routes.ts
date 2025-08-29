#!/usr/bin/env tsx

import * as fs from "fs";
import * as path from "path";

// Set environment variables to prevent database connection during route extraction
if (!process.env.DATABASE_URL)
  process.env.DATABASE_URL = "postgresql://dummy:dummy@dummy:5432/dummy";
if (!process.env.DIRECT_URL)
  process.env.DIRECT_URL = "postgresql://dummy:dummy@dummy:5432/dummy";

// Suppress console output during app import
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
};

// Disable console during import
console.log = console.error = console.warn = console.info = () => {};

/**
 * Extract routes from an Express Router recursively
 */
function extractRoutes(router: any, basePath = ""): string[] {
  const routes: string[] = [];

  if (!router.stack) {
    return routes;
  }

  for (const layer of router.stack) {
    if (layer.route) {
      // This is a route endpoint
      const path = basePath + layer.route.path;
      // Convert Express route parameters (:param) to AWS WAF format ({param})
      const awsPath = path.replace(/:([^/]+)/g, "{$1}");
      routes.push(awsPath);
    } else if (layer.name === "router" && layer.handle.stack) {
      // This is a sub-router
      const mountPath = layer.regexp.source
        .replace("^\\", "")
        .replace("\\/?(?=\\/|$)", "")
        .replace(/\\\//g, "/")
        .replace(/[^a-zA-Z0-9\-_/]/g, "");

      const subRoutes = extractRoutes(layer.handle, basePath + mountPath);
      routes.push(...subRoutes);
    }
  }

  return routes;
}

/**
 * Dynamically extract all routes from the Express application
 */
async function getAllRoutes(): Promise<string[]> {
  try {
    // Import the Express app
    const appModule = await import("../src/index.js");
    const app = appModule.default;

    if (!app || !app._router) {
      throw new Error("Could not access Express app router");
    }

    const routes: string[] = [];

    // Extract routes from the main router
    const extractedRoutes = extractRoutes(app._router);
    routes.push(...extractedRoutes);

    // Add any standalone routes that might be defined directly on the app
    // Health and exception endpoints are defined directly on app
    routes.push("/health");
    routes.push("/exception");

    return routes.sort();
  } catch (error) {
    console.error(
      "Failed to dynamically extract routes, falling back to static analysis"
    );

    // Fallback: analyze route files statically
    return await analyzeRouteFiles();
  }
}

/**
 * Fallback method: analyze route files statically
 */
async function analyzeRouteFiles(): Promise<string[]> {
  const routesDir = path.join(__dirname, "..", "src", "routes");
  const indexFile = path.join(__dirname, "..", "src", "index.ts");

  const routes: string[] = [];

  // Add standalone routes from index.ts
  routes.push("/health");
  routes.push("/exception");

  // Read index.ts to get route prefixes
  const indexContent = fs.readFileSync(indexFile, "utf8");
  const routePrefixes: { [key: string]: string } = {};

  // Extract app.use statements to get route prefixes
  const appUseRegex = /app\.use\(["']([^"']+)["'],\s*(\w+Router)\)/g;
  let match;
  while ((match = appUseRegex.exec(indexContent)) !== null) {
    const prefix = match[1];
    const routerName = match[2];
    routePrefixes[routerName] = prefix;
  }

  // Read all route files
  const routeFiles = fs.readdirSync(routesDir).filter((f) => f.endsWith(".ts"));

  for (const file of routeFiles) {
    const filePath = path.join(routesDir, file);
    const content = fs.readFileSync(filePath, "utf8");

    // Extract router name from export
    const exportMatch = content.match(/export.*?(\w+Router)/);
    const routerName = exportMatch?.[1];
    const prefix = routerName ? routePrefixes[routerName] || "" : "";

    // Extract route definitions
    const routeRegex =
      /router\.(get|post|put|delete|patch)\s*\(\s*["']([^"']+)["']/g;
    let routeMatch;
    while ((routeMatch = routeRegex.exec(content)) !== null) {
      const routePath = routeMatch[2];
      // Convert Express params to AWS WAF format
      const awsPath = (prefix + routePath).replace(/:([^/]+)/g, "{$1}");
      routes.push(awsPath);
    }
  }

  return routes.sort();
}

// Main execution
async function main() {
  try {
    // Restore console for output
    Object.assign(console, originalConsole);

    console.log("🔍 Extracting routes from Express.js backend-node...");

    // Get all routes
    const routes = await getAllRoutes();
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
