import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BotType, BotTypeUpdate } from "@shared/schema";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { ChevronDown, ArrowUp, ArrowDown } from "lucide-react";

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
  real24hProfit: number;
  periodType: string;
}

interface BotEntryTableProps {
  botTypeData: BotTypeTableData[];
  selectedPeriod: string | null;
  onPeriodChange: (period: string | null) => void;
  sortColumn: string | null;
  sortDirection: 'asc' | 'desc';
  onSort: (column: string) => void;
}

export default function BotEntryTable({ botTypeData, selectedPeriod, onPeriodChange, sortColumn, sortDirection, onSort }: BotEntryTableProps) {
  const getPeriodBadgeVariant = (periodType: string) => {
    switch (periodType.toLowerCase()) {
      case 'tag':
        return 'default';
      case 'woche':
        return 'secondary';
      case 'monat':
        return 'outline';
      default:
        return 'default';
    }
  };

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
      <div className="max-h-[320px] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky top-0 z-10 bg-muted border-b" data-testid="header-datum">
                <div className="flex items-center justify-between w-full cursor-pointer hover-elevate rounded px-2 py-1" onClick={() => onSort('lastUpdated')}>
                  <span>Datum</span>
                  <SortIcon column="lastUpdated" />
                </div>
              </TableHead>
              <TableHead className="sticky top-0 z-10 bg-muted border-b" data-testid="header-bot-name">
                <div className="flex items-center justify-between w-full cursor-pointer hover-elevate rounded px-2 py-1" onClick={() => onSort('name')}>
                  <span>Bot-Name</span>
                  <SortIcon column="name" />
                </div>
              </TableHead>
              <TableHead className="sticky top-0 z-10 bg-muted border-b text-right" data-testid="header-investition">
                <div className="flex items-center justify-between w-full cursor-pointer hover-elevate rounded px-2 py-1" onClick={() => onSort('gesamtInvestmentAvg')}>
                  <span>Investition (USDT)</span>
                  <SortIcon column="gesamtInvestmentAvg" />
                </div>
              </TableHead>
              <TableHead className="sticky top-0 z-10 bg-muted border-b text-right" data-testid="header-profit-usdt">
                <div className="flex items-center justify-between w-full cursor-pointer hover-elevate rounded px-2 py-1" onClick={() => onSort('gesamtProfit')}>
                  <span>Profit (USDT)</span>
                  <SortIcon column="gesamtProfit" />
                </div>
              </TableHead>
              <TableHead className="sticky top-0 z-10 bg-muted border-b text-right" data-testid="header-real-24h-profit">
                <div className="flex items-center justify-between w-full cursor-pointer hover-elevate rounded px-2 py-1" onClick={() => onSort('real24hProfit')}>
                  <span>Real 24h Profit</span>
                  <SortIcon column="real24hProfit" />
                </div>
              </TableHead>
              <TableHead className="sticky top-0 z-10 bg-muted border-b" data-testid="header-zeitraum">
                <DropdownMenu>
                  <DropdownMenuTrigger className="flex items-center gap-1 hover-elevate px-2 py-1 rounded-md cursor-pointer" data-testid="dropdown-zeitraum">
                    <span>Zeitraum</span>
                    <ChevronDown className="h-4 w-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" data-testid="dropdown-zeitraum-content">
                    <DropdownMenuItem 
                      onClick={() => onPeriodChange(null)}
                      className={selectedPeriod === null ? "bg-accent" : ""}
                      data-testid="dropdown-option-alle"
                    >
                      Alle
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => onPeriodChange("Tag")}
                      className={selectedPeriod === "Tag" ? "bg-accent" : ""}
                      data-testid="dropdown-option-tag"
                    >
                      Tag
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => onPeriodChange("Woche")}
                      className={selectedPeriod === "Woche" ? "bg-accent" : ""}
                      data-testid="dropdown-option-woche"
                    >
                      Woche
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => onPeriodChange("Monat")}
                      className={selectedPeriod === "Monat" ? "bg-accent" : ""}
                      data-testid="dropdown-option-monat"
                    >
                      Monat
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {botTypeData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8" data-testid="text-no-entries">
                  Keine Einträge vorhanden
                </TableCell>
              </TableRow>
            ) : (
              botTypeData.map((botType) => (
                <TableRow key={botType.id} className="hover-elevate" data-testid={`row-entry-${botType.id}`}>
                  <TableCell data-testid={`cell-date-${botType.id}`}>
                    {botType.lastUpdated 
                      ? format(new Date(botType.lastUpdated), 'dd.MM.yyyy', { locale: de })
                      : '-'
                    }
                  </TableCell>
                  <TableCell className="font-medium" data-testid={`cell-bot-name-${botType.id}`}>
                    {botType.name}
                  </TableCell>
                  <TableCell className="text-right" data-testid={`cell-investment-${botType.id}`}>
                    {formatNumber(botType.gesamtInvestmentAvg)}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${botType.gesamtProfit >= 0 ? 'text-green-600' : 'text-red-600'}`} data-testid={`cell-profit-${botType.id}`}>
                    {formatWithSign(botType.gesamtProfit, 4)} USDT
                  </TableCell>
                  <TableCell className={`text-right font-medium ${botType.real24hProfit >= 0 ? 'text-green-600' : 'text-red-600'}`} data-testid={`cell-real-24h-profit-${botType.id}`}>
                    {formatWithSign(botType.real24hProfit, 2)} USDT
                  </TableCell>
                  <TableCell data-testid={`cell-period-${botType.id}`}>
                    <Badge variant={getPeriodBadgeVariant(botType.periodType)} data-testid={`badge-period-${botType.id}`}>
                      {botType.periodType}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
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
  // - Update Metrics: overallGridProfitUsdt (Grid Profit)
  // - Closed Bots: profit (Gesamt Profit)
  const gesamtProfit = updatesForType.reduce((sum, update) => {
    if (update.status === 'Closed Bots') {
      return sum + (parseFloat(update.profit || '0') || 0);
    } else {
      return sum + (parseFloat(update.overallGridProfitUsdt || '0') || 0);
    }
  }, 0);
  
  // Gesamtinvestment-Ø: Durchschnitt über alle Update Metrics
  const updateMetricsOnly = updatesForType.filter(update => update.status === 'Update Metrics');
  let gesamtInvestmentAvg = 0;
  if (updateMetricsOnly.length > 0) {
    const totalInvestment = updateMetricsOnly.reduce((sum, update) => {
      return sum + (parseFloat(update.totalInvestment || '0') || 0);
    }, 0);
    gesamtInvestmentAvg = totalInvestment / updateMetricsOnly.length;
  }
  
  // Real 24h Profit: Summe der "echten" 24h Werte für jeden Update
  // - Runtime < 24h: Gesamten Grid Profit (den echten Wert)
  // - Runtime >= 24h: Durchschnittlichen Grid Profit pro Tag
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
  
  return {
    id: botType.id,
    name: botType.name,
    lastUpdated,
    gesamtInvestmentAvg,
    gesamtProfit,
    real24hProfit,
    periodType: 'Tag' // Default, wird später angepasst
  };
}
