import { Card } from "@/components/ui/card";
import { LucideIcon, Info } from "lucide-react";
import { useState, useEffect } from "react";

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  iconColor: string;
  dropdown?: React.ReactNode;
  eyeIcon?: React.ReactNode;
  infoTooltip?: string;
  tooltipAlign?: 'left' | 'right';
}

export default function StatCard({ label, value, icon: Icon, iconColor, dropdown, eyeIcon, infoTooltip, tooltipAlign = 'left' }: StatCardProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  
  useEffect(() => {
    if (showTooltip) {
      const timer = setTimeout(() => {
        setShowTooltip(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showTooltip]);
  
  const handleInfoClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowTooltip(prev => !prev);
  };
  
  return (
    <Card className="p-4 h-full overflow-visible">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0 overflow-visible">
          <div className="flex items-center gap-1 mb-1 overflow-visible">
            <p className="text-xs text-muted-foreground whitespace-nowrap">{label}</p>
            {infoTooltip && (
              <div className="relative">
                <Info 
                  className="h-3 w-3 text-muted-foreground/60 cursor-pointer hover:text-muted-foreground transition-colors" 
                  onClick={handleInfoClick}
                  data-testid={`info-icon-${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                />
                {showTooltip && (
                  <div 
                    className={`absolute bottom-full mb-2 w-64 p-3 text-xs bg-popover border border-border rounded-lg shadow-xl animate-in fade-in-0 zoom-in-95 ${
                      tooltipAlign === 'right' ? 'right-0' : 'left-0'
                    }`}
                    style={{ zIndex: 9999 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p className="text-foreground leading-relaxed">{infoTooltip}</p>
                    <div className={`absolute -bottom-1.5 w-3 h-3 bg-popover border-r border-b border-border rotate-45 ${
                      tooltipAlign === 'right' ? 'right-2' : 'left-1'
                    }`} />
                  </div>
                )}
              </div>
            )}
            {dropdown}
            {eyeIcon}
          </div>
          <p className="text-lg font-bold whitespace-nowrap">{value}</p>
        </div>
        <div className={`p-2 rounded-lg shrink-0 ${iconColor}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </Card>
  );
}
