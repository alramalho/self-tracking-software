export { prisma } from "./client"; // browser-safe stub
export { prisma as serverPrisma } from "./server"; // server-only prisma instance
export * from "./generated/prisma"; // exports generated types from prisma
