import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Printer } from "lucide-react";
import ReportFilters from "@/components/ReportFilters";
import StatCard from "@/components/StatCard";
import ProfitLineChart from "@/components/ProfitLineChart";
import ProfitBarChart from "@/components/ProfitBarChart";
import { Wallet, TrendingUp, Percent } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface ReportData {
  entries: any[];
  summary: {
    totalInvestment: number;
    totalProfit: number;
    totalProfitPercent: number;
    avgDailyProfit: number;
    dayCount: number;
  };
  charts: {
    profitByBot: { name: string; profit: number }[];
    profitByDate: { date: string; profit: number }[];
  };
}

export default function Reports() {
  const [filters, setFilters] = useState({ 
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], 
    endDate: new Date().toISOString().split('T')[0], 
    periodType: 'Tag' 
  });

  const { data, isLoading, isError } = useQuery<ReportData>({
    queryKey: ['/api/report', filters.startDate, filters.endDate],
    enabled: !!filters.startDate && !!filters.endDate,
  });

  const handleFilterChange = (newFilters: { startDate: string; endDate: string; periodType: string }) => {
    setFilters(newFilters);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold mb-2" data-testid="heading-reports">Berichte & Analyse</h1>
            <p className="text-muted-foreground">
              Erstellen Sie detaillierte Berichte für ausgewählte Zeiträume.
            </p>
          </div>
          <Button onClick={handlePrint} className="gap-2 print:hidden" data-testid="button-print">
            <Printer className="w-4 h-4" />
            Drucken / PDF
          </Button>
        </div>

        <div className="mb-8 print:hidden">
          <ReportFilters onFilterChange={handleFilterChange} />
        </div>

        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-32" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          </div>
        ) : isError ? (
          <Card className="p-12 text-center">
            <p className="text-destructive mb-2">Fehler beim Laden des Berichts</p>
            <p className="text-muted-foreground text-sm">
              Bitte versuchen Sie es erneut oder wählen Sie einen anderen Zeitraum.
            </p>
          </Card>
        ) : data ? (
          <>
            <Card className="p-6 mb-8">
              <h2 className="text-xl font-bold mb-4">Berichtszusammenfassung</h2>
              <div className="prose max-w-none text-sm">
                <p className="text-muted-foreground">
                  Für den ausgewählten Zeitraum ({filters.periodType}, {new Date(filters.startDate).toLocaleDateString('de-DE')} bis {new Date(filters.endDate).toLocaleDateString('de-DE')}) wurden folgende Ergebnisse erzielt:
                  Die Gesamtinvestition beträgt {data.summary.totalInvestment.toLocaleString('de-DE', { minimumFractionDigits: 2 })} USDT,
                  mit einem Gesamtprofit von {data.summary.totalProfit.toLocaleString('de-DE', { minimumFractionDigits: 2 })} USDT.
                  Dies entspricht einer Performance von {data.summary.totalProfitPercent.toFixed(2)}%.
                  Der durchschnittliche Profit pro Tag beträgt {data.summary.avgDailyProfit.toLocaleString('de-DE', { minimumFractionDigits: 2 })} USDT.
                </p>
              </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <StatCard
                label="Investiertes Kapital"
                value={`${data.summary.totalInvestment.toLocaleString('de-DE', { minimumFractionDigits: 2 })} USDT`}
                icon={Wallet}
                iconColor="bg-blue-100 text-blue-600"
              />
              <StatCard
                label="Profit im Zeitraum"
                value={`${data.summary.totalProfit.toLocaleString('de-DE', { minimumFractionDigits: 2 })} USDT`}
                icon={TrendingUp}
                iconColor="bg-green-100 text-green-600"
              />
              <StatCard
                label="Performance %"
                value={`${data.summary.totalProfitPercent.toFixed(2)}%`}
                icon={Percent}
                iconColor="bg-purple-100 text-purple-600"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ProfitLineChart data={data.charts.profitByDate} title="Profit-Verlauf im Zeitraum" />
              <ProfitBarChart data={data.charts.profitByBot} title="Profit nach Bot im Zeitraum" />
            </div>
          </>
        ) : (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">
              Wählen Sie einen Zeitraum aus, um den Bericht anzuzeigen.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
