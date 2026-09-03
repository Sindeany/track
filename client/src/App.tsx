import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import ManagerDashboard from "./pages/ManagerDashboard";
import ManagerReportDetail from "./pages/ManagerReportDetail";
import ManagerStaff from "./pages/ManagerStaff";
import NotFound from "./pages/NotFound";
import ReportDetail from "./pages/ReportDetail";
import ReportsHistory from "./pages/ReportsHistory";
import VisitForm from "./pages/VisitForm";

function Router() {
  return <Switch>
    <Route path="/" component={Home} />
    <Route path="/login" component={Login} />
    <Route path="/reports" component={ReportsHistory} />
    <Route path="/reports/new" component={VisitForm} />
    <Route path="/reports/:id" component={ReportDetail} />
    <Route path="/manager" component={ManagerDashboard} />
    <Route path="/manager/staff" component={ManagerStaff} />
    <Route path="/manager/reports/:id" component={ManagerReportDetail} />
    <Route component={NotFound} />
  </Switch>;
}

function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster richColors position="top-center" /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}

export default App;
