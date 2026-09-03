import "dotenv/config";
import express from "express";
import { createServer } from "node:http";
import net from "node:net";
import path from "node:path";
import fs from "node:fs/promises";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
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

async function startServer() {
  const app = express();
  const server = createServer(app);
  const uploadDir = path.resolve(process.env.UPLOAD_DIR || "uploads");
  await fs.mkdir(uploadDir, { recursive: true });

  try {
    const { ensureInitialAdmin } = await import("../db");
    const admin = await ensureInitialAdmin();
    if (admin) {
      console.log(`[Auth] Initial administrator ready: ${admin.openId}`);
    }
  } catch (error) {
    console.warn("[Auth] Could not ensure initial administrator on start:", error);
  }

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.use("/uploads", express.static(uploadDir, { maxAge: "1d", index: false }));
  app.use(
    "/api/trpc",
    createExpressMiddleware({ router: appRouter, createContext }),
  );

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = Number(process.env.PORT || 3000);
  const port = await findAvailablePort(preferredPort);
  server.listen(port, () => {
    console.log(`Application running on port ${port}`);
  });
}

startServer().catch(error => {
  console.error("Failed to start application", error);
  process.exitCode = 1;
});
