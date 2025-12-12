import { useQuery } from "@tanstack/react-query";
import { Wallet, TrendingUp, Percent, Search, Check, Plus, Zap, Pencil, X, Save, GripVertical } from "lucide-react";
import StatCard from "@/components/StatCard";
import BotEntryTable, { BotTypeTableData, calculateBotTypeTableData } from "@/components/BotEntryTable";
import ProfitLineChart from "@/components/ProfitLineChart";
import ProfitBarChartAdvanced from "@/components/ProfitBarChartAdvanced";
import { BotEntry, BotType, BotTypeUpdate } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useMemo, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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

// Helper function to parse runtime string to hours (same as bot-types.tsx)
function parseRuntimeToHours(runtime: string | null | undefined): number {
  if (!runtime) return 0;
  
  let totalHours = 0;
  
  // Match days
  const daysMatch = runtime.match(/(\d+)d/);
  if (daysMatch) totalHours += parseInt(daysMatch[1]) * 24;
  
  // Match hours
  const hoursMatch = runtime.match(/(\d+)h/);
  if (hoursMatch) totalHours += parseInt(hoursMatch[1]);
  
  // Match minutes
  const minutesMatch = runtime.match(/(\d+)m/);
  if (minutesMatch) totalHours += parseInt(minutesMatch[1]) / 60;
  
  return totalHours;
}

// Default order for metric cards
const DEFAULT_CARD_ORDER = ['Gesamtkapital', 'Gesamtprofit', 'Gesamtprofit %', 'Ø Profit/Tag', 'Real Profit/Tag'];

// SortableItem component for drag and drop
interface SortableItemProps {
  id: string;
  children: React.ReactNode;
  isEditMode: boolean;
}

function SortableItem({ id, children, isEditMode }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !isEditMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      {isEditMode && (
        <div
          {...attributes}
          {...listeners}
          className="absolute -top-2 -left-2 z-10 bg-primary text-primary-foreground rounded-full p-1 cursor-grab active:cursor-grabbing shadow-md"
        >
          <GripVertical className="h-3 w-3" />
        </div>
      )}
      {children}
    </div>
  );
}

