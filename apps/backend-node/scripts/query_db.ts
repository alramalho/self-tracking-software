#!/usr/bin/env tsx

import dotenv from "dotenv";
import path from "path";

type CliArgs = {
  query?: string;
  prod: boolean;
  help: boolean;
};

const BLOCKED_KEYWORDS = [
  "insert",
  "update",
  "delete",
  "truncate",
  "merge",
  "upsert",
  "create",
  "alter",
  "drop",
  "rename",
  "grant",
  "revoke",
  "vacuum",
  "analyze",
  "reindex",
  "refresh",
  "cluster",
  "copy",
  "call",
  "do",
  "execute",
  "prepare",
  "deallocate",
  "set",
  "reset",
  "commit",
  "rollback",
  "begin",
  "start",
  "transaction",
  "lock",
  "listen",
  "notify",
  "comment",
  "attach",
  "detach",
  "replace",
  "nextval",
  "setval",
];

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    prod: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--prod") {
      args.prod = true;
    } else if (arg === "--query" && argv[i + 1]) {
      args.query = argv[++i];
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg}`);
    }
  }

  return args;
}

function printUsage(): void {
  console.log(
    [
      "Usage:",
      '  pnpm query-db --query "SELECT * FROM users LIMIT 5"',
      '  pnpm query-db --prod --query "SELECT id, username FROM users LIMIT 5"',
      "",
      "Connection env vars:",
      "  DEV_DATABASE_URL   Used by default.",
      "  PROD_DATABASE_URL  Used with --prod.",
      "",
      "Safety:",
      "  Only SELECT, WITH, and EXPLAIN SELECT queries are allowed.",
      "  Obvious write/DDL/transaction keywords are blocked before execution.",
      "  Query execution runs inside a READ ONLY transaction.",
    ].join("\n")
  );
}

function loadEnv(prod: boolean): void {
  const backendRoot = path.resolve(__dirname, "..");

  dotenv.config({ path: path.join(backendRoot, ".env") });
  if (prod) {
    dotenv.config({ path: path.join(backendRoot, ".env.prod"), override: true });
  }
}

function getDatabaseUrl(prod: boolean): string {
  const databaseUrl = prod
    ? process.env.PROD_DATABASE_URL || process.env.DATABASE_URL
    : process.env.DEV_DATABASE_URL || process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      prod
        ? "PROD_DATABASE_URL is not set"
        : "DEV_DATABASE_URL is not set"
    );
  }

  return databaseUrl;
}

function stripTrailingSemicolon(query: string): string {
  return query.trim().replace(/;\s*$/, "").trim();
}

function assertReadOnlyQuery(query: string): string {
  const normalized = stripTrailingSemicolon(query);
  const lower = normalized.toLowerCase();

  if (!normalized) {
    throw new Error("Query is empty");
  }

  if (lower.includes(";")) {
    throw new Error("Multiple statements are not allowed");
  }

  const startsReadOnly =
    /^(select|with)\b/i.test(normalized) ||
    /^explain\s+(select|with)\b/i.test(normalized);

  if (!startsReadOnly) {
    throw new Error("Only SELECT, WITH, and EXPLAIN SELECT queries are allowed");
  }

  for (const keyword of BLOCKED_KEYWORDS) {
    const pattern = new RegExp(`\\b${keyword}\\b`, "i");
    if (pattern.test(normalized)) {
      throw new Error(`Blocked potentially unsafe SQL keyword: ${keyword}`);
    }
  }

  if (/\bselect\s+.+\s+into\b/i.test(normalized)) {
    throw new Error("SELECT INTO is blocked because it can create tables");
  }

  return normalized;
}

function serialize(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, serialize(child)])
    );
  }
  return value;
}

function unwrapModule<T extends Record<string, unknown>>(module: T): T {
  return (module.default && typeof module.default === "object"
    ? module.default
    : module) as T;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    return;
  }

  if (!args.query) {
    printUsage();
    process.exit(1);
  }

  loadEnv(args.prod);
  const databaseUrl = getDatabaseUrl(args.prod);
  process.env.DATABASE_URL = databaseUrl;

  const safeQuery = assertReadOnlyQuery(args.query);
  const prismaModule = unwrapModule(await import("@tsw/prisma"));
  const { PrismaClient } = prismaModule as typeof import("@tsw/prisma");
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '15s'");
      return tx.$queryRawUnsafe(safeQuery);
    });

    console.log(JSON.stringify(serialize(result), null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
