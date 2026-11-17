import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import React, { Suspense, lazy } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import PwaInstallPrompt from "./components/PwaInstallPrompt";
import { ThemeProvider } from "./contexts/ThemeContext";

const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const ManagerClients = lazy(() => import("./pages/ManagerClients"));
const ManagerDashboard = lazy(() => import("./pages/ManagerDashboard"));
const ManagerReportDetail = lazy(() => import("./pages/ManagerReportDetail"));
const ManagerStaff = lazy(() => import("./pages/ManagerStaff"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ReportDetail = lazy(() => import("./pages/ReportDetail"));
const ReportsHistory = lazy(() => import("./pages/ReportsHistory"));
const VisitForm = lazy(() => import("./pages/VisitForm"));

function PageLoader() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#F4F7F7]" dir="rtl">
      <div className="flex flex-col items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#104946] font-black text-[#D8FFB6] shadow-sm">
          زم
        </div>
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#104946] border-t-transparent" />
      </div>
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/login" component={Login} />
        <Route path="/reports" component={ReportsHistory} />
        <Route path="/reports/new" component={VisitForm} />
        <Route path="/reports/:id" component={ReportDetail} />
        <Route path="/manager" component={ManagerDashboard} />
        <Route path="/manager/staff" component={ManagerStaff} />
        <Route path="/manager/clients" component={ManagerClients} />
        <Route path="/manager/reports/:id" component={ManagerReportDetail} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster richColors position="top-center" />
          <Router />
          <PwaInstallPrompt />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
