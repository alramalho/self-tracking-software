import type { PrismaClient as PrismaClientType } from "./generated/prisma";
import { PrismaClient } from "./generated/prisma";

const globalForPrisma = (typeof globalThis !== "undefined"
  ? globalThis
  : {}) as unknown as { prisma: PrismaClientType };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Re-export PrismaClient class for scripts that need to create custom instances
export { PrismaClient };
