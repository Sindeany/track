import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { addVisitComment, addVisitPhotos, createVisit, getVisitForManager, getVisitForRepresentative, listVisitsForManager, listVisitsForRepresentative, upsertClientFromVisit } from "../db";
import { storagePut } from "../storage";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";

const purposeValues = ["quote", "follow_up", "complaint_follow_up", "other"] as const;

export const visitCreateSchema = z.object({
  clientName: z.string().trim().min(2, "أدخل اسم العميل.").max(180),
  employeeName: z.string().trim().min(2, "أدخل اسم الموظف.").max(180),
  employeeRole: z.string().trim().min(2, "أدخل دور الموظف.").max(180),
  phone: z.string().trim().min(6, "أدخل رقم هاتف صالحًا.").max(32),
  address: z.string().trim().min(5, "أدخل عنوان الزيارة.").max(3000),
  visitPurpose: z.enum(purposeValues),
  report: z.string().trim().min(10, "اكتب تقرير الزيارة.").max(10000),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  locationAccuracy: z.number().min(0).max(50000).nullable().optional(),
  photos: z.array(z.string().max(4_000_000)).max(5, "الحد الأقصى خمس صور لكل تقرير."),
}).strict();

export function cameraJpegToBuffer(dataUrl: string) {
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new TRPCError({ code: "BAD_REQUEST", message: "صيغة صورة الكاميرا غير صالحة." });
  const buffer = Buffer.from(match[1], "base64");
  if (!buffer.length || buffer.length > 3 * 1024 * 1024) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "يجب ألا يتجاوز حجم الصورة 3 ميغابايت." });
  }
  return buffer;
}

export const visitsRouter = router({
  mine: protectedProcedure.query(({ ctx }) => listVisitsForRepresentative(ctx.user.id)),
  getMine: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const visit = await getVisitForRepresentative(input.id, ctx.user.id);
    if (!visit) throw new TRPCError({ code: "NOT_FOUND", message: "لم يتم العثور على التقرير." });
    return visit;
  }),
  create: protectedProcedure.input(visitCreateSchema).mutation(async ({ ctx, input }) => {
    const capturedAt = new Date();
    const visitId = await createVisit({
      representativeId: ctx.user.id,
      clientName: input.clientName,
      employeeName: input.employeeName,
      employeeRole: input.employeeRole,
      phone: input.phone,
      address: input.address,
      visitPurpose: input.visitPurpose,
      report: input.report,
      latitude: input.latitude.toFixed(7),
      longitude: input.longitude.toFixed(7),
      locationAccuracy: input.locationAccuracy ? Math.round(input.locationAccuracy) : null,
      visitedAt: capturedAt,
    });

    const photos = await Promise.all(input.photos.map(async (image, index) => {
      const buffer = cameraJpegToBuffer(image);
      const file = await storagePut(`visit-photos/${ctx.user.id}/${visitId}/${capturedAt.getTime()}-${index + 1}.jpg`, buffer, "image/jpeg");
      return { visitId, objectKey: file.key, objectUrl: file.url };
    }));
    await addVisitPhotos(photos);
    try {
      await upsertClientFromVisit({
        name: input.clientName,
        address: input.address,
        contactPerson: input.employeeName,
        contactRole: input.employeeRole,
        phone: input.phone,
      });
    } catch (error) {
      console.warn("[Visits] Auto-upsert client failed:", error);
    }
    return { id: visitId, capturedAt };
  }),
  managerList: adminProcedure.query(() => {
    return listVisitsForManager();
  }),
  managerGet: adminProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input }) => {
    const visit = await getVisitForManager(input.id);
    if (!visit) throw new TRPCError({ code: "NOT_FOUND", message: "لم يتم العثور على التقرير." });
    return visit;
  }),
  addComment: adminProcedure.input(z.object({
    visitId: z.number().int().positive(),
    body: z.string().trim().min(2, "اكتب الملاحظة أولًا.").max(3000),
  })).mutation(async ({ ctx, input }) => {
    const visit = await getVisitForManager(input.visitId);
    if (!visit) throw new TRPCError({ code: "NOT_FOUND", message: "لم يتم العثور على التقرير." });
    await addVisitComment({ visitId: input.visitId, managerId: ctx.user.id, body: input.body });
    return { success: true };
  }),
});
