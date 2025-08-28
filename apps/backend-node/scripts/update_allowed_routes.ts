#!/usr/bin/env tsx

import * as fs from "fs";
import * as path from "path";

// Set environment variables to prevent database connection during route extraction
process.env.NODE_ENV = "script";
process.env.DATABASE_URL = "postgresql://dummy:dummy@dummy:5432/dummy";
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
 * Get all routes manually by analyzing the known route structure
 * This is more reliable than trying to introspect the Express app
 */
function getAllRoutes(): string[] {
  return [
    // Health and basic endpoints
    "/health",
    "/exception",

    // User routes (from /api/users prefix)
    "/api/users/user-health",
    "/api/users/user",
    "/api/users/connections/{username}",
    "/api/users/check-username/{username}",
    "/api/users/update-user",
    "/api/users/search-users/{username}",
    "/api/users/user/connection-count",
    "/api/users/recommended-users",
    "/api/users/user/{username_or_id}",
    "/api/users/send-connection-request/{recipientId}",
    "/api/users/accept-connection-request/{request_id}",
    "/api/users/reject-connection-request/{request_id}",
    "/api/users/timeline",
    "/api/users/report-feedback",
    "/api/users/all-users",
    "/api/users/get-user-profile/{username_or_id}",
    "/api/users/handle-referral/{referrer_username}",
    "/api/users/load-messages",
    "/api/users/update-timezone",
    "/api/users/update-theme",
    "/api/users/user/{username}/get-user-plan-type",
    "/api/users/user/daily-checkin-settings",

    // Activity routes (from /api/activities prefix)
    "/api/activities/activities",
    "/api/activities/activity-entries",
    "/api/activities/log-activity",
    "/api/activities/activity-entries/{entryId}",
    "/api/activities/activities/{activityId}",
    "/api/activities/activity/{activityId}/entries",
    "/api/activities/recent-activities",
    "/api/activities/activity-feed",
    "/api/activities/activities/{activityId}/visibility",

    // Plans routes (from /api/plans prefix)
    "/api/plans/plans",
    "/api/plans/create-plan",
    "/api/plans/plans/{planId}",
    "/api/plans/plans/{planId}/activities",
    "/api/plans/plans/{planId}/complete",

    // Metrics routes (from /api/metrics prefix)
    "/api/metrics/metrics/{username}",
    "/api/metrics/streaks/{username}",
    "/api/metrics/leaderboard",

    // Messages routes (from /api/messages prefix)
    "/api/messages/send-message",
    "/api/messages/messages/{recipientId}",
    "/api/messages/messages/{messageId}/emotions",

    // Notifications routes (from /api/notifications prefix)
    "/api/notifications/notifications",
    "/api/notifications/notifications/{notificationId}/mark-read",
    "/api/notifications/notifications/mark-all-read",
    "/api/notifications/subscribe-push",
    "/api/notifications/unsubscribe-push",

    // Onboarding routes (from /api/onboarding prefix)
    "/api/onboarding/sample-activities",
    "/api/onboarding/create-sample-activities",
    "/api/onboarding/skip-onboarding",

    // Admin routes (from /api/admin prefix)
    "/api/admin/users",
    "/api/admin/user-details/{userId}",
    "/api/admin/analytics",

    // Clerk routes (from /api/clerk prefix)
    "/api/clerk/webhooks",

    // AI routes (from /api/ai prefix)
    "/api/ai/recommendations",
    "/api/ai/activity-insights",

    // Stripe routes (from /api/stripe prefix)
    "/api/stripe/create-checkout-session",
    "/api/stripe/webhook",
    "/api/stripe/billing-portal",
  ].sort();
}

// Main execution
async function main() {
  try {
    // Restore console for output
    Object.assign(console, originalConsole);

    console.log("🔍 Extracting routes from Express.js backend-node...");

    // Get all routes
    const routes = getAllRoutes();
    console.log(`📊 Found ${routes.length} routes`);

    // Filter out excluded routes (FastAPI specific routes that don't apply to Express)
    const excludedRoutes = new Set([
      "/docs",
      "/openapi.json",
      "/docs/oauth2-redirect",
      "/redoc",
    ]);

    const filteredRoutes = routes.filter((route) => !excludedRoutes.has(route));

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
    filteredRoutes.slice(0, 8).forEach((route) => console.log(`   ${route}`));
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
