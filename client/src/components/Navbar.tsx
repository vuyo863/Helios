import { Link, useLocation } from "wouter";
import { BarChart3, Upload, FileText, Layers, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Navbar() {
  const [location] = useLocation();

  const navItems = [
    { path: '/', label: 'Dashboard', icon: BarChart3 },
    { path: '/upload', label: 'AI Analyse', icon: Upload },
    { path: '/bot-types', label: 'Bot Types', icon: Layers },
    { path: '/future', label: 'Future', icon: TrendingUp },
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
              const isActive = location === item.path;
              return (
                <Link key={item.path} href={item.path}>
                  <Button
                    variant={isActive ? 'default' : 'ghost'}
                    className="gap-2"
                    data-testid={`link-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden md:inline">{item.label}</span>
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
