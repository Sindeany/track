import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(express.static(distPath, {
    setHeaders(res, filePath) {
      if (filePath.endsWith(`${path.sep}sw.js`) || filePath.endsWith(`${path.sep}index.html`)) {
        res.setHeader("Cache-Control", "no-cache");
      }
    },
  }));

  // fall through to index.html for page navigations, but 404 for missing assets
  app.use("*", (req, res) => {
    const reqPath = req.originalUrl || req.url || "";
    if (
      reqPath.startsWith("/assets/") ||
      reqPath.startsWith("/api/") ||
      reqPath.match(/\.(js|css|json|png|jpg|jpeg|svg|webp|ico|woff|woff2)$/i)
    ) {
      return res.status(404).type("text/plain").send("Not Found");
    }
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
