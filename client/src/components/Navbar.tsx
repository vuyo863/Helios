import { Link, useLocation } from "wouter";
import { BarChart3, Upload, FileText, Layers, TrendingUp, Bell } from "lucide-react";
import heliosLogo from "@/assets/helios-logo.png";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

export default function Navbar() {
  const [location] = useLocation();

  // Track active alarms count with polling
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);

  // Check localStorage for active alarms every 2 seconds
  useEffect(() => {
    const checkAlarms = () => {
      const storedAlarms = localStorage.getItem('active-alarms');
      if (!storedAlarms) {
        setHasUnreadNotifications(false);
        return;
      }

      try {
        const alarms = JSON.parse(storedAlarms);
        setHasUnreadNotifications(Array.isArray(alarms) && alarms.length > 0);
      } catch {
        setHasUnreadNotifications(false);
      }
    };

    // Check immediately
    checkAlarms();

    // Poll every 2 seconds
    const interval = setInterval(checkAlarms, 2000);

    return () => clearInterval(interval);
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
            <img src={heliosLogo} alt="Helios AI" className="w-12 h-12" />
            <h1 className="text-xl font-semibold tracking-wide" style={{ fontFamily: 'Orbitron, sans-serif' }}>
              <span style={{ color: '#38bdf8' }}>HELIOS</span>
              <span style={{ color: '#1e293b' }}> AI</span>
            </h1>
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