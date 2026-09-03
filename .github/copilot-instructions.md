# GitHub Copilot instructions

- Keep the application RTL and Arabic-first.
- Do not store image bytes in MySQL; store metadata and keep bytes in `UPLOAD_DIR` or an S3-compatible private bucket.
- Never commit `.env`, credentials, production URLs, customer data, or uploaded images.
- Keep manager-only procedures protected by `adminProcedure` and never rely only on frontend route guards.
- Store timestamps in UTC and convert them for display.
- Keep camera capture restricted to `getUserMedia`; do not add a gallery/file-picker fallback without an explicit product decision.
- Add or update Vitest coverage for every server procedure and important camera/report flow.
- Before production, replace the demo context in `server/_core/context.ts` with a real auth provider and add CSRF/rate-limit policy appropriate to the chosen deployment.
