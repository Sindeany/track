import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { initials } from "@/lib/visits";
import type { AppNavigationItem } from "@/lib/navigation";
import { startLogin } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { BriefcaseBusiness, LayoutDashboard, LogOut, PanelRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useLocation } from "wouter";

type DashboardLayoutProps = {
  title: string;
  subtitle?: string;
  navigation: AppNavigationItem[];
  children: React.ReactNode;
};

export default function DashboardLayout({ title, subtitle, navigation, children }: DashboardLayoutProps) {
  const { loading, user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const mobileSidebarPreview = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("sidebar-preview");

  if (loading) {
    return <div className="min-h-screen bg-[#F4F7F7] p-5"><div className="mx-auto h-24 max-w-6xl animate-pulse rounded-3xl bg-white" /></div>;
  }

  if (!user) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#F4F7F7] p-6 text-center" dir="rtl">
        <div className="max-w-sm rounded-[2rem] bg-white p-8 shadow-[0_18px_60px_-28px_rgba(16,73,70,.35)]">
          <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-[#104946] text-xl font-bold text-white">زم</div>
          <h1 className="text-xl font-bold text-[#153D3A]">تسجيل الدخول مطلوب</h1>
          <p className="mt-3 text-sm leading-7 text-slate-500">سجّل الدخول للوصول إلى تقارير الزيارات الميدانية.</p>
          <Button className="mt-6 w-full bg-[#0D625B] hover:bg-[#094D48]" onClick={() => startLogin()}>تسجيل الدخول</Button>
        </div>
      </div>
    );
  }

  const isDemoUser = user.openId.startsWith("field-visits-demo-");
  const isManagerView = location.startsWith("/manager");
  const switchExperience = () => {
    const target = isManagerView ? "/reports" : "/manager";
    if (isDemoUser) {
      sessionStorage.setItem("field-visits-demo-role", isManagerView ? "user" : "admin");
      window.location.assign(target);
      return;
    }
    setLocation(target);
  };

  return (
    <SidebarProvider defaultOpen={!isMobile} defaultOpenMobile={mobileSidebarPreview}>
      <Sidebar side="right" collapsible="offcanvas" className="border-l border-r-0 border-[#DCE8E5] bg-[#0C3F3C] text-white" dir="rtl">
        <SidebarHeader className="border-b border-white/10 px-5 py-6">
          <button onClick={() => setLocation(user.role === "admin" ? "/manager" : "/")} className="flex items-center gap-3 text-right" aria-label="العودة للصفحة الرئيسية">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#D8FFB6] font-black text-[#0B4C46]">زم</span>
            <span>
              <span className="block text-sm font-bold tracking-tight">زيارة ميدانية</span>
              <span className="mt-0.5 block text-xs text-white/60">نظام التقارير</span>
            </span>
          </button>
        </SidebarHeader>
        <SidebarContent className="px-3 py-5">
          <p className="px-3 pb-2 text-[11px] font-bold tracking-[.13em] text-white/45">القائمة الرئيسية</p>
          <SidebarMenu>
            {navigation.map(item => {
              const active = location === item.path || (item.path !== "/" && location.startsWith(`${item.path}/`));
              return <SidebarMenuItem key={item.path}>
                <SidebarMenuButton isActive={active} onClick={() => setLocation(item.path)} className="h-11 rounded-xl px-3 text-white/75 hover:bg-white/10 hover:text-white data-[active=true]:bg-[#D8FFB6] data-[active=true]:font-bold data-[active=true]:text-[#0B4C46]" tooltip={item.label}>
                  <item.icon className="h-[18px] w-[18px]" />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>;
            })}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="border-t border-white/10 p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-3 rounded-xl p-2 text-right transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8FFB6]">
                <Avatar className="h-9 w-9 border border-white/20"><AvatarFallback className="bg-white/15 text-xs font-bold text-white">{initials(user.name)}</AvatarFallback></Avatar>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{user.name || "مستخدم النظام"}</span><span className="block truncate pt-0.5 text-xs text-white/55">{isDemoUser ? `تجربة — ${user.role === "admin" ? "مدير" : "مندوب"}` : user.role === "admin" ? "مدير" : "مندوب مبيعات"}</span></span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive"><LogOut className="ml-2 h-4 w-4" />تسجيل الخروج</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="bg-[#F4F7F7]" dir="rtl">
        <header className="sticky top-0 z-30 flex min-h-[76px] items-center gap-3 border-b border-[#DCE8E5]/80 bg-[#F4F7F7]/90 px-4 py-3 backdrop-blur md:px-8">
          <SidebarTrigger className="h-10 w-10 rounded-xl border border-[#D8E5E2] bg-white text-[#104946] md:hidden"><PanelRight className="h-5 w-5" /></SidebarTrigger>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-extrabold tracking-tight text-[#153D3A] md:text-xl">{title}</h1>
            {subtitle ? <p className="mt-0.5 truncate text-xs text-slate-500 md:text-sm">{subtitle}</p> : null}
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-[#D6E8E4] bg-white px-3 py-1.5 text-xs font-medium text-[#25645E] sm:flex"><span className={`h-2 w-2 rounded-full ${isDemoUser ? "bg-[#D7A24A]" : "bg-[#71B58A]"}`} />{isDemoUser ? "وضع تجربة" : "متصل وآمن"}</div>
          {(isDemoUser || user.role === "admin") ? <Button variant="outline" onClick={switchExperience} className="h-9 shrink-0 border-[#BFDAD5] bg-white text-xs font-bold text-[#0D625B] hover:bg-[#EDF7F5] hover:text-[#094D48]">{isManagerView ? <><BriefcaseBusiness className="ml-1.5 h-4 w-4" />وضع المندوب</> : <><LayoutDashboard className="ml-1.5 h-4 w-4" />لوحة المدير</>}</Button> : null}
        </header>
        <main className="mx-auto w-full max-w-7xl p-4 pb-28 md:p-8 md:pb-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
