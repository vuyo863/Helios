import { useQuery } from "@tanstack/react-query";
import { Wallet, TrendingUp, Percent, Calendar } from "lucide-react";
import StatCard from "@/components/StatCard";
import BotEntryTable from "@/components/BotEntryTable";
import ProfitLineChart from "@/components/ProfitLineChart";
import ProfitBarChart from "@/components/ProfitBarChart";
import { BotEntry } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { data: entries = [], isLoading } = useQuery<BotEntry[]>({
    queryKey: ['/api/entries'],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <h1 className="text-2xl font-bold mb-8">Übersicht</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const totalInvestment = entries.reduce((sum, entry) => sum + parseFloat(entry.investment), 0);
  const totalProfit = entries.reduce((sum, entry) => sum + parseFloat(entry.profit), 0);
  const totalProfitPercent = totalInvestment > 0 ? (totalProfit / totalInvestment) * 100 : 0;
  
  const dayCount = entries.length > 0 
    ? Math.max(1, Math.ceil((new Date().getTime() - new Date(entries[entries.length - 1].date).getTime()) / (1000 * 60 * 60 * 24)))
    : 1;
  const avgDailyProfit = totalProfit / dayCount;

  const lineChartData = entries
    .slice(0, 10)
    .reverse()
    .reduce((acc, entry) => {
      const dateStr = new Date(entry.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
      const existing = acc.find(item => item.date === dateStr);
      if (existing) {
        existing.profit += parseFloat(entry.profit);
      } else {
        acc.push({ date: dateStr, profit: parseFloat(entry.profit) });
      }
      return acc;
    }, [] as { date: string; profit: number }[]);

  const barChartData = Object.entries(
    entries.reduce((acc, entry) => {
      if (!acc[entry.botName]) {
        acc[entry.botName] = 0;
      }
      acc[entry.botName] += parseFloat(entry.profit);
      return acc;
    }, {} as Record<string, number>)
  )
    .map(([name, profit]) => ({ name, profit }))
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 6);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold mb-8" data-testid="heading-dashboard">Übersicht</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            label="Gesamtkapital"
            value={`${totalInvestment.toLocaleString('de-DE', { minimumFractionDigits: 2 })} USDT`}
            icon={Wallet}
            iconColor="bg-blue-100 text-blue-600"
          />
          <StatCard
            label="Gesamtprofit"
            value={`${totalProfit.toLocaleString('de-DE', { minimumFractionDigits: 2 })} USDT`}
            icon={TrendingUp}
            iconColor="bg-green-100 text-green-600"
          />
          <StatCard
            label="Gesamtprofit %"
            value={`${totalProfitPercent.toFixed(2)}%`}
            icon={Percent}
            iconColor="bg-purple-100 text-purple-600"
          />
          <StatCard
            label="Ø Profit/Tag"
            value={`${avgDailyProfit.toLocaleString('de-DE', { minimumFractionDigits: 2 })} USDT`}
            icon={Calendar}
            iconColor="bg-orange-100 text-orange-600"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <ProfitLineChart data={lineChartData} title="Profit-Verlauf" />
          <ProfitBarChart data={barChartData} title="Profit nach Bot" />
        </div>

        <div>
          <h2 className="text-xl font-bold mb-4">Alle Einträge</h2>
          <BotEntryTable entries={entries} />
        </div>
      </div>
    </div>
  );
}
