import { Card } from "@/components/ui/card";
import { LucideIcon, Info } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

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
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const iconRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (showTooltip) {
      const timer = setTimeout(() => {
        setShowTooltip(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showTooltip]);
  
  useEffect(() => {
    if (showTooltip && iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect();
      const tooltipWidth = 256;
      let left = tooltipAlign === 'right' 
        ? rect.right - tooltipWidth 
        : rect.left;
      left = Math.max(8, Math.min(left, window.innerWidth - tooltipWidth - 8));
      setTooltipPos({
        top: rect.top - 8,
        left: left,
      });
    }
  }, [showTooltip, tooltipAlign]);
  
  const handleInfoClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowTooltip(prev => !prev);
  };
  
  return (
    <Card className="p-4 h-full">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 mb-1">
            <p className="text-xs text-muted-foreground whitespace-nowrap">{label}</p>
            {infoTooltip && (
              <div ref={iconRef} className="relative">
                <Info 
                  className="h-3 w-3 text-muted-foreground/60 cursor-pointer hover:text-muted-foreground transition-colors" 
                  onClick={handleInfoClick}
                  data-testid={`info-icon-${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                />
                {showTooltip && createPortal(
                  <div 
                    className="fixed w-64 p-3 text-xs bg-popover border border-border rounded-lg shadow-xl animate-in fade-in-0 zoom-in-95"
                    style={{ 
                      zIndex: 99999,
                      top: tooltipPos.top,
                      left: tooltipPos.left,
                      transform: 'translateY(-100%)'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p className="text-foreground leading-relaxed">{infoTooltip}</p>
                    <div 
                      className="absolute -bottom-1.5 w-3 h-3 bg-popover border-r border-b border-border rotate-45"
                      style={{ left: tooltipAlign === 'right' ? 'auto' : '8px', right: tooltipAlign === 'right' ? '8px' : 'auto' }}
                    />
                  </div>,
                  document.body
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
