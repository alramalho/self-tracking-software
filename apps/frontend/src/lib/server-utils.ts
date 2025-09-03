import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

export async function validateUser() {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    throw new Error("User not authenticated");
  }
  const user = await prisma.user.findUnique({
    where: { clerkId },
  });
  const userId = user?.id;
  if (!userId) {
    throw new Error("User not authenticated");
  }
  return user;
}