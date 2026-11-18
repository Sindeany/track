import { hashPassword } from "../server/_core/auth";
import { getDb, closeDb } from "../server/db";
import { users } from "../drizzle/schema";
import { eq, sql } from "drizzle-orm";

async function main() {
  const newPassword = process.argv[2] || process.env.INITIAL_ADMIN_PASSWORD;
  if (!newPassword || newPassword.trim().length < 8) {
    console.error("[Error] Please provide a new password with at least 8 characters.");
    console.error("Usage: node dist/reset-admin.js <new-password>");
    process.exit(1);
  }

  const db = await getDb();
  if (!db) {
    console.error("[Error] Cannot connect to database.");
    process.exit(1);
  }

  const passwordHash = hashPassword(newPassword.trim());

  await db
    .update(users)
    .set({
      passwordHash,
      sessionVersion: sql`${users.sessionVersion} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(users.openId, "admin"));

  console.log(`[Success] Password for administrator (admin) has been reset successfully to: ${newPassword.trim()}`);
  await closeDb();
  process.exit(0);
}

main().catch(err => {
  console.error("[Error] Failed to reset administrator password:", err);
  process.exit(1);
});
