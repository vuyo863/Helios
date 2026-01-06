import { Switch, Route, useLocation } from "wouter";
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
import Notifications from "@/pages/notifications";
import NotFound from "@/pages/not-found";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import OneSignal from 'react-onesignal';

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/upload" component={Upload} />
      <Route path="/bot-types" component={BotTypesPage} />
      <Route path="/future" component={BotTypeAnalyzer} />
      <Route path="/notifications" component={Notifications} />
      <Route path="/reports" component={Reports} />
      <Route component={NotFound} />
    </Switch>
  );
}

function GlobalNotificationToast() {
  const [, setLocation] = useLocation();
  const [showToast, setShowToast] = useState(false);
  const [lastAlarmCount, setLastAlarmCount] = useState(0);

  useEffect(() => {
    // Poll for new alarms every 2 seconds
    const checkForNewAlarms = () => {
      const storedAlarms = localStorage.getItem('active-alarms');
      if (!storedAlarms) {
        setLastAlarmCount(0);
        return;
      }
      
      try {
        const alarms = JSON.parse(storedAlarms);
        const currentCount = Array.isArray(alarms) ? alarms.length : 0;
        
        // Show toast if alarm count increased
        if (currentCount > lastAlarmCount && lastAlarmCount > 0) {
          setShowToast(true);
          
          // Auto-hide after 4 seconds
          setTimeout(() => {
            setShowToast(false);
          }, 4000);
        }
        
        setLastAlarmCount(currentCount);
      } catch {
        // Ignore parse errors
      }
    };

    // Initial check
    checkForNewAlarms();

    // Set up polling
    const interval = setInterval(checkForNewAlarms, 2000);

    return () => clearInterval(interval);
  }, [lastAlarmCount]);

  const handleToastClick = () => {
    setShowToast(false);
    setLocation('/notifications');
  };

  if (!showToast) return null;

  return (
    <div 
      className="fixed top-20 left-1/2 -translate-x-1/2 z-[9999] cursor-pointer animate-in slide-in-from-top-5 duration-300"
      onClick={handleToastClick}
    >
      <div className="bg-red-500 text-white px-6 py-3 rounded-lg shadow-2xl flex items-center gap-3 hover:bg-red-600 transition-colors">
        <Bell className="w-5 h-5 animate-pulse" />
        <div>
          <p className="font-semibold text-sm">Neue Notification!</p>
          <p className="text-xs opacity-90">Klicken um Details zu sehen</p>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [oneSignalInitialized, setOneSignalInitialized] = useState(false);

  // Initialize OneSignal for Web Push Notifications
  useEffect(() => {
    if (oneSignalInitialized) return;

    OneSignal.init({
      appId: import.meta.env.VITE_ONESIGNAL_APP_ID || '6f15f4f1-93dc-491f-ba4a-c78354f46858',
      allowLocalhostAsSecureOrigin: true,
    }).then(() => {
      setOneSignalInitialized(true);
      console.log('OneSignal initialized successfully');
    }).catch((error) => {
      console.error('OneSignal initialization error:', error);
    });
  }, [oneSignalInitialized]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <UpdateNotificationProvider>
          <Navbar />
          <GlobalNotificationToast />
          <Router />
          <Toaster />
        </UpdateNotificationProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
