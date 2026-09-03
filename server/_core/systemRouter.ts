import { publicProcedure, router } from "./trpc";

export const systemRouter = router({
  health: publicProcedure.query(() => ({
    ok: true,
    service: "field-visits",
    timestamp: new Date().toISOString(),
  })),
});
