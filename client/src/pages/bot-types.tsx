import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BotType } from "@shared/schema";
import { Layers, Calendar } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";

export default function BotTypesPage() {
  const { data: botTypes = [], isLoading } = useQuery<BotType[]>({
    queryKey: ['/api/bot-types'],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <Skeleton className="h-10 w-64 mb-2" />
            <Skeleton className="h-6 w-96" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2" data-testid="text-page-title">Bot Types</h1>
          <p className="text-muted-foreground text-lg">
            Verwalten Sie Ihre Bot-Kategorien und Strategien
          </p>
        </div>

        {botTypes.length === 0 ? (
          <Card className="p-12 text-center">
            <CardContent>
              <Layers className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">Keine Bot Types gefunden</h3>
              <p className="text-muted-foreground">
                Erstellen Sie Bot Types, um Ihre Trading-Strategien zu kategorisieren.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {botTypes.map((botType) => (
              <Card 
                key={botType.id} 
                className="hover-elevate active-elevate-2 transition-all"
                data-testid={`card-bot-type-${botType.id}`}
              >
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <CardTitle className="text-xl mb-1 flex items-center gap-2">
                        <Layers className="w-5 h-5 text-primary" />
                        {botType.name}
                      </CardTitle>
                      {botType.description && (
                        <CardDescription className="text-sm mt-2">
                          {botType.description}
                        </CardDescription>
                      )}
                    </div>
                    {botType.color && (
                      <div 
                        className="w-8 h-8 rounded-md border-2 border-border flex-shrink-0"
                        style={{ backgroundColor: botType.color }}
                        data-testid={`color-indicator-${botType.id}`}
                      />
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span>
                      Erstellt: {format(new Date(botType.createdAt), "dd.MM.yyyy", { locale: de })}
                    </span>
                  </div>
                  {botType.color && (
                    <div className="pt-2 border-t">
                      <Badge 
                        variant="outline" 
                        style={{ 
                          backgroundColor: `${botType.color}20`, 
                          borderColor: botType.color,
                          color: botType.color
                        }}
                        data-testid={`badge-color-${botType.id}`}
                      >
                        {botType.color}
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