export default function Dashboard() {
  const { data: entries = [], isLoading } = useQuery<BotEntry[]>({
    queryKey: ['/api/entries'],
  });

  const [selectedBotName, setSelectedBotName] = useState<string>("Gesamt");
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [removedBotsFromTable, setRemovedBotsFromTable] = useState<string[]>([]);
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
  const [chartSequence, setChartSequence] = useState<'hours' | 'days' | 'weeks' | 'months'>('days');
  
  // From/Until update selection
  const [fromUpdateDialogOpen, setFromUpdateDialogOpen] = useState(false);
  const [untilUpdateDialogOpen, setUntilUpdateDialogOpen] = useState(false);
  const [selectedFromUpdate, setSelectedFromUpdate] = useState<any | null>(null);
  const [selectedUntilUpdate, setSelectedUntilUpdate] = useState<any | null>(null);
  const [tempSelectedUpdate, setTempSelectedUpdate] = useState<any | null>(null);
  const [updateSortBy, setUpdateSortBy] = useState<'datum' | 'gridProfit' | 'gridProfit24h' | 'gesInvest'>('datum');
  const [updateSortDirection, setUpdateSortDirection] = useState<'desc' | 'asc'>('desc');
  const [settingsCollapsed, setSettingsCollapsed] = useState(false);

  // Drag and drop state for metric cards
  const [isCardEditMode, setIsCardEditMode] = useState(false);
  const [cardOrder, setCardOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem('dashboardCardOrder');
    return saved ? JSON.parse(saved) : DEFAULT_CARD_ORDER;
  });
  const [tempCardOrder, setTempCardOrder] = useState<string[]>(cardOrder);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setTempCardOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  // Save card order
  const handleSaveCardOrder = () => {
    setCardOrder(tempCardOrder);
    localStorage.setItem('dashboardCardOrder', JSON.stringify(tempCardOrder));
    setIsCardEditMode(false);
  };

  // Cancel card order edit
  const handleCancelCardOrder = () => {
    setTempCardOrder(cardOrder);
    setIsCardEditMode(false);
  };

  // Start edit mode
  const handleStartCardEdit = () => {
    setTempCardOrder(cardOrder);
    setIsCardEditMode(true);
  };

  // Hole alle Bot-Types (aktiv + inaktiv, aber nicht archiviert)
  const { data: botTypes = [] } = useQuery<BotType[]>({
    queryKey: ['/api/bot-types'],
    refetchInterval: 2000, // Auto-refresh alle 2 Sekunden
  });

  // Hole Updates für alle Bot-Types für Gesamtkapital-Berechnung
  const { data: allBotTypeUpdates = [] } = useQuery<any[]>({
    queryKey: ['/api/bot-type-updates'],
    refetchInterval: 2000, // Auto-refresh alle 2 Sekunden
  });

  // ALLE useMemo Hooks MÜSSEN hier stehen, BEVOR irgendwelche Bedingungen geprüft werden
  const allEntries = useMemo(() => [...entries], [entries]);

  const availableBotTypes = useMemo(() => {
    return botTypes.filter(bt => !bt.isArchived);
  }, [botTypes]);

  const selectedBotTypeData = useMemo(() => {
    if (selectedBotName === "Gesamt") return null;
    return availableBotTypes.find(bt => bt.name === selectedBotName);
  }, [selectedBotName, availableBotTypes]);

  const uniqueBotNames = useMemo(() => {
    const allNames = availableBotTypes.map(bt => bt.name);
    return ["Gesamt", ...allNames.sort()];
  }, [availableBotTypes]);

  const uniqueBotNamesOnly = useMemo(() => {
    const allNames = availableBotTypes.map(bt => bt.name);
    return allNames.sort();
  }, [availableBotTypes]);

  // Automatisch alle aktiven Bot-Types anzeigen, außer die manuell entfernten
  const selectedBotsForTable = useMemo(() => {
    const activeBotNames = availableBotTypes
      .filter(bt => bt.isActive)
      .map(bt => bt.name);
    return activeBotNames.filter(name => !removedBotsFromTable.includes(name));
  }, [availableBotTypes, removedBotsFromTable]);

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

  const filteredEntriesForStats = useMemo(() => {
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

  // Berechne Bot-Type-Tabellendaten für die ausgewählten Bots
  const botTypeTableData = useMemo((): BotTypeTableData[] => {
    // Finde die ausgewählten Bot-Types basierend auf den Namen
    const selectedBotTypes = selectedBotsForTable.length > 0
      ? availableBotTypes.filter(bt => selectedBotsForTable.includes(bt.name))
      : [];
    
    // Berechne die Tabellendaten für jeden ausgewählten Bot-Type
    let tableData = selectedBotTypes.map(botType => 
      calculateBotTypeTableData(botType, allBotTypeUpdates)
    );
    
    // Sortierung anwenden
    // Pfeil runter (desc) = größter Wert oben
    // Pfeil hoch (asc) = kleinster Wert oben
    if (sortColumn) {
      tableData.sort((a, b) => {
        let aValue: any = a[sortColumn as keyof BotTypeTableData];
        let bValue: any = b[sortColumn as keyof BotTypeTableData];
        
        // Datum-Spalten: In Zeitstempel umwandeln
        if (sortColumn === 'lastUpdated' || sortColumn === 'metricStarted' || sortColumn === 'latestDate') {
          aValue = aValue ? new Date(aValue).getTime() : 0;
          bValue = bValue ? new Date(bValue).getTime() : 0;
        } else if (sortColumn === 'name') {
          aValue = aValue?.toLowerCase() || '';
          bValue = bValue?.toLowerCase() || '';
        }
        
        let comparison = 0;
        if (aValue > bValue) {
          comparison = 1;
        } else if (aValue < bValue) {
          comparison = -1;
        }
        
        // desc = größter Wert oben (comparison * -1)
        // asc = kleinster Wert oben (comparison)
        return sortDirection === 'desc' ? -comparison : comparison;
      });
    }
    
    return tableData;
  }, [selectedBotsForTable, availableBotTypes, allBotTypeUpdates, sortColumn, sortDirection]);

  // Hole Updates für den ausgewählten Bot Type
  const { data: selectedBotTypeUpdates = [] } = useQuery<any[]>({
    queryKey: ['/api/bot-types', selectedBotTypeData?.id || 'none', 'updates'],
    enabled: !!selectedBotTypeData?.id,
    refetchInterval: 2000, // Auto-refresh alle 2 Sekunden
  });

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

  // Berechne totalInvestment basierend auf Bot Type Status - MUSS VOR isLoading check sein!
  // Verwendet dieselbe Logik wie Bot-Types-Seite: Durchschnitt aller "Update Metrics" pro Bot-Type
  const totalInvestment = useMemo(() => {
    if (selectedBotName === "Gesamt") {
      // Prüfe ob alle benötigten Daten vorhanden sind
      if (!availableBotTypes || !allBotTypeUpdates || availableBotTypes.length === 0 || allBotTypeUpdates.length === 0) {
        // Falls Daten fehlen, nutze Entries als Fallback
        return filteredEntriesForStats.reduce((sum, entry) => sum + parseFloat(entry.investment), 0);
      }
      
      // Summiere Gesamtinvestment-Ø von allen aktiven Bot Types
      // Gesamtinvestment-Ø = Durchschnitt aller totalInvestment von Updates mit Status "Update Metrics"
      const activeBotTypes = availableBotTypes.filter(bt => bt.isActive);
      let sum = 0;
      
      activeBotTypes.forEach(botType => {
        // Nur Updates mit Status "Update Metrics" verwenden (wie auf Bot-Types-Seite)
        const updateMetricsOnly = allBotTypeUpdates.filter(
          update => update.botTypeId === botType.id && update.status === "Update Metrics"
        );
        
        if (updateMetricsOnly.length > 0) {
          // Berechne Durchschnitt aller totalInvestment Werte
          const avgInvestment = updateMetricsOnly.reduce(
            (s, u) => s + (parseFloat(u.totalInvestment || '0') || 0), 0
          ) / updateMetricsOnly.length;
          sum += avgInvestment;
        }
      });
      
      return sum;
    } else {
      // Für spezifischen Bot: Summiere aus Entries
      return filteredEntriesForStats.reduce((sum, entry) => sum + parseFloat(entry.investment), 0);
    }
  }, [selectedBotName, availableBotTypes, allBotTypeUpdates, filteredEntriesForStats]);
  
  // Berechne totalProfit - Dieselbe Logik wie Bot-Types-Seite:
  // - Update Metrics: overallGridProfitUsdt (Grid Profit)
  // - Closed Bots: profit (Gesamt Profit)
  const totalProfit = useMemo(() => {
    if (selectedBotName === "Gesamt") {
      // Prüfe ob alle benötigten Daten vorhanden sind
      if (!availableBotTypes || !allBotTypeUpdates || availableBotTypes.length === 0 || allBotTypeUpdates.length === 0) {
        // Falls Daten fehlen, nutze Entries als Fallback
        return filteredEntriesForStats.reduce((sum, entry) => sum + parseFloat(entry.profit), 0);
      }
      
      // Summiere Gesamt Profit von allen aktiven Bot Types
      const activeBotTypes = availableBotTypes.filter(bt => bt.isActive);
      let sum = 0;
      
      activeBotTypes.forEach(botType => {
        const updatesForType = allBotTypeUpdates.filter(update => update.botTypeId === botType.id);
        
        // Gesamt Profit: Alle Updates, aber unterschiedliche Felder je nach Status
        // - Update Metrics: overallGridProfitUsdt (Grid Profit)
        // - Closed Bots: profit (Gesamt Profit)
        const totalGridProfit = updatesForType.reduce((s, update) => {
          if (update.status === 'Closed Bots') {
            return s + (parseFloat(update.profit || '0') || 0);
          } else {
            return s + (parseFloat(update.overallGridProfitUsdt || '0') || 0);
          }
        }, 0);
        
        sum += totalGridProfit;
      });
      
      return sum;
    } else {
      // Für spezifischen Bot: Summiere aus Entries
      return filteredEntriesForStats.reduce((sum, entry) => sum + parseFloat(entry.profit), 0);
    }
  }, [selectedBotName, availableBotTypes, allBotTypeUpdates, filteredEntriesForStats]);
  
  const totalProfitPercent = useMemo(() => 
    totalInvestment > 0 ? (totalProfit / totalInvestment) * 100 : 0,
    [totalInvestment, totalProfit]
  );

  // Ø Profit/Tag: Summe der "24h Ø Profit" von allen aktiven Bot-Types
  // Berechnung wie auf Bot-Types-Seite: weighted average (totalProfit / totalHours * 24)
  const avgDailyProfit = useMemo(() => {
    if (selectedBotName === "Gesamt") {
      if (!availableBotTypes || !allBotTypeUpdates || availableBotTypes.length === 0 || allBotTypeUpdates.length === 0) {
        return 0;
      }
      
      const activeBotTypes = availableBotTypes.filter(bt => bt.isActive);
      let totalAvg24h = 0;
      
      activeBotTypes.forEach(botType => {
        const updateMetricsOnly = allBotTypeUpdates.filter(
          update => update.botTypeId === botType.id && update.status === 'Update Metrics'
        );
        
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
            const avg24h = profitPerHour * 24;
            totalAvg24h += avg24h;
          }
        }
      });
      
      return totalAvg24h;
    } else {
      // Für spezifischen Bot: Fallback
      return 0;
    }
  }, [selectedBotName, availableBotTypes, allBotTypeUpdates]);

  // Real Profit/Tag: Summe der "Real 24h Profit" von allen aktiven Bot-Types
  // Berechnung wie auf Bot-Types-Seite:
  // - Wenn Runtime < 24h: Nimm den gesamten Grid Profit
  // - Wenn Runtime >= 24h: Nimm den avgGridProfitDay
  const real24hProfit = useMemo(() => {
    if (selectedBotName === "Gesamt") {
      if (!availableBotTypes || !allBotTypeUpdates || availableBotTypes.length === 0 || allBotTypeUpdates.length === 0) {
        return 0;
      }
      
      const activeBotTypes = availableBotTypes.filter(bt => bt.isActive);
      let totalReal24h = 0;
      
      activeBotTypes.forEach(botType => {
        const updateMetricsOnly = allBotTypeUpdates.filter(
          update => update.botTypeId === botType.id && update.status === 'Update Metrics'
        );
        
        updateMetricsOnly.forEach(update => {
          const gridProfit = parseFloat(update.overallGridProfitUsdt || '0') || 0;
          const runtimeHours = parseRuntimeToHours(update.avgRuntime);
          const avgGridProfitDay = parseFloat(update.avgGridProfitDay || '0') || 0;
          
          if (runtimeHours < 24) {
            // Bot läuft weniger als 24h: Nimm den gesamten Grid Profit
            totalReal24h += gridProfit;
          } else {
            // Bot läuft 24h oder länger: Nimm den Durchschnitt pro Tag
            totalReal24h += avgGridProfitDay;
          }
        });
      });
      
      return totalReal24h;
    } else {
      return 0;
    }
  }, [selectedBotName, availableBotTypes, allBotTypeUpdates]);

  const lineChartData = useMemo(() => 
    filteredEntriesForStats
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
      }, [] as { date: string; profit: number }[]),
    [filteredEntriesForStats]
  );

  // Handler functions
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
    // Berechne welche Bots entfernt wurden vs. welche hinzugefügt wurden
    const activeBotNames = availableBotTypes
      .filter(bt => bt.isActive)
      .map(bt => bt.name);
    
    // Bots die aktiv sind aber nicht in tempSelectedBots -> zu removedBotsFromTable hinzufügen
    // Bots die in tempSelectedBots sind -> aus removedBotsFromTable entfernen
    const newRemovedBots = activeBotNames.filter(name => !tempSelectedBots.includes(name));
    setRemovedBotsFromTable(newRemovedBots);
    setDialogOpen(false);
  };

  const handleRemoveBotType = (botTypeId: string) => {
    // Finde den Bot-Type Namen basierend auf der ID und füge ihn zu removedBotsFromTable hinzu
    const botType = availableBotTypes.find(bt => bt.id === botTypeId);
    if (botType) {
      setRemovedBotsFromTable(prev => [...prev, botType.name]);
    }
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <h1 className="text-2xl font-bold mb-8">Dashboard</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center gap-4 mb-8 flex-wrap">
          <h1 className="text-2xl font-bold" data-testid="heading-dashboard">Dashboard</h1>
          
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
            
            {isCardEditMode ? (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSaveCardOrder}
                  className="h-8 w-8"
                  data-testid="button-save-card-order"
                >
                  <Save className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCancelCardOrder}
                  className="h-8 w-8"
                  data-testid="button-cancel-card-order"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleStartCardEdit}
                className="h-8 w-8"
                data-testid="button-edit-card-order"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={isCardEditMode ? tempCardOrder : cardOrder}
            strategy={horizontalListSortingStrategy}
          >
            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8 ${isCardEditMode ? 'pt-4' : ''}`}>
              {(isCardEditMode ? tempCardOrder : cardOrder).map((cardId) => {
                const cardConfig: Record<string, { label: string; value: string; icon: any; iconColor: string }> = {
                  'Gesamtkapital': {
                    label: 'Gesamtkapital',
                    value: `${totalInvestment.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`,
                    icon: Wallet,
                    iconColor: 'bg-blue-100 text-blue-600',
                  },
                  'Gesamtprofit': {
                    label: 'Gesamtprofit',
                    value: `${totalProfit.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`,
                    icon: TrendingUp,
                    iconColor: 'bg-green-100 text-green-600',
                  },
                  'Gesamtprofit %': {
                    label: 'Gesamtprofit %',
                    value: `${totalProfitPercent.toFixed(2)}%`,
                    icon: Percent,
                    iconColor: 'bg-purple-100 text-purple-600',
                  },
                  'Ø Profit/Tag': {
                    label: 'Ø Profit/Tag',
                    value: `${avgDailyProfit.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`,
                    icon: CalendarIcon,
                    iconColor: 'bg-orange-100 text-orange-600',
                  },
                  'Real Profit/Tag': {
                    label: 'Real Profit/Tag',
                    value: `${real24hProfit.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`,
                    icon: Zap,
                    iconColor: 'bg-yellow-100 text-yellow-600',
                  },
                };
                
                const config = cardConfig[cardId];
                if (!config) return null;
                
                return (
                  <SortableItem key={cardId} id={cardId} isEditMode={isCardEditMode}>
                    <div 
                      onClick={() => !isCardEditMode && toggleMetricCard(cardId)}
                      className={`cursor-pointer transition-all ${
                        activeMetricCards.includes(cardId) 
                          ? 'ring-2 ring-cyan-600 shadow-[0_0_15px_rgba(8,145,178,0.6)] rounded-lg' 
                          : ''
                      } ${isCardEditMode ? 'ring-2 ring-dashed ring-muted-foreground/30 rounded-lg' : ''}`}
                      data-testid={`card-${cardId.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                    >
                      <StatCard
                        label={config.label}
                        value={config.value}
                        icon={config.icon}
                        iconColor={config.iconColor}
                      />
                    </div>
                  </SortableItem>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>

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
                  <PopoverContent className="w-48 p-2" align="end">
                    <div className="space-y-1">
                      {['Custom', '1h', '24h', '7 Days', '30 Days'].map((option) => (
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
                      <Separator className="my-1" />
                      <Button
                        variant={selectedTimeRange === 'First-Last Update' ? "default" : "ghost"}
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => handleTimeRangeSelect('First-Last Update')}
                      >
                        First-Last Update
                      </Button>
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
              <div className="flex items-center justify-between">
                <span className="text-sm">Sequenz</span>
                <Select value={chartSequence} onValueChange={(value: 'hours' | 'days' | 'weeks' | 'months') => setChartSequence(value)}>
                  <SelectTrigger className="w-[100px] h-8" data-testid="select-chart-sequence">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hours">Stunden</SelectItem>
                    <SelectItem value="days">Tage</SelectItem>
                    <SelectItem value="weeks">Wochen</SelectItem>
                    <SelectItem value="months">Monate</SelectItem>
                  </SelectContent>
                </Select>
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
            Alle Einträge
          </h2>
          <BotEntryTable 
            botTypeData={botTypeTableData} 
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={handleSort}
            onRemoveBotType={handleRemoveBotType}
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
          <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>From Update auswählen - {selectedBotName}</DialogTitle>
            </DialogHeader>

            <div className="flex items-center justify-between py-2 border-b">
              <h4 className="font-semibold text-sm text-muted-foreground">Update Verlauf</h4>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Sortieren:</span>
                <Select value={updateSortBy} onValueChange={(value) => setUpdateSortBy(value as typeof updateSortBy)}>
                  <SelectTrigger className="h-8 w-[150px] text-xs">
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
                  className="h-8 w-8"
                  onClick={() => setUpdateSortDirection('desc')}
                >
                  <ChevronDown className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant={updateSortDirection === 'asc' ? 'default' : 'outline'}
                  className="h-8 w-8"
                  onClick={() => setUpdateSortDirection('asc')}
                >
                  <ChevronUp className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {sortedUpdates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Keine Updates vorhanden
                </div>
              ) : (
                sortedUpdates.map((update) => (
                  <Card 
                    key={update.id}
                    className={cn(
                      "cursor-pointer transition-all hover-elevate",
                      tempSelectedUpdate?.id === update.id && "ring-2 ring-primary shadow-md"
                    )}
                    onClick={() => handleFromUpdateSelect(update)}
                  >
                    <CardContent className="p-3">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-sm">
                            {update.status} #{update.version}
                          </p>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <CalendarIcon className="w-3 h-3" />
                            {update.createdAt 
                              ? format(new Date(update.createdAt as Date), "dd.MM.yyyy HH:mm", { locale: de })
                              : '-'
                            }
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">Grid Profit 24H Ø</span>
                            <p className="font-medium text-primary">
                              {update.avgGridProfitDay ? `${parseFloat(update.avgGridProfitDay) > 0 ? '+' : ''}${parseFloat(update.avgGridProfitDay).toFixed(2)}` : '0.00'} USDT
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Grid Profit</span>
                            <p className="font-medium text-primary">
                              {update.overallGridProfitUsdt ? `${parseFloat(update.overallGridProfitUsdt) > 0 ? '+' : ''}${parseFloat(update.overallGridProfitUsdt).toFixed(4)}` : '0.00'} USDT
                            </p>
                          </div>
                          <div className="col-span-2">
                            <span className="text-muted-foreground">Gesamt-Investment</span>
                            <p className="font-medium">{update.totalInvestment || '0.00'} USDT</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            <DialogFooter className="border-t pt-4">
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
          <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Until Update auswählen - {selectedBotName}</DialogTitle>
            </DialogHeader>

            <div className="flex items-center justify-between py-2 border-b">
              <h4 className="font-semibold text-sm text-muted-foreground">Update Verlauf</h4>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Sortieren:</span>
                <Select value={updateSortBy} onValueChange={(value) => setUpdateSortBy(value as typeof updateSortBy)}>
                  <SelectTrigger className="h-8 w-[150px] text-xs">
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
                  className="h-8 w-8"
                  onClick={() => setUpdateSortDirection('desc')}
                >
                  <ChevronDown className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant={updateSortDirection === 'asc' ? 'default' : 'outline'}
                  className="h-8 w-8"
                  onClick={() => setUpdateSortDirection('asc')}
                >
                  <ChevronUp className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {sortedUpdates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Keine Updates vorhanden
                </div>
              ) : (
                sortedUpdates.map((update) => (
                  <Card 
                    key={update.id}
                    className={cn(
                      "cursor-pointer transition-all hover-elevate",
                      tempSelectedUpdate?.id === update.id && "ring-2 ring-primary shadow-md"
                    )}
                    onClick={() => handleUntilUpdateSelect(update)}
                  >
                    <CardContent className="p-3">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-sm">
                            {update.status} #{update.version}
                          </p>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <CalendarIcon className="w-3 h-3" />
                            {update.createdAt 
                              ? format(new Date(update.createdAt as Date), "dd.MM.yyyy HH:mm", { locale: de })
                              : '-'
                            }
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">Grid Profit 24H Ø</span>
                            <p className="font-medium text-primary">
                              {update.avgGridProfitDay ? `${parseFloat(update.avgGridProfitDay) > 0 ? '+' : ''}${parseFloat(update.avgGridProfitDay).toFixed(2)}` : '0.00'} USDT
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Grid Profit</span>
                            <p className="font-medium text-primary">
                              {update.overallGridProfitUsdt ? `${parseFloat(update.overallGridProfitUsdt) > 0 ? '+' : ''}${parseFloat(update.overallGridProfitUsdt).toFixed(4)}` : '0.00'} USDT
                            </p>
                          </div>
                          <div className="col-span-2">
                            <span className="text-muted-foreground">Gesamt-Investment</span>
                            <p className="font-medium">{update.totalInvestment || '0.00'} USDT</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            <DialogFooter className="border-t pt-4">
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
