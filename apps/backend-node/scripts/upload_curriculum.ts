#!/usr/bin/env tsx

import dotenv from "dotenv";
import fs from "fs";
import path from "path";

type CliArgs = {
  username?: string;
  planGoal?: string;
  dir?: string;
  prod: boolean;
  delete: boolean;
  help: boolean;
};

const MAX_FILES = 100;
const MAX_FILE_BYTES = 200_000;

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { prod: false, delete: false, help: false };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--prod") {
      args.prod = true;
    } else if (arg === "--delete") {
      args.delete = true;
    } else if (arg === "--username" && argv[i + 1]) {
      args.username = argv[++i];
    } else if (arg === "--plan-goal" && argv[i + 1]) {
      args.planGoal = argv[++i];
    } else if (arg === "--dir" && argv[i + 1]) {
      args.dir = argv[++i];
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg}`);
    }
  }

  return args;
}

function printUsage(): void {
  console.log(
    [
      "Attach a folder of markdown files to a plan as its curriculum.",
      "Replace semantics: files no longer present in the folder are removed.",
      "",
      "Usage:",
      '  pnpm upload-curriculum --username alex --plan-goal "robotics" --dir ~/personal/learning',
      '  pnpm upload-curriculum --prod --username alex --plan-goal "robotics" --dir ~/personal/learning',
      '  pnpm upload-curriculum --prod --username alex --plan-goal "robotics" --delete',
      "",
      "Options:",
      "  --username    Owner username (exact match)",
      "  --plan-goal   Case-insensitive substring of the plan goal (must match exactly one active plan)",
      "  --dir         Folder to upload; *.md files, recursive, relative paths preserved",
      "  --delete      Remove the plan's curriculum instead of uploading",
      "  --prod        Use PROD_DATABASE_URL instead of DEV_DATABASE_URL",
    ].join("\n")
  );
}

function loadEnv(prod: boolean): void {
  const backendRoot = path.resolve(__dirname, "..");
  dotenv.config({ path: path.join(backendRoot, ".env") });
  if (prod) {
    dotenv.config({ path: path.join(backendRoot, ".env.prod"), override: true });
  }

  const databaseUrl = prod
    ? process.env.PROD_DATABASE_URL || process.env.DATABASE_URL
    : process.env.DEV_DATABASE_URL || process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      prod ? "PROD_DATABASE_URL is not set" : "DEV_DATABASE_URL is not set"
    );
  }
  process.env.DATABASE_URL = databaseUrl;
}

function collectMarkdownFiles(
  rootDir: string
): Array<{ path: string; content: string }> {
  const files: Array<{ path: string; content: string }> = [];

  function walk(currentDir: string) {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        const relativePath = path.relative(rootDir, fullPath);
        const content = fs.readFileSync(fullPath, "utf8");
        if (Buffer.byteLength(content, "utf8") > MAX_FILE_BYTES) {
          throw new Error(
            `${relativePath} exceeds ${MAX_FILE_BYTES} bytes; split it before uploading`
          );
        }
        files.push({ path: relativePath, content });
      }
    }
  }

  walk(rootDir);
  if (files.length === 0) throw new Error(`No .md files found in ${rootDir}`);
  if (files.length > MAX_FILES) {
    throw new Error(`${files.length} files exceed the ${MAX_FILES} file limit`);
  }
  return files;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || !args.username || !args.planGoal || (!args.dir && !args.delete)) {
    printUsage();
    process.exit(args.help ? 0 : 1);
  }

  loadEnv(args.prod);
  const { PrismaClient } = await import("@tsw/prisma");
  const prisma = new PrismaClient();

  try {
    const user = await prisma.user.findFirst({
      where: { username: args.username, deletedAt: null },
      select: { id: true, username: true },
    });
    if (!user) throw new Error(`User "${args.username}" not found`);

    const plans = await prisma.plan.findMany({
      where: {
        userId: user.id,
        deletedAt: null,
        archivedAt: null,
        goal: { contains: args.planGoal, mode: "insensitive" },
      },
      select: { id: true, goal: true },
    });
    if (plans.length === 0) {
      throw new Error(`No active plan matching "${args.planGoal}"`);
    }
    if (plans.length > 1) {
      throw new Error(
        `Ambiguous plan goal "${args.planGoal}", matches:\n${plans.map((p) => `  - ${p.goal}`).join("\n")}`
      );
    }
    const plan = plans[0];

    if (args.delete) {
      const deleted = await prisma.planCurriculumFile.deleteMany({
        where: { planId: plan.id },
      });
      console.log(`Removed ${deleted.count} curriculum files from "${plan.goal}"`);
      return;
    }

    const rootDir = path.resolve(args.dir!.replace(/^~/, process.env.HOME || "~"));
    const files = collectMarkdownFiles(rootDir);

    await prisma.$transaction([
      prisma.planCurriculumFile.deleteMany({
        where: { planId: plan.id, path: { notIn: files.map((f) => f.path) } },
      }),
      ...files.map((file) =>
        prisma.planCurriculumFile.upsert({
          where: { planId_path: { planId: plan.id, path: file.path } },
          create: { planId: plan.id, path: file.path, content: file.content },
          update: { content: file.content },
        })
      ),
    ]);

    console.log(
      `Attached ${files.length} files to "${plan.goal}" (${user.username}):`
    );
    for (const file of files) {
      console.log(`  - ${file.path} (${Buffer.byteLength(file.content, "utf8")} bytes)`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
