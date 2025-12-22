import { Link, useLocation } from "wouter";
import { BarChart3, Upload, FileText, Layers, TrendingUp, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUpdateNotification } from "@/lib/update-notification-context";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

export default function Navbar() {
  const [location] = useLocation();
  const { hasUpdate } = useUpdateNotification();

  // Fetch active alarms to show red badge
  const { data: botTypes = [] } = useQuery<any[]>({
    queryKey: ['/api/bot-types'],
    refetchInterval: 2000,
  });

  const { data: allBotTypeUpdates = [] } = useQuery<any[]>({
    queryKey: ['/api/bot-type-updates'],
    refetchInterval: 2000,
  });

  // Check if there are any unapproved active alarms
  const hasUnreadNotifications = useMemo(() => {
    // This would ideally come from a dedicated notifications API
    // For now, we'll use a simple localStorage-based approach
    const storedAlarms = localStorage.getItem('active-alarms');
    if (!storedAlarms) return false;

    try {
      const alarms = JSON.parse(storedAlarms);
      return Array.isArray(alarms) && alarms.length > 0;
    } catch {
      return false;
    }
  }, []);

  const isActive = (path: string) => location === path;

  const navItems = [
    { path: '/', label: 'Dashboard', icon: BarChart3 },
    { path: '/upload', label: 'AI Analyse', icon: Upload },
    { path: '/bot-types', label: 'Bot Types', icon: Layers },
    { path: '/future', label: 'Future', icon: TrendingUp },
    { path: '/notifications', label: 'Notifications', icon: Bell },
    { path: '/reports', label: 'Berichte', icon: FileText },
  ];

  return (
    <nav className="border-b bg-card">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-bold">Pionex Bot Tracker</h1>
          </div>

          <div className="flex gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActiveItem = location === item.path;
              return (
                <Link key={item.path} href={item.path}>
                  <Button
                    variant={isActiveItem ? 'default' : 'ghost'}
                    className="gap-2 relative"
                    data-testid={`link-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden md:inline">{item.label}</span>
                    {item.path === '/notifications' && hasUnreadNotifications && (
                      <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-card" />
                    )}
                  </Button>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}