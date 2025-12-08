import { useQuery } from "@tanstack/react-query";
import { Wallet, TrendingUp, Percent, Search, Check, Plus } from "lucide-react";
import StatCard from "@/components/StatCard";
import BotEntryTable from "@/components/BotEntryTable";
import ProfitLineChart from "@/components/ProfitLineChart";
import ProfitBarChartAdvanced from "@/components/ProfitBarChartAdvanced";
import { BotEntry, BotType } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useMemo } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const { data: entries = [], isLoading } = useQuery<BotEntry[]>({
    queryKey: ['/api/entries'],
  });

  const [selectedBotName, setSelectedBotName] = useState<string>("Gesamt");
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedBotsForTable, setSelectedBotsForTable] = useState<string[]>([]);
  const [tempSelectedBots, setTempSelectedBots] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  const [timeRangeOpen, setTimeRangeOpen] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState('7 Days');
  const [customTimeOpen, setCustomTimeOpen] = useState(false);
  const [customDays, setCustomDays] = useState('');
  const [customHours, setCustomHours] = useState('');
  const [customMinutes, setCustomMinutes] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });

  const allEntries = useMemo(() => [...entries], [entries]);

  // Hole alle Bot-Types (aktiv + inaktiv, aber nicht archiviert)
  const { data: botTypes = [] } = useQuery<BotType[]>({
    queryKey: ['/api/bot-types'],
  });

  const availableBotTypes = useMemo(() => {
    return botTypes.filter(bt => !bt.isArchived);
  }, [botTypes]);

  const uniqueBotNames = useMemo(() => {
    // Alle nicht-archivierten Bot-Types anzeigen
    const allNames = availableBotTypes.map(bt => bt.name);
    return ["Gesamt", ...allNames.sort()];
  }, [availableBotTypes]);

  const uniqueBotNamesOnly = useMemo(() => {
    // Alle nicht-archivierten Bot-Types anzeigen
    const allNames = availableBotTypes.map(bt => bt.name);
    return allNames.sort();
  }, [availableBotTypes]);

  const filteredEntriesForTable = useMemo(() => {
    let filtered = [...allEntries];
    
    if (selectedBotsForTable.length > 0) {
      filtered = filtered.filter(entry => selectedBotsForTable.includes(entry.botName));
    }
    
    if (selectedPeriod) {
      filtered = filtered.filter(entry => entry.periodType === selectedPeriod);
    }
    
    if (sortColumn) {
      filtered.sort((a, b) => {
        let aValue: any = a[sortColumn as keyof BotEntry];
        let bValue: any = b[sortColumn as keyof BotEntry];
        
        if (sortColumn === 'date') {
          aValue = new Date(aValue).getTime();
          bValue = new Date(bValue).getTime();
        } else if (sortColumn === 'investment' || sortColumn === 'profit' || sortColumn === 'profitPercent') {
          aValue = parseFloat(aValue.toString());
          bValue = parseFloat(bValue.toString());
        } else if (sortColumn === 'botName') {
          aValue = aValue.toLowerCase();
          bValue = bValue.toLowerCase();
        }
        
        let comparison = 0;
        if (aValue > bValue) {
          comparison = 1;
        } else if (aValue < bValue) {
          comparison = -1;
        }
        
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }
    
    return filtered;
  }, [allEntries, selectedBotsForTable, selectedPeriod, sortColumn, sortDirection]);

  const filteredEntries = useMemo(() => {
    if (selectedBotName === "Gesamt") {
      return [...allEntries];
    }
    return allEntries.filter(entry => entry.botName === selectedBotName);
  }, [allEntries, selectedBotName]);

  const filteredBotNames = useMemo(() => {
    if (!searchQuery) return uniqueBotNamesOnly;
    return uniqueBotNamesOnly.filter(name => 
      name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [uniqueBotNamesOnly, searchQuery]);

  const handleOpenDialog = () => {
    setTempSelectedBots([...selectedBotsForTable]);
    setSearchQuery("");
    setDialogOpen(true);
  };

  const handleToggleBot = (botName: string) => {
    setTempSelectedBots(prev => 
      prev.includes(botName) 
        ? prev.filter(b => b !== botName)
        : [...prev, botName]
    );
  };

  const handleSaveSelection = () => {
    setSelectedBotsForTable([...tempSelectedBots]);
    setDialogOpen(false);
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handleTimeRangeSelect = (value: string) => {
    setSelectedTimeRange(value);
    setCustomTimeOpen(value === 'Custom');
    setTimeRangeOpen(false);
  };

  const handleApplyCustomTime = () => {
    // Hier kann die Logik für die Anwendung des Custom-Zeitraums implementiert werden
    console.log('Custom time applied:', { customDays, customHours, customMinutes, dateRange });
    setCustomTimeOpen(false);
  };

  const handleDateSelect = (range: { from: Date | undefined; to: Date | undefined }) => {
    setDateRange(range);
    if (range.from && range.to) {
      const diffMs = range.to.getTime() - range.from.getTime();
      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      
      setCustomDays(days.toString());
      setCustomHours(hours.toString());
      setCustomMinutes(minutes.toString());
      setCalendarOpen(false);
    }
  };

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

  const totalInvestment = filteredEntries.reduce((sum, entry) => sum + parseFloat(entry.investment), 0);
  const totalProfit = filteredEntries.reduce((sum, entry) => sum + parseFloat(entry.profit), 0);
  const totalProfitPercent = totalInvestment > 0 ? (totalProfit / totalInvestment) * 100 : 0;
  
  const dayCount = filteredEntries.length > 0 
    ? Math.max(1, Math.ceil((new Date().getTime() - new Date(filteredEntries[filteredEntries.length - 1].date).getTime()) / (1000 * 60 * 60 * 24)))
    : 1;
  const avgDailyProfit = totalProfit / dayCount;

  const lineChartData = filteredEntries
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

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center gap-4 mb-8 flex-wrap">
          <h1 className="text-2xl font-bold" data-testid="heading-dashboard">Übersicht</h1>
          
          <div className="flex items-center gap-2">
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="w-[300px] justify-between"
                  data-testid="button-bot-filter"
                >
                  {selectedBotName}
                  <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0">
                <Command>
                  <CommandInput placeholder="Bot suchen..." data-testid="input-bot-search" />
                  <CommandList>
                    <CommandEmpty>Kein Bot gefunden.</CommandEmpty>
                    <CommandGroup>
                      {uniqueBotNames.map((botName) => (
                        <CommandItem
                          key={botName}
                          value={botName}
                          onSelect={(currentValue) => {
                            const selectedName = uniqueBotNames.find(
                              name => name.toLowerCase() === currentValue.toLowerCase()
                            ) || "Gesamt";
                            setSelectedBotName(selectedName);
                            setOpen(false);
                          }}
                          data-testid={`option-bot-${botName}`}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedBotName === botName ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {botName}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

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
            icon={CalendarIcon}
            iconColor="bg-orange-100 text-orange-600"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <ProfitLineChart data={lineChartData} title="Profit-Verlauf" />
          </div>
          <Card className="p-4">
            <h4 className="text-sm font-semibold mb-3">Graph-Einstellungen</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Letzten</span>
                <Popover open={timeRangeOpen} onOpenChange={setTimeRangeOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      {selectedTimeRange}
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-40 p-2" align="end">
                    <div className="space-y-1">
                      {['Custom', '1 h', '24 h', '1 Day', '7 Days', '30 Days'].map((option) => (
                        <Button
                          key={option}
                          variant={selectedTimeRange === option ? "default" : "ghost"}
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => handleTimeRangeSelect(option)}
                        >
                          {option}
                        </Button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              
              {customTimeOpen && (
                <>
                  <Separator />
                  <div className="space-y-2 p-2 bg-muted/50 rounded-md">
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        placeholder="0"
                        value={customDays}
                        onChange={(e) => setCustomDays(e.target.value)}
                        className="h-8 text-xs"
                      />
                      <span className="text-xs text-muted-foreground">D</span>
                      
                      <Input
                        type="number"
                        placeholder="0"
                        value={customHours}
                        onChange={(e) => setCustomHours(e.target.value)}
                        className="h-8 text-xs"
                      />
                      <span className="text-xs text-muted-foreground">H</span>
                      
                      <Input
                        type="number"
                        placeholder="0"
                        value={customMinutes}
                        onChange={(e) => setCustomMinutes(e.target.value)}
                        className="h-8 text-xs"
                      />
                      <span className="text-xs text-muted-foreground">M</span>
                      
                      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                            <CalendarIcon className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                          <Calendar
                            mode="range"
                            selected={dateRange as any}
                            onSelect={handleDateSelect as any}
                            numberOfMonths={2}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    
                    <Button
                      size="sm"
                      className="w-full h-7 text-xs"
                      onClick={handleApplyCustomTime}
                    >
                      Apply
                    </Button>
                  </div>
                </>
              )}
              
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm">Datenansicht</span>
                <Button variant="outline" size="sm">Profit</Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm">Charttyp</span>
                <Button variant="outline" size="sm">Linie</Button>
              </div>
            </div>
          </Card>
        </div>

        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">
            {selectedBotName === "Gesamt" ? "Alle Einträge" : `Einträge: ${selectedBotName}`}
          </h2>
          <BotEntryTable 
            entries={filteredEntriesForTable} 
            selectedPeriod={selectedPeriod}
            onPeriodChange={setSelectedPeriod}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={handleSort}
          />
          
          <Card 
            className="mt-4 p-6 text-center cursor-pointer hover-elevate"
            onClick={handleOpenDialog}
            data-testid="button-add-bot-version"
          >
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Plus className="w-5 h-5" />
              <span className="font-medium">Bot-Version hinzufügen</span>
            </div>
          </Card>
        </div>

        <div className="mb-8">
          <ProfitBarChartAdvanced entries={allEntries} title="Profit nach Bot" />
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Bots für Tabelle auswählen</DialogTitle>
              <DialogDescription>
                Wählen Sie die Bots aus, die in der Tabelle angezeigt werden sollen.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {tempSelectedBots.length} ausgewählt
                </span>
              </div>

              <Input
                placeholder="Bot suchen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-bot-search-dialog"
              />

              <div className="max-h-[350px] overflow-y-auto space-y-2">
                {filteredBotNames.map((botName) => (
                  <div
                    key={botName}
                    className="flex items-center space-x-2 p-2 rounded hover-elevate cursor-pointer"
                    onClick={() => handleToggleBot(botName)}
                    data-testid={`checkbox-bot-${botName}`}
                  >
                    <Checkbox
                      checked={tempSelectedBots.includes(botName)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setTempSelectedBots(prev => [...prev, botName]);
                        } else {
                          setTempSelectedBots(prev => prev.filter(b => b !== botName));
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="text-sm">{botName}</span>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                data-testid="button-cancel-selection"
              >
                Abbrechen
              </Button>
              <Button
                onClick={handleSaveSelection}
                data-testid="button-save-selection"
              >
                Speichern
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
