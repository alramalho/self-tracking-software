import { User } from "@tsw/prisma";
import { AsyncLocalStorage } from "async_hooks";

interface RequestContext {
  user?: User;
  requestId?: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

export function getCurrentUser(): User | undefined {
  const context = requestContext.getStore();
  return context?.user;
}

export function getCurrentRequestId(): string | undefined {
  const context = requestContext.getStore();
  return context?.requestId;
}

export function setRequestContext(context: RequestContext): void {
  const store = requestContext.getStore();
  if (store) {
    Object.assign(store, context);
  }
}
