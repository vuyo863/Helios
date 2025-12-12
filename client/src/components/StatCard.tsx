import { Card } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  iconColor: string;
}

export default function StatCard({ label, value, icon: Icon, iconColor }: StatCardProps) {
  return (
    <Card className="p-4 h-full">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground mb-1 whitespace-nowrap">{label}</p>
          <p className="text-lg font-bold whitespace-nowrap">{value}</p>
        </div>
        <div className={`p-2 rounded-lg shrink-0 ${iconColor}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </Card>
  );
}
