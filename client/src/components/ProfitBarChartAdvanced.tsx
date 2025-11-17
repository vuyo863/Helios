import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useState, useMemo } from "react";
import { BotEntry } from "@shared/schema";
import { Search, Check } from "lucide-react";

interface ProfitBarChartAdvancedProps {
  entries: BotEntry[];
  title: string;
}

interface MetricOption {
  key: keyof BotEntry;
  label: string;
  color: string;
}

const METRIC_OPTIONS: MetricOption[] = [
  { key: 'profit', label: 'Profit', color: '#3B82F6' },
  { key: 'investment', label: 'Investment', color: '#10B981' },
  { key: 'profitPercent', label: 'Profit %', color: '#8B5CF6' },
  { key: 'avgGridProfitHour', label: 'Ø Grid Profit (Stunde)', color: '#06B6D4' },
  { key: 'avgGridProfitDay', label: 'Ø Grid Profit (Tag)', color: '#F59E0B' },
  { key: 'avgGridProfitWeek', label: 'Ø Grid Profit (Woche)', color: '#84CC16' },
  { key: 'overallTrendPnlUsdt', label: 'Gesamter Trend P&L (USDT)', color: '#F97316' },
  { key: 'overallTrendPnlPercent', label: 'Gesamter Trend P&L (%)', color: '#14B8A6' },
  { key: 'highestGridProfit', label: 'Höchster Grid Profit', color: '#EF4444' },
  { key: 'overallGridProfitUsdt', label: 'Gesamter Grid Profit (USDT)', color: '#EC4899' },
];

export default function ProfitBarChartAdvanced({ entries, title }: ProfitBarChartAdvancedProps) {
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['profit']);
  const [botSearchQuery, setBotSearchQuery] = useState("");
  const [selectedBots, setSelectedBots] = useState<string[]>([]);

  const uniqueBotNames = useMemo(() => {
    const names = Array.from(new Set(entries.map(entry => entry.botName)));
    return names.sort();
  }, [entries]);

  const filteredBotNames = useMemo(() => {
    if (!botSearchQuery) return uniqueBotNames;
    return uniqueBotNames.filter(name => 
      name.toLowerCase().includes(botSearchQuery.toLowerCase())
    );
  }, [uniqueBotNames, botSearchQuery]);

  const chartData = useMemo(() => {
    const botsToShow = selectedBots.length > 0 ? selectedBots : uniqueBotNames;
    
    return botsToShow.slice(0, 6).map(botName => {
      const botEntries = entries.filter(e => e.botName === botName);
      const dataPoint: any = { name: botName };
      
      selectedMetrics.forEach(metric => {
        const total = botEntries.reduce((sum, entry) => {
          const value = entry[metric as keyof BotEntry];
          return sum + (value ? parseFloat(value.toString()) : 0);
        }, 0);
        dataPoint[metric] = total;
      });
      
      return dataPoint;
    }).sort((a, b) => {
      const firstMetric = selectedMetrics[0] || 'profit';
      return (b[firstMetric] || 0) - (a[firstMetric] || 0);
    });
  }, [entries, selectedBots, uniqueBotNames, selectedMetrics]);

  const toggleMetric = (metricKey: string) => {
    setSelectedMetrics(prev => 
      prev.includes(metricKey) 
        ? prev.filter(m => m !== metricKey)
        : [...prev, metricKey]
    );
  };

  const toggleBot = (botName: string) => {
    setSelectedBots(prev => 
      prev.includes(botName) 
        ? prev.filter(b => b !== botName)
        : [...prev, botName]
    );
  };

  const activeMetrics = METRIC_OPTIONS.filter(m => selectedMetrics.includes(m.key));
  const inactiveMetrics = METRIC_OPTIONS.filter(m => !selectedMetrics.includes(m.key));

  return (
    <Card className="p-6">
      <h3 className="text-lg font-bold mb-6">{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis 
            dataKey="name" 
            tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
          />
          <YAxis 
            tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
            label={{ value: 'USDT', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: 'hsl(var(--muted-foreground))' } }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />
          <Legend />
          {activeMetrics.map(metric => (
            <Bar 
              key={metric.key}
              dataKey={metric.key}
              name={metric.label}
              fill={metric.color}
              radius={[4, 4, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Left: Metric Selection */}
        <Card className="p-4">
          <h4 className="text-sm font-semibold mb-3">Metriken auswählen</h4>
          
          {/* Active Metrics */}
          <div className="space-y-2 mb-3">
            {activeMetrics.length > 0 ? (
              activeMetrics.map((metric) => (
                <Badge
                  key={metric.key}
                  className="w-full justify-between cursor-pointer hover-elevate"
                  style={{ backgroundColor: metric.color }}
                  onClick={() => toggleMetric(metric.key)}
                  data-testid={`badge-metric-active-${metric.key}`}
                >
                  <span>{metric.label}</span>
                  <Check className="w-3 h-3" />
                </Badge>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">Keine Metriken ausgewählt</p>
            )}
          </div>

          <Separator className="my-3" />

          {/* Inactive Metrics */}
          <div className="space-y-2">
            {inactiveMetrics.map((metric) => (
              <Badge
                key={metric.key}
                variant="outline"
                className="w-full justify-start cursor-pointer hover-elevate"
                onClick={() => toggleMetric(metric.key)}
                data-testid={`badge-metric-inactive-${metric.key}`}
              >
                <div 
                  className="w-3 h-3 rounded-full mr-2" 
                  style={{ backgroundColor: metric.color }}
                />
                {metric.label}
              </Badge>
            ))}
          </div>
        </Card>

        {/* Right: Bot Selection */}
        <Card className="p-4">
          <h4 className="text-sm font-semibold mb-3">Bots filtern</h4>
          
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Bot suchen..."
              value={botSearchQuery}
              onChange={(e) => setBotSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-bot-search-chart"
            />
          </div>

          <div className="max-h-[200px] overflow-y-auto space-y-2">
            {filteredBotNames.map((botName) => (
              <Badge
                key={botName}
                variant={selectedBots.includes(botName) ? "default" : "outline"}
                className="w-full justify-between cursor-pointer hover-elevate"
                onClick={() => toggleBot(botName)}
                data-testid={`badge-bot-${botName}`}
              >
                <span className="truncate">{botName}</span>
                {selectedBots.includes(botName) && <Check className="w-3 h-3 ml-2" />}
              </Badge>
            ))}
          </div>

          {selectedBots.length > 0 && (
            <p className="text-xs text-muted-foreground mt-3">
              {selectedBots.length} Bot{selectedBots.length !== 1 ? 's' : ''} ausgewählt
            </p>
          )}
        </Card>
      </div>
    </Card>
  );
}
