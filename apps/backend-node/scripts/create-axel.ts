#!/usr/bin/env tsx
// One-off: creates the "axel" test account (Clerk user + DB row) with an inverted copy of alex's photo.
// Dry run by default. Pass --apply to write to production.
//   pnpm exec tsx scripts/create-axel.ts --image /path/to/axel.png [--apply]
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.prod") });

const EMAIL = "alexandre.ramalho.1998+axel@gmail.com";
const apply = process.argv.includes("--apply");
const imageArg = process.argv[process.argv.indexOf("--image") + 1];

async function main() {
  if (!imageArg || !fs.existsSync(imageArg))
    throw new Error("Pass --image <path to the inverted PNG>");
  // Dynamic imports so DATABASE_URL and the Clerk key are set before they load.
  const { createClerkClient } = await import("@clerk/express");
  const prismaModule: any = await import("../src/utils/prisma");
  const prisma = (prismaModule.prisma ?? prismaModule.default.prisma) as typeof import("../src/utils/prisma").prisma;
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

  // Prod's schema can lag the local Prisma client, so only ever select the columns needed.
  const pick = { id: true, picture: true, timezone: true } as const;
  const alex = await prisma.user.findUnique({
    where: { username: "alex" },
    select: pick,
  });
  if (!alex) throw new Error("alex not found");
  const existing = await clerk.users.getUserList({ emailAddress: [EMAIL] });
  console.log(`database: ${new URL(process.env.DATABASE_URL!).host}`);
  console.log(`alex: ${alex.id} (timezone ${alex.timezone})`);
  console.log(
    existing.data[0]
      ? `axel already exists in Clerk: ${existing.data[0].id}`
      : "axel does not exist in Clerk yet"
  );
  if (!apply) return console.log("dry run: nothing written (use --apply)");

  let clerkUser = existing.data[0];
  if (!clerkUser) {
    const base = {
      emailAddress: [EMAIL],
      firstName: "Axel",
      skipPasswordRequirement: true,
    };
    try {
      clerkUser = await clerk.users.createUser({ ...base, username: "axel" });
    } catch (error) {
      console.warn("Clerk refused a username, creating without one:", error);
      clerkUser = await clerk.users.createUser(base);
    }
    console.log(`created Clerk user ${clerkUser.id}`);
  }
  const buffer = fs.readFileSync(imageArg);
  clerkUser = await clerk.users.updateUserProfileImage(clerkUser.id, {
    file: new Blob([buffer], { type: "image/png" }),
  });

  // The Clerk webhook normally creates the row; give it a moment, then fall back.
  let user = null;
  for (let attempt = 0; attempt < 10 && !user; attempt++) {
    user = await prisma.user.findFirst({
      where: { OR: [{ clerkId: clerkUser.id }, { email: EMAIL }] },
      select: pick,
    });
    if (!user) await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  const data = {
    clerkId: clerkUser.id,
    email: EMAIL,
    name: "Axel",
    username: "axel",
    picture: clerkUser.imageUrl,
    timezone: alex.timezone,
    onboardingCompletedAt: new Date(),
  };
  user = user
    ? await prisma.user.update({ where: { id: user.id }, data, select: pick })
    : await prisma.user.create({ data, select: pick });
  console.log(`axel ready: db ${user.id}, clerk ${clerkUser.id}`);
  console.log(`photo: ${user.picture}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => process.exit());
