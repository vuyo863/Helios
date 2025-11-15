import { Wallet, TrendingUp, Percent, Calendar } from "lucide-react";
import StatCard from "@/components/StatCard";
import BotEntryTable from "@/components/BotEntryTable";
import ProfitLineChart from "@/components/ProfitLineChart";
import ProfitBarChart from "@/components/ProfitBarChart";
import { BotEntry } from "@shared/schema";

// TODO: remove mock functionality - replace with real data from backend
const mockEntries: BotEntry[] = [
  {
    id: '1',
    date: '2025-01-10',
    botName: 'ETH/USDT Futures Moon',
    investment: '5000.00',
    profit: '125.50',
    profitPercent: '2.51',
    periodType: 'Tag',
    notes: null,
    screenshotPath: null,
  },
  {
    id: '2',
    date: '2025-01-09',
    botName: 'BTC Grid Bot',
    investment: '10000.00',
    profit: '342.80',
    profitPercent: '3.43',
    periodType: 'Woche',
    notes: null,
    screenshotPath: null,
  },
  {
    id: '3',
    date: '2025-01-08',
    botName: 'SOL Moon Bot',
    investment: '3500.00',
    profit: '87.50',
    profitPercent: '2.50',
    periodType: 'Tag',
    notes: null,
    screenshotPath: null,
  },
  {
    id: '4',
    date: '2025-01-07',
    botName: 'ADA Futures',
    investment: '7500.00',
    profit: '189.20',
    profitPercent: '2.52',
    periodType: 'Monat',
    notes: null,
    screenshotPath: null,
  },
];

const mockLineChartData = [
  { date: '05.01', profit: 120 },
  { date: '06.01', profit: 280 },
  { date: '07.01', profit: 469 },
  { date: '08.01', profit: 557 },
  { date: '09.01', profit: 900 },
  { date: '10.01', profit: 1025 },
];

const mockBarChartData = [
  { name: 'ETH Futures', profit: 468.50 },
  { name: 'BTC Grid', profit: 342.80 },
  { name: 'SOL Moon', profit: 215.40 },
  { name: 'ADA Futures', profit: 189.20 },
];

export default function Dashboard() {
  // TODO: remove mock functionality - calculate from real data
  const totalInvestment = mockEntries.reduce((sum, entry) => sum + parseFloat(entry.investment), 0);
  const totalProfit = mockEntries.reduce((sum, entry) => sum + parseFloat(entry.profit), 0);
  const totalProfitPercent = (totalProfit / totalInvestment) * 100;
  const avgDailyProfit = totalProfit / 7;

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
          <ProfitLineChart data={mockLineChartData} title="Profit-Verlauf" />
          <ProfitBarChart data={mockBarChartData} title="Profit nach Bot" />
        </div>

        <div>
          <h2 className="text-xl font-bold mb-4">Alle Einträge</h2>
          <BotEntryTable entries={mockEntries} />
        </div>
      </div>
    </div>
  );
}
