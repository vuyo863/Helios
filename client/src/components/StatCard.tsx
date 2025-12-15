import { Card } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  iconColor: string;
  dropdown?: React.ReactNode;
}

export default function StatCard({ label, value, icon: Icon, iconColor, dropdown }: StatCardProps) {
  return (
    <Card className="p-4 h-full">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 mb-1">
            <p className="text-xs text-muted-foreground whitespace-nowrap">{label}</p>
            {dropdown}
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
