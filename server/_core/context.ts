import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { parse as parseCookie } from "cookie";
import { COOKIE_NAME } from "@shared/const";
import type { User } from "../../drizzle/schema";
import { getOrCreateDemoUser, getUserById } from "../db";
import { verifySessionToken } from "./auth";

/**
 * The portable export starts in demo mode so it can be evaluated locally.
 * Set DEMO_MODE_ENABLED=false before production.
 */
export const DEMO_MODE_ENABLED = process.env.DEMO_MODE_ENABLED !== "false";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions,
): Promise<TrpcContext> {
  let user: User | null = null;

  const cookieHeader = opts.req.headers.cookie;
  if (cookieHeader) {
    try {
      const cookies = parseCookie(cookieHeader);
      const sessionToken = cookies[COOKIE_NAME];
      const session = verifySessionToken(sessionToken);
      if (session?.userId) {
        const foundUser = await getUserById(session.userId);
        if (foundUser && foundUser.isActive) {
          user = foundUser;
        }
      }
    } catch {
      user = null;
    }
  }

  if (!user && DEMO_MODE_ENABLED) {
    try {
      const requestedRole = opts.req.headers["x-field-visits-demo-role"];
      user = await getOrCreateDemoUser(requestedRole === "admin" ? "admin" : "user");
    } catch {
      user = null;
    }
  }

  return { req: opts.req, res: opts.res, user };
}
