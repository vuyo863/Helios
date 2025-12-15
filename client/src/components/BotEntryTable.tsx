import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { BotType, BotTypeUpdate } from "@shared/schema";
import { format, parse, parseISO, isValid } from "date-fns";
import { de } from "date-fns/locale";
import { ArrowUp, ArrowDown, X, LineChart } from "lucide-react";

// Helper function to parse runtime string like "1d 14h 28m" to hours
function parseRuntimeToHours(runtime: string | null | undefined): number {
  if (!runtime) return 0;
  
  let totalHours = 0;
  
  const daysMatch = runtime.match(/(\d+)d/);
  if (daysMatch) totalHours += parseInt(daysMatch[1]) * 24;
  
  const hoursMatch = runtime.match(/(\d+)h/);
  if (hoursMatch) totalHours += parseInt(hoursMatch[1]);
  
  const minutesMatch = runtime.match(/(\d+)m/);
  if (minutesMatch) totalHours += parseInt(minutesMatch[1]) / 60;
  
  return totalHours;
}

// Helper function to parse runtime string to milliseconds
function parseRuntimeToMs(runtime: string | null | undefined): number {
  if (!runtime) return 0;
  let totalMs = 0;
  const days = runtime.match(/(\d+)\s*d/);
  const hours = runtime.match(/(\d+)\s*h/);
  const minutes = runtime.match(/(\d+)\s*m/);
  const seconds = runtime.match(/(\d+)\s*s/);
  if (days) totalMs += parseInt(days[1]) * 24 * 60 * 60 * 1000;
  if (hours) totalMs += parseInt(hours[1]) * 60 * 60 * 1000;
  if (minutes) totalMs += parseInt(minutes[1]) * 60 * 1000;
  if (seconds) totalMs += parseInt(seconds[1]) * 1000;
  return totalMs;
}

// Helper function to parse German date format
function parseGermanDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  // Try with seconds first
  let parsed = parse(dateStr, "dd.MM.yyyy HH:mm:ss", new Date(), { locale: de });
  if (isValid(parsed)) return parsed;
  // Try without seconds
  parsed = parse(dateStr, "dd.MM.yyyy HH:mm", new Date(), { locale: de });
  if (isValid(parsed)) return parsed;
  // Try date only
  parsed = parse(dateStr, "dd.MM.yyyy", new Date(), { locale: de });
  if (isValid(parsed)) return parsed;
  // Try ISO format
  parsed = parseISO(dateStr);
  if (isValid(parsed)) return parsed;
  // Fallback to native Date
  parsed = new Date(dateStr);
  if (isValid(parsed)) return parsed;
  return null;
}

// Formatiert Werte mit "+" Präfix bei positiven Zahlen
function formatWithSign(value: string | number | null | undefined, decimals: number = 2): string {
  if (value === null || value === undefined || value === '' || value === '-') {
    return '-';
  }
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return '-';
  
  let formatted = numValue.toFixed(decimals);
  
  if (decimals > 2) {
    formatted = formatted.replace(/\.?0+$/, '');
    if (!formatted.includes('.')) {
      formatted += '.00';
    } else {
      const decimalPart = formatted.split('.')[1] || '';
      if (decimalPart.length === 1) {
        formatted += '0';
      }
    }
  }
  
  if (numValue > 0) {
    return `+${formatted}`;
  }
  return formatted;
}

export interface BotTypeTableData {
  id: string;
  name: string;
  lastUpdated: Date | null;
  gesamtInvestmentAvg: number;
  gesamtProfit: number;
  profitPercent: number;
  real24hProfit: number;
  avg24hProfit: number;
  wontLiqBudget: number;
  metricStarted: Date | null;
  latestDate: Date | null;
}

interface BotEntryTableProps {
  botTypeData: BotTypeTableData[];
  sortColumn: string | null;
  sortDirection: 'asc' | 'desc';
  onSort: (column: string) => void;
  onRemoveBotType: (botTypeId: string) => void;
  selectedChartBotTypes?: string[];
  onToggleChartBotType?: (botTypeId: string) => void;
}

