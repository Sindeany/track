import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { Request } from "express";
import { parse as parseCookie } from "cookie";
import { COOKIE_NAME } from "@shared/const";
import { getOrCreateDemoUser, getUserById, sanitizeUser, type SafeUser } from "../db";
import { verifySessionToken } from "./auth";

/**
 * Demo mode is opt-in for local development only and is strictly disabled in test and production.
 */
export function isDemoModeEnabled(): boolean {
  return process.env.NODE_ENV === "development" && process.env.DEMO_MODE_ENABLED === "true";
}

export const DEMO_MODE_ENABLED = isDemoModeEnabled();

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: SafeUser | null;
};

export async function authenticateRequest(req: Request): Promise<SafeUser | null> {
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    try {
      const cookies = parseCookie(cookieHeader);
      const sessionToken = cookies[COOKIE_NAME];
      const session = verifySessionToken(sessionToken);
      if (session?.userId) {
        const foundUser = await getUserById(session.userId);
        if (
          foundUser &&
          foundUser.isActive &&
          session.sv === (foundUser.sessionVersion ?? 0)
        ) {
          return sanitizeUser(foundUser);
        }
      }
    } catch {
      return null;
    }
  }

  if (isDemoModeEnabled()) {
    try {
      const requestedRole = req.headers["x-field-visits-demo-role"];
      const demoUser = await getOrCreateDemoUser(requestedRole === "admin" ? "admin" : "user");
      return sanitizeUser(demoUser);
    } catch {
      return null;
    }
  }

  return null;
}

export async function createContext(
  opts: CreateExpressContextOptions,
): Promise<TrpcContext> {
  const user = await authenticateRequest(opts.req);
  return { req: opts.req, res: opts.res, user };
}
