import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import { deleteClient, listClients, searchClients, updateClient } from "../db";

export const clientsRouter = router({
  search: protectedProcedure
    .input(z.object({ query: z.string().default("") }))
    .query(async ({ input }) => {
      return searchClients(input.query);
    }),

  list: protectedProcedure.query(async () => {
    return listClients();
  }),

  update: adminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        name: z.string().trim().min(2, "اسم العميل يجب ألا يقل عن حرفين.").max(180).optional(),
        address: z.string().trim().min(3, "العنوان مطلوب.").max(3000).optional(),
        contactPerson: z.string().trim().min(2).max(180).nullable().optional(),
        contactRole: z.string().trim().min(2).max(180).nullable().optional(),
        phone: z.string().trim().min(6, "رقم الهاتف غير صالح.").max(32).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const updated = await updateClient(input.id, input);
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "العميل غير موجود." });
      }
      return updated;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      await deleteClient(input.id);
      return { success: true };
    }),
});
