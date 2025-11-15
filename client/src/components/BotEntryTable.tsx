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
import { BotEntry } from "@shared/schema";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { ChevronDown } from "lucide-react";

interface BotEntryTableProps {
  entries: BotEntry[];
  selectedPeriod: string | null;
  onPeriodChange: (period: string | null) => void;
}

export default function BotEntryTable({ entries, selectedPeriod, onPeriodChange }: BotEntryTableProps) {
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

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="max-h-[320px] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky top-0 z-10 bg-muted border-b" data-testid="header-datum">Datum</TableHead>
              <TableHead className="sticky top-0 z-10 bg-muted border-b" data-testid="header-bot-name">Bot-Name</TableHead>
              <TableHead className="sticky top-0 z-10 bg-muted border-b text-right" data-testid="header-investition">Investition (USDT)</TableHead>
              <TableHead className="sticky top-0 z-10 bg-muted border-b text-right" data-testid="header-profit-usdt">Profit (USDT)</TableHead>
              <TableHead className="sticky top-0 z-10 bg-muted border-b text-right" data-testid="header-profit-percent">Profit (%)</TableHead>
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
            {entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8" data-testid="text-no-entries">
                  Keine Einträge vorhanden
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry, index) => (
                <TableRow key={entry.id} className="hover-elevate" data-testid={`row-entry-${entry.id}`}>
                  <TableCell data-testid={`cell-date-${entry.id}`}>
                    {format(new Date(entry.date), 'dd.MM.yyyy', { locale: de })}
                  </TableCell>
                  <TableCell className="font-medium" data-testid={`cell-bot-name-${entry.id}`}>
                    {entry.botName}
                  </TableCell>
                  <TableCell className="text-right" data-testid={`cell-investment-${entry.id}`}>
                    {formatNumber(entry.investment)}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${parseFloat(entry.profit.toString()) >= 0 ? 'text-green-600' : 'text-red-600'}`} data-testid={`cell-profit-${entry.id}`}>
                    {formatNumber(entry.profit)}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${parseFloat(entry.profitPercent.toString()) >= 0 ? 'text-green-600' : 'text-red-600'}`} data-testid={`cell-profit-percent-${entry.id}`}>
                    {formatNumber(entry.profitPercent)}%
                  </TableCell>
                  <TableCell data-testid={`cell-period-${entry.id}`}>
                    <Badge variant={getPeriodBadgeVariant(entry.periodType)} data-testid={`badge-period-${entry.id}`}>
                      {entry.periodType}
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