export default function BotEntryTable({ botTypeData, sortColumn, sortDirection, onSort, onRemoveBotType, selectedChartBotTypes = [], onToggleChartBotType }: BotEntryTableProps) {
  const formatNumber = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return num.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) {
      return (
        <div className="flex flex-col ml-1 opacity-40">
          <ArrowUp className="h-3 w-3 -mb-1" />
          <ArrowDown className="h-3 w-3" />
        </div>
      );
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="h-4 w-4 ml-1" />
    ) : (
      <ArrowDown className="h-4 w-4 ml-1" />
    );
  };

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="overflow-x-auto">
        <div className="max-h-[400px] overflow-y-auto">
          <Table className="min-w-[1200px]">
            <TableHeader>
              <TableRow>
                <TableHead className="sticky top-0 z-10 bg-muted border-b w-[120px]" data-testid="header-last-updated">
                  <div className="flex items-center justify-between w-full cursor-pointer hover-elevate rounded px-2 py-1" onClick={() => onSort('lastUpdated')}>
                    <span>LastUpdated</span>
                    <SortIcon column="lastUpdated" />
                  </div>
                </TableHead>
                <TableHead className="sticky top-0 z-10 bg-muted border-b w-[140px]" data-testid="header-bot-name">
                  <div className="flex items-center justify-between w-full cursor-pointer hover-elevate rounded px-2 py-1" onClick={() => onSort('name')}>
                    <span>Bot-Name</span>
                    <SortIcon column="name" />
                  </div>
                </TableHead>
                <TableHead className="sticky top-0 z-10 bg-muted border-b text-right w-[130px]" data-testid="header-investition">
                  <div className="flex items-center justify-between w-full cursor-pointer hover-elevate rounded px-2 py-1" onClick={() => onSort('gesamtInvestmentAvg')}>
                    <span>Investition</span>
                    <SortIcon column="gesamtInvestmentAvg" />
                  </div>
                </TableHead>
                <TableHead className="sticky top-0 z-10 bg-muted border-b text-right w-[130px]" data-testid="header-profit-usdt">
                  <div className="flex items-center justify-between w-full cursor-pointer hover-elevate rounded px-2 py-1" onClick={() => onSort('gesamtProfit')}>
                    <span>Profit</span>
                    <SortIcon column="gesamtProfit" />
                  </div>
                </TableHead>
                <TableHead className="sticky top-0 z-10 bg-muted border-b text-right w-[110px]" data-testid="header-profit-percent">
                  <div className="flex items-center justify-between w-full cursor-pointer hover-elevate rounded px-2 py-1 whitespace-nowrap" onClick={() => onSort('profitPercent')}>
                    <span>Profit %</span>
                    <SortIcon column="profitPercent" />
                  </div>
                </TableHead>
                <TableHead className="sticky top-0 z-10 bg-muted border-b text-right w-[130px]" data-testid="header-real-24h-profit">
                  <div className="flex items-center justify-between w-full cursor-pointer hover-elevate rounded px-2 py-1" onClick={() => onSort('real24hProfit')}>
                    <span>Real 24h</span>
                    <SortIcon column="real24hProfit" />
                  </div>
                </TableHead>
                <TableHead className="sticky top-0 z-10 bg-muted border-b text-right w-[130px]" data-testid="header-avg-24h-profit">
                  <div className="flex items-center justify-between w-full cursor-pointer hover-elevate rounded px-2 py-1" onClick={() => onSort('avg24hProfit')}>
                    <span>24h Ø</span>
                    <SortIcon column="avg24hProfit" />
                  </div>
                </TableHead>
                <TableHead className="sticky top-0 z-10 bg-muted border-b text-right w-[120px]" data-testid="header-wont-liq-budget">
                  <div className="flex items-center justify-between w-full cursor-pointer hover-elevate rounded px-2 py-1" onClick={() => onSort('wontLiqBudget')}>
                    <span>Wont Liq</span>
                    <SortIcon column="wontLiqBudget" />
                  </div>
                </TableHead>
                <TableHead className="sticky top-0 z-10 bg-muted border-b w-[200px]" data-testid="header-runtime">
                  <div className="flex items-center justify-between w-full cursor-pointer hover-elevate rounded px-2 py-1" onClick={() => onSort('metricStarted')}>
                    <span>Zeitraum</span>
                    <SortIcon column="metricStarted" />
                  </div>
                </TableHead>
                <TableHead className="sticky top-0 z-10 bg-muted border-b w-[60px] text-center" data-testid="header-chart">
                  <span>Chart</span>
                </TableHead>
                <TableHead className="sticky top-0 z-10 bg-muted border-b w-[50px]" data-testid="header-actions">
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {botTypeData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-muted-foreground py-8" data-testid="text-no-entries">
                    Keine Einträge vorhanden
                  </TableCell>
                </TableRow>
              ) : (
                botTypeData.map((botType) => (
                  <TableRow key={botType.id} className="hover-elevate" data-testid={`row-entry-${botType.id}`}>
                    <TableCell className="text-sm" data-testid={`cell-last-updated-${botType.id}`}>
                      {botType.lastUpdated 
                        ? format(new Date(botType.lastUpdated), 'dd.MM.yyyy', { locale: de })
                        : '-'
                      }
                    </TableCell>
                    <TableCell className="font-medium text-sm" data-testid={`cell-bot-name-${botType.id}`}>
                      {botType.name}
                    </TableCell>
                    <TableCell className="text-right text-sm" data-testid={`cell-investment-${botType.id}`}>
                      {formatNumber(botType.gesamtInvestmentAvg)}
                    </TableCell>
                    <TableCell className={`text-right text-sm font-medium ${botType.gesamtProfit >= 0 ? 'text-green-600' : 'text-red-600'}`} data-testid={`cell-profit-${botType.id}`}>
                      {formatWithSign(botType.gesamtProfit, 2)}
                    </TableCell>
                    <TableCell className={`text-right text-sm font-medium ${botType.profitPercent >= 0 ? 'text-green-600' : 'text-red-600'}`} data-testid={`cell-profit-percent-${botType.id}`}>
                      {formatWithSign(botType.profitPercent, 2)}%
                    </TableCell>
                    <TableCell className={`text-right text-sm font-medium ${botType.real24hProfit >= 0 ? 'text-green-600' : 'text-red-600'}`} data-testid={`cell-real-24h-profit-${botType.id}`}>
                      {formatWithSign(botType.real24hProfit, 2)}
                    </TableCell>
                    <TableCell className={`text-right text-sm font-medium ${botType.avg24hProfit >= 0 ? 'text-green-600' : 'text-red-600'}`} data-testid={`cell-avg-24h-profit-${botType.id}`}>
                      {formatWithSign(botType.avg24hProfit, 2)}
                    </TableCell>
                    <TableCell className="text-right text-sm" data-testid={`cell-wont-liq-budget-${botType.id}`}>
                      {formatNumber(botType.wontLiqBudget)}
                    </TableCell>
                    <TableCell className="text-sm" data-testid={`cell-runtime-${botType.id}`}>
                      <div className="flex flex-col text-xs">
                        <span>
                          {botType.metricStarted 
                            ? format(new Date(botType.metricStarted), 'dd.MM.yy', { locale: de })
                            : '-'
                          }
                          {' - '}
                          {botType.latestDate 
                            ? format(new Date(botType.latestDate), 'dd.MM.yy', { locale: de })
                            : '-'
                          }
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center" data-testid={`cell-chart-${botType.id}`}>
                      <button
                        onClick={() => onToggleChartBotType?.(botType.id)}
                        className="p-1 rounded hover-elevate cursor-pointer"
                        data-testid={`button-chart-${botType.id}`}
                      >
                        <LineChart 
                          className={`h-4 w-4 mx-auto transition-colors ${
                            selectedChartBotTypes.includes(botType.id) 
                              ? 'text-blue-500' 
                              : 'text-muted-foreground'
                          }`} 
                        />
                      </button>
                    </TableCell>
                    <TableCell data-testid={`cell-actions-${botType.id}`}>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => onRemoveBotType(botType.id)}
                        data-testid={`button-remove-${botType.id}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

// Helper function to calculate bot type table data from updates
export function calculateBotTypeTableData(
  botType: BotType,
  updates: BotTypeUpdate[]
): BotTypeTableData {
  const updatesForType = updates.filter(update => update.botTypeId === botType.id);
  
  // Gesamt Profit: Alle Updates, aber unterschiedliche Felder je nach Status
  const gesamtProfit = updatesForType.reduce((sum, update) => {
    if (update.status === 'Closed Bots') {
      return sum + (parseFloat(update.profit || '0') || 0);
    } else {
      return sum + (parseFloat(update.overallGridProfitUsdt || '0') || 0);
    }
  }, 0);
  
  // Nur Update Metrics für die folgenden Berechnungen
  const updateMetricsOnly = updatesForType.filter(update => update.status === 'Update Metrics');
  
  // Gesamtinvestment-Ø
  let gesamtInvestmentAvg = 0;
  if (updateMetricsOnly.length > 0) {
    const totalInvestment = updateMetricsOnly.reduce((sum, update) => {
      return sum + (parseFloat(update.totalInvestment || '0') || 0);
    }, 0);
    gesamtInvestmentAvg = totalInvestment / updateMetricsOnly.length;
  }
  
  // Real 24h Profit
  let real24hProfit = 0;
  updateMetricsOnly.forEach(update => {
    const gridProfit = parseFloat(update.overallGridProfitUsdt || '0') || 0;
    const runtimeHours = parseRuntimeToHours(update.avgRuntime);
    const avgGridProfitDay = parseFloat(update.avgGridProfitDay || '0') || 0;
    
    if (runtimeHours < 24) {
      real24hProfit += gridProfit;
    } else {
      real24hProfit += avgGridProfitDay;
    }
  });
  
  // 24h Ø Profit
  let avg24hProfit = 0;
  if (updateMetricsOnly.length > 0) {
    let totalProfit = 0;
    let totalHours = 0;
    
    updateMetricsOnly.forEach(update => {
      const gridProfit = parseFloat(update.overallGridProfitUsdt || '0') || 0;
      const runtimeHours = parseRuntimeToHours(update.avgRuntime);
      totalProfit += gridProfit;
      totalHours += runtimeHours;
    });
    
    if (totalHours > 0) {
      const profitPerHour = totalProfit / totalHours;
      avg24hProfit = profitPerHour * 24;
    }
  }
  
  // Wont Liq Budget: Direkt von Bot-Type Karte
  const wontLiqBudget = parseFloat(botType.wontLiqBudget || '0') || 0;
  
  // Metric Started (frühstes "From"-Datum aus Content-Cards) und Latest Date (spätestes Enddatum)
  // Das "From"-Datum wird aus lastUpload genommen (wie in der Content-Card angezeigt)
  const allStartDates: Date[] = [];
  const allEndDates: Date[] = [];
  
  updatesForType.forEach(update => {
    // Für beide Modi (Update Metrics + Closed Bots): lastUpload ist das "From"-Datum
    if (update.lastUpload) {
      const fromDate = parseGermanDate(update.lastUpload as string);
      if (fromDate) {
        allStartDates.push(fromDate);
      }
    }
    // thisUpload ist das "Until"/"End Date"
    if (update.thisUpload) {
      const untilDate = parseGermanDate(update.thisUpload as string);
      if (untilDate) {
        allEndDates.push(untilDate);
      }
    }
  });
  
  // Frühstes Startdatum (Metric Started)
  let metricStarted: Date | null = null;
  if (allStartDates.length > 0) {
    metricStarted = allStartDates.reduce((earliest, current) => 
      current < earliest ? current : earliest
    );
  }
  
  // Spätestes Enddatum (Latest Date)
  let latestDate: Date | null = null;
  if (allEndDates.length > 0) {
    latestDate = allEndDates.reduce((latest, current) => 
      current > latest ? current : latest
    );
  }
  
  // Last Updated: Das neueste createdAt Datum aus allen Updates
  let lastUpdated: Date | null = null;
  if (updatesForType.length > 0) {
    const sortedByDate = [...updatesForType].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt as Date).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt as Date).getTime() : 0;
      return dateB - dateA;
    });
    if (sortedByDate[0]?.createdAt) {
      lastUpdated = new Date(sortedByDate[0].createdAt as Date);
    }
  }
  
  // Profit % = (Gesamt Profit / Gesamtinvestment-Ø) * 100
  const profitPercent = gesamtInvestmentAvg > 0 
    ? (gesamtProfit / gesamtInvestmentAvg) * 100 
    : 0;
  
  return {
    id: botType.id,
    name: botType.name,
    lastUpdated,
    gesamtInvestmentAvg,
    gesamtProfit,
    profitPercent,
    real24hProfit,
    avg24hProfit,
    wontLiqBudget,
    metricStarted,
    latestDate
  };
}
