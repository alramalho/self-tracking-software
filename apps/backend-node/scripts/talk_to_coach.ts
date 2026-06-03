#!/usr/bin/env tsx

import dotenv from "dotenv";
import chalk from "chalk";
import { createRequire } from "module";
import path from "path";

// Prisma reads DATABASE_URL when its module is loaded. Use require after CLI env
// selection so --prod/DEV_DATABASE_URL/PROD_DATABASE_URL are applied first.
const requireFromScript = createRequire(__filename);

type CliArgs = {
  user?: string;
  message?: string;
  prod: boolean;
  history: number;
  help: boolean;
};

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    prod: false,
    history: 0,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--prod") {
      args.prod = true;
    } else if (arg === "--user" && argv[i + 1]) {
      args.user = argv[++i];
    } else if (arg === "--message" && argv[i + 1]) {
      args.message = argv[++i];
    } else if (arg === "--history" && argv[i + 1]) {
      const history = Number.parseInt(argv[++i], 10);
      args.history = Number.isFinite(history) && history > 0 ? history : 0;
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
      '  pnpm talk-to-coach --user alex --message "how many videos are in this playlist?"',
      '  pnpm talk-to-coach --prod --user alex --message "what are the modules here https://..."',
      "",
      "Options:",
      "  --user <username|email|id>  User to test as.",
      "  --message <text>           Message to send to the coach.",
      "  --prod                     Load .env, then override with .env.prod.",
      "  --history <n>              Include the latest n coach chat messages. Default: 0.",
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

function formatElapsedSeconds(startedAt: bigint): string {
  const elapsedSeconds =
    Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
  return `${elapsedSeconds.toFixed(elapsedSeconds < 10 ? 2 : 1)}s`;
}

function printMutedJsonSection(title: string, value: unknown): void {
  console.log(chalk.dim(`\n${title}:`));
  console.log(chalk.dim(JSON.stringify(value, null, 2)));
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    return;
  }

  if (!args.user || !args.message) {
    printUsage();
    process.exit(1);
  }

  loadEnv(args.prod);
  process.env.DATABASE_URL = getDatabaseUrl(args.prod);

  const { prisma } = requireFromScript("../src/utils/prisma") as typeof import("../src/utils/prisma");

  const user = await prisma.user.findFirst({
    where: {
      deletedAt: null,
      OR: [
        { username: args.user },
        { email: args.user },
        { id: args.user },
      ],
    },
  });

  if (!user) {
    console.error(`User not found: ${args.user}`);
    await prisma.$disconnect();
    process.exit(1);
  }

  if (user.planType === "FREE") {
    console.log("no coach");
    await prisma.$disconnect();
    return;
  }

  const { coachAgentService } = requireFromScript(
    "../src/services/coachAgentService"
  ) as typeof import("../src/services/coachAgentService");
  const { requestContext } = requireFromScript(
    "../src/utils/requestContext"
  ) as typeof import("../src/utils/requestContext");

  const now = new Date();

  const [plans, reminders, history] = await Promise.all([
    prisma.plan.findMany({
      where: {
        userId: user.id,
        deletedAt: null,
        archivedAt: null,
        isPaused: false,
        OR: [{ finishingDate: null }, { finishingDate: { gt: now } }],
      },
      include: {
        activities: true,
        sessions: true,
        milestones: true,
      },
      orderBy: [{ createdAt: "desc" }],
    }),
    prisma.reminder.findMany({
      where: {
        userId: user.id,
        status: "PENDING",
      },
      orderBy: { triggerAt: "asc" },
    }),
    args.history > 0
      ? prisma.message.findMany({
          where: {
            chat: {
              userId: user.id,
              type: "COACH",
            },
          },
          orderBy: { createdAt: "desc" },
          take: args.history,
        })
      : Promise.resolve([]),
  ]);

  const conversationHistory = history
    .reverse()
    .map((message) => ({
      role: message.role === "USER" ? "user" as const : "assistant" as const,
      content: message.content,
    }));

  console.log(
    chalk.dim(
      [
        `Environment: ${args.prod ? "prod" : "dev"}`,
        `User: ${user.username || user.email} (${user.id})`,
        `Plan type: ${user.planType}`,
        `Active plans: ${plans.length}`,
        `History messages: ${conversationHistory.length}`,
        "",
      ].join("\n")
    )
  );
  console.log(`${chalk.cyan("User message:")} ${chalk.white(args.message)}`);
  console.log(chalk.dim("\nCoach response:"));

  const responseStartedAt = process.hrtime.bigint();
  const response = await requestContext.run({ user }, () =>
    coachAgentService.generateResponse({
      user,
      message: args.message!,
      conversationHistory,
      plans,
      reminders,
      memoriesContext: null,
    })
  );
  const responseTime = formatElapsedSeconds(responseStartedAt);

  console.log(chalk.dim(`Responded in ${responseTime}`));

  for (let i = 0; i < response.draftMessages.length; i++) {
    const draft = response.draftMessages[i];
    console.log(`\n${chalk.cyan(`[${i + 1}]`)} ${chalk.white(draft.content)}`);

    if (draft.toolCalls?.length) {
      printMutedJsonSection("Tool calls", draft.toolCalls);
    }

    if (draft.planProposals?.length) {
      printMutedJsonSection("Plan proposals", draft.planProposals);
    }

    if (draft.planCreationProposals?.length) {
      printMutedJsonSection(
        "Plan creation proposals",
        draft.planCreationProposals
      );
    }

    if (draft.activityLogProposals?.length) {
      printMutedJsonSection("Activity log proposals", draft.activityLogProposals);
    }
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
