import { useQuery } from "@tanstack/react-query";
import { Wallet, TrendingUp, Percent, Search, Check, Plus, Zap, Pencil, X, Save, GripVertical, RotateCcw, ZoomIn } from "lucide-react";
import StatCard from "@/components/StatCard";
import BotEntryTable, { BotTypeTableData, calculateBotTypeTableData } from "@/components/BotEntryTable";
import ProfitLineChart from "@/components/ProfitLineChart";
import ProfitBarChartAdvanced from "@/components/ProfitBarChartAdvanced";
import { BotEntry, BotType, BotTypeUpdate } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useMemo, useEffect, useRef } from "react";
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
import { CalendarIcon, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, PanelLeftClose, PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
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

// Helper function to parse German date format (dd.MM.yyyy HH:mm:ss or dd.MM.yyyy HH:mm)
function parseGermanDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  
  // Format: "24.11.2025 16:42:12" or "24.11.2025 16:42" or "08.12.2025 12:42"
  const match = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (match) {
    const [, day, month, year, hour, minute, second = '0'] = match;
    const date = new Date(
      parseInt(year),
      parseInt(month) - 1, // Months are 0-indexed
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second)
    );
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  return null;
}

// Helper function to get timestamp from update for date comparison
// Uses the displayed date on the Content Card (thisUpload = End Date/Until, lastUpload = Start Date/From)
function getUpdateTimestamp(update: { thisUpload?: string | null; lastUpload?: string | null; createdAt?: Date | null }): number {
  // For comparison, use thisUpload (End Date for Closed Bots, Until for Update Metrics)
  // This is the date displayed on the Content Card
  if (update.thisUpload) {
    const parsed = parseGermanDate(update.thisUpload);
    if (parsed) return parsed.getTime();
  }
  // Fallback to lastUpload (Start Date/From)
  if (update.lastUpload) {
    const parsed = parseGermanDate(update.lastUpload);
    if (parsed) return parsed.getTime();
  }
  // Final fallback to createdAt
  if (update.createdAt) {
    return new Date(update.createdAt).getTime();
  }
  return 0;
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
  const [selectedChartBotTypes, setSelectedChartBotTypes] = useState<string[]>([]);
  const [tempSelectedBots, setTempSelectedBots] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  const [timeRangeOpen, setTimeRangeOpen] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState('First-Last Update');
  const [customTimeOpen, setCustomTimeOpen] = useState(false);
  const [customDays, setCustomDays] = useState('');
  const [customHours, setCustomHours] = useState('');
  const [customMinutes, setCustomMinutes] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [activeMetricCards, setActiveMetricCards] = useState<string[]>(['Gesamtkapital', 'Gesamtprofit']);
  const [showGridProfit, setShowGridProfit] = useState(false);
  const [showTrendPnl, setShowTrendPnl] = useState(false);
  const [showHighestValue, setShowHighestValue] = useState(false);
  const [showLowestValue, setShowLowestValue] = useState(false);
  // Dropdown-State für Gesamtprofit % - wählt zwischen Gesamtinvestment und Investitionsmenge
  const [profitPercentBase, setProfitPercentBase] = useState<'gesamtinvestment' | 'investitionsmenge'>('gesamtinvestment');
  const [profitPercentDropdownOpen, setProfitPercentDropdownOpen] = useState(false);
  const [chartSequence, setChartSequence] = useState<'hours' | 'days' | 'weeks' | 'months'>('days');
  const [sequencePopoverOpen, setSequencePopoverOpen] = useState(false);
  
  // Chart state - wird bei Apply aktiviert
  const [chartApplied, setChartApplied] = useState(false);
  const [appliedChartSettings, setAppliedChartSettings] = useState<{
    timeRange: string;
    sequence: 'hours' | 'days' | 'weeks' | 'months';
    fromUpdate: any | null;
    untilUpdate: any | null;
    // Für "Letzten" Zeitraum-Filter
    customDays?: string;
    customHours?: string;
    customMinutes?: string;
  } | null>(null);
  
  // From/Until update selection
  const [fromUpdateDialogOpen, setFromUpdateDialogOpen] = useState(false);
  const [untilUpdateDialogOpen, setUntilUpdateDialogOpen] = useState(false);
  const [selectedFromUpdate, setSelectedFromUpdate] = useState<any | null>(null);
  const [selectedUntilUpdate, setSelectedUntilUpdate] = useState<any | null>(null);
  const [tempSelectedUpdate, setTempSelectedUpdate] = useState<any | null>(null);
  const [updateSortBy, setUpdateSortBy] = useState<'datum' | 'gridProfit' | 'gridProfit24h' | 'gesInvest'>('datum');
  const [updateSortDirection, setUpdateSortDirection] = useState<'desc' | 'asc'>('desc');
  const [settingsCollapsed, setSettingsCollapsed] = useState(false);
  
  // Update-Auswahl Bestätigungs-Status: 'idle' | 'editing' | 'confirmed'
  const [updateSelectionMode, setUpdateSelectionMode] = useState<'idle' | 'editing' | 'confirmed'>('idle');
  
  // Chart Animation Key - wird bei echten User-Aktionen erhöht (Apply, Bot-Wechsel, Metrik-Toggle)
  // Durch Erhöhen des Keys wird der Chart komplett neu gerendert mit sauberer Animation
  const [chartAnimationKey, setChartAnimationKey] = useState(0);
  
  // Separater Key NUR für Investitionsmenge/Gesamtinvestment-Wechsel wenn Gesamtkapital aktiv
  const [investmentBaseKey, setInvestmentBaseKey] = useState(0);
  
  // Chart Zoom & Pan State
  // zoomLevel: 1 = 100%, 2 = 200% (doppelt so detailliert), etc.
  const [chartZoom, setChartZoom] = useState(1);
  // panOffset: Verschiebung auf der Y-Achse (in Chart-Einheiten)
  const [chartPanY, setChartPanY] = useState(0);
  // Drag-State für Pan
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartPanY, setDragStartPanY] = useState(0);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  
  // Chart Zoom & Pan Event-Handler
  const handleChartWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    // Zoom: Scroll nach oben = reinzoomen (größerer Zoom), nach unten = rauszoomen
    const zoomDelta = e.deltaY > 0 ? -0.1 : 0.1;
    setChartZoom(prev => Math.max(1, Math.min(10, prev + zoomDelta)));
  };
  
  const handleChartMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Nur linke Maustaste für Pan
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStartY(e.clientY);
    setDragStartPanY(chartPanY);
  };
  
  const handleChartMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    // Pan: Mausbewegung in Y-Offset umrechnen
    const deltaY = e.clientY - dragStartY;
    // Je größer der Zoom, desto empfindlicher die Pan-Bewegung
    const sensitivity = 2 / chartZoom;
    setChartPanY(dragStartPanY + deltaY * sensitivity);
  };
  
  const handleChartMouseUp = () => {
    setIsDragging(false);
  };
  
  const handleChartMouseLeave = () => {
    setIsDragging(false);
  };
  
  const handleResetZoomPan = () => {
    setChartZoom(1);
    setChartPanY(0);
  };
  
  // Handler für Update-Auswahl Icons
  const handleConfirmUpdateSelection = () => {
    if (selectedFromUpdate && selectedUntilUpdate) {
      setUpdateSelectionMode('confirmed');
    }
  };
  
  const handleEditUpdateSelection = () => {
    setUpdateSelectionMode('editing');
  };
  
  const handleClearUpdateSelection = () => {
    setSelectedFromUpdate(null);
    setSelectedUntilUpdate(null);
    setUpdateSelectionMode('idle');
  };
  
  const handleSaveUpdateSelection = () => {
    if (selectedFromUpdate && selectedUntilUpdate) {
      setUpdateSelectionMode('confirmed');
    } else {
      setUpdateSelectionMode('idle');
    }
  };

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

  // Gefilterte Updates für Until-Dialog: Nur Updates die NACH dem From-Update-Datum liegen
  const filteredUpdatesForUntil = useMemo(() => {
    if (!selectedFromUpdate) return sortedUpdates;
    
    const fromTimestamp = getUpdateTimestamp(selectedFromUpdate);
    if (fromTimestamp === 0) return sortedUpdates;
    
    // Nur Updates mit späterem Datum als das From-Update anzeigen
    return sortedUpdates.filter(update => {
      const updateTimestamp = getUpdateTimestamp(update);
      return updateTimestamp > fromTimestamp;
    });
  }, [sortedUpdates, selectedFromUpdate]);

  // Berechne die Anzahl der angezeigten Updates basierend auf Auswahl
  // NUR wenn Apply geklickt wurde ODER From/Until manuell ausgewählt
  const displayedUpdatesCount = useMemo(() => {
    // Nur berechnen wenn Apply geklickt wurde ODER From/Until manuell ausgewählt
    const hasManualSelection = selectedFromUpdate && selectedUntilUpdate;
    
    if (!hasManualSelection && !chartApplied) {
      // Noch nichts ausgewählt/angewendet - zeige 0
      return { total: 0, updateMetrics: 0, closedBots: 0 };
    }
    
    if (!sortedUpdates || sortedUpdates.length === 0) return { total: 0, updateMetrics: 0, closedBots: 0 };
    
    let filteredUpdates = sortedUpdates;
    
    // Wenn From und Until manuell ausgewählt sind, filtere entsprechend
    if (hasManualSelection) {
      const fromTimestamp = getUpdateTimestamp(selectedFromUpdate);
      const untilTimestamp = getUpdateTimestamp(selectedUntilUpdate);
      
      filteredUpdates = sortedUpdates.filter(update => {
        const updateTimestamp = getUpdateTimestamp(update);
        return updateTimestamp >= fromTimestamp && updateTimestamp <= untilTimestamp;
      });
    } else if (chartApplied && appliedChartSettings) {
      // Wenn Apply geklickt wurde, nutze die angewendeten Einstellungen
      if (appliedChartSettings.fromUpdate && appliedChartSettings.untilUpdate) {
        const fromTimestamp = getUpdateTimestamp(appliedChartSettings.fromUpdate);
        const untilTimestamp = getUpdateTimestamp(appliedChartSettings.untilUpdate);
        
        filteredUpdates = sortedUpdates.filter(update => {
          const updateTimestamp = getUpdateTimestamp(update);
          return updateTimestamp >= fromTimestamp && updateTimestamp <= untilTimestamp;
        });
      } else if (appliedChartSettings.timeRange !== 'First-Last Update') {
        // "Letzten"-Zeitraum Filter
        const rangeMs = parseTimeRangeToMs(
          appliedChartSettings.timeRange,
          appliedChartSettings.customDays,
          appliedChartSettings.customHours,
          appliedChartSettings.customMinutes
        );
        
        if (rangeMs !== null && rangeMs > 0) {
          const now = Date.now();
          const cutoffTimestamp = now - rangeMs;
          
          filteredUpdates = sortedUpdates.filter(update => {
            const updateTimestamp = getUpdateTimestamp(update);
            return updateTimestamp >= cutoffTimestamp;
          });
        }
      }
      // First-Last Update = alle Updates (default)
    }
    
    const updateMetrics = filteredUpdates.filter(u => u.status === 'Update Metrics').length;
    const closedBots = filteredUpdates.filter(u => u.status === 'Closed Bots').length;
    
    return { total: filteredUpdates.length, updateMetrics, closedBots };
  }, [sortedUpdates, selectedFromUpdate, selectedUntilUpdate, chartApplied, appliedChartSettings]);

  // Farben für die verschiedenen Metriken (passend zu den Card-Farben)
  const metricColors: Record<string, string> = {
    'Gesamtkapital': '#2563eb',      // Blau
    'Gesamtprofit': '#16a34a',       // Grün
    'Gesamtprofit %': '#9333ea',     // Lila
    'Ø Profit/Tag': '#ea580c',       // Orange
    'Real Profit/Tag': '#ca8a04',    // Gelb/Gold
  };

  // Farben für Multi-Bot-Type Chart (verschiedene Farben pro Bot-Type)
  const BOT_TYPE_COLORS = [
    '#2563eb', // Blau
    '#16a34a', // Grün
    '#9333ea', // Lila
    '#ea580c', // Orange
    '#ca8a04', // Gelb/Gold
    '#dc2626', // Rot
    '#0891b2', // Cyan
    '#7c3aed', // Violett
    '#059669', // Emerald
    '#d946ef', // Fuchsia
  ];

  // Hole Farbe für Bot-Type basierend auf Index
  const getBotTypeColor = (index: number): string => {
    return BOT_TYPE_COLORS[index % BOT_TYPE_COLORS.length];
  };

  // Multi-Bot-Type Chart Modus aktiv?
  // Nur aktiv wenn Bot-Types ausgewählt UND Chart-Settings angewendet wurden
  const isMultiBotChartMode = selectedChartBotTypes.length > 0 && chartApplied;

  // Chart-Daten für Multi-Bot-Type Modus
  // Zeigt Gesamtprofit für jeden ausgewählten Bot-Type als separate Linie
  // Respektiert dieselben Filter wie der Single-Bot Modus (Zeitraum, From/Until)
  const multiBotChartData = useMemo(() => {
    if (!isMultiBotChartMode || allBotTypeUpdates.length === 0 || !appliedChartSettings) {
      return { data: [], botTypeNames: [] as string[] };
    }

    // Normalisiere IDs zu Strings für konsistente Vergleiche
    const selectedIds = selectedChartBotTypes.map(id => String(id));

    // Finde die Namen der ausgewählten Bot-Types
    const selectedBotTypesInfo = availableBotTypes.filter(bt => 
      selectedIds.includes(String(bt.id))
    );
    const botTypeNames = selectedBotTypesInfo.map(bt => bt.name);

    // Filtere Updates für die ausgewählten Bot-Types
    let relevantUpdates = allBotTypeUpdates.filter(update => 
      selectedIds.includes(String(update.botTypeId))
    );

    if (relevantUpdates.length === 0) {
      return { data: [], botTypeNames };
    }

    // WICHTIG: Wende dieselben Filter an wie im Single-Bot Modus
    // Priorität 1: From/Until manuell ausgewählt
    if (appliedChartSettings.fromUpdate && appliedChartSettings.untilUpdate) {
      const fromTimestamp = getUpdateTimestamp(appliedChartSettings.fromUpdate);
      const untilTimestamp = getUpdateTimestamp(appliedChartSettings.untilUpdate);
      
      relevantUpdates = relevantUpdates.filter(update => {
        const updateTimestamp = getUpdateTimestamp(update);
        return updateTimestamp >= fromTimestamp && updateTimestamp <= untilTimestamp;
      });
    } 
    // Priorität 2: "Letzten"-Zeitraum Filter
    else if (appliedChartSettings.timeRange !== 'First-Last Update') {
      const rangeMs = parseTimeRangeToMs(
        appliedChartSettings.timeRange,
        appliedChartSettings.customDays,
        appliedChartSettings.customHours,
        appliedChartSettings.customMinutes
      );
      
      if (rangeMs !== null && rangeMs > 0) {
        const now = Date.now();
        const cutoffTimestamp = now - rangeMs;
        
        relevantUpdates = relevantUpdates.filter(update => {
          const updateTimestamp = getUpdateTimestamp(update);
          return updateTimestamp >= cutoffTimestamp;
        });
      }
    }
    // Priorität 3: First-Last Update = Alle Updates (keine zusätzliche Filterung)

    if (relevantUpdates.length === 0) {
      return { data: [], botTypeNames };
    }

    // Sortiere nach Zeitstempel
    relevantUpdates.sort((a, b) => getUpdateTimestamp(a) - getUpdateTimestamp(b));

    // Generiere Chart-Daten: Ein Datenpunkt pro Update
    // WICHTIG: Keine kumulative Summierung - overallGridProfitUsdt ist bereits der Gesamtwert
    const dataPoints: Array<Record<string, any>> = [];

    relevantUpdates.forEach(update => {
      const timestamp = getUpdateTimestamp(update);
      const botType = selectedBotTypesInfo.find(bt => String(bt.id) === String(update.botTypeId));
      if (!botType) return;

      // Finde oder erstelle Datenpunkt für diesen Zeitstempel
      let point = dataPoints.find(p => p.timestamp === timestamp);
      if (!point) {
        point = {
          time: new Date(timestamp).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
          timestamp,
        };
        // Initialisiere alle Bot-Types mit null (wird zu 0 wenn kein Wert)
        selectedBotTypesInfo.forEach(bt => {
          point![bt.name] = null;
        });
        dataPoints.push(point);
      }

      // Profit für diesen Bot-Type an diesem Zeitpunkt
      // overallGridProfitUsdt ist bereits der aktuelle Gesamtwert, nicht Delta
      let profit = 0;
      if (update.status === 'Closed Bots') {
        profit = parseFloat(update.profit || '0') || 0;
      } else {
        profit = parseFloat(update.overallGridProfitUsdt || '0') || 0;
      }

      point[botType.name] = profit;
    });

    // Sortiere Datenpunkte nach Zeitstempel
    dataPoints.sort((a, b) => a.timestamp - b.timestamp);

    return { data: dataPoints, botTypeNames };
  }, [isMultiBotChartMode, selectedChartBotTypes, allBotTypeUpdates, availableBotTypes, appliedChartSettings, chartApplied]);

  // Helper: Berechne Millisekunden für "Letzten"-Zeitraum
  const parseTimeRangeToMs = (timeRange: string, customDays?: string, customHours?: string, customMinutes?: string): number | null => {
    const MS_PER_MINUTE = 60 * 1000;
    const MS_PER_HOUR = 60 * MS_PER_MINUTE;
    const MS_PER_DAY = 24 * MS_PER_HOUR;
    
    switch (timeRange) {
      case '1h':
        return 1 * MS_PER_HOUR;
      case '24h':
        return 24 * MS_PER_HOUR;
      case '7 Days':
        return 7 * MS_PER_DAY;
      case '30 Days':
        return 30 * MS_PER_DAY;
      case 'Custom':
        const days = parseInt(customDays || '0') || 0;
        const hours = parseInt(customHours || '0') || 0;
        const minutes = parseInt(customMinutes || '0') || 0;
        return (days * MS_PER_DAY) + (hours * MS_PER_HOUR) + (minutes * MS_PER_MINUTE);
      case 'First-Last Update':
        return null; // Alle Updates anzeigen
      default:
        return null;
    }
  };

  // Chart-Daten basierend auf appliedChartSettings generieren
  // Unterstützt mehrere Metriken gleichzeitig
  // Für jeden Update werden ZWEI Punkte erstellt: Start (lastUpload) und Ende (thisUpload)
  const chartData = useMemo(() => {
    if (!chartApplied || !appliedChartSettings || !sortedUpdates || sortedUpdates.length === 0) {
      return [];
    }
    
    // Filtere Updates basierend auf den angewendeten Einstellungen
    let filteredUpdates = [...sortedUpdates];
    
    // Priorität 1: From/Until manuell ausgewählt
    if (appliedChartSettings.fromUpdate && appliedChartSettings.untilUpdate) {
      const fromTimestamp = getUpdateTimestamp(appliedChartSettings.fromUpdate);
      const untilTimestamp = getUpdateTimestamp(appliedChartSettings.untilUpdate);
      
      filteredUpdates = sortedUpdates.filter(update => {
        const updateTimestamp = getUpdateTimestamp(update);
        return updateTimestamp >= fromTimestamp && updateTimestamp <= untilTimestamp;
      });
    } 
    // Priorität 2: "Letzten"-Zeitraum Filter (1h, 24h, 7 Days, 30 Days, Custom)
    else if (appliedChartSettings.timeRange !== 'First-Last Update') {
      const rangeMs = parseTimeRangeToMs(
        appliedChartSettings.timeRange,
        appliedChartSettings.customDays,
        appliedChartSettings.customHours,
        appliedChartSettings.customMinutes
      );
      
      if (rangeMs !== null && rangeMs > 0) {
        const now = Date.now();
        const cutoffTimestamp = now - rangeMs;
        
        filteredUpdates = sortedUpdates.filter(update => {
          const updateTimestamp = getUpdateTimestamp(update);
          return updateTimestamp >= cutoffTimestamp;
        });
      }
    }
    // Priorität 3: First-Last Update = Alle Updates anzeigen (default)
    
    // Sortiere nach Datum (älteste zuerst)
    filteredUpdates.sort((a, b) => {
      const timeA = getUpdateTimestamp(a);
      const timeB = getUpdateTimestamp(b);
      return timeA - timeB;
    });
    
    // Helper Funktion für Zeitlabel-Formatierung
    const formatTimeLabel = (date: Date) => {
      switch (appliedChartSettings.sequence) {
        case 'hours':
          return date.toLocaleString('de-DE', { hour: '2-digit', minute: '2-digit' });
        case 'days':
          return date.toLocaleString('de-DE', { day: '2-digit', month: '2-digit' });
        case 'weeks':
          return date.toLocaleString('de-DE', { day: '2-digit', month: '2-digit' });
        case 'months':
          return date.toLocaleString('de-DE', { month: 'short', year: '2-digit' });
        default:
          return date.toLocaleString('de-DE', { day: '2-digit', month: '2-digit' });
      }
    };
    
    // Generiere Chart-Daten mit ZWEI Punkten pro Update: Start und Ende
    // Das zeigt den ganzen Zeitraum des Updates an (FROM bis UNTIL)
    // Jeder Punkt enthält ALLE Metrik-Werte
    const dataPoints: Array<{
      time: string;
      timestamp: number;
      version: number;
      status: string;
      isStartPoint?: boolean;
      // Alle Metriken
      'Gesamtkapital': number;
      'Gesamtprofit': number;
      'Gesamtprofit %': number;
      'Ø Profit/Tag': number;
      'Real Profit/Tag': number;
    }> = [];
    
    filteredUpdates.forEach((update, index) => {
      // Endpunkt: thisUpload (Ende des Updates)
      const endTimestamp = getUpdateTimestamp(update);
      const endDate = new Date(endTimestamp);
      
      // Startpunkt: lastUpload (Anfang des Updates)
      let startTimestamp = endTimestamp;
      if (update.lastUpload) {
        const parsed = parseGermanDate(update.lastUpload);
        if (parsed) {
          startTimestamp = parsed.getTime();
        }
      }
      const startDate = new Date(startTimestamp);
      
      // Berechne alle Metriken für dieses Update
      // Gesamtkapital = totalInvestment ODER investment (baseInvestment) je nach Auswahl
      const gesamtkapital = profitPercentBase === 'investitionsmenge'
        ? parseFloat(update.investment || '0') || 0
        : parseFloat(update.totalInvestment || '0') || 0;
      
      // Gesamtprofit: für Update Metrics = overallGridProfitUsdt, für Closed Bots = profit
      let gesamtprofit = 0;
      if (update.status === 'Closed Bots') {
        gesamtprofit = parseFloat(update.profit || '0') || 0;
      } else {
        gesamtprofit = parseFloat(update.overallGridProfitUsdt || '0') || 0;
      }
      
      // Gesamtprofit % = basierend auf gewählter Basis (Gesamtinvestment oder Investitionsmenge)
      // Direkte Berechnung: Gesamtprofit / gewählte Investitionsbasis * 100
      const gesamtprofitPercent = gesamtkapital > 0 ? (gesamtprofit / gesamtkapital) * 100 : 0;
      
      // Ø Profit/Tag = avgGridProfitDay
      const avgDailyProfit = parseFloat(update.avgGridProfitDay || '0') || 0;
      
      // Real Profit/Tag = Berechnung basierend auf Laufzeit
      const runtimeHours = parseRuntimeToHours(update.longestRuntime || update.runtime);
      const runtimeDays = runtimeHours / 24;
      const realDailyProfit = runtimeDays > 0 ? gesamtprofit / runtimeDays : 0;
      
      // Nur Startpunkt hinzufügen wenn lastUpload vorhanden und unterschiedlich vom Endpunkt
      if (update.lastUpload && startTimestamp !== endTimestamp) {
        dataPoints.push({
          time: formatTimeLabel(startDate),
          timestamp: startTimestamp,
          version: update.version || index + 1,
          status: update.status,
          isStartPoint: true,
          // Gesamtkapital bleibt konstant (kein Anstieg von 0)
          // Profit-Metriken starten bei 0 und steigen zum Endwert
          'Gesamtkapital': gesamtkapital,
          'Gesamtprofit': 0,
          'Gesamtprofit %': 0,
          'Ø Profit/Tag': 0,
          'Real Profit/Tag': 0,
        });
      }
      
      // Endpunkt mit allen Metrik-Werten
      dataPoints.push({
        time: formatTimeLabel(endDate),
        timestamp: endTimestamp,
        version: update.version || index + 1,
        status: update.status,
        isStartPoint: false,
        'Gesamtkapital': gesamtkapital,
        'Gesamtprofit': gesamtprofit,
        'Gesamtprofit %': gesamtprofitPercent,
        'Ø Profit/Tag': avgDailyProfit,
        'Real Profit/Tag': realDailyProfit,
      });
    });
    
    // Sortiere alle Punkte nach Zeitstempel
    dataPoints.sort((a, b) => a.timestamp - b.timestamp);
    
    return dataPoints;
  }, [chartApplied, appliedChartSettings, sortedUpdates, profitPercentBase]);

  // Prüfe ob Gesamtkapital aktiv ist
  // Wenn ja: Alle Profit-Metriken starten auf Gesamtkapital-Höhe (bei JEDEM Update)
  const hasGesamtkapitalActive = useMemo(() => {
    return activeMetricCards.includes('Gesamtkapital');
  }, [activeMetricCards]);

  // Transformierte Chart-Daten
  // Wenn Gesamtkapital aktiv: Alle Profit-Metriken werden um Gesamtkapital offsettet
  // Das gilt für ALLE Updates, nicht nur für einen einzelnen
  const transformedChartData = useMemo(() => {
    if (!chartData || chartData.length === 0) return chartData;
    
    // Wenn Gesamtkapital nicht aktiv, normale Daten zurückgeben
    if (!hasGesamtkapitalActive) return chartData;
    
    // Transformiere die Daten: ALLE Profit-Werte um Gesamtkapital erhöhen
    // Bei jedem Update-Startpunkt und Endpunkt wird der Profit-Wert + Gesamtkapital angezeigt
    return chartData.map(point => {
      const gesamtkapital = point['Gesamtkapital'] || 0;
      
      return {
        ...point,
        // Gesamtprofit startet ab Gesamtkapital
        'Gesamtprofit': point['Gesamtprofit'] + gesamtkapital,
        // Gesamtprofit % startet auch ab Gesamtkapital (für visuelle Konsistenz)
        'Gesamtprofit %': point['Gesamtprofit %'] + gesamtkapital,
        // Ø Profit/Tag startet ab Gesamtkapital
        'Ø Profit/Tag': point['Ø Profit/Tag'] + gesamtkapital,
        // Real Profit/Tag startet ab Gesamtkapital
        'Real Profit/Tag': point['Real Profit/Tag'] + gesamtkapital,
        // Speichere Originalwerte für Tooltips
        '_rawGesamtprofit': point['Gesamtprofit'],
        '_rawGesamtprofitPercent': point['Gesamtprofit %'],
        '_rawAvgDailyProfit': point['Ø Profit/Tag'],
        '_rawRealDailyProfit': point['Real Profit/Tag'],
      };
    });
  }, [chartData, hasGesamtkapitalActive]);

  // Berechne X-Achsen-Ticks basierend auf Sequence (Granularität)
  // WICHTIG: Der Zeitraum (From bis Until) bleibt IMMER gleich!
  // Tick-Intervalle:
  // - Stunden → Stunden-Ticks, Labels = Uhrzeit + ab und zu Datum
  // - Tage → Tages-Ticks, Labels = Datum
  // - Wochen → TAGES-Ticks (!), Labels = Datum + ab und zu KW
  // - Monate → TAGES-Ticks (!), Labels = Datum + ab und zu Monat
  const xAxisTicks = useMemo(() => {
    if (!chartData || chartData.length === 0) return [];
    
    const timestamps = chartData.map(d => d.timestamp).filter(t => t > 0);
    if (timestamps.length === 0) return [];
    
    // Zeitraum ist FIX (startTime bis endTime)
    const startTime = Math.min(...timestamps);
    const endTime = Math.max(...timestamps);
    
    const sequence = appliedChartSettings?.sequence || 'days';
    
    // Tick-Intervall je nach Sequence
    // WICHTIG: Wochen und Monate haben auch TÄGLICHE Ticks!
    // Nur die Beschriftung ändert sich
    let tickInterval: number;
    switch (sequence) {
      case 'hours':
        tickInterval = 60 * 60 * 1000;           // 1 Stunde
        break;
      case 'days':
      case 'weeks':    // Tages-Ticks, aber KW-Labels am Montag
      case 'months':   // Tages-Ticks, aber Monat-Labels am Monatsersten
        tickInterval = 24 * 60 * 60 * 1000;      // 1 Tag
        break;
      default:
        tickInterval = 24 * 60 * 60 * 1000;      // Default: 1 Tag
    }
    
    // Generiere Ticks vom Startpunkt bis Endpunkt mit dem gewählten Intervall
    const ticks: number[] = [];
    
    // Starte bei sinnvollem Startpunkt (runde auf volle Stunde/Tag)
    const startDate = new Date(startTime);
    if (sequence === 'hours') {
      startDate.setMinutes(0, 0, 0);
    } else {
      startDate.setHours(0, 0, 0, 0);
    }
    
    let currentTs = startDate.getTime();
    
    // Generiere Ticks über den gesamten fixen Zeitraum
    while (currentTs <= endTime + tickInterval) {
      ticks.push(currentTs);
      currentTs += tickInterval;
    }
    
    return ticks;
  }, [chartData, appliedChartSettings?.sequence]);

  // Berechne Y-Achsen-Domain dynamisch basierend auf aktiven Metriken + Zoom/Pan
  // Für Gesamtkapital: Domain nahe am tatsächlichen Wert (nicht bei 0 starten)
  // Für Profit-Metriken: Domain bei 0 starten (Wachstum zeigen)
  const yAxisDomain = useMemo((): [number | string, number | string] => {
    // Verwende transformierte Daten für korrekte Domain-Berechnung
    const dataToUse = transformedChartData;
    if (!dataToUse || dataToUse.length === 0 || activeMetricCards.length === 0) {
      return ['auto', 'auto'];
    }
    
    // Sammle alle Werte der aktiven Metriken
    const allValues: number[] = [];
    activeMetricCards.forEach(metric => {
      dataToUse.forEach(point => {
        const val = point[metric as keyof typeof point] as number;
        if (typeof val === 'number' && !isNaN(val)) {
          allValues.push(val);
        }
      });
    });
    
    if (allValues.length === 0) return ['auto', 'auto'];
    
    const minVal = Math.min(...allValues);
    const maxVal = Math.max(...allValues);
    
    let baseLower: number;
    let baseUpper: number;
    
    // Wenn Gesamtkapital aktiv ist + Profit-Metriken
    // Die Profit-Werte sind bereits auf Gesamtkapital gestapelt
    // -> Y-Achse soll NICHT bei 0 starten, sondern den Bereich nahe dem Kapital zoomen
    // So ist die Profit-Steigerung deutlich sichtbar!
    if (hasGesamtkapitalActive) {
      // Berechne sinnvolle Grenzen:
      // - Unten: Etwas unter dem Gesamtkapital (aber nicht unter 0)
      // - Oben: Über dem gestapelten Profit
      const range = maxVal - minVal;
      // Mindest-Padding: 20% des Bereichs oder 5% des Maximalwerts
      const padding = Math.max(range * 0.3, maxVal * 0.02);
      
      baseLower = Math.max(0, minVal - padding);
      baseUpper = maxVal + padding;
    } else {
      // Wenn ALLE aktiven Metriken "konstante" Typen sind (nur Gesamtkapital)
      // dann soll die Y-Achse NICHT bei 0 starten
      const constantMetrics = ['Gesamtkapital'];
      const allConstant = activeMetricCards.every(m => constantMetrics.includes(m));
      
      if (allConstant) {
        // Domain nahe am Min/Max mit etwas Padding
        const range = maxVal - minVal;
        const padding = range > 0 ? range * 0.1 : maxVal * 0.05;
        baseLower = Math.max(0, minVal - padding);
        baseUpper = maxVal + padding;
      } else {
        // Für Profit-Metriken: Bei 0 starten
        baseLower = 0;
        baseUpper = maxVal * 1.1; // 10% Padding oben
      }
    }
    
    // Zoom & Pan anwenden
    // chartZoom: 1 = 100%, 2 = 200% (doppelt so detailliert = halbe Range)
    // chartPanY: Verschiebung in Pixel, umgerechnet auf Chart-Einheiten
    const baseRange = baseUpper - baseLower;
    const zoomedRange = baseRange / chartZoom;
    const center = (baseLower + baseUpper) / 2;
    
    // Pan-Offset: chartPanY in Pixel, umrechnen auf Chart-Einheiten
    // Negative Werte = nach oben panen (höhere Werte sehen)
    const panOffset = (chartPanY / 300) * baseRange; // 300px = Chart-Höhe
    
    const zoomedLower = center - zoomedRange / 2 + panOffset;
    const zoomedUpper = center + zoomedRange / 2 + panOffset;
    
    return [Math.max(0, zoomedLower), zoomedUpper];
  }, [transformedChartData, activeMetricCards, hasGesamtkapitalActive, chartZoom, chartPanY]);


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
      // Für spezifischen Bot-Type: Verwende Updates wie auf Bot-Types-Seite
      if (!selectedBotTypeData || !allBotTypeUpdates) {
        return filteredEntriesForStats.reduce((sum, entry) => sum + parseFloat(entry.investment), 0);
      }
      
      // Nur Updates mit Status "Update Metrics" für diesen Bot-Type
      const updateMetricsOnly = allBotTypeUpdates.filter(
        update => update.botTypeId === selectedBotTypeData.id && update.status === "Update Metrics"
      );
      
      if (updateMetricsOnly.length > 0) {
        // Berechne Durchschnitt aller totalInvestment Werte
        return updateMetricsOnly.reduce(
          (s, u) => s + (parseFloat(u.totalInvestment || '0') || 0), 0
        ) / updateMetricsOnly.length;
      }
      
      return 0;
    }
  }, [selectedBotName, availableBotTypes, allBotTypeUpdates, filteredEntriesForStats, selectedBotTypeData]);
  
  // Berechne totalBaseInvestment (Investitionsmenge-Ø) - GLEICHE LOGIK wie Gesamtinvestment-Ø
  // Pro Bot-Type: Durchschnitt aller "investment" Werte von "Update Metrics" Updates
  // Dann alle Bot-Type-Durchschnitte summieren
  const totalBaseInvestment = useMemo(() => {
    if (selectedBotName === "Gesamt") {
      if (!availableBotTypes || !allBotTypeUpdates || availableBotTypes.length === 0 || allBotTypeUpdates.length === 0) {
        return 0;
      }
      
      const activeBotTypes = availableBotTypes.filter(bt => bt.isActive);
      let sum = 0;
      
      activeBotTypes.forEach(botType => {
        // Nur Updates mit Status "Update Metrics" verwenden (wie bei Gesamtinvestment-Ø)
        const updateMetricsOnly = allBotTypeUpdates.filter(
          update => update.botTypeId === botType.id && update.status === "Update Metrics"
        );
        
        if (updateMetricsOnly.length > 0) {
          // Berechne Durchschnitt aller investment Werte pro Bot-Type
          const avgInvestment = updateMetricsOnly.reduce(
            (s, u) => s + (parseFloat(u.investment || '0') || 0), 0
          ) / updateMetricsOnly.length;
          sum += avgInvestment;
        }
      });
      
      return sum;
    } else {
      if (!selectedBotTypeData || !allBotTypeUpdates) {
        return 0;
      }
      
      // Nur Updates mit Status "Update Metrics" für diesen Bot-Type
      const updateMetricsOnly = allBotTypeUpdates.filter(
        update => update.botTypeId === selectedBotTypeData.id && update.status === "Update Metrics"
      );
      
      if (updateMetricsOnly.length > 0) {
        // Berechne Durchschnitt aller investment Werte
        return updateMetricsOnly.reduce(
          (s, u) => s + (parseFloat(u.investment || '0') || 0), 0
        ) / updateMetricsOnly.length;
      }
      
      return 0;
    }
  }, [selectedBotName, availableBotTypes, allBotTypeUpdates, selectedBotTypeData]);
  
  // displayedInvestment: Wechselt zwischen Gesamtinvestment und Investitionsmenge basierend auf Dropdown
  const displayedInvestment = useMemo(() => {
    return profitPercentBase === 'gesamtinvestment' ? totalInvestment : totalBaseInvestment;
  }, [profitPercentBase, totalInvestment, totalBaseInvestment]);
  
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
      // Für spezifischen Bot-Type: Verwende Updates wie auf Bot-Types-Seite
      if (!selectedBotTypeData || !allBotTypeUpdates) {
        return filteredEntriesForStats.reduce((sum, entry) => sum + parseFloat(entry.profit), 0);
      }
      
      // Alle Updates für diesen Bot-Type
      const updatesForType = allBotTypeUpdates.filter(update => update.botTypeId === selectedBotTypeData.id);
      
      // Gesamt Profit: Alle Updates, aber unterschiedliche Felder je nach Status
      return updatesForType.reduce((s, update) => {
        if (update.status === 'Closed Bots') {
          return s + (parseFloat(update.profit || '0') || 0);
        } else {
          return s + (parseFloat(update.overallGridProfitUsdt || '0') || 0);
        }
      }, 0);
    }
  }, [selectedBotName, availableBotTypes, allBotTypeUpdates, filteredEntriesForStats, selectedBotTypeData]);
  
  // Berechne Profit-Prozent
  // Gesamtinvestment: totalProfit / totalInvestment * 100
  // Investitionsmenge: totalProfit / totalBaseInvestment * 100
  const totalProfitPercent = useMemo(() => {
    if (profitPercentBase === 'gesamtinvestment') {
      // Berechne Prozent basierend auf Gesamtinvestment (totalInvestment)
      return totalInvestment > 0 ? (totalProfit / totalInvestment) * 100 : 0;
    }
    
    // Investitionsmenge: Berechne Prozent direkt basierend auf totalBaseInvestment
    return totalBaseInvestment > 0 ? (totalProfit / totalBaseInvestment) * 100 : 0;
  }, [totalInvestment, totalBaseInvestment, totalProfit, profitPercentBase]);

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
      // Für spezifischen Bot-Type: Berechne wie auf Bot-Types-Seite
      if (!selectedBotTypeData || !allBotTypeUpdates) {
        return 0;
      }
      
      const updateMetricsOnly = allBotTypeUpdates.filter(
        update => update.botTypeId === selectedBotTypeData.id && update.status === 'Update Metrics'
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
          return profitPerHour * 24;
        }
      }
      
      return 0;
    }
  }, [selectedBotName, availableBotTypes, allBotTypeUpdates, selectedBotTypeData]);

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
      // Für spezifischen Bot-Type: Berechne wie auf Bot-Types-Seite
      if (!selectedBotTypeData || !allBotTypeUpdates) {
        return 0;
      }
      
      const updateMetricsOnly = allBotTypeUpdates.filter(
        update => update.botTypeId === selectedBotTypeData.id && update.status === 'Update Metrics'
      );
      
      let totalReal24h = 0;
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
      
      return totalReal24h;
    }
  }, [selectedBotName, availableBotTypes, allBotTypeUpdates, selectedBotTypeData]);

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
    // Speichere die aktuellen Einstellungen und aktiviere den Chart
    setAppliedChartSettings({
      timeRange: selectedTimeRange,
      sequence: chartSequence,
      fromUpdate: selectedFromUpdate,
      untilUpdate: selectedUntilUpdate,
      // Custom-Werte für "Custom" Zeitraum
      customDays: customDays,
      customHours: customHours,
      customMinutes: customMinutes,
    });
    setChartApplied(true);
    // Automatisch "Gesamtprofit" Content-Karte aktivieren/hervorheben
    setActiveMetricCards(['Gesamtprofit']);
    // Trigger Animation bei Apply
    setChartAnimationKey(prev => prev + 1);
  };

  const toggleMetricCard = (cardName: string) => {
    // Bei Multi-Bot-Auswahl (>1): Nur EINE Metrik-Card erlauben
    if (selectedChartBotTypes.length > 1) {
      // Im Multi-Bot-Mode: Toggle zwischen aktiv/inaktiv oder wechseln
      const newMetrics = activeMetricCards.includes(cardName) && activeMetricCards.length === 1
        ? [] 
        : [cardName];
      setActiveMetricCards(newMetrics);
    } else {
      // Single-Bot oder kein Multi-Bot: Normales Toggle-Verhalten
      if (activeMetricCards.includes(cardName)) {
        setActiveMetricCards(prev => prev.filter(name => name !== cardName));
      } else {
        setActiveMetricCards(prev => [...prev, cardName]);
      }
    }
    // Chart komplett neu rendern mit sauberer Animation
    setChartAnimationKey(prev => prev + 1);
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

  // Auto-Apply: Wenn ein Bot-Type ausgewählt wird (nicht "Gesamt"), automatisch Default-Einstellungen anwenden
  useEffect(() => {
    if (selectedBotName !== "Gesamt") {
      // Default-Einstellungen setzen
      setSelectedTimeRange('First-Last Update');
      setChartSequence('days');
      // From/Until Update zurücksetzen
      setSelectedFromUpdate(null);
      setSelectedUntilUpdate(null);
      setUpdateSelectionMode('idle');
      // Automatisch Apply mit Default-Einstellungen
      setAppliedChartSettings({
        timeRange: 'First-Last Update',
        sequence: 'days',
        fromUpdate: null,
        untilUpdate: null,
        customDays: '',
        customHours: '',
        customMinutes: '',
      });
      setChartApplied(true);
      setActiveMetricCards(['Gesamtprofit']);
      // Trigger Animation
      setChartAnimationKey(prev => prev + 1);
    } else {
      // Bei "Gesamt": Chart zurücksetzen
      setChartApplied(false);
      setAppliedChartSettings(null);
    }
  }, [selectedBotName]);

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
                            // Animation wird durch Auto-Apply useEffect getriggert
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
                    label: profitPercentBase === 'gesamtinvestment' ? 'Gesamtkapital' : 'Investitionsmenge',
                    value: `${displayedInvestment.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`,
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
                    label: profitPercentBase === 'gesamtinvestment' ? 'Gesamtprofit % (GI)' : 'Gesamtprofit % (IM)',
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
                      className={`cursor-pointer transition-all relative ${
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
                        dropdown={cardId === 'Gesamtkapital' && !isCardEditMode ? (
                          <Popover open={profitPercentDropdownOpen} onOpenChange={setProfitPercentDropdownOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-4 w-4 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setProfitPercentDropdownOpen(!profitPercentDropdownOpen);
                                }}
                                data-testid="dropdown-profit-percent-base"
                              >
                                <ChevronDown className="h-3 w-3" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-48 p-1" align="start">
                              <div className="flex flex-col gap-1">
                                <Button
                                  variant={profitPercentBase === 'gesamtinvestment' ? 'secondary' : 'ghost'}
                                  size="sm"
                                  className="justify-start"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setProfitPercentBase('gesamtinvestment');
                                    setProfitPercentDropdownOpen(false);
                                    // Trigger Animation nur wenn Gesamtkapital-Card aktiv ist
                                    if (activeMetricCards.includes('Gesamtkapital')) {
                                      setInvestmentBaseKey(prev => prev + 1);
                                    }
                                  }}
                                  data-testid="option-gesamtinvestment"
                                >
                                  {profitPercentBase === 'gesamtinvestment' && <Check className="h-4 w-4 mr-2" />}
                                  Gesamtinvestment
                                </Button>
                                <Button
                                  variant={profitPercentBase === 'investitionsmenge' ? 'secondary' : 'ghost'}
                                  size="sm"
                                  className="justify-start"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setProfitPercentBase('investitionsmenge');
                                    setProfitPercentDropdownOpen(false);
                                    // Trigger Animation nur wenn Gesamtkapital-Card aktiv ist
                                    if (activeMetricCards.includes('Gesamtkapital')) {
                                      setInvestmentBaseKey(prev => prev + 1);
                                    }
                                  }}
                                  data-testid="option-investitionsmenge"
                                >
                                  {profitPercentBase === 'investitionsmenge' && <Check className="h-4 w-4 mr-2" />}
                                  Investitionsmenge
                                </Button>
                              </div>
                            </PopoverContent>
                          </Popover>
                        ) : undefined}
                      />
                    </div>
                  </SortableItem>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>

        <div className="flex items-stretch gap-4 mb-8">
          <div className="flex-1">
            <Card className="p-6 h-full">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold">Update Verlauf</h3>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">From:</span>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-2 min-w-[100px]"
                      onClick={() => selectedBotName !== "Gesamt" && updateSelectionMode !== 'confirmed' && setFromUpdateDialogOpen(true)}
                      disabled={selectedBotName === "Gesamt" || updateSelectionMode === 'confirmed'}
                    >
                      {selectedFromUpdate ? `#${selectedFromUpdate.version}` : 'Select'}
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">Until:</span>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-2 min-w-[100px]"
                      onClick={() => selectedBotName !== "Gesamt" && updateSelectionMode !== 'confirmed' && setUntilUpdateDialogOpen(true)}
                      disabled={selectedBotName === "Gesamt" || updateSelectionMode === 'confirmed'}
                    >
                      {selectedUntilUpdate ? `#${selectedUntilUpdate.version}` : 'Select'}
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </div>
                  
                  {/* Icon-Buttons für Update-Auswahl Bestätigung */}
                  {updateSelectionMode === 'idle' && selectedFromUpdate && selectedUntilUpdate && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={handleConfirmUpdateSelection}
                      title="Auswahl bestätigen"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                  
                  {updateSelectionMode === 'confirmed' && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={handleEditUpdateSelection}
                      title="Auswahl bearbeiten"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  
                  {updateSelectionMode === 'editing' && (
                    <>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={handleClearUpdateSelection}
                        title="Auswahl leeren"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={handleSaveUpdateSelection}
                        title="Auswahl speichern"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
                
                {/* Zoom/Pan Info & Reset Button */}
                {(chartZoom > 1 || chartPanY !== 0) && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <ZoomIn className="h-3 w-3" />
                      {chartZoom.toFixed(1)}x
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={handleResetZoomPan}
                      data-testid="button-reset-zoom-pan"
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Reset
                    </Button>
                  </div>
                )}
              </div>
              
              {/* Chart Container with Zoom & Pan Events */}
              <div
                ref={chartContainerRef}
                onWheel={handleChartWheel}
                onMouseDown={handleChartMouseDown}
                onMouseMove={handleChartMouseMove}
                onMouseUp={handleChartMouseUp}
                onMouseLeave={handleChartMouseLeave}
                className={cn("select-none", isDragging && "cursor-grabbing")}
                style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
              >
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  key={investmentBaseKey}
                  data={isMultiBotChartMode 
                    ? (multiBotChartData.data.length > 0 ? multiBotChartData.data : [{ time: '-', timestamp: 0 }])
                    : (transformedChartData.length > 0 ? transformedChartData : [
                        { time: '-', timestamp: 0, 'Gesamtkapital': 0, 'Gesamtprofit': 0, 'Gesamtprofit %': 0, 'Ø Profit/Tag': 0, 'Real Profit/Tag': 0 },
                      ])
                  }
                  margin={{ top: 5, right: 30, left: 20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="timestamp"
                    type="number"
                    domain={['dataMin', 'dataMax']}
                    ticks={xAxisTicks.length > 0 ? xAxisTicks : undefined}
                    interval={0}
                    tickLine={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1 }}
                    axisLine={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }}
                    height={70}
                    tickSize={8}
                    tick={(props: any) => {
                      const { x, y, payload, index } = props;
                      if (!payload || !payload.value || payload.value === 0) {
                        return <g />;
                      }
                      
                      const date = new Date(payload.value);
                      const sequence = appliedChartSettings?.sequence || 'days';
                      
                      // Helper: ISO Kalenderwoche berechnen
                      const getISOWeek = (d: Date): number => {
                        const dt = new Date(d.getTime());
                        dt.setHours(0, 0, 0, 0);
                        dt.setDate(dt.getDate() + 3 - (dt.getDay() + 6) % 7);
                        const week1 = new Date(dt.getFullYear(), 0, 4);
                        return 1 + Math.round(((dt.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
                      };
                      
                      // DYNAMISCHE Intervall-Berechnung basierend auf Zeitraum-Länge
                      const timestamps = xAxisTicks.filter(t => t > 0);
                      const startTime = timestamps.length > 0 ? Math.min(...timestamps) : 0;
                      const endTime = timestamps.length > 0 ? Math.max(...timestamps) : 0;
                      const totalHours = (endTime - startTime) / (1000 * 60 * 60);
                      const totalDays = totalHours / 24;
                      const totalWeeks = totalDays / 7;
                      const totalMonths = totalDays / 30;
                      
                      let label = '';
                      let isMajor = false;  // Major = größere Einheit mit blauer Umrandung
                      let showLabel = false;
                      
                      if (sequence === 'hours') {
                        // ADAPTIVE Stunden-Intervalle basierend auf Zeitraum
                        // Bei längeren Zeiträumen (>7 Tage): NUR Mitternacht-Labels (1 pro Tag)
                        // Bei kürzeren Zeiträumen: Zusätzlich Stunden-Labels
                        
                        const hour = date.getHours();
                        const isMidnight = hour === 0 && date.getMinutes() === 0;
                        
                        if (totalDays > 7) {
                          // Bei >7 Tagen: NUR Mitternacht zeigen (1 Label pro Tag)
                          // Verhindert Überlappung bei längeren Zeiträumen
                          if (isMidnight) {
                            label = date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
                            isMajor = true;
                            showLabel = true;
                          }
                          // Keine Zwischen-Stunden-Labels!
                        } else {
                          // Bei ≤7 Tagen: Mitternacht + Intervall-Stunden
                          let tickIntervalHours: number;
                          if (totalHours <= 24) {           // bis 1 Tag
                            tickIntervalHours = 2;
                          } else if (totalHours <= 48) {    // bis 2 Tage
                            tickIntervalHours = 3;
                          } else if (totalHours <= 72) {    // bis 3 Tage
                            tickIntervalHours = 4;
                          } else {                          // 3-7 Tage
                            tickIntervalHours = 6;
                          }
                          
                          const isIntervalHour = hour % tickIntervalHours === 0 && date.getMinutes() === 0;
                          
                          if (isMidnight) {
                            // Mitternacht = Datum mit blauer Umrandung
                            label = date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
                            isMajor = true;
                            showLabel = true;
                          } else if (isIntervalHour) {
                            // Intervall-Stunde = Uhrzeit
                            label = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                            showLabel = true;
                          }
                        }
                        
                      } else if (sequence === 'days') {
                        // ADAPTIVE Tages-Intervalle basierend auf Zeitraum
                        let tickIntervalDays: number;
                        if (totalDays <= 7) {
                          tickIntervalDays = 1;
                        } else if (totalDays <= 30) {
                          tickIntervalDays = 2;
                        } else if (totalDays <= 90) {
                          tickIntervalDays = 7;
                        } else {
                          tickIntervalDays = Math.ceil(totalDays / 25);
                        }
                        
                        if (index % tickIntervalDays === 0) {
                          label = date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
                          showLabel = true;
                        }
                        
                      } else if (sequence === 'weeks') {
                        // ADAPTIVE Wochen-Intervalle basierend auf Zeitraum
                        let tickIntervalWeeks: number;
                        if (totalWeeks <= 4) {
                          tickIntervalWeeks = 1;
                        } else if (totalWeeks <= 12) {
                          tickIntervalWeeks = 2;
                        } else {
                          tickIntervalWeeks = Math.ceil(totalWeeks / 10);
                        }
                        
                        const isMonday = date.getDay() === 1;
                        // Bei Wochen: Jeden Montag im Intervall zeigen
                        const weekIndex = Math.floor(index / 7);
                        const isIntervalWeek = weekIndex % tickIntervalWeeks === 0;
                        
                        if (isMonday && isIntervalWeek) {
                          label = `KW ${getISOWeek(date)}`;
                          isMajor = true;
                          showLabel = true;
                        } else if (index % (tickIntervalWeeks * 2) === 0 && !isMonday) {
                          // Zwischendurch auch mal Datum zeigen
                          label = date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
                          showLabel = true;
                        }
                        
                      } else if (sequence === 'months') {
                        // ADAPTIVE Monats-Intervalle basierend auf Zeitraum
                        let tickIntervalMonths: number;
                        if (totalMonths <= 6) {
                          tickIntervalMonths = 1;
                        } else {
                          tickIntervalMonths = Math.ceil(totalMonths / 6);
                        }
                        
                        const isFirstOfMonth = date.getDate() === 1;
                        // Jeden X. Tag im Monat zeigen
                        const dayIntervalInMonth = Math.max(5, Math.ceil(totalDays / 20));
                        
                        if (isFirstOfMonth) {
                          label = date.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
                          isMajor = true;
                          showLabel = true;
                        } else if (index % dayIntervalInMonth === 0) {
                          label = date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
                          showLabel = true;
                        }
                      }
                      
                      // Kein Label? Leeres Element
                      if (!showLabel) {
                        return <g />;
                      }
                      
                      if (isMajor) {
                        // Major tick: Blauer Ring, größere Schrift
                        const textWidth = label.length * 6 + 10;
                        const textHeight = 18;
                        return (
                          <g transform={`translate(${x},${y}) rotate(-45)`}>
                            <rect
                              x={-textWidth + 4}
                              y={-textHeight / 2}
                              width={textWidth}
                              height={textHeight}
                              rx={4}
                              ry={4}
                              fill="transparent"
                              stroke="hsl(217, 91%, 60%)"
                              strokeWidth={1.5}
                            />
                            <text
                              x={0}
                              y={5}
                              textAnchor="end"
                              fill="hsl(217, 91%, 60%)"
                              fontSize={12}
                              fontWeight={600}
                            >
                              {label}
                            </text>
                          </g>
                        );
                      } else {
                        // Minor tick: Normal
                        return (
                          <g transform={`translate(${x},${y}) rotate(-45)`}>
                            <text
                              x={0}
                              y={4}
                              textAnchor="end"
                              fill="hsl(var(--muted-foreground))"
                              fontSize={11}
                            >
                              {label}
                            </text>
                          </g>
                        );
                      }
                    }}
                  />
                  <YAxis 
                    domain={yAxisDomain}
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1 }}
                    tickSize={8}
                    axisLine={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }}
                    tickFormatter={(value) => value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  />
                  <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" strokeOpacity={0.5} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                      fontSize: '14px',
                      color: 'hsl(var(--foreground))'
                    }}
                    labelStyle={{
                      fontWeight: 'bold',
                      marginBottom: '4px',
                      color: 'hsl(var(--foreground))'
                    }}
                    labelFormatter={(label, payload) => {
                      if (payload && payload.length > 0 && payload[0].payload) {
                        const dataPoint = payload[0].payload;
                        const date = new Date(dataPoint.timestamp);
                        const sequence = appliedChartSettings?.sequence || 'days';
                        
                        if (sequence === 'hours') {
                          return date.toLocaleString('de-DE', { 
                            day: '2-digit', month: '2-digit', year: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                          });
                        } else if (sequence === 'days') {
                          return date.toLocaleString('de-DE', { 
                            weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                          });
                        } else {
                          return date.toLocaleString('de-DE', { 
                            day: '2-digit', month: '2-digit', year: 'numeric'
                          });
                        }
                      }
                      return label;
                    }}
                    formatter={(value: number, name: string, props: any) => {
                      // Wenn Gesamtkapital aktiv: Zeige die echten Werte für alle Profit-Metriken
                      let displayValue = value;
                      if (hasGesamtkapitalActive && props?.payload) {
                        if (name === 'Gesamtprofit' && props.payload._rawGesamtprofit !== undefined) {
                          displayValue = props.payload._rawGesamtprofit;
                        } else if (name === 'Gesamtprofit %' && props.payload._rawGesamtprofitPercent !== undefined) {
                          displayValue = props.payload._rawGesamtprofitPercent;
                        } else if (name === 'Ø Profit/Tag' && props.payload._rawAvgDailyProfit !== undefined) {
                          displayValue = props.payload._rawAvgDailyProfit;
                        } else if (name === 'Real Profit/Tag' && props.payload._rawRealDailyProfit !== undefined) {
                          displayValue = props.payload._rawRealDailyProfit;
                        }
                      }
                      const suffix = name === 'Gesamtprofit %' ? '%' : ' USDT';
                      return [displayValue.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + suffix, name];
                    }}
                  />
                  {/* Dynamisch Lines rendern - Multi-Bot-Mode oder Single-Bot mit Metriken */}
                  {isMultiBotChartMode ? (
                    // Multi-Bot-Type Modus: Eine Linie pro Bot-Type (zeigt Gesamtprofit)
                    multiBotChartData.botTypeNames.map((botTypeName, index) => (
                      <Line 
                        key={botTypeName}
                        type="monotone" 
                        dataKey={botTypeName}
                        name={botTypeName}
                        stroke={getBotTypeColor(index)}
                        strokeWidth={2}
                        dot={{ fill: getBotTypeColor(index), r: 4 }}
                        connectNulls
                        isAnimationActive={true}
                        animationDuration={1200}
                        animationBegin={0}
                        animationEasing="ease-out"
                      />
                    ))
                  ) : (
                    // Single-Bot Modus: Lines für alle aktiven Metriken
                    activeMetricCards.map((metricName) => (
                      <Line 
                        key={metricName}
                        type="monotone" 
                        dataKey={metricName}
                        name={metricName}
                        stroke={metricColors[metricName] || '#888888'}
                        strokeWidth={2}
                        dot={{ fill: metricColors[metricName] || '#888888', r: 4 }}
                        connectNulls
                        isAnimationActive={true}
                        animationDuration={1200}
                        animationBegin={0}
                        animationEasing="ease-out"
                      />
                    ))
                  )}
                </LineChart>
              </ResponsiveContainer>
              </div>
            </Card>
          </div>
          
          {/* Settings Container - Right side, same height as chart */}
          <div className="flex flex-shrink-0 ring-2 ring-cyan-600 shadow-[0_0_15px_rgba(8,145,178,0.6)] rounded-lg">
            {/* Collapse Toggle Strip - Left Side */}
            <div 
              className={cn(
                "flex flex-col items-center justify-start pt-3 w-10 bg-muted/30 cursor-pointer hover-elevate border",
                settingsCollapsed ? "rounded-md" : "rounded-l-md border-r-0"
              )}
              onClick={() => setSettingsCollapsed(!settingsCollapsed)}
              title={settingsCollapsed ? "Graph-Einstellungen ausklappen" : "Graph-Einstellungen einklappen"}
            >
              {settingsCollapsed ? (
                <PanelLeft className="h-5 w-5 text-muted-foreground" />
              ) : (
                <PanelLeftClose className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            
            {/* Settings Content - conditionally rendered */}
            {!settingsCollapsed && (
              <Card className="p-4 flex flex-col rounded-l-none border-l-0 w-64">
                <h4 className="text-sm font-semibold mb-3">Graph-Einstellungen</h4>
                <div className="space-y-3 flex-1">
              <div className={cn("flex items-center justify-between", updateSelectionMode === 'confirmed' && "opacity-50")}>
                <span className="text-sm">Letzten</span>
                <Popover open={timeRangeOpen} onOpenChange={(open) => updateSelectionMode !== 'confirmed' && setTimeRangeOpen(open)}>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-2"
                      disabled={updateSelectionMode === 'confirmed'}
                    >
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
                <span className="text-sm">Sequence</span>
                <Popover open={sequencePopoverOpen} onOpenChange={setSequencePopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2" data-testid="select-chart-sequence">
                      {chartSequence === 'hours' ? 'Hours' : chartSequence === 'days' ? 'Days' : chartSequence === 'weeks' ? 'Weeks' : 'Months'}
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-2" align="end">
                    <div className="space-y-1">
                      {[
                        { value: 'hours', label: 'Hours' },
                        { value: 'days', label: 'Days' },
                        { value: 'weeks', label: 'Weeks' },
                        { value: 'months', label: 'Months' }
                      ].map((option) => (
                        <Button
                          key={option.value}
                          variant={chartSequence === option.value ? "default" : "ghost"}
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => {
                            setChartSequence(option.value as 'hours' | 'days' | 'weeks' | 'months');
                            setSequencePopoverOpen(false);
                          }}
                          data-testid={`sequence-option-${option.value}`}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Anzahl Metriks</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium bg-muted px-2 py-1 rounded" data-testid="text-update-count">
                    {displayedUpdatesCount.total}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({displayedUpdatesCount.updateMetrics} Update, {displayedUpdatesCount.closedBots} Closed)
                  </span>
                </div>
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
            selectedChartBotTypes={selectedChartBotTypes}
            onToggleChartBotType={(botTypeId) => {
              setSelectedChartBotTypes(prev => 
                prev.includes(botTypeId)
                  ? prev.filter(id => id !== botTypeId)
                  : [...prev, botTypeId]
              );
              // Reset alle Chart-Einstellungen auf Default
              setSelectedTimeRange('First-Last Update');
              setChartSequence('days');
              setShowGridProfit(false);
              setShowTrendPnl(false);
              setShowHighestValue(false);
              setShowLowestValue(false);
              setSelectedFromUpdate(null);
              setSelectedUntilUpdate(null);
              setChartApplied(false);
              setAppliedChartSettings(null);
              setUpdateSelectionMode('idle');
            }}
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
          <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-6">
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
            
            <div className="flex-1 overflow-y-auto py-2 space-y-3 px-1">
              {sortedUpdates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Keine Updates vorhanden
                </div>
              ) : (
                sortedUpdates.map((update) => {
                  const profitValue = parseFloat(update.profit || '0') || 0;
                  const closedBotsTitleColor = update.status === 'Closed Bots' 
                    ? (profitValue > 0 ? 'text-green-600' : profitValue < 0 ? 'text-red-600' : '')
                    : '';
                  const gridProfit24h = update.avgGridProfitDay || '0.00';
                  
                  return (
                  <Card 
                    key={update.id}
                    className={cn(
                      "cursor-pointer transition-all hover-elevate",
                      tempSelectedUpdate?.id === update.id && "ring-2 ring-primary shadow-md"
                    )}
                    onClick={() => handleFromUpdateSelect(update)}
                  >
                    <CardContent className="p-4">
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-sm mb-2 ${closedBotsTitleColor}`}>
                          {update.status} #{update.version}
                        </p>
                        <div className="flex flex-col gap-y-1 text-xs">
                          {/* Zeile 1: Datum (Start/End Date für Closed Bots, From/Until für Update Metrics) */}
                          <div className="flex items-center flex-wrap gap-x-6">
                            {update.lastUpload && update.thisUpload ? (
                              <>
                                <span className="flex items-center gap-1 text-muted-foreground">
                                  <span className="font-medium">{update.status === 'Closed Bots' ? 'Start Date:' : 'From:'}</span>
                                  {update.lastUpload || '-'}
                                </span>
                                <span className="flex items-center gap-1 text-muted-foreground">
                                  <span className="font-medium">{update.status === 'Closed Bots' ? 'End Date:' : 'Until:'}</span>
                                  {update.thisUpload || '-'}
                                </span>
                              </>
                            ) : (
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <CalendarIcon className="w-3 h-3" />
                                {update.createdAt 
                                  ? format(new Date(update.createdAt as Date), "dd.MM.yyyy HH:mm", { locale: de })
                                  : '-'
                                }
                              </span>
                            )}
                          </div>
                          {/* Zeile 2: Für Closed Bots nur "Gesamt Profit", für Update Metrics "Real 24h + Grid Profit 24H Ø + Grid Profit" */}
                          <div className="flex items-center flex-wrap gap-x-6">
                            {update.status === 'Closed Bots' ? (
                              <span className="flex items-center gap-1.5">
                                <span className="text-muted-foreground">Gesamt Profit:</span>
                                <span className="font-medium text-primary">
                                  {update.profit ? `${parseFloat(update.profit) > 0 ? '+' : ''}${parseFloat(update.profit).toFixed(2)}` : '0.00'} USDT
                                </span>
                              </span>
                            ) : (
                              <>
                                <span className="flex items-center gap-1.5">
                                  <span className="text-muted-foreground">Real 24h Grid Profit:</span>
                                  <span className="font-medium text-primary">
                                    {(() => {
                                      const runtimeHours = parseRuntimeToHours(update.avgRuntime);
                                      if (runtimeHours < 24) {
                                        const val = parseFloat(update.overallGridProfitUsdt || '0') || 0;
                                        return `${val > 0 ? '+' : ''}${val.toFixed(2)} USDT`;
                                      } else {
                                        const val = parseFloat(gridProfit24h) || 0;
                                        return `${val > 0 ? '+' : ''}${val.toFixed(2)} USDT`;
                                      }
                                    })()}
                                  </span>
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <span className="text-muted-foreground">Grid Profit 24H Ø:</span>
                                  <span className="font-medium text-primary">
                                    {(() => {
                                      const val = parseFloat(gridProfit24h) || 0;
                                      return `${val > 0 ? '+' : ''}${val.toFixed(2)} USDT`;
                                    })()}
                                  </span>
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <span className="text-muted-foreground">Grid Profit:</span>
                                  <span className="font-medium text-primary">
                                    {(() => {
                                      const val = parseFloat(update.overallGridProfitUsdt || '0') || 0;
                                      return `${val > 0 ? '+' : ''}${val.toFixed(2)} USDT`;
                                    })()}
                                  </span>
                                </span>
                              </>
                            )}
                          </div>
                          {/* Zeile 3: Gesamt-Investment */}
                          <div className="flex items-center flex-wrap gap-x-6">
                            <span className="flex items-center gap-1.5">
                              <span className="text-muted-foreground">Gesamt-Investment:</span>
                              <span className="font-medium">{update.totalInvestment || '0.00'} USDT</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  );
                })
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
          <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-6">
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
            
            <div className="flex-1 overflow-y-auto py-2 space-y-3 px-1">
              {filteredUpdatesForUntil.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {selectedFromUpdate 
                    ? "Keine Updates nach dem From-Datum vorhanden"
                    : "Keine Updates vorhanden"}
                </div>
              ) : (
                filteredUpdatesForUntil.map((update) => {
                  const profitValue = parseFloat(update.profit || '0') || 0;
                  const closedBotsTitleColor = update.status === 'Closed Bots' 
                    ? (profitValue > 0 ? 'text-green-600' : profitValue < 0 ? 'text-red-600' : '')
                    : '';
                  const gridProfit24h = update.avgGridProfitDay || '0.00';
                  
                  return (
                  <Card 
                    key={update.id}
                    className={cn(
                      "cursor-pointer transition-all hover-elevate",
                      tempSelectedUpdate?.id === update.id && "ring-2 ring-primary shadow-md"
                    )}
                    onClick={() => handleUntilUpdateSelect(update)}
                  >
                    <CardContent className="p-4">
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-sm mb-2 ${closedBotsTitleColor}`}>
                          {update.status} #{update.version}
                        </p>
                        <div className="flex flex-col gap-y-1 text-xs">
                          {/* Zeile 1: Datum (Start/End Date für Closed Bots, From/Until für Update Metrics) */}
                          <div className="flex items-center flex-wrap gap-x-6">
                            {update.lastUpload && update.thisUpload ? (
                              <>
                                <span className="flex items-center gap-1 text-muted-foreground">
                                  <span className="font-medium">{update.status === 'Closed Bots' ? 'Start Date:' : 'From:'}</span>
                                  {update.lastUpload || '-'}
                                </span>
                                <span className="flex items-center gap-1 text-muted-foreground">
                                  <span className="font-medium">{update.status === 'Closed Bots' ? 'End Date:' : 'Until:'}</span>
                                  {update.thisUpload || '-'}
                                </span>
                              </>
                            ) : (
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <CalendarIcon className="w-3 h-3" />
                                {update.createdAt 
                                  ? format(new Date(update.createdAt as Date), "dd.MM.yyyy HH:mm", { locale: de })
                                  : '-'
                                }
                              </span>
                            )}
                          </div>
                          {/* Zeile 2: Für Closed Bots nur "Gesamt Profit", für Update Metrics "Real 24h + Grid Profit 24H Ø + Grid Profit" */}
                          <div className="flex items-center flex-wrap gap-x-6">
                            {update.status === 'Closed Bots' ? (
                              <span className="flex items-center gap-1.5">
                                <span className="text-muted-foreground">Gesamt Profit:</span>
                                <span className="font-medium text-primary">
                                  {update.profit ? `${parseFloat(update.profit) > 0 ? '+' : ''}${parseFloat(update.profit).toFixed(2)}` : '0.00'} USDT
                                </span>
                              </span>
                            ) : (
                              <>
                                <span className="flex items-center gap-1.5">
                                  <span className="text-muted-foreground">Real 24h Grid Profit:</span>
                                  <span className="font-medium text-primary">
                                    {(() => {
                                      const runtimeHours = parseRuntimeToHours(update.avgRuntime);
                                      if (runtimeHours < 24) {
                                        const val = parseFloat(update.overallGridProfitUsdt || '0') || 0;
                                        return `${val > 0 ? '+' : ''}${val.toFixed(2)} USDT`;
                                      } else {
                                        const val = parseFloat(gridProfit24h) || 0;
                                        return `${val > 0 ? '+' : ''}${val.toFixed(2)} USDT`;
                                      }
                                    })()}
                                  </span>
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <span className="text-muted-foreground">Grid Profit 24H Ø:</span>
                                  <span className="font-medium text-primary">
                                    {(() => {
                                      const val = parseFloat(gridProfit24h) || 0;
                                      return `${val > 0 ? '+' : ''}${val.toFixed(2)} USDT`;
                                    })()}
                                  </span>
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <span className="text-muted-foreground">Grid Profit:</span>
                                  <span className="font-medium text-primary">
                                    {(() => {
                                      const val = parseFloat(update.overallGridProfitUsdt || '0') || 0;
                                      return `${val > 0 ? '+' : ''}${val.toFixed(2)} USDT`;
                                    })()}
                                  </span>
                                </span>
                              </>
                            )}
                          </div>
                          {/* Zeile 3: Gesamt-Investment */}
                          <div className="flex items-center flex-wrap gap-x-6">
                            <span className="flex items-center gap-1.5">
                              <span className="text-muted-foreground">Gesamt-Investment:</span>
                              <span className="font-medium">{update.totalInvestment || '0.00'} USDT</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  );
                })
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
