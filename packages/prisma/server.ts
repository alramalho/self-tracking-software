import type { PrismaClient as PrismaClientType } from "./generated/prisma";
import { PrismaClient } from "./generated/prisma";

const globalForPrisma = (typeof globalThis !== "undefined"
  ? globalThis
  : {}) as unknown as { prisma: PrismaClientType };

const prisma = globalForPrisma.prisma || new PrismaClient();

const nodeEnv =
  // @ts-ignore
  typeof process !== "undefined"
    ? // @ts-ignore
      process.env.NODE_ENV
    : undefined;

if (nodeEnv !== "production") {
  globalForPrisma.prisma = prisma;
}

// Export using both ESM and CommonJS for compatibility
export { prisma, PrismaClient };

// CommonJS compatibility - only if module exists (Node.js environment)
// @ts-ignore - module may not exist in browser/vite environments
if (typeof module !== "undefined" && module.exports) {
  // @ts-ignore
  module.exports = { prisma, PrismaClient };
}
