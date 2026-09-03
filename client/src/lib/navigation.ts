import { ClipboardList, LayoutDashboard, PlusCircle, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type AppNavigationItem = { label: string; path: string; icon: LucideIcon };

export const representativeNavigation: AppNavigationItem[] = [
  { icon: ClipboardList, label: "تقاريري", path: "/reports" },
  { icon: PlusCircle, label: "تقرير جديد", path: "/reports/new" },
];

export const managerNavigation: AppNavigationItem[] = [
  { icon: LayoutDashboard, label: "لوحة المتابعة", path: "/manager" },
  { icon: Users, label: "فريق العمل والأداء", path: "/manager/staff" },
];
