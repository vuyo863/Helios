import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UpdateNotificationProvider } from "@/lib/update-notification-context";
import Navbar from "@/components/Navbar";
import Dashboard from "@/pages/dashboard";
import Upload from "@/pages/upload";
import Reports from "@/pages/reports";
import BotTypesPage from "@/pages/bot-types";
import BotTypeAnalyzer from "@/pages/bot-type-analyzer";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/upload" component={Upload} />
      <Route path="/bot-types" component={BotTypesPage} />
      <Route path="/future" component={BotTypeAnalyzer} />
      <Route path="/reports" component={Reports} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <UpdateNotificationProvider>
          <Navbar />
          <Router />
          <Toaster />
        </UpdateNotificationProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
