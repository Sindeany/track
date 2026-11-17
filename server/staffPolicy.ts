export function lastAdminMutationBlocked(params: {
  targetRole: "user" | "admin";
  adminCount: number;
  nextRole?: "user" | "admin";
  nextIsActive?: boolean;
  deleting?: boolean;
}): string | null {
  if (params.targetRole !== "admin" || params.adminCount > 1) return null;
  if (params.deleting) return "لا يمكن حذف آخر مدير في النظام.";
  if (params.nextIsActive === false) return "لا يمكن تجميد آخر مدير في النظام.";
  if (params.nextRole === "user") return "لا يمكن تخفيض آخر مدير في النظام.";
  return null;
}

export function staffDeleteBlocked(visitCount: number): string | null {
  if (visitCount > 0) {
    return "لا يمكن حذف مندوب لديه تقارير زيارات. جمّد الحساب بدلاً من حذفه.";
  }
  return null;
}
