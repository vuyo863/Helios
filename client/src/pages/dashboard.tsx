import { useQuery } from "@tanstack/react-query";
import { Wallet, TrendingUp, Percent, Search, Check, Plus } from "lucide-react";
import StatCard from "@/components/StatCard";
import BotEntryTable from "@/components/BotEntryTable";
import ProfitLineChart from "@/components/ProfitLineChart";
import ProfitBarChartAdvanced from "@/components/ProfitBarChartAdvanced";
import { BotEntry, BotType, BotTypeUpdate } from "@shared/schema";
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
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from "date-fns";
import { de } from "date-fns/locale";

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
  const [activeMetricCards, setActiveMetricCards] = useState<string[]>([]);
  const [showGridProfit, setShowGridProfit] = useState(false);
  const [showTrendPnl, setShowTrendPnl] = useState(false);
  const [showHighestValue, setShowHighestValue] = useState(false);
  const [showLowestValue, setShowLowestValue] = useState(false);
  
  // From/Until update selection
  const [fromUpdateDialogOpen, setFromUpdateDialogOpen] = useState(false);
  const [untilUpdateDialogOpen, setUntilUpdateDialogOpen] = useState(false);
  const [selectedFromUpdate, setSelectedFromUpdate] = useState<any | null>(null);
  const [selectedUntilUpdate, setSelectedUntilUpdate] = useState<any | null>(null);
  const [tempSelectedUpdate, setTempSelectedUpdate] = useState<any | null>(null);
  const [updateSortBy, setUpdateSortBy] = useState<'datum' | 'gridProfit' | 'gridProfit24h' | 'gesInvest'>('datum');
  const [updateSortDirection, setUpdateSortDirection] = useState<'desc' | 'asc'>('desc');
  const [settingsCollapsed, setSettingsCollapsed] = useState(false);

  const allEntries = useMemo(() => [...entries], [entries]);

  // Hole alle Bot-Types (aktiv + inaktiv, aber nicht archiviert)
  const { data: botTypes = [] } = useQuery<BotType[]>({
    queryKey: ['/api/bot-types'],
  });

  const availableBotTypes = useMemo(() => {
    return botTypes.filter(bt => !bt.isArchived);
  }, [botTypes]);

  // Hole Updates für den ausgewählten Bot Type
  const selectedBotTypeData = useMemo(() => {
    if (selectedBotName === "Gesamt") return null;
    return availableBotTypes.find(bt => bt.name === selectedBotName);
  }, [selectedBotName, availableBotTypes]);

  const { data: selectedBotTypeUpdates = [] } = useQuery<any[]>({
    queryKey: ['/api/bot-types', selectedBotTypeData?.id, 'updates'],
    enabled: !!selectedBotTypeData?.id,
  });

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

  const handleApplySettings = () => {
    // Hier kann die Logik für die Anwendung der Einstellungen implementiert werden
    console.log('Settings applied:', { 
      selectedTimeRange, 
      customDays, 
      customHours, 
      customMinutes, 
      dateRange,
      activeMetricCards,
      showGridProfit,
      showTrendPnl,
      showHighestValue,
      showLowestValue
    });
  };

  const toggleMetricCard = (cardName: string) => {
    setActiveMetricCards(prev => 
      prev.includes(cardName) 
        ? prev.filter(name => name !== cardName)
        : [...prev, cardName]
    );
  };

  const handleFromUpdateSelect = (update: any) => {
    setTempSelectedUpdate(update);
  };

  const handleUntilUpdateSelect = (update: any) => {
    setTempSelectedUpdate(update);
  };

  const handleApplyFromUpdate = () => {
    setSelectedFromUpdate(tempSelectedUpdate);
    setFromUpdateDialogOpen(false);
    setTempSelectedUpdate(null);
  };

  const handleApplyUntilUpdate = () => {
    setSelectedUntilUpdate(tempSelectedUpdate);
    setUntilUpdateDialogOpen(false);
    setTempSelectedUpdate(null);
  };

  const sortedUpdates = useMemo(() => {
    if (!selectedBotTypeUpdates.length) return [];
    
    return [...selectedBotTypeUpdates].sort((a, b) => {
      let valueA: number = 0;
      let valueB: number = 0;
      
      switch (updateSortBy) {
        case 'datum':
          valueA = a.createdAt ? new Date(a.createdAt as Date).getTime() : 0;
          valueB = b.createdAt ? new Date(b.createdAt as Date).getTime() : 0;
          break;
        case 'gridProfit':
          valueA = parseFloat(a.overallGridProfitUsdt || '0') || 0;
          valueB = parseFloat(b.overallGridProfitUsdt || '0') || 0;
          break;
        case 'gridProfit24h':
          valueA = parseFloat(a.avgGridProfitDay || '0') || 0;
          valueB = parseFloat(b.avgGridProfitDay || '0') || 0;
          break;
        case 'gesInvest':
          valueA = parseFloat(a.totalInvestment || '0') || 0;
          valueB = parseFloat(b.totalInvestment || '0') || 0;
          break;
      }
      
      return updateSortDirection === 'desc' ? valueB - valueA : valueA - valueB;
    });
  }, [selectedBotTypeUpdates, updateSortBy, updateSortDirection]);

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
          <div 
            onClick={() => toggleMetricCard('Gesamtkapital')}
            className={`cursor-pointer transition-all ${
              activeMetricCards.includes('Gesamtkapital') 
                ? 'ring-2 ring-cyan-600 shadow-[0_0_15px_rgba(8,145,178,0.6)] rounded-lg' 
                : ''
            }`}
          >
            <StatCard
              label="Gesamtkapital"
              value={`${totalInvestment.toLocaleString('de-DE', { minimumFractionDigits: 2 })} USDT`}
              icon={Wallet}
              iconColor="bg-blue-100 text-blue-600"
            />
          </div>
          <div 
            onClick={() => toggleMetricCard('Gesamtprofit')}
            className={`cursor-pointer transition-all ${
              activeMetricCards.includes('Gesamtprofit') 
                ? 'ring-2 ring-cyan-600 shadow-[0_0_15px_rgba(8,145,178,0.6)] rounded-lg' 
                : ''
            }`}
          >
            <StatCard
              label="Gesamtprofit"
              value={`${totalProfit.toLocaleString('de-DE', { minimumFractionDigits: 2 })} USDT`}
              icon={TrendingUp}
              iconColor="bg-green-100 text-green-600"
            />
          </div>
          <div 
            onClick={() => toggleMetricCard('Gesamtprofit %')}
            className={`cursor-pointer transition-all ${
              activeMetricCards.includes('Gesamtprofit %') 
                ? 'ring-2 ring-cyan-600 shadow-[0_0_15px_rgba(8,145,178,0.6)] rounded-lg' 
                : ''
            }`}
          >
            <StatCard
              label="Gesamtprofit %"
              value={`${totalProfitPercent.toFixed(2)}%`}
              icon={Percent}
              iconColor="bg-purple-100 text-purple-600"
            />
          </div>
          <div 
            onClick={() => toggleMetricCard('Ø Profit/Tag')}
            className={`cursor-pointer transition-all ${
              activeMetricCards.includes('Ø Profit/Tag') 
                ? 'ring-2 ring-cyan-600 shadow-[0_0_15px_rgba(8,145,178,0.6)] rounded-lg' 
                : ''
            }`}
          >
            <StatCard
              label="Ø Profit/Tag"
              value={`${avgDailyProfit.toLocaleString('de-DE', { minimumFractionDigits: 2 })} USDT`}
              icon={CalendarIcon}
              iconColor="bg-orange-100 text-orange-600"
            />
          </div>
        </div>

        <div className={`grid grid-cols-1 gap-6 mb-8 ${settingsCollapsed ? 'lg:grid-cols-1' : 'lg:grid-cols-3'}`}>
          <div className={settingsCollapsed ? '' : 'lg:col-span-2'}>
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold">Update Verlauf</h3>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">From:</span>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-2 min-w-[120px]"
                      onClick={() => selectedBotName !== "Gesamt" && setFromUpdateDialogOpen(true)}
                      disabled={selectedBotName === "Gesamt"}
                    >
                      {selectedFromUpdate ? `#${selectedFromUpdate.version}` : 'Select'}
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Until:</span>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-2 min-w-[120px]"
                      onClick={() => selectedBotName !== "Gesamt" && setUntilUpdateDialogOpen(true)}
                      disabled={selectedBotName === "Gesamt"}
                    >
                      {selectedUntilUpdate ? `#${selectedUntilUpdate.version}` : 'Select'}
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setSettingsCollapsed(!settingsCollapsed)}
                  >
                    {settingsCollapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart 
                  data={[
                    { time: '00:00', wert: 0 },
                    { time: '04:00', wert: 0 },
                    { time: '08:00', wert: 0 },
                    { time: '12:00', wert: 0 },
                    { time: '16:00', wert: 0 },
                    { time: '20:00', wert: 0 },
                    { time: '24:00', wert: 0 },
                  ]}
                  margin={{ top: 5, right: 30, left: 20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="time"
                    label={{ value: 'Time', position: 'insideBottom', offset: -10, style: { fontSize: 14, fill: 'hsl(var(--muted-foreground))' } }}
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    dataKey="wert"
                    label={{ value: 'Wert', angle: -90, position: 'insideLeft', style: { fontSize: 14, fill: 'hsl(var(--muted-foreground))' } }}
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="wert" 
                    stroke="hsl(var(--chart-2))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--chart-2))', r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>
          {!settingsCollapsed && (
          <Card className="p-4 relative flex flex-col">
            <h4 className="text-sm font-semibold mb-3">Graph-Einstellungen</h4>
            <div className="space-y-3 flex-1">
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
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Grid Profit</span>
                  <Switch
                    checked={showGridProfit}
                    onCheckedChange={setShowGridProfit}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Trend P&L</span>
                  <Switch
                    checked={showTrendPnl}
                    onCheckedChange={setShowTrendPnl}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Highest Value</span>
                  <Switch
                    checked={showHighestValue}
                    onCheckedChange={setShowHighestValue}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Lowest Value</span>
                  <Switch
                    checked={showLowestValue}
                    onCheckedChange={setShowLowestValue}
                  />
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm">Charttyp</span>
                <Button variant="outline" size="sm">Linie</Button>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button 
                size="sm"
                onClick={handleApplySettings}
                data-testid="button-apply-settings"
              >
                Apply
              </Button>
            </div>
          </Card>
          )}
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

        <Dialog open={fromUpdateDialogOpen} onOpenChange={setFromUpdateDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>From Update auswählen - {selectedBotName}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm text-muted-foreground">Update Verlauf</h4>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Sortieren:</span>
                  <Select value={updateSortBy} onValueChange={(value) => setUpdateSortBy(value as typeof updateSortBy)}>
                    <SelectTrigger className="h-7 w-[140px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="datum">Datum</SelectItem>
                      <SelectItem value="gridProfit">Grid Profit</SelectItem>
                      <SelectItem value="gridProfit24h">Grid Profit 24H Ø</SelectItem>
                      <SelectItem value="gesInvest">Ges. Invest</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="icon"
                    variant={updateSortDirection === 'desc' ? 'default' : 'outline'}
                    className="h-7 w-7"
                    onClick={() => setUpdateSortDirection('desc')}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant={updateSortDirection === 'asc' ? 'default' : 'outline'}
                    className="h-7 w-7"
                    onClick={() => setUpdateSortDirection('asc')}
                  >
                    <ChevronUp className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {sortedUpdates.map((update) => (
                  <Card 
                    key={update.id}
                    className={cn(
                      "cursor-pointer transition-all",
                      tempSelectedUpdate?.id === update.id && "ring-2 ring-primary"
                    )}
                    onClick={() => handleFromUpdateSelect(update)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm mb-2">
                            {update.status} #{update.version}
                          </p>
                          <div className="flex flex-col gap-y-1 text-xs">
                            <div className="flex items-center flex-wrap gap-x-6">
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <Calendar className="w-3 h-3" />
                                {update.createdAt 
                                  ? format(new Date(update.createdAt as Date), "dd.MM.yyyy HH:mm", { locale: de })
                                  : '-'
                                }
                              </span>
                            </div>
                            <div className="flex items-center flex-wrap gap-x-6">
                              <span className="flex items-center gap-1.5">
                                <span className="text-muted-foreground">Grid Profit 24H Ø:</span>
                                <span className="font-medium text-primary">
                                  {update.avgGridProfitDay ? `${parseFloat(update.avgGridProfitDay) > 0 ? '+' : ''}${parseFloat(update.avgGridProfitDay).toFixed(2)}` : '0.00'} USDT
                                </span>
                              </span>
                              <span className="flex items-center gap-1.5">
                                <span className="text-muted-foreground">Grid Profit:</span>
                                <span className="font-medium text-primary">
                                  {update.overallGridProfitUsdt ? `${parseFloat(update.overallGridProfitUsdt) > 0 ? '+' : ''}${parseFloat(update.overallGridProfitUsdt).toFixed(4)}` : '0.00'} USDT
                                </span>
                              </span>
                            </div>
                            <div className="flex items-center flex-wrap gap-x-6">
                              <span className="flex items-center gap-1.5">
                                <span className="text-muted-foreground">Gesamt-Investment:</span>
                                <span className="font-medium">{update.totalInvestment || '0.00'} USDT</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setFromUpdateDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleApplyFromUpdate} disabled={!tempSelectedUpdate}>
                Apply
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={untilUpdateDialogOpen} onOpenChange={setUntilUpdateDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Until Update auswählen - {selectedBotName}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm text-muted-foreground">Update Verlauf</h4>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Sortieren:</span>
                  <Select value={updateSortBy} onValueChange={(value) => setUpdateSortBy(value as typeof updateSortBy)}>
                    <SelectTrigger className="h-7 w-[140px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="datum">Datum</SelectItem>
                      <SelectItem value="gridProfit">Grid Profit</SelectItem>
                      <SelectItem value="gridProfit24h">Grid Profit 24H Ø</SelectItem>
                      <SelectItem value="gesInvest">Ges. Invest</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="icon"
                    variant={updateSortDirection === 'desc' ? 'default' : 'outline'}
                    className="h-7 w-7"
                    onClick={() => setUpdateSortDirection('desc')}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant={updateSortDirection === 'asc' ? 'default' : 'outline'}
                    className="h-7 w-7"
                    onClick={() => setUpdateSortDirection('asc')}
                  >
                    <ChevronUp className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {sortedUpdates.map((update) => (
                  <Card 
                    key={update.id}
                    className={cn(
                      "cursor-pointer transition-all",
                      tempSelectedUpdate?.id === update.id && "ring-2 ring-primary"
                    )}
                    onClick={() => handleUntilUpdateSelect(update)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm mb-2">
                            {update.status} #{update.version}
                          </p>
                          <div className="flex flex-col gap-y-1 text-xs">
                            <div className="flex items-center flex-wrap gap-x-6">
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <Calendar className="w-3 h-3" />
                                {update.createdAt 
                                  ? format(new Date(update.createdAt as Date), "dd.MM.yyyy HH:mm", { locale: de })
                                  : '-'
                                }
                              </span>
                            </div>
                            <div className="flex items-center flex-wrap gap-x-6">
                              <span className="flex items-center gap-1.5">
                                <span className="text-muted-foreground">Grid Profit 24H Ø:</span>
                                <span className="font-medium text-primary">
                                  {update.avgGridProfitDay ? `${parseFloat(update.avgGridProfitDay) > 0 ? '+' : ''}${parseFloat(update.avgGridProfitDay).toFixed(2)}` : '0.00'} USDT
                                </span>
                              </span>
                              <span className="flex items-center gap-1.5">
                                <span className="text-muted-foreground">Grid Profit:</span>
                                <span className="font-medium text-primary">
                                  {update.overallGridProfitUsdt ? `${parseFloat(update.overallGridProfitUsdt) > 0 ? '+' : ''}${parseFloat(update.overallGridProfitUsdt).toFixed(4)}` : '0.00'} USDT
                                </span>
                              </span>
                            </div>
                            <div className="flex items-center flex-wrap gap-x-6">
                              <span className="flex items-center gap-1.5">
                                <span className="text-muted-foreground">Gesamt-Investment:</span>
                                <span className="font-medium">{update.totalInvestment || '0.00'} USDT</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setUntilUpdateDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleApplyUntilUpdate} disabled={!tempSelectedUpdate}>
                Apply
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
