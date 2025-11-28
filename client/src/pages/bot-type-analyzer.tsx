import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { BotType, BotEntry } from "@shared/schema";
import { BarChart3 } from "lucide-react";

export default function BotTypeAnalyzer() {
  const { data: botTypes = [], isLoading: loadingBotTypes } = useQuery<BotType[]>({
    queryKey: ['/api/bot-types'],
  });

  const { data: botEntries = [], isLoading: loadingEntries } = useQuery<BotEntry[]>({
    queryKey: ['/api/bot-entries'],
  });

  if (loadingBotTypes || loadingEntries) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Lade Daten...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <BarChart3 className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Bot Type Analyzer</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {botTypes.map((botType) => {
          const entriesForType = botEntries.filter(entry => entry.botTypeId === botType.id);
          const totalProfit = entriesForType.reduce((sum, entry) => sum + (parseFloat(entry.profit) || 0), 0);
          const avgProfit = entriesForType.length > 0 ? totalProfit / entriesForType.length : 0;

          return (
            <Card key={botType.id} data-testid={`card-bottype-${botType.id}`}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div 
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: botType.color || '#3b82f6' }}
                  />
                  <CardTitle>{botType.name}</CardTitle>
                </div>
                <CardDescription>{botType.description || 'Keine Beschreibung'}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Anzahl Einträge:</span>
                    <span className="font-medium" data-testid={`text-entries-${botType.id}`}>
                      {entriesForType.length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gesamt Profit:</span>
                    <span className="font-medium text-primary" data-testid={`text-total-profit-${botType.id}`}>
                      {totalProfit.toFixed(2)} USDT
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ø Profit:</span>
                    <span className="font-medium" data-testid={`text-avg-profit-${botType.id}`}>
                      {avgProfit.toFixed(2)} USDT
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {botTypes.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">Keine Bot Types gefunden.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
