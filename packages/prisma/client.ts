import type { PrismaClient as PrismaClientType } from "./generated/prisma";

let prisma: PrismaClientType;

// Browser stub
if (typeof window !== "undefined") {
  const throwBrowserError = () => {
    throw new Error(
      "Prisma Client cannot be used in the browser. API calls should be made through your backend."
    );
  };
  prisma = new Proxy(
    {},
    {
      get: () => throwBrowserError,
    }
  ) as any;
} else {
  // Server-side code - dynamic import to avoid bundling in browser
  // @ts-ignore - require only runs in Node.js environment
  const { PrismaClient } = require("./generated/prisma");

  const globalForPrisma = (typeof globalThis !== "undefined"
    ? globalThis
    : {}) as unknown as { prisma: PrismaClientType };

  prisma = globalForPrisma.prisma || new PrismaClient();

  // @ts-ignore - process only exists in Node.js environment
  const nodeEnv =
    // @ts-ignore
    typeof process !== "undefined"
      ? // @ts-ignore
        process.env.NODE_ENV
      : import.meta.env.MODE;

  if (nodeEnv !== "production") globalForPrisma.prisma = prisma;
}

export { prisma };
