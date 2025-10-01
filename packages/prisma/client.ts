import type { PrismaClient as PrismaClientType } from "./generated/prisma";

// Browser-only stub that throws errors when Prisma is accessed
const throwBrowserError = () => {
  throw new Error(
    "Prisma Client cannot be used in the browser. API calls should be made through your backend."
  );
};

export const prisma = new Proxy(
  {},
  {
    get: () => throwBrowserError,
  }
) as PrismaClientType;
