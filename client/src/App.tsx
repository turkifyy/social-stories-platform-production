import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/hooks/useAuth";
import { createContext, useContext } from "react";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import Accounts from "@/pages/accounts";
import Schedule from "@/pages/schedule";
import Jobs from "@/pages/jobs";
import Analytics from "@/pages/analytics";
import Insights from "@/pages/insights";
import Profile from "@/pages/profile";
import Admin from "@/pages/admin";
import DailyStories from "@/pages/daily-stories";
import SchedulingSettings from "@/pages/scheduling-settings";

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({ isAuthenticated: false, isLoading: true });

function useAuthContext() {
  return useContext(AuthContext);
}

function AuthenticatedRoutes() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/accounts" component={Accounts} />
      <Route path="/schedule" component={Schedule} />
      <Route path="/jobs" component={Jobs} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/insights" component={Insights} />
      <Route path="/profile" component={Profile} />
      <Route path="/admin" component={Admin} />
      <Route path="/daily-stories" component={DailyStories} />
      <Route path="/scheduling-settings" component={SchedulingSettings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function UnauthenticatedRoutes() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route component={Landing} />
    </Switch>
  );
}

function LoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <i className="fas fa-spinner fa-spin text-4xl text-primary mb-4"></i>
        <p className="text-muted-foreground">جاري التحميل...</p>
      </div>
    </div>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuthContext();
  
  const style = {
    "--sidebar-width": "20rem",
    "--sidebar-width-icon": "4rem",
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <UnauthenticatedRoutes />;
  }

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1">
          <header className="flex items-center gap-4 p-4 border-b">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
          </header>
          <main className="flex-1 overflow-auto p-6">
            <AuthenticatedRoutes />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function App() {
  const authState = useAuth();

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthContext.Provider value={authState}>
          <AppContent />
        </AuthContext.Provider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
