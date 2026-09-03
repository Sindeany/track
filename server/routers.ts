import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createSessionToken, hashPassword, verifyPassword } from "./_core/auth";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { createUserWithPassword, getUserById, getUserByLogin, getUserByOpenId, listRepresentatives, listStaffWithKPIs, resetStaffPassword, updateStaffUser, updateUserLastSignedIn } from "./db";
import { visitsRouter } from "./routers/visits";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    login: publicProcedure
      .input(
        z.object({
          login: z.string().trim().min(1, "أدخل اسم المستخدم أو البريد الإلكتروني."),
          password: z.string().min(1, "أدخل كلمة المرور."),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const user = await getUserByLogin(input.login);
        if (!user || !user.passwordHash || !verifyPassword(input.password, user.passwordHash)) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "اسم المستخدم أو كلمة المرور غير صحيحة.",
          });
        }

        if (user.isActive === false) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "تم تجميد هذا الحساب من قبل الإدارة. يرجى مراجعة المسؤول.",
          });
        }

        await updateUserLastSignedIn(user.id);
        const token = createSessionToken({ userId: user.id, role: user.role });
        const cookieOptions = getSessionCookieOptions(ctx.req);

        ctx.res.cookie(COOKIE_NAME, token, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        });

        return {
          success: true as const,
          user: {
            id: user.id,
            openId: user.openId,
            name: user.name,
            email: user.email,
            role: user.role,
          },
        };
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    createUser: adminProcedure
      .input(
        z.object({
          openId: z.string().trim().min(3, "اسم المستخدم يجب ألا يقل عن 3 أحرف.").max(64),
          name: z.string().trim().min(2, "اسم الموظف مطلوب.").max(180),
          email: z.string().trim().email("صيغة البريد الإلكتروني غير صحيحة.").nullable().optional(),
          password: z.string().min(6, "كلمة المرور يجب ألا تقل عن 6 خانات."),
          role: z.enum(["user", "admin"]).default("user"),
        }),
      )
      .mutation(async ({ input }) => {
        const existing = await getUserByOpenId(input.openId.toLowerCase());
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "اسم المستخدم مسجل مسبقًا.",
          });
        }

        const passwordHash = hashPassword(input.password);
        const user = await createUserWithPassword({
          openId: input.openId,
          name: input.name,
          email: input.email,
          passwordHash,
          role: input.role,
        });

        return {
          id: user.id,
          openId: user.openId,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      }),
    listUsers: adminProcedure.query(async () => {
      return listRepresentatives();
    }),
    listStaffKPIs: adminProcedure.query(async () => {
      return listStaffWithKPIs();
    }),
    updateUser: adminProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          name: z.string().trim().min(2, "اسم الموظف مطلوب.").max(180).optional(),
          email: z.string().trim().email("صيغة البريد الإلكتروني غير صحيحة.").nullable().optional(),
          isActive: z.boolean().optional(),
          role: z.enum(["user", "admin"]).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        if (input.id === ctx.user.id && input.isActive === false) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "لا يمكنك تجميد حسابك الحالي لتجنب إقفال لوحة التحكم.",
          });
        }
        const updated = await updateStaffUser(input.id, {
          name: input.name,
          email: input.email,
          isActive: input.isActive,
          role: input.role,
        });
        if (!updated) {
          throw new TRPCError({ code: "NOT_FOUND", message: "المستخدم غير موجود." });
        }
        return {
          id: updated.id,
          openId: updated.openId,
          name: updated.name,
          email: updated.email,
          role: updated.role,
          isActive: updated.isActive,
        };
      }),
    resetPassword: adminProcedure
      .input(
        z.object({
          userId: z.number().int().positive(),
          newPassword: z.string().min(6, "كلمة المرور يجب ألا تقل عن 6 خانات."),
        }),
      )
      .mutation(async ({ input }) => {
        const targetUser = await getUserById(input.userId);
        if (!targetUser) {
          throw new TRPCError({ code: "NOT_FOUND", message: "المستخدم غير موجود." });
        }
        const newHash = hashPassword(input.newPassword);
        await resetStaffPassword(input.userId, newHash);
        return { success: true as const, message: "تم إعادة تعيين كلمة المرور بنجاح." };
      }),
  }),
  visits: visitsRouter,
});

export type AppRouter = typeof appRouter;
