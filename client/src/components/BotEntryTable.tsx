import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BotEntry } from "@shared/schema";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface BotEntryTableProps {
  entries: BotEntry[];
}

export default function BotEntryTable({ entries }: BotEntryTableProps) {
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
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead data-testid="header-datum">Datum</TableHead>
              <TableHead data-testid="header-bot-name">Bot-Name</TableHead>
              <TableHead className="text-right" data-testid="header-investition">Investition (USDT)</TableHead>
              <TableHead className="text-right" data-testid="header-profit-usdt">Profit (USDT)</TableHead>
              <TableHead className="text-right" data-testid="header-profit-percent">Profit (%)</TableHead>
              <TableHead data-testid="header-zeitraum">Zeitraum</TableHead>
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
