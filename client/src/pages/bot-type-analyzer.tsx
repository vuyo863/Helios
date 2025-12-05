import { TrendingUp } from "lucide-react";

export default function BotTypeAnalyzer() {
  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <TrendingUp className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Future</h1>
      </div>

      <p className="text-muted-foreground">
        Diese Seite wird in Zukunft erweitert.
      </p>
    </div>
  );
}
