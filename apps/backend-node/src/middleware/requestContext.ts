import { NextFunction, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { requestContext } from "../utils/requestContext";
import { AuthenticatedRequest } from "./auth";

export function requestContextMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  // The user might not be available yet if auth middleware hasn't run
  // We'll update the context later when user info becomes available
  const context = {
    userId: req.user?.id,
    requestId: uuidv4(),
  };

  requestContext.run(context, () => {
    // Add a method to update the context when user becomes available
    // res.locals.setUserId = (userId: string) => {
    //   const store = requestContext.getStore();
    //   if (store) {
    //     store.userId = userId;
    //   }
    // };
    next();
  });
}
