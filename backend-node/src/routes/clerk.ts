import { Request, Response, Router } from "express";
import { Webhook } from "svix";
import { logger } from "../utils/logger";
import { prisma } from "../utils/prisma";

const router = Router();

const verifyWebhook = async (req: Request): Promise<boolean> => {
  const headers = req.headers;
  const payload = JSON.stringify(req.body);

  logger.info("Verifying svix webhook");

  // if (process.env.NODE_ENV === 'development') {
  //   return true;
  // }

  try {
    const webhook = new Webhook(process.env.SVIX_SECRET!);
    webhook.verify(payload, headers as any);
    logger.info("Webhook verified");
    return true;
  } catch (error) {
    logger.error(`Could not validate webhook signature. Error: ${error}`);
    throw new Error("Could not validate webhook signature");
  }
};

router.post("/webhook", async (req: Request, res: Response) => {
  try {
    await verifyWebhook(req);

    const payload = req.body;
    const eventType = payload.type;
    const data = payload.data;

    logger.info(`Received clerk webhook ${eventType}`);

    if (!eventType || !data) {
      return res.status(400).json({ error: "Missing event type or data" });
    }

    const userClerkId = data.id;

    if (eventType === "user.deleted") {
      const user = await prisma.user.findUnique({
        where: { clerkId: userClerkId },
      });

      if (user) {
        await prisma.user.update({
          where: { id: user.id },
          data: { deletedAt: new Date() },
        });
      }

      return res.json({
        status: "success",
        message: "User deleted successfully",
      });
    }

    // Process user data for create and update events
    const emailAddress = data.email_addresses[0].email_address;
    const firstName = data.first_name;
    const lastName = data.last_name;
    const username = data.username;
    let picture = null;

    if (data.external_accounts) {
      picture = data.profile_image_url;

      if (!picture) {
        picture = data.external_accounts[0]?.picture;
      }

      if (picture) {
        logger.info("Picture found!");
        picture = picture.replace(/"/g, "");
      } else {
        logger.info(`No picture found for user ${userClerkId}`);
      }
    } else {
      logger.info(`No external accounts found for user ${userClerkId}`);
    }

    const userData = {
      email: emailAddress,
      name: `${firstName} ${lastName}`,
      username: username?.toLowerCase() || emailAddress.split("@")[0],
      clerkId: userClerkId,
      picture,
    };

    if (eventType === "user.created") {
      const existingUser = await prisma.user.findUnique({
        where: { email: emailAddress },
      });

      if (existingUser) {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: userData,
        });
        logger.info(`User with email '${emailAddress}' updated.`);
      } else {
        logger.info(
          `User with email '${emailAddress}' not found. Creating new user.`
        );
        await prisma.user.create({
          data: userData,
        });
      }
      return res.json({
        status: "success",
        message: "User created successfully",
      });
    } else if (eventType === "user.updated") {
      const user = await prisma.user.findUnique({
        where: { clerkId: userClerkId },
      });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      await prisma.user.update({
        where: { id: user.id },
        data: userData,
      });
      return res.json({
        status: "success",
        message: "User updated successfully",
      });
    } else {
      const errorMsg = `Unhandled event type: ${eventType}`;
      logger.error(errorMsg);
      return res.status(400).json({ error: errorMsg });
    }
  } catch (error: any) {
    if (error.message === "Could not validate webhook signature") {
      return res
        .status(400)
        .json({ error: "Could not validate webhook signature" });
    }

    logger.error(`Clerk Webhook: ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
});

export const clerkRouter: Router = router;
export default clerkRouter;
