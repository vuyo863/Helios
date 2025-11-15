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
    <Card className="p-6">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className="text-sm text-muted-foreground mb-2">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
        <div className={`p-2 rounded-lg ${iconColor}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </Card>
  );
}
