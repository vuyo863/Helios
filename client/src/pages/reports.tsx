import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Printer } from "lucide-react";
import ReportFilters from "@/components/ReportFilters";
import StatCard from "@/components/StatCard";
import ProfitLineChart from "@/components/ProfitLineChart";
import ProfitBarChart from "@/components/ProfitBarChart";
import { Wallet, TrendingUp, Percent } from "lucide-react";

// TODO: remove mock functionality - replace with real data from backend
const mockLineChartData = [
  { date: '05.01', profit: 120 },
  { date: '06.01', profit: 280 },
  { date: '07.01', profit: 469 },
  { date: '08.01', profit: 557 },
];

const mockBarChartData = [
  { name: 'ETH Futures', profit: 468.50 },
  { name: 'BTC Grid', profit: 342.80 },
];

export default function Reports() {
  const [filters, setFilters] = useState({ startDate: '', endDate: '', periodType: 'Tag' });

  const handleFilterChange = (newFilters: { startDate: string; endDate: string; periodType: string }) => {
    setFilters(newFilters);
    console.log('Filters applied:', newFilters);
    // TODO: remove mock functionality - fetch filtered data from backend
  };

  const handlePrint = () => {
    window.print();
  };

  // TODO: remove mock functionality - calculate from filtered real data
  const reportStats = {
    totalInvestment: 15420.50,
    totalProfit: 1025.50,
    totalProfitPercent: 6.65,
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

        <Card className="p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">Berichtszusammenfassung</h2>
          <div className="prose max-w-none text-sm">
            <p className="text-muted-foreground">
              Für den ausgewählten Zeitraum ({filters.periodType}) wurden folgende Ergebnisse erzielt:
              Die Gesamtinvestition beträgt {reportStats.totalInvestment.toLocaleString('de-DE', { minimumFractionDigits: 2 })} USDT,
              mit einem Gesamtprofit von {reportStats.totalProfit.toLocaleString('de-DE', { minimumFractionDigits: 2 })} USDT.
              Dies entspricht einer Performance von {reportStats.totalProfitPercent.toFixed(2)}%.
            </p>
            {/* TODO: remove mock functionality - replace with AI-generated report text from backend */}
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard
            label="Investiertes Kapital"
            value={`${reportStats.totalInvestment.toLocaleString('de-DE', { minimumFractionDigits: 2 })} USDT`}
            icon={Wallet}
            iconColor="bg-blue-100 text-blue-600"
          />
          <StatCard
            label="Profit im Zeitraum"
            value={`${reportStats.totalProfit.toLocaleString('de-DE', { minimumFractionDigits: 2 })} USDT`}
            icon={TrendingUp}
            iconColor="bg-green-100 text-green-600"
          />
          <StatCard
            label="Performance %"
            value={`${reportStats.totalProfitPercent.toFixed(2)}%`}
            icon={Percent}
            iconColor="bg-purple-100 text-purple-600"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ProfitLineChart data={mockLineChartData} title="Profit-Verlauf im Zeitraum" />
          <ProfitBarChart data={mockBarChartData} title="Profit nach Bot im Zeitraum" />
        </div>
      </div>
    </div>
  );
}
