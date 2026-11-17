import "dotenv/config";
import express from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";
import helmet from "helmet";
import { createServer } from "node:http";
import net from "node:net";
import path from "node:path";
import fs from "node:fs/promises";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { closeDb, pingDb } from "../db";
import { appRouter } from "../routers";
import { authenticateRequest, createContext } from "./context";
import { ENV, validateProductionConfig } from "./env";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const probe = net.createServer();
    probe.once("error", () => resolve(false));
    probe.listen(port, () => probe.close(() => resolve(true)));
  });
}

async function findAvailablePort(startPort: number) {
  for (let port = startPort; port < startPort + 20; port += 1) {
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

export async function resolveListenPort(preferredPort: number, isProduction: boolean): Promise<number> {
  if (!Number.isInteger(preferredPort) || preferredPort <= 0 || preferredPort > 65535) {
    throw new Error(`[Config] PORT must be a valid TCP port. Received ${preferredPort}.`);
  }
  if (isProduction) {
    if (!(await isPortAvailable(preferredPort))) {
      throw new Error(`[Config] Port ${preferredPort} is already in use.`);
    }
    return preferredPort;
  }
  return findAvailablePort(preferredPort);
}

function clientKey(req: Request): string {
  if (ENV.trustProxy) {
    const cloudflareIp = req.headers["cf-connecting-ip"];
    if (typeof cloudflareIp === "string" && net.isIP(cloudflareIp.trim())) {
      return ipKeyGenerator(cloudflareIp.trim());
    }
  }
  return ipKeyGenerator(req.ip ?? "0.0.0.0");
}

export async function createApp() {
  const app = express();
  if (ENV.trustProxy) app.set("trust proxy", 1);

  const uploadDir = path.resolve(process.env.UPLOAD_DIR || "uploads");
  await fs.mkdir(uploadDir, { recursive: true });

  app.use(
    helmet({
      frameguard: { action: "deny" },
      contentSecurityPolicy: ENV.isProduction
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
              fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
              imgSrc: ["'self'", "data:", "blob:"],
              connectSrc: ["'self'"],
              mediaSrc: ["'self'", "blob:"],
              objectSrc: ["'none'"],
              baseUri: ["'self'"],
              frameAncestors: ["'none'"],
            },
          }
        : false,
    }),
  );

  const anonymousLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: clientKey,
    skip: req =>
      process.env.NODE_ENV !== "production" ||
      req.method === "GET" ||
      req.path === "/api/health" ||
      req.path.startsWith("/api/trpc") ||
      req.path.startsWith("/uploads"),
    message: { error: "تم تجاوز الحد المسموح للطلبات. يرجى المحاولة بعد قليل." },
  });

  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 180,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: clientKey,
    message: { error: "تم تجاوز الحد المسموح للطلبات. يرجى المحاولة بعد قليل." },
  });

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: clientKey,
    skip: req => !req.path.includes("auth.login"),
    message: { error: "تم تجاوز محاولات تسجيل الدخول المسموحة. يرجى الانتظار 15 دقيقة." },
  });

  app.use(anonymousLimiter);

  app.get("/api/health", async (_req, res) => {
    const dbConnected = await pingDb();
    res.status(dbConnected ? 200 : 503).json({
      ok: dbConnected,
      db: dbConnected ? "connected" : "disconnected",
      service: "field-visits",
      timestamp: new Date().toISOString(),
    });
  });

  app.use("/uploads", apiLimiter);
  const staticUploads = express.static(uploadDir, { maxAge: "1d", index: false });
  app.use("/uploads", async (req, res, next) => {
    const user = await authenticateRequest(req);
    if (!user) {
      return res.status(401).json({ error: "يجب تسجيل الدخول للوصول إلى المرفقات." });
    }

    const cleanRelPath = req.path.replace(/\\/g, "/").replace(/^\/+/, "");
    if (!cleanRelPath || cleanRelPath.includes("..")) {
      return res.status(400).json({ error: "مسار الملف غير صالح." });
    }

    const match = /^visit-photos\/(\d+)\//.exec(cleanRelPath);
    if (match) {
      const ownerId = Number(match[1]);
      if (user.role !== "admin" && user.id !== ownerId) {
        return res.status(403).json({ error: "غير مصرح لك بالوصول إلى هذا المرفق." });
      }
    } else if (user.role !== "admin") {
      return res.status(403).json({ error: "غير مصرح لك بالوصول إلى هذا المرفق." });
    }

    return staticUploads(req, res, next);
  });

  app.use("/api/trpc", apiLimiter, loginLimiter);
  app.use("/api/trpc", express.json({ limit: "25mb" }));
  app.use(
    "/api/trpc",
    createExpressMiddleware({ router: appRouter, createContext }),
  );

  return app;
}

async function startServer() {
  validateProductionConfig();

  const app = await createApp();
  const server = createServer(app);

  try {
    const { ensureInitialAdmin } = await import("../db");
    const admin = await ensureInitialAdmin();
    if (admin) {
      console.log(`[Auth] Initial administrator ready: ${admin.openId}`);
    }
  } catch (error) {
    console.warn("[Auth] Could not ensure initial administrator on start:", error);
    if (ENV.isProduction) throw error;
  }

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = Number(process.env.PORT || 3000);
  const port = await resolveListenPort(preferredPort, ENV.isProduction);
  server.listen(port, () => {
    console.log(`Application running on port ${port}`);
  });

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[Server] Received ${signal}, shutting down gracefully...`);

    const forceTimer = setTimeout(() => {
      console.error("[Server] Forced exit after graceful shutdown timeout.");
      process.exit(1);
    }, 10_000);
    forceTimer.unref();

    server.close(async () => {
      await closeDb();
      console.log("[Server] Closed HTTP server and database pool.");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

if (process.env.NODE_ENV !== "test") {
  startServer().catch(error => {
    console.error("Failed to start application", error);
    process.exitCode = 1;
  });
}
