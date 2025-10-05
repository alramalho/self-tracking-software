export { prisma } from "./client"; // browser-safe stub
export * from "./generated/prisma"; // exports generated types from prisma
export { prisma as serverPrisma } from "./server"; // server-only prisma instance
