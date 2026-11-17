import { pingDb } from "../db";
import { publicProcedure, router } from "./trpc";

export const systemRouter = router({
  health: publicProcedure.query(async () => {
    const dbConnected = await pingDb();
    return {
      ok: dbConnected,
      db: dbConnected ? "connected" : "disconnected",
      service: "field-visits",
      timestamp: new Date().toISOString(),
    };
  }),
});
