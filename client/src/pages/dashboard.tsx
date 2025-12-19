import { useQuery } from "@tanstack/react-query";
import { Wallet, TrendingUp, Percent, Search, Check, Plus, Zap, Pencil, X, Save, GripVertical, RotateCcw, ZoomIn, Eye, LineChart as LineChartIcon, Trash2 } from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, PanelLeftClose, PanelLeft, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceDot } from 'recharts';
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

// Helper function to format runtime from milliseconds to "Xd Xh Xm" format
function formatRuntimeFromMs(ms: number): string {
  if (ms <= 0) return '0m';
  
  const totalMinutes = Math.floor(ms / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
  
  return parts.join(' ');
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
  const [alleEintraegeMode, setAlleEintraegeMode] = useState<'compare' | 'added'>('compare');
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
    // Für "Letzten" Zeitraum-Filter (D/H/M Felder)
    customDays?: string;
    customHours?: string;
    customMinutes?: string;
    // Für Kalender-Auswahl (von-bis Datum)
    customFromDate?: Date;
    customToDate?: Date;
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
  const [markerViewActive, setMarkerViewActive] = useState(false);
  const [markerEditActive, setMarkerEditActive] = useState(false);
  const [hoveredUpdateId, setHoveredUpdateId] = useState<string | null>(null);
  const [lockedUpdateIds, setLockedUpdateIds] = useState<Set<string>>(new Set());
  // Stift-Modus: nur Single-Select (einer zur Zeit)
  const [editHoveredUpdateId, setEditHoveredUpdateId] = useState<string | null>(null);
  const [editSelectedUpdateId, setEditSelectedUpdateId] = useState<string | null>(null);
  // Nach Apply: das bestätigte Update wird dauerhaft blau angezeigt
  const [appliedUpdateId, setAppliedUpdateId] = useState<string | null>(null);
  // Analysieren-Modus: zeigt nur das eine ausgewählte Update im Graph
  const [analyzeMode, setAnalyzeMode] = useState(false);
  // Such-Dialog für Metrik-Auswahl
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  // Detail-Dialog für angewandte Metrik (Auge-Button)
  const [metricDetailDialogOpen, setMetricDetailDialogOpen] = useState(false);
  const [appliedUpdateDetails, setAppliedUpdateDetails] = useState<any | null>(null);
  const [loadingUpdateDetails, setLoadingUpdateDetails] = useState(false);
  
  // Update-Auswahl Bestätigungs-Status: 'idle' | 'editing' | 'confirmed'
  const [updateSelectionMode, setUpdateSelectionMode] = useState<'idle' | 'editing' | 'confirmed'>('idle');
  
  // Chart Animation Key - wird bei echten User-Aktionen erhöht (Apply, Bot-Wechsel, Metrik-Toggle)
  // Durch Erhöhen des Keys wird der Chart komplett neu gerendert mit sauberer Animation
  const [chartAnimationKey, setChartAnimationKey] = useState(0);
  
  // Separater Key NUR für Investitionsmenge/Gesamtinvestment-Wechsel wenn Gesamtkapital aktiv
  const [investmentBaseKey, setInvestmentBaseKey] = useState(0);
  
  // Chart Zoom & Pan State
  // zoomLevel: 1 = 100%, 2 = 200% (doppelt so detailliert), etc.
  const [chartZoomY, setChartZoomY] = useState(1);
  const [chartZoomX, setChartZoomX] = useState(1);
  // panOffset: Verschiebung auf der Y/X-Achse (in Chart-Einheiten)
  const [chartPanY, setChartPanY] = useState(0);
  const [chartPanX, setChartPanX] = useState(0);
  // Drag-State für Pan
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartPanY, setDragStartPanY] = useState(0);
  const [dragStartPanX, setDragStartPanX] = useState(0);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  
  // Tooltip Aktivierungsradius - nur anzeigen wenn Maus nah am Datenpunkt
  // Speichert die letzte Mausposition relativ zum Chart für Distanzprüfung
  const [tooltipActivePayload, setTooltipActivePayload] = useState<any[] | null>(null);
  const [tooltipCoordinate, setTooltipCoordinate] = useState<{ x: number; y: number } | null>(null);
  const [tooltipIsNearPoint, setTooltipIsNearPoint] = useState(false);
  
  // Chart Zoom & Pan Event-Handler
  // Mausrad im Chart = Zoom für BEIDE Achsen gleichzeitig (wie Bild-Viewer)
  // WICHTIG: Nativer Event-Listener mit passive: false, damit preventDefault() funktioniert
  // Ref für isDragging um in Event-Listener aktuellen Wert zu haben
  const isDraggingRef = useRef(false);
  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);
  
  // Native Wheel-Event Listener für Chart-Zoom
  // Muss native sein weil React's onWheel passiv ist und preventDefault() nicht funktioniert
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;
    
    const handleWheel = (e: WheelEvent) => {
      // IMMER verhindern dass die Page scrollt, solange Maus im Chart ist
      e.preventDefault();
      e.stopPropagation();
      
      // Nicht zoomen während des Dragging
      if (isDraggingRef.current) return;
      
      // Zoom für alle Scroll-Events (Mausrad, Touchpad, Pinch)
      const zoomDelta = e.deltaY > 0 ? -0.1 : 0.1;
      
      // Zoom für beide Achsen gleichzeitig
      setChartZoomY(prev => Math.max(1, Math.min(10, prev + zoomDelta)));
      setChartZoomX(prev => Math.max(1, Math.min(10, prev + zoomDelta)));
    };
    
    // passive: false ist WICHTIG damit preventDefault() funktioniert
    container.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  });
  
  const handleChartMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Nur linke Maustaste für Pan
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStartY(e.clientY);
    setDragStartX(e.clientX);
    setDragStartPanY(chartPanY);
    setDragStartPanX(chartPanX);
  };
  
  const handleChartMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    // Pan: Mausbewegung in Y/X-Offset umrechnen
    const deltaY = e.clientY - dragStartY;
    const deltaX = e.clientX - dragStartX;
    // Je größer der Zoom, desto empfindlicher die Pan-Bewegung
    const sensitivityY = 2 / chartZoomY;
    const sensitivityX = 2 / chartZoomX;
    setChartPanY(dragStartPanY + deltaY * sensitivityY);
    setChartPanX(dragStartPanX + deltaX * sensitivityX);
  };
  
  const handleChartMouseUp = () => {
    setIsDragging(false);
  };
  
  const handleChartMouseLeave = () => {
    setIsDragging(false);
  };
  
  const handleResetZoomPan = () => {
    setChartZoomY(1);
    setChartZoomX(1);
    setChartPanY(0);
    setChartPanX(0);
  };
  
  // Handler für LineChart onMouseMove - prüft Distanz zum Datenpunkt
  // Aktivierungsradius: 15 Pixel (sehr klein, nur bei direktem Hover)
  const TOOLTIP_ACTIVATION_RADIUS = 15;
  
  const handleLineChartMouseMove = (state: any) => {
    if (!state || !state.activePayload || state.activePayload.length === 0) {
      setTooltipIsNearPoint(false);
      setTooltipActivePayload(null);
      setTooltipCoordinate(null);
      // Clear update hover when not near any point
      if (markerViewActive) {
        setHoveredUpdateId(null);
      }
      return;
    }
    
    // Speichere die Payload und Koordinate
    setTooltipActivePayload(state.activePayload);
    setTooltipCoordinate(state.activeCoordinate);
    
    // Prüfe ob die Maus nah genug am Punkt ist
    // state.chartX/chartY = Mausposition, state.activeCoordinate = Punkt-Position
    if (state.chartX !== undefined && state.chartY !== undefined && state.activeCoordinate) {
      const dx = Math.abs(state.chartX - state.activeCoordinate.x);
      const dy = Math.abs(state.chartY - state.activeCoordinate.y);
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Nur aktivieren wenn innerhalb des Radius
      const isNearPoint = distance <= TOOLTIP_ACTIVATION_RADIUS;
      setTooltipIsNearPoint(isNearPoint);
      
      // When eye is active, check if near an update start/end point
      if (markerViewActive) {
        // If not near any point, clear hover immediately
        if (!isNearPoint) {
          setHoveredUpdateId(null);
          return;
        }
        
        if (state.activePayload[0]?.payload?.timestamp) {
          const hoveredTs = state.activePayload[0].payload.timestamp;
          
          // Find matching update by checking if this timestamp matches start or end
          const matchingUpdate = sortedUpdates?.find(u => {
            const endTs = u.thisUpload ? parseGermanDate(u.thisUpload)?.getTime() : null;
            const startTs = u.lastUpload ? parseGermanDate(u.lastUpload)?.getTime() : null;
            // Allow 60 second tolerance for matching
            return (endTs && Math.abs(endTs - hoveredTs) < 60000) || 
                   (startTs && Math.abs(startTs - hoveredTs) < 60000);
          });
          
          if (matchingUpdate) {
            if (matchingUpdate.status === 'Closed Bots') {
              setHoveredUpdateId(`c-${matchingUpdate.version}`);
            } else if (matchingUpdate.status === 'Update Metrics') {
              setHoveredUpdateId(`u-${matchingUpdate.version}`);
            } else {
              setHoveredUpdateId(null);
            }
          } else {
            setHoveredUpdateId(null);
          }
        }
      }
    } else {
      setTooltipIsNearPoint(false);
    }
  };
  
  const handleLineChartMouseLeave = () => {
    setTooltipIsNearPoint(false);
    setTooltipActivePayload(null);
    setTooltipCoordinate(null);
    // Clear chart-triggered hover (but not locked items)
    if (markerViewActive) {
      setHoveredUpdateId(null);
    }
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
    return ["Gesamt", "Custom", ...allNames.sort()];
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

  // Berechne die Anzahl der angezeigten Updates basierend auf AKTUELLER Auswahl
  // Reagiert sofort auf Zeitraum-Änderung (vor Apply)
  const displayedUpdatesCount = useMemo(() => {
    if (!sortedUpdates || sortedUpdates.length === 0) return { total: 0, updateMetrics: 0, closedBots: 0 };
    
    let filteredUpdates = sortedUpdates;
    const hasManualSelection = selectedFromUpdate && selectedUntilUpdate;
    
    // Priorität 1: Wenn From und Until manuell ausgewählt sind
    if (hasManualSelection) {
      const fromTimestamp = getUpdateTimestamp(selectedFromUpdate);
      const untilTimestamp = getUpdateTimestamp(selectedUntilUpdate);
      
      filteredUpdates = sortedUpdates.filter(update => {
        const updateTimestamp = getUpdateTimestamp(update);
        return updateTimestamp >= fromTimestamp && updateTimestamp <= untilTimestamp;
      });
    } 
    // Priorität 2: Aktueller selectedTimeRange (reagiert sofort auf Dropdown-Auswahl)
    else if (selectedTimeRange !== 'First-Last Update') {
      const rangeMs = parseTimeRangeToMs(
        selectedTimeRange,
        customDays,
        customHours,
        customMinutes
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
    // Priorität 3: First-Last Update = alle Updates anzeigen
    
    const updateMetrics = filteredUpdates.filter(u => u.status === 'Update Metrics').length;
    const closedBots = filteredUpdates.filter(u => u.status === 'Closed Bots').length;
    
    return { total: filteredUpdates.length, updateMetrics, closedBots };
  }, [sortedUpdates, selectedFromUpdate, selectedUntilUpdate, selectedTimeRange, customDays, customHours, customMinutes]);

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

  // Multi-Bot-Type Chart Modus DEAKTIVIERT
  // selectedChartBotTypes wird nur noch für UI-Toggle (blau/grau) in Alle Einträge genutzt
  // Chart-Funktionalität wird später separat implementiert
  const isMultiBotChartMode = false;

  // Compare/Added Modus: 2+ Bot-Types ausgewählt
  // Bei 2+ werden From/Until deaktiviert, Content Cards zeigen "--"
  const isMultiSelectCompareMode = alleEintraegeMode === 'compare' && selectedChartBotTypes.length >= 2;

  // Bei 2+ Bot-Types: Graph-Einstellungen auf Default setzen
  useEffect(() => {
    if (isMultiSelectCompareMode) {
      setSelectedTimeRange('First-Last Update');
      setShowHighestValue(false);
      setShowLowestValue(false);
      setChartSequence('days');
      setSelectedFromUpdate(null);
      setSelectedUntilUpdate(null);
    }
  }, [isMultiSelectCompareMode]);

  // ========== COMPARE MODUS - SEPARATE SECTION ==========
  // Diese Logik ist komplett unabhängig von den Graph-Einstellungen (Golden State)
  // Linien werden GRAU angezeigt (nicht von Content Cards bestimmt)
  
  // Compare-Modus: Chart-Daten für alle ausgewählten Bot-Types
  // WICHTIG: Gleiche Logik wie chartData - ZWEI Punkte pro Update (Start + Ende)
  // Findet automatisch das früheste und späteste Datum aller Bot-Types
  const compareChartData = useMemo(() => {
    if (!isMultiSelectCompareMode || allBotTypeUpdates.length === 0) {
      return { data: [], botTypeNames: [] as string[], minTimestamp: 0, maxTimestamp: 0 };
    }

    const selectedIds = selectedChartBotTypes.map(id => String(id));
    
    // Finde die Namen der ausgewählten Bot-Types
    const selectedBotTypesInfo = availableBotTypes.filter(bt => 
      selectedIds.includes(String(bt.id))
    );
    const botTypeNames = selectedBotTypesInfo.map(bt => bt.name);

    // Filtere Updates für die ausgewählten Bot-Types
    const relevantUpdates = allBotTypeUpdates.filter(update => 
      selectedIds.includes(String(update.botTypeId))
    );

    if (relevantUpdates.length === 0) {
      return { data: [], botTypeNames, minTimestamp: 0, maxTimestamp: 0 };
    }

    // Gruppiere Updates pro Bot-Type und sortiere jede Gruppe nach Zeit
    const updatesByBotType: Record<string, typeof relevantUpdates> = {};
    selectedBotTypesInfo.forEach(bt => {
      updatesByBotType[bt.name] = relevantUpdates
        .filter(u => String(u.botTypeId) === String(bt.id))
        .sort((a, b) => getUpdateTimestamp(a) - getUpdateTimestamp(b));
    });

    // Sammle alle Timestamps für min/max Berechnung
    const allTimestamps: number[] = [];

    // Generiere Chart-Daten: ZWEI Punkte pro Update (Start + Ende)
    // Jeder Bot-Type bekommt seine eigene Linie
    const dataPoints: Array<Record<string, any>> = [];

    // Für jeden Bot-Type: Erstelle Start- und End-Punkte pro Update
    selectedBotTypesInfo.forEach(botType => {
      const updates = updatesByBotType[botType.name] || [];
      
      // Kumulativer Wert für Vergleichs-Modus
      let cumulativeProfit = 0;
      
      updates.forEach((update, idx) => {
        // End-Timestamp: thisUpload
        const endTimestamp = getUpdateTimestamp(update);
        
        // Start-Timestamp: lastUpload (oder endTimestamp wenn nicht vorhanden)
        let startTimestamp = endTimestamp;
        if (update.lastUpload) {
          const parsed = parseGermanDate(update.lastUpload);
          if (parsed) {
            startTimestamp = parsed.getTime();
          }
        }
        
        allTimestamps.push(startTimestamp, endTimestamp);
        
        // Berechne den Profit-Wert
        let profitValue = 0;
        if (update.status === 'Closed Bots') {
          profitValue = parseFloat(update.profit || '0') || 0;
        } else {
          profitValue = parseFloat(update.overallGridProfitUsdt || '0') || 0;
        }
        
        // Prüfe ob Vergleichs-Modus (wie in chartData)
        const hasAbsoluteFields = update.overallGridProfitUsdtAbsolute !== null && update.overallGridProfitUsdtAbsolute !== undefined;
        let isVergleichsModus = false;
        
        if (hasAbsoluteFields) {
          const absoluteValue = parseFloat(update.overallGridProfitUsdtAbsolute || '0') || 0;
          isVergleichsModus = Math.abs(profitValue - absoluteValue) > 0.01;
        } else {
          isVergleichsModus = update.calculationMode === 'Normal';
        }
        
        // Bei Vergleichs-Modus: kumuliere Werte
        if (isVergleichsModus && idx > 0) {
          cumulativeProfit += profitValue;
          profitValue = cumulativeProfit;
        } else {
          cumulativeProfit = profitValue;
        }
        
        // Start-Punkt: Wert vom vorherigen Endpunkt oder 0
        const startValue = idx > 0 ? dataPoints.filter(p => p[botType.name] !== null && p[botType.name] !== undefined).slice(-1)[0]?.[botType.name] || 0 : 0;
        
        // Erstelle Start-Punkt
        const startPoint: Record<string, any> = {
          time: new Date(startTimestamp).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
          timestamp: startTimestamp,
          isStartPoint: true,
          botTypeName: botType.name,
        };
        // Initialisiere alle Bot-Types mit null
        selectedBotTypesInfo.forEach(bt => {
          startPoint[bt.name] = null;
        });
        // Setze den Wert für diesen Bot-Type
        startPoint[botType.name] = idx === 0 ? 0 : startValue;
        dataPoints.push(startPoint);
        
        // Erstelle End-Punkt
        const endPoint: Record<string, any> = {
          time: new Date(endTimestamp).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
          timestamp: endTimestamp,
          isStartPoint: false,
          botTypeName: botType.name,
        };
        // Initialisiere alle Bot-Types mit null
        selectedBotTypesInfo.forEach(bt => {
          endPoint[bt.name] = null;
        });
        // Setze den Wert für diesen Bot-Type
        endPoint[botType.name] = profitValue;
        dataPoints.push(endPoint);
      });
    });

    // Berechne min/max Timestamps
    const minTimestamp = allTimestamps.length > 0 ? Math.min(...allTimestamps) : 0;
    const maxTimestamp = allTimestamps.length > 0 ? Math.max(...allTimestamps) : 0;

    // Sortiere Datenpunkte nach Zeitstempel
    dataPoints.sort((a, b) => a.timestamp - b.timestamp);

    return { data: dataPoints, botTypeNames, minTimestamp, maxTimestamp };
  }, [isMultiSelectCompareMode, selectedChartBotTypes, allBotTypeUpdates, availableBotTypes]);
  // ========== ENDE COMPARE MODUS SECTION ==========

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
    // Priorität 2: Custom mit Kalender-Auswahl
    else if (appliedChartSettings.timeRange === 'Custom' && appliedChartSettings.customFromDate && appliedChartSettings.customToDate) {
      const fromTimestamp = appliedChartSettings.customFromDate.getTime();
      const toDate = new Date(appliedChartSettings.customToDate);
      toDate.setHours(23, 59, 59, 999);
      const untilTimestamp = toDate.getTime();
      
      relevantUpdates = relevantUpdates.filter(update => {
        const updateTimestamp = getUpdateTimestamp(update);
        return updateTimestamp >= fromTimestamp && updateTimestamp <= untilTimestamp;
      });
    }
    // Priorität 3: "Letzten"-Zeitraum Filter
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
    // Priorität 4: First-Last Update = Alle Updates (keine zusätzliche Filterung)

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
    // Priorität 2: Custom mit Kalender-Auswahl (von-bis Datum)
    else if (appliedChartSettings.timeRange === 'Custom' && appliedChartSettings.customFromDate && appliedChartSettings.customToDate) {
      const fromTimestamp = appliedChartSettings.customFromDate.getTime();
      // Bis Ende des Tages (23:59:59.999)
      const toDate = new Date(appliedChartSettings.customToDate);
      toDate.setHours(23, 59, 59, 999);
      const untilTimestamp = toDate.getTime();
      
      filteredUpdates = sortedUpdates.filter(update => {
        const updateTimestamp = getUpdateTimestamp(update);
        return updateTimestamp >= fromTimestamp && updateTimestamp <= untilTimestamp;
      });
    }
    // Priorität 3: "Letzten"-Zeitraum Filter (1h, 24h, 7 Days, 30 Days, Custom mit D/H/M)
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
    // Priorität 4: First-Last Update = Alle Updates anzeigen (default)
    
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
    // Bei Vergleichs-Modus: Werte kumulieren (vom vorherigen Endpunkt weiterlaufen)
    const dataPoints: Array<{
      time: string;
      timestamp: number;
      version: number;
      status: string;
      isStartPoint?: boolean;
      isAlsoEndPoint?: boolean; // Wenn dieser Punkt sowohl Start als auch End ist (gleicher Zeitstempel)
      calculationMode?: string; // 'Neu' oder 'Vergleich'
      // Runtime in Millisekunden (nur bei Endpunkten)
      runtimeMs?: number;
      // Alle Metriken
      'Gesamtkapital': number;
      'Gesamtprofit': number;
      'Gesamtprofit %': number;
      'Ø Profit/Tag': number;
      'Real Profit/Tag': number;
      // Für Tooltip: Zeige auch vorherigen Endpunkt-Wert wenn dieser Punkt beides ist
      _prevEndValues?: {
        timestamp: number;
        'Gesamtkapital': number;
        'Gesamtprofit': number;
        'Gesamtprofit %': number;
        'Ø Profit/Tag': number;
        'Real Profit/Tag': number;
      };
      // Für Tooltip: Zeige an, dass dieser Endpunkt auch der Startpunkt des nächsten Updates ist
      _isAlsoStartOfNext?: boolean;
      _nextStartInfo?: {
        nextUpdateVersion: number;
        'Gesamtkapital': number;
        'Gesamtprofit': number;
        'Gesamtprofit %': number;
        'Ø Profit/Tag': number;
        'Real Profit/Tag': number;
      };
    }> = [];
    
    // Laufende Summe für kumulierte Werte bei Vergleichs-Modus
    let cumulativeProfit = 0;
    let cumulativeProfitPercent = 0;
    let cumulativeAvgDaily = 0;
    let cumulativeRealDaily = 0;
    // Speichere vorherigen Endpunkt-Timestamp für Tooltip
    let prevEndTimestamp = 0;
    // Speichere vorheriges Gesamtkapital für Tooltip bei Vergleichs-Modus
    let prevGesamtkapital = 0;
    
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
      
      // Prüfe ob dieses Update im Vergleichs-Modus ist
      // Primär: Prüfe *_absolute Felder (wenn vorhanden und unterschiedlich)
      // Fallback: Prüfe calculationMode === "Normal" (nicht Startmetrik)
      const hasAbsoluteFields = update.overallGridProfitUsdtAbsolute !== null && update.overallGridProfitUsdtAbsolute !== undefined;
      let isVergleichsModus = false;
      
      if (hasAbsoluteFields) {
        const mainValue = parseFloat(update.overallGridProfitUsdt || '0') || 0;
        const absoluteValue = parseFloat(update.overallGridProfitUsdtAbsolute || '0') || 0;
        isVergleichsModus = Math.abs(mainValue - absoluteValue) > 0.01;
      } else {
        // Fallback: calculationMode "Normal" bedeutet es ist ein Update nach Startmetrik
        isVergleichsModus = update.calculationMode === 'Normal';
      }
      
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
      
      // Speichere vorherige Endwerte vor dem Update (inkl. Timestamp und Gesamtkapital)
      const prevEndValues = {
        timestamp: prevEndTimestamp,
        'Gesamtkapital': prevGesamtkapital,
        'Gesamtprofit': cumulativeProfit,
        'Gesamtprofit %': cumulativeProfitPercent,
        'Ø Profit/Tag': cumulativeAvgDaily,
        'Real Profit/Tag': cumulativeRealDaily,
      };
      
      // WICHTIG: Immer den RAW-Wert verwenden, KEINE Kumulierung!
      // Bei Vergleichs-Modus ist overallGridProfitUsdt bereits die DIFFERENZ
      // Diese soll direkt im Chart angezeigt werden (kann negativ sein)
      cumulativeProfit = gesamtprofit;
      cumulativeProfitPercent = gesamtprofitPercent;
      cumulativeAvgDaily = avgDailyProfit;
      cumulativeRealDaily = realDailyProfit;
      
      // Nur Startpunkt hinzufügen wenn lastUpload vorhanden und unterschiedlich vom Endpunkt
      // ABER: Bei Vergleichs-Modus KEINEN separaten Startpunkt erstellen!
      // Die Linie soll flüssig vom vorherigen Endpunkt zum neuen Endpunkt laufen
      // Prüfung mit prevEndTimestamp statt index > 0, weil Filter das erste Update verändern können
      const hasPreviousEndPoint = prevEndTimestamp !== 0;
      // Prüfe ob der Startpunkt auf dem gleichen oder sehr nahen Timestamp wie der vorherige Endpunkt liegt
      // In diesem Fall keinen separaten Startpunkt erstellen, um Überlappung zu vermeiden
      const startOverlapsPrevEnd = hasPreviousEndPoint && Math.abs(startTimestamp - prevEndTimestamp) < 60000; // 1 Minute Toleranz
      // Bei Vergleichs-Modus: Nie Startpunkt erstellen (Linie läuft flüssig weiter)
      // Bei Closed Bots: Auch kein Startpunkt - nur EIN Punkt (End Date) mit dem Profit
      const isClosedBots = update.status === 'Closed Bots';
      
      // WICHTIG: Wenn es das ERSTE gefilterte Update ist (kein vorheriger Endpunkt vorhanden),
      // dann MUSS der Startpunkt immer erstellt werden, auch bei Vergleichs-Modus!
      // Das stellt sicher, dass die komplette Linie angezeigt wird, auch wenn nur 1 Update gefiltert wurde
      const isFirstFilteredUpdate = !hasPreviousEndPoint;
      const skipStartPoint = isClosedBots || (isVergleichsModus && !isFirstFilteredUpdate) || startOverlapsPrevEnd;
      
      if (update.lastUpload && startTimestamp !== endTimestamp && !skipStartPoint) {
        // Nur bei Neu-Modus ohne Überlappung: Startpunkt bei 0
        dataPoints.push({
          time: formatTimeLabel(startDate),
          timestamp: startTimestamp,
          version: update.version || index + 1,
          status: update.status,
          isStartPoint: true,
          calculationMode: update.calculationMode || 'Neu',
          'Gesamtkapital': gesamtkapital,
          'Gesamtprofit': 0,
          'Gesamtprofit %': 0,
          'Ø Profit/Tag': 0,
          'Real Profit/Tag': 0,
        });
      }
      
      // Berechne Runtime in Millisekunden (End - Start)
      // Bei Closed Bots: keine Runtime (nur ein Punkt mit End Date)
      const runtimeMs = isClosedBots ? undefined : endTimestamp - startTimestamp;
      
      // Endpunkt mit allen Metrik-Werten (kumuliert bei Vergleichs-Modus)
      dataPoints.push({
        time: formatTimeLabel(endDate),
        timestamp: endTimestamp,
        version: update.version || index + 1,
        status: update.status,
        isStartPoint: false,
        calculationMode: update.calculationMode || 'Neu',
        runtimeMs: runtimeMs,
        'Gesamtkapital': gesamtkapital,
        'Gesamtprofit': cumulativeProfit,
        'Gesamtprofit %': cumulativeProfitPercent,
        'Ø Profit/Tag': cumulativeAvgDaily,
        'Real Profit/Tag': cumulativeRealDaily,
        // Speichere vorherige Werte für Tooltip bei Vergleichs-Modus
        _prevEndValues: isVergleichsModus && index > 0 ? prevEndValues : undefined,
      });
      
      // Speichere aktuellen Endpunkt-Timestamp und Gesamtkapital für nächstes Update
      prevEndTimestamp = endTimestamp;
      prevGesamtkapital = gesamtkapital;
    });
    
    // Sortiere alle Punkte nach Zeitstempel
    dataPoints.sort((a, b) => a.timestamp - b.timestamp);
    
    // Zweiter Durchlauf: Markiere Endpunkte, die auch Startpunkte für das nächste Update sind
    // Dies ist der Fall bei Vergleichs-Modus, wo kein separater Startpunkt erstellt wird
    for (let i = 0; i < dataPoints.length; i++) {
      const currentPoint = dataPoints[i];
      
      // Nur Endpunkte prüfen
      if (currentPoint.isStartPoint !== false) continue;
      
      // Finde das nächste Update in den ursprünglichen Updates (nach diesem Endpunkt)
      const currentUpdateIndex = filteredUpdates.findIndex(u => {
        const ts = getUpdateTimestamp(u);
        return ts === currentPoint.timestamp;
      });
      
      // WICHTIG: filteredUpdates ist AUFSTEIGEND sortiert (älteste zuerst, Zeile 930-934)
      // Das NÄCHSTE Update in chronologischer Reihenfolge ist also bei index + 1
      if (currentUpdateIndex >= 0 && currentUpdateIndex < filteredUpdates.length - 1) {
        const nextUpdate = filteredUpdates[currentUpdateIndex + 1];
        // Prüfe ob das nächste Update ein Vergleichs-Update ist
        // Primär: Prüfe *_absolute Felder (wenn vorhanden und unterschiedlich)
        // Fallback: Prüfe calculationMode === "Normal" (nicht Startmetrik)
        const nextHasAbsoluteFields = nextUpdate.overallGridProfitUsdtAbsolute !== null && nextUpdate.overallGridProfitUsdtAbsolute !== undefined;
        let isNextVergleich = false;
        
        if (nextHasAbsoluteFields) {
          // Primäre Erkennung: absolute Felder vorhanden
          const nextMainValue = parseFloat(nextUpdate.overallGridProfitUsdt || '0') || 0;
          const nextAbsoluteValue = parseFloat(nextUpdate.overallGridProfitUsdtAbsolute || '0') || 0;
          isNextVergleich = Math.abs(nextMainValue - nextAbsoluteValue) > 0.01;
        } else {
          // Fallback: calculationMode "Normal" bedeutet es ist ein Update nach Startmetrik
          // (nicht perfekt, aber die einzige verfügbare Information)
          isNextVergleich = nextUpdate.calculationMode === 'Normal';
        }
        
        if (isNextVergleich) {
          // Dieser Endpunkt ist AUCH der Startpunkt für das nächste Update
          // Speichere die Startwerte für das nächste Update (sind die Endwerte von diesem)
          currentPoint._isAlsoStartOfNext = true;
          currentPoint._nextStartInfo = {
            nextUpdateVersion: nextUpdate.version || currentUpdateIndex + 2,
            // Die Start-Werte des nächsten Updates = Die End-Werte dieses Updates
            'Gesamtkapital': currentPoint['Gesamtkapital'],
            'Gesamtprofit': currentPoint['Gesamtprofit'],
            'Gesamtprofit %': currentPoint['Gesamtprofit %'],
            'Ø Profit/Tag': currentPoint['Ø Profit/Tag'],
            'Real Profit/Tag': currentPoint['Real Profit/Tag'],
          };
        }
      }
    }
    
    return dataPoints;
  }, [chartApplied, appliedChartSettings, sortedUpdates, profitPercentBase]);

  // Prüfe ob Gesamtkapital aktiv ist
  // Wenn ja: Alle Profit-Metriken starten auf Gesamtkapital-Höhe (bei JEDEM Update)
  const hasGesamtkapitalActive = useMemo(() => {
    return activeMetricCards.includes('Gesamtkapital');
  }, [activeMetricCards]);

  // Transformierte Chart-Daten für visuelle Darstellung
  // Wenn Gesamtkapital/Investitionsmenge aktiv ist: Profit-Werte starten auf Investment-Höhe
  // WICHTIG: Nur visuelle Transformation für Chart - ändert KEINE Berechnungen oder Modi!
  // Die echten Werte werden als _actual Felder gespeichert für den Tooltip
  const transformedChartData = useMemo(() => {
    if (!hasGesamtkapitalActive || !chartData || chartData.length === 0) {
      // Kein Offset nötig - Daten unverändert durchreichen
      // Aber trotzdem _actual Felder hinzufügen für konsistenten Tooltip-Zugriff
      return chartData.map(point => ({
        ...point,
        _actualGesamtprofit: point['Gesamtprofit'],
        _actualAvgDaily: point['Ø Profit/Tag'],
        _actualRealDaily: point['Real Profit/Tag'],
        _actualGesamtkapital: point['Gesamtkapital'],
        _actualProfitPercent: point['Gesamtprofit %'],
      }));
    }
    
    // Wenn Gesamtkapital aktiv: Profit-Metriken auf Investment-Level offsetten
    // So starten alle Linien auf der gleichen Höhe wie das Investment
    // Die echten Werte werden als _actual Felder gespeichert
    return chartData.map(point => {
      const investmentBase = point['Gesamtkapital'];
      
      return {
        ...point,
        // Echte Werte für Tooltip speichern
        _actualGesamtprofit: point['Gesamtprofit'],
        _actualAvgDaily: point['Ø Profit/Tag'],
        _actualRealDaily: point['Real Profit/Tag'],
        _actualGesamtkapital: point['Gesamtkapital'],
        _actualProfitPercent: point['Gesamtprofit %'],
        // Profit-Werte werden zum Investment addiert (visueller Offset für Chart)
        'Gesamtprofit': point['Gesamtprofit'] + investmentBase,
        'Ø Profit/Tag': point['Ø Profit/Tag'] + investmentBase,
        'Real Profit/Tag': point['Real Profit/Tag'] + investmentBase,
        // Gesamtkapital bleibt unverändert
        'Gesamtkapital': investmentBase,
        // Prozent-Linie auch auf Investment-Level offsetten (für visuelle Konsistenz)
        'Gesamtprofit %': point['Gesamtprofit %'] + investmentBase,
      };
    });
  }, [chartData, hasGesamtkapitalActive]);

  // Berechne Zeitgrenzen für Analysieren-Modus
  // Wenn analyzeMode aktiv: Nur das ausgewählte Update wird im Graph angezeigt
  const analyzeModeBounds = useMemo(() => {
    if (!analyzeMode || !appliedUpdateId) {
      return null;
    }
    
    // Parse Update ID (u-X oder c-X)
    const isClosedBot = appliedUpdateId.startsWith('c-');
    const version = parseInt(appliedUpdateId.split('-')[1], 10);
    
    // Finde das Update in den Daten
    const allUpdates = selectedBotTypeData?.id 
      ? (allBotTypeUpdates || []).filter((u: BotTypeUpdate) => u.botTypeId === selectedBotTypeData.id)
      : [];
    
    const update = allUpdates.find((u: BotTypeUpdate) => 
      u.version === version && 
      (isClosedBot ? u.status === 'Closed Bots' : u.status === 'Update Metrics')
    );
    
    if (!update) {
      return null;
    }
    
    // Parse Start und End Zeitstempel
    const parseTs = (dateStr: string | null | undefined): number | null => {
      if (!dateStr) return null;
      const parsed = parseGermanDate(dateStr);
      return parsed ? parsed.getTime() : null;
    };
    
    // Für Closed Bots: startDate und endDate verwenden
    // Für Update Metrics: lastUpload (Start) und thisUpload (End)
    let startTs: number | null;
    let endTs: number | null;
    
    if (isClosedBot) {
      startTs = parseTs(update.startDate);
      endTs = parseTs(update.endDate);
    } else {
      startTs = parseTs(update.lastUpload);
      endTs = parseTs(update.thisUpload);
    }
    
    // Mindestens ein Zeitstempel muss vorhanden sein
    if (startTs === null && endTs === null) {
      return null;
    }
    
    // Falls einer fehlt: Fallback auf den vorhandenen
    if (startTs === null) startTs = endTs! - (24 * 60 * 60 * 1000); // 1 Tag vorher
    if (endTs === null) endTs = startTs + (24 * 60 * 60 * 1000); // 1 Tag nachher
    
    return { startTs, endTs, update, isClosedBot, version };
  }, [analyzeMode, appliedUpdateId, selectedBotTypeData, allBotTypeUpdates]);

  // Berechne Highest und Lowest Value für jede aktive Metrik
  // Diese werden als Marker im Chart angezeigt wenn die entsprechenden Toggles aktiv sind
  const extremeValues = useMemo(() => {
    if (!transformedChartData || transformedChartData.length === 0) {
      return { highest: {}, lowest: {} } as { 
        highest: Record<string, { timestamp: number; value: number }>; 
        lowest: Record<string, { timestamp: number; value: number }>;
      };
    }
    
    // Nur Endpunkte betrachten (nicht Startpunkte)
    const endPoints = transformedChartData.filter(p => p.isStartPoint === false);
    if (endPoints.length === 0) {
      return { highest: {}, lowest: {} } as { 
        highest: Record<string, { timestamp: number; value: number }>; 
        lowest: Record<string, { timestamp: number; value: number }>;
      };
    }
    
    const highest: Record<string, { timestamp: number; value: number }> = {};
    const lowest: Record<string, { timestamp: number; value: number }> = {};
    
    // Für jede aktive Metrik den höchsten und niedrigsten Wert finden
    activeMetricCards.forEach(metricName => {
      let maxVal = -Infinity;
      let minVal = Infinity;
      let maxPoint: { timestamp: number; value: number } | null = null;
      let minPoint: { timestamp: number; value: number } | null = null;
      
      endPoints.forEach(point => {
        const value = point[metricName as keyof typeof point] as number;
        if (typeof value === 'number') {
          if (value > maxVal) {
            maxVal = value;
            maxPoint = { timestamp: point.timestamp, value };
          }
          if (value < minVal) {
            minVal = value;
            minPoint = { timestamp: point.timestamp, value };
          }
        }
      });
      
      if (maxPoint) highest[metricName] = maxPoint;
      if (minPoint) lowest[metricName] = minPoint;
    });
    
    return { highest, lowest };
  }, [transformedChartData, activeMetricCards]);

  // Berechne X-Achsen-Ticks basierend auf Sequence (Granularität)
  // WICHTIG: Der Zeitraum (From bis Until) bleibt IMMER gleich!
  // Tick-Intervalle:
  // - Stunden → Stunden-Ticks, Labels = Uhrzeit + ab und zu Datum
  // - Tage → Tages-Ticks, Labels = Datum
  // - Wochen → TAGES-Ticks (!), Labels = Datum + ab und zu KW
  // - Monate → TAGES-Ticks (!), Labels = Datum + ab und zu Monat
  const xAxisTicks = useMemo(() => {
    // COMPARE MODUS: Tick-Generierung für den Vergleichsmodus
    if (isMultiSelectCompareMode && compareChartData.minTimestamp > 0 && compareChartData.maxTimestamp > 0) {
      const startTs = compareChartData.minTimestamp;
      const endTs = compareChartData.maxTimestamp;
      const durationMs = endTs - startTs;
      const durationDays = durationMs / (1000 * 60 * 60 * 24);
      
      // Berechne ideales Intervall basierend auf Zeitspanne
      let tickInterval: number;
      
      if (durationDays <= 7) {
        tickInterval = 24 * 60 * 60 * 1000; // 1 Tag
      } else if (durationDays <= 14) {
        tickInterval = 2 * 24 * 60 * 60 * 1000; // 2 Tage
      } else if (durationDays <= 30) {
        tickInterval = 3 * 24 * 60 * 60 * 1000; // 3 Tage
      } else if (durationDays <= 60) {
        tickInterval = 7 * 24 * 60 * 60 * 1000; // 1 Woche
      } else {
        tickInterval = 14 * 24 * 60 * 60 * 1000; // 2 Wochen
      }
      
      const ticks: number[] = [];
      ticks.push(startTs);
      
      let currentTs = startTs + tickInterval;
      while (currentTs < endTs) {
        ticks.push(currentTs);
        currentTs += tickInterval;
      }
      
      if (ticks[ticks.length - 1] !== endTs) {
        ticks.push(endTs);
      }
      
      return ticks;
    }
    
    // ANALYSIEREN-MODUS: Spezielle Tick-Generierung für 10-12 Ticks
    if (analyzeModeBounds) {
      const { startTs, endTs } = analyzeModeBounds;
      const durationMs = endTs - startTs;
      const durationHours = durationMs / (1000 * 60 * 60);
      const durationDays = durationHours / 24;
      
      // Ziel: 10-12 Ticks
      const targetTicks = 10;
      
      // Berechne ideales Intervall basierend auf Zeitspanne
      let tickInterval: number;
      let useHourFormat = false;
      
      if (durationHours <= 6) {
        // < 6 Stunden: 30-Minuten-Intervalle
        tickInterval = 30 * 60 * 1000;
        useHourFormat = true;
      } else if (durationHours <= 24) {
        // < 1 Tag: 2-Stunden-Intervalle
        tickInterval = 2 * 60 * 60 * 1000;
        useHourFormat = true;
      } else if (durationDays <= 3) {
        // 1-3 Tage: 6-Stunden-Intervalle
        tickInterval = 6 * 60 * 60 * 1000;
        useHourFormat = true;
      } else if (durationDays <= 7) {
        // 3-7 Tage: 12-Stunden-Intervalle
        tickInterval = 12 * 60 * 60 * 1000;
        useHourFormat = true;
      } else if (durationDays <= 14) {
        // 1-2 Wochen: Tages-Intervalle
        tickInterval = 24 * 60 * 60 * 1000;
      } else if (durationDays <= 60) {
        // 2-8 Wochen: 2-Tages-Intervalle
        tickInterval = 2 * 24 * 60 * 60 * 1000;
      } else {
        // > 2 Monate: 1-Wochen-Intervalle
        tickInterval = 7 * 24 * 60 * 60 * 1000;
      }
      
      // Generiere Ticks - ANCHORED an startTs (nicht global ausgerichtet)
      // TradingView-Level: Ticks beginnen exakt beim Start-Datum
      const ticks: number[] = [];
      
      // Erster Tick = exaktes Start-Datum
      ticks.push(startTs);
      
      // Zwischen-Ticks: Inkrementiere direkt von startTs
      // KEINE globale Rundung auf "runde" Zeiten!
      // Beispiel: Start 16:52 mit 6h-Intervall → 16:52, 22:52, 04:52...
      let currentTs = startTs + tickInterval;
      
      while (currentTs < endTs) {
        ticks.push(currentTs);
        currentTs += tickInterval;
      }
      
      // Letzter Tick = exaktes End-Datum
      if (ticks[ticks.length - 1] !== endTs) {
        ticks.push(endTs);
      }
      
      return ticks;
    }
    
    // NORMALER MODUS: Originale Logik
    if (!chartData || chartData.length === 0) return [];
    
    const timestamps = chartData.map(d => d.timestamp).filter(t => t > 0);
    if (timestamps.length === 0) return [];
    
    // Zeitraum ist FIX (startTime bis endTime)
    const startTime = Math.min(...timestamps);
    const endTime = Math.max(...timestamps);
    
    const baseSequence = appliedChartSettings?.sequence || 'days';
    
    // ZOOM-basierte automatische Sequence-Anpassung für Ticks
    // Bei hohem Zoom automatisch feinere Ticks generieren
    let effectiveSequence = baseSequence;
    if (chartZoomX >= 6) {
      effectiveSequence = 'hours';
    } else if (chartZoomX >= 3 && baseSequence !== 'hours') {
      effectiveSequence = 'hours';
    }
    
    const sequence = effectiveSequence;
    
    // TICK-DENSITY-CAP: Max. 8-12 Major-Ticks (Pro-Trading-UI-Level)
    // Berechne sichtbare Zeitspanne basierend auf Zoom
    const totalRange = endTime - startTime;
    const visibleRange = totalRange / chartZoomX; // Sichtbarer Bereich bei Zoom
    
    // Adaptive Intervall-Wahl basierend auf sichtbarer Zeitspanne
    // Ziel: 8-12 Ticks im sichtbaren Bereich
    const visibleHours = visibleRange / (60 * 60 * 1000);
    const visibleDays = visibleRange / (24 * 60 * 60 * 1000);
    
    let tickInterval: number;
    
    if (visibleHours <= 12) {
      // Sehr hoch gezoomt: 1-Stunden-Intervalle
      tickInterval = 60 * 60 * 1000;
    } else if (visibleHours <= 36) {
      // Hoch gezoomt: 2-Stunden-Intervalle
      tickInterval = 2 * 60 * 60 * 1000;
    } else if (visibleHours <= 72) {
      // Mittel gezoomt: 6-Stunden-Intervalle
      tickInterval = 6 * 60 * 60 * 1000;
    } else if (visibleDays <= 7) {
      // Leicht gezoomt: 12-Stunden-Intervalle
      tickInterval = 12 * 60 * 60 * 1000;
    } else if (visibleDays <= 21) {
      // Normal: Tages-Intervalle
      tickInterval = 24 * 60 * 60 * 1000;
    } else if (visibleDays <= 60) {
      // Ausgezoomt: 2-Tages-Intervalle
      tickInterval = 2 * 24 * 60 * 60 * 1000;
    } else {
      // Stark ausgezoomt: Wochen-Intervalle
      tickInterval = 7 * 24 * 60 * 60 * 1000;
    }
    
    // FESTE BOUNDARY-TICKS: Start- und Enddatum IMMER sichtbar
    const ticks: number[] = [];
    
    // 1. IMMER mit startTime beginnen (feste Grenze)
    ticks.push(startTime);
    
    // 2. Adaptive Zwischen-Ticks generieren
    const startDate = new Date(startTime);
    if (tickInterval < 24 * 60 * 60 * 1000) {
      // Bei Stunden-Intervallen: runde auf nächste volle Stunde nach startTime
      startDate.setMinutes(0, 0, 0);
      if (startDate.getTime() <= startTime) {
        startDate.setTime(startDate.getTime() + 60 * 60 * 1000);
      }
    } else {
      // Bei Tages-Intervallen: runde auf nächste Mitternacht nach startTime
      startDate.setHours(0, 0, 0, 0);
      if (startDate.getTime() <= startTime) {
        startDate.setTime(startDate.getTime() + 24 * 60 * 60 * 1000);
      }
    }
    
    let currentTs = startDate.getTime();
    
    // Generiere Zwischen-Ticks (nicht zu nah an Start/End)
    const minGap = tickInterval * 0.3; // Mindestabstand zu Boundaries
    while (currentTs < endTime - minGap) {
      if (currentTs > startTime + minGap) {
        ticks.push(currentTs);
      }
      currentTs += tickInterval;
    }
    
    // 3. IMMER mit endTime enden (feste Grenze)
    if (endTime !== startTime) {
      ticks.push(endTime);
    }
    
    // 4. FALLBACK: Wenn zu wenige Ticks (< 3), kleinere Einheit verwenden
    if (ticks.length < 3 && totalRange > 60 * 60 * 1000) {
      // Fallback auf Stunden-Intervalle
      const fallbackTicks: number[] = [startTime];
      const fallbackInterval = Math.max(30 * 60 * 1000, totalRange / 8); // Min 30min, max 8 Ticks
      let fallbackTs = startTime + fallbackInterval;
      while (fallbackTs < endTime - fallbackInterval * 0.3) {
        fallbackTicks.push(fallbackTs);
        fallbackTs += fallbackInterval;
      }
      fallbackTicks.push(endTime);
      return fallbackTicks;
    }
    
    return ticks;
  }, [chartData, appliedChartSettings?.sequence, chartZoomX, analyzeModeBounds, isMultiSelectCompareMode, compareChartData]);

  // Berechne Y-Achsen-Domain dynamisch basierend auf aktiven Metriken + Zoom/Pan
  // WICHTIG: Padding hinzufügen damit Punkte am Rand nicht abgeschnitten werden
  const yAxisDomain = useMemo((): [number | string, number | string] => {
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
    
    // Berechne Basis-Domain mit ausreichend Padding (15% auf jeder Seite für mehr Puffer)
    const dataRange = maxVal - minVal;
    const padding = dataRange > 0 ? dataRange * 0.15 : Math.abs(maxVal) * 0.15 || 1;
    
    // IMMER Padding unten UND oben, damit Punkte nicht am Rand abgeschnitten werden
    // Mindestens 10% des maxVal als unteres Padding, damit der Chart nicht "verpackt" aussieht
    const minBottomPadding = Math.abs(maxVal) * 0.1;
    
    if (minVal < 0) {
      // Negative Werte vorhanden: Padding nach unten UND nach oben
      baseLower = minVal - Math.max(padding, minBottomPadding);
      baseUpper = maxVal + padding;
    } else if (hasGesamtkapitalActive) {
      // Gesamtkapital aktiv: Immer etwas Puffer unten lassen (nicht bei 0 abschneiden)
      // Wenn Werte nahe beieinander, mehr Puffer nach unten für bessere Visualisierung
      const bottomPadding = Math.max(padding, minBottomPadding);
      baseLower = Math.max(-bottomPadding * 0.5, minVal - bottomPadding);
      baseUpper = maxVal + padding;
    } else {
      const constantMetrics = ['Gesamtkapital'];
      const allConstant = activeMetricCards.every(m => constantMetrics.includes(m));
      
      if (allConstant) {
        const bottomPadding = Math.max(padding, minBottomPadding);
        baseLower = Math.max(-bottomPadding * 0.5, minVal - bottomPadding);
        baseUpper = maxVal + padding;
      } else {
        // Profit-Metriken ohne negative Werte: bei 0 oder leicht darunter starten
        const bottomPadding = Math.max(padding, minBottomPadding);
        baseLower = -bottomPadding * 0.5;
        baseUpper = maxVal + padding;
      }
    }
    
    // Bei Zoom 1 und Pan 0: Zeige den vollen Bereich mit Padding
    if (chartZoomY === 1 && chartPanY === 0) {
      return [baseLower, baseUpper];
    }
    
    // Zoom & Pan anwenden
    const baseRange = baseUpper - baseLower;
    const zoomedRange = baseRange / chartZoomY;
    const center = (baseLower + baseUpper) / 2;
    
    // Pan-Offset
    const panOffset = (chartPanY / 300) * baseRange;
    
    let zoomedLower = center - zoomedRange / 2 + panOffset;
    let zoomedUpper = center + zoomedRange / 2 + panOffset;
    
    // Extra Padding unten beim Zoomen (10% der sichtbaren Range)
    // Damit der untere Punkt nicht am Rand klebt
    const zoomPadding = zoomedRange * 0.1;
    zoomedLower = zoomedLower - zoomPadding;
    
    return [zoomedLower, zoomedUpper];
  }, [transformedChartData, activeMetricCards, hasGesamtkapitalActive, chartZoomY, chartPanY]);

  // Berechne X-Achsen-Domain (Zeit) basierend auf Zoom & Pan
  // WICHTIG: Padding hinzufügen damit Punkte am Rand nicht abgeschnitten werden
  // Bei analyzeMode: Nur den Zeitraum des ausgewählten Updates zeigen
  const xAxisDomain = useMemo((): [number | string, number | string] => {
    // COMPARE MODUS: Nutze frühestes und spätestes Datum aller ausgewählten Bot-Types
    if (isMultiSelectCompareMode && compareChartData.minTimestamp > 0 && compareChartData.maxTimestamp > 0) {
      const range = compareChartData.maxTimestamp - compareChartData.minTimestamp;
      const padding = range > 0 ? range * 0.05 : 24 * 60 * 60 * 1000; // 5% oder 1 Tag
      return [compareChartData.minTimestamp - padding, compareChartData.maxTimestamp + padding];
    }
    
    // ANALYSIEREN-MODUS: Nur das ausgewählte Update anzeigen
    if (analyzeModeBounds) {
      const { startTs, endTs } = analyzeModeBounds;
      // 5% Padding auf jeder Seite für schöne Darstellung
      const range = endTs - startTs;
      const padding = range * 0.05;
      return [startTs - padding, endTs + padding];
    }
    
    // Hole Start- und Endzeit aus den Daten
    const dataToUse = transformedChartData;
    if (!dataToUse || dataToUse.length === 0) {
      return ['dataMin', 'dataMax'];
    }
    
    const timestamps = dataToUse.map(d => d.timestamp).filter(t => t > 0);
    if (timestamps.length === 0) return ['dataMin', 'dataMax'];
    
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    
    // Basis-Range mit Padding (5% auf jeder Seite)
    const dataRange = maxTime - minTime;
    if (dataRange === 0) {
      // Einzelner Punkt: 1 Tag Padding auf jeder Seite
      const oneDayMs = 24 * 60 * 60 * 1000;
      return [minTime - oneDayMs, maxTime + oneDayMs];
    }
    
    // 5% Padding auf jeder Seite damit Punkte nicht abgeschnitten werden
    const padding = dataRange * 0.05;
    const baseMin = minTime - padding;
    const baseMax = maxTime + padding;
    const baseRange = baseMax - baseMin;
    
    // Bei Zoom 1 und Pan 0: Zeige den vollen Bereich mit Padding
    if (chartZoomX === 1 && chartPanX === 0) {
      return [baseMin, baseMax];
    }
    
    // Zoom anwenden (zoomedRange = kleinerer Bereich bei höherem Zoom)
    const zoomedRange = baseRange / chartZoomX;
    const center = (baseMin + baseMax) / 2;
    
    // Pan-Offset: chartPanX in Pixel, umrechnen auf Zeit-Einheiten
    const chartWidth = 600;
    const panOffset = -(chartPanX / chartWidth) * baseRange;
    
    const zoomedStart = center - zoomedRange / 2 + panOffset;
    const zoomedEnd = center + zoomedRange / 2 + panOffset;
    
    return [zoomedStart, zoomedEnd];
  }, [transformedChartData, chartZoomX, chartPanX, analyzeModeBounds, isMultiSelectCompareMode, compareChartData]);

  // ===== ZEITFILTER FÜR STATCARDS =====
  // Diese gefilterten Updates werden in allen StatCard-Berechnungen verwendet
  // damit die Cards nur die Werte der gefilterten Updates anzeigen
  const timeFilteredBotTypeUpdates = useMemo(() => {
    if (!allBotTypeUpdates || allBotTypeUpdates.length === 0) {
      return [];
    }
    
    // ANALYSIEREN-MODUS: Nur das ausgewählte Update für StatCards verwenden
    if (analyzeMode && appliedUpdateId && selectedBotTypeData) {
      // Parse Update-ID: "u-X" = Update Metrics, "c-X" = Closed Bots
      const isClosedBot = appliedUpdateId.startsWith('c-');
      const versionStr = appliedUpdateId.replace(/^[uc]-/, '');
      const version = parseInt(versionStr, 10);
      
      // Finde das passende Update - MUSS auch botTypeId matchen!
      const selectedUpdate = allBotTypeUpdates.find(update => {
        // Muss zum aktuellen Bot-Type gehören
        if (update.botTypeId !== selectedBotTypeData.id) {
          return false;
        }
        if (isClosedBot) {
          return update.status === "Closed Bots" && update.version === version;
        } else {
          return update.status === "Update Metrics" && update.version === version;
        }
      });
      
      return selectedUpdate ? [selectedUpdate] : [];
    }
    
    // Wenn keine appliedChartSettings vorhanden, alle Updates zurückgeben
    if (!appliedChartSettings) {
      return allBotTypeUpdates;
    }
    
    // Helper: Hole Timestamp für ein Update
    const getTs = (update: any): number => {
      // Bei Closed Bots: endDate, sonst thisUpload
      const dateStr = update.endDate || update.thisUpload;
      if (!dateStr) return 0;
      const parsed = parseGermanDate(dateStr);
      return parsed ? parsed.getTime() : 0;
    };
    
    let filtered = [...allBotTypeUpdates];
    
    // Priorität 1: From/Until manuell ausgewählt
    if (appliedChartSettings.fromUpdate && appliedChartSettings.untilUpdate) {
      const fromTs = getTs(appliedChartSettings.fromUpdate);
      const untilTs = getTs(appliedChartSettings.untilUpdate);
      
      filtered = filtered.filter(update => {
        const ts = getTs(update);
        return ts >= fromTs && ts <= untilTs;
      });
    }
    // Priorität 2: Custom mit Kalender-Auswahl
    else if (appliedChartSettings.timeRange === 'Custom' && appliedChartSettings.customFromDate && appliedChartSettings.customToDate) {
      const fromTs = appliedChartSettings.customFromDate.getTime();
      const toDate = new Date(appliedChartSettings.customToDate);
      toDate.setHours(23, 59, 59, 999);
      const untilTs = toDate.getTime();
      
      filtered = filtered.filter(update => {
        const ts = getTs(update);
        return ts >= fromTs && ts <= untilTs;
      });
    }
    // Priorität 3: "Letzten"-Zeitraum Filter (1h, 24h, 7 Days, 30 Days, Custom mit D/H/M)
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
        
        filtered = filtered.filter(update => {
          const ts = getTs(update);
          return ts >= cutoffTimestamp;
        });
      }
    }
    // Priorität 4: First-Last Update = Alle Updates (kein Filter)
    
    return filtered;
  }, [allBotTypeUpdates, appliedChartSettings, analyzeMode, appliedUpdateId, selectedBotTypeData]);

  // Berechne totalInvestment basierend auf Bot Type Status - MUSS VOR isLoading check sein!
  // Verwendet dieselbe Logik wie Bot-Types-Seite: Durchschnitt aller "Update Metrics" pro Bot-Type
  const totalInvestment = useMemo(() => {
    // Verwende timeFilteredBotTypeUpdates statt allBotTypeUpdates für Zeitraum-Filterung
    if (selectedBotName === "Gesamt") {
      // Prüfe ob alle benötigten Daten vorhanden sind
      if (!availableBotTypes || timeFilteredBotTypeUpdates.length === 0) {
        // Falls Daten fehlen, nutze Entries als Fallback
        return filteredEntriesForStats.reduce((sum, entry) => sum + parseFloat(entry.investment), 0);
      }
      
      // Summiere Gesamtinvestment-Ø von allen aktiven Bot Types
      // Gesamtinvestment-Ø = Durchschnitt aller totalInvestment von Updates mit Status "Update Metrics"
      const activeBotTypes = availableBotTypes.filter(bt => bt.isActive);
      let sum = 0;
      
      activeBotTypes.forEach(botType => {
        // Nur Updates mit Status "Update Metrics" verwenden (wie auf Bot-Types-Seite)
        const updateMetricsOnly = timeFilteredBotTypeUpdates.filter(
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
      if (!selectedBotTypeData || timeFilteredBotTypeUpdates.length === 0) {
        return filteredEntriesForStats.reduce((sum, entry) => sum + parseFloat(entry.investment), 0);
      }
      
      // Nur Updates mit Status "Update Metrics" für diesen Bot-Type
      const updateMetricsOnly = timeFilteredBotTypeUpdates.filter(
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
  }, [selectedBotName, availableBotTypes, timeFilteredBotTypeUpdates, filteredEntriesForStats, selectedBotTypeData]);
  
  // Berechne totalBaseInvestment (Investitionsmenge-Ø) - GLEICHE LOGIK wie Gesamtinvestment-Ø
  // Pro Bot-Type: Durchschnitt aller "investment" Werte von "Update Metrics" Updates
  // Dann alle Bot-Type-Durchschnitte summieren
  const totalBaseInvestment = useMemo(() => {
    // Verwende timeFilteredBotTypeUpdates für Zeitraum-Filterung
    if (selectedBotName === "Gesamt") {
      if (!availableBotTypes || timeFilteredBotTypeUpdates.length === 0) {
        return 0;
      }
      
      const activeBotTypes = availableBotTypes.filter(bt => bt.isActive);
      let sum = 0;
      
      activeBotTypes.forEach(botType => {
        // Nur Updates mit Status "Update Metrics" verwenden (wie bei Gesamtinvestment-Ø)
        const updateMetricsOnly = timeFilteredBotTypeUpdates.filter(
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
      if (!selectedBotTypeData || timeFilteredBotTypeUpdates.length === 0) {
        return 0;
      }
      
      // Nur Updates mit Status "Update Metrics" für diesen Bot-Type
      const updateMetricsOnly = timeFilteredBotTypeUpdates.filter(
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
  }, [selectedBotName, availableBotTypes, timeFilteredBotTypeUpdates, selectedBotTypeData]);
  
  // displayedInvestment: Wechselt zwischen Gesamtinvestment und Investitionsmenge basierend auf Dropdown
  const displayedInvestment = useMemo(() => {
    return profitPercentBase === 'gesamtinvestment' ? totalInvestment : totalBaseInvestment;
  }, [profitPercentBase, totalInvestment, totalBaseInvestment]);
  
  // Berechne totalProfit - Dieselbe Logik wie Bot-Types-Seite:
  // - Update Metrics: overallGridProfitUsdt (Grid Profit)
  // - Closed Bots: profit (Gesamt Profit)
  const totalProfit = useMemo(() => {
    // Verwende timeFilteredBotTypeUpdates für Zeitraum-Filterung
    if (selectedBotName === "Gesamt") {
      // Prüfe ob alle benötigten Daten vorhanden sind
      if (!availableBotTypes || timeFilteredBotTypeUpdates.length === 0) {
        // Falls Daten fehlen, nutze Entries als Fallback
        return filteredEntriesForStats.reduce((sum, entry) => sum + parseFloat(entry.profit), 0);
      }
      
      // Summiere Gesamt Profit von allen aktiven Bot Types
      const activeBotTypes = availableBotTypes.filter(bt => bt.isActive);
      let sum = 0;
      
      activeBotTypes.forEach(botType => {
        const updatesForType = timeFilteredBotTypeUpdates.filter(update => update.botTypeId === botType.id);
        
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
      if (!selectedBotTypeData || timeFilteredBotTypeUpdates.length === 0) {
        return filteredEntriesForStats.reduce((sum, entry) => sum + parseFloat(entry.profit), 0);
      }
      
      // Alle Updates für diesen Bot-Type
      const updatesForType = timeFilteredBotTypeUpdates.filter(update => update.botTypeId === selectedBotTypeData.id);
      
      // Gesamt Profit: Alle Updates, aber unterschiedliche Felder je nach Status
      return updatesForType.reduce((s, update) => {
        if (update.status === 'Closed Bots') {
          return s + (parseFloat(update.profit || '0') || 0);
        } else {
          return s + (parseFloat(update.overallGridProfitUsdt || '0') || 0);
        }
      }, 0);
    }
  }, [selectedBotName, availableBotTypes, timeFilteredBotTypeUpdates, filteredEntriesForStats, selectedBotTypeData]);
  
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
    // Verwende timeFilteredBotTypeUpdates für Zeitraum-Filterung
    if (selectedBotName === "Gesamt") {
      if (!availableBotTypes || timeFilteredBotTypeUpdates.length === 0) {
        return 0;
      }
      
      const activeBotTypes = availableBotTypes.filter(bt => bt.isActive);
      let totalAvg24h = 0;
      
      activeBotTypes.forEach(botType => {
        const updateMetricsOnly = timeFilteredBotTypeUpdates.filter(
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
      if (!selectedBotTypeData || timeFilteredBotTypeUpdates.length === 0) {
        return 0;
      }
      
      const updateMetricsOnly = timeFilteredBotTypeUpdates.filter(
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
  }, [selectedBotName, availableBotTypes, timeFilteredBotTypeUpdates, selectedBotTypeData]);

  // Real Profit/Tag: Summe der "Real 24h Profit" von allen aktiven Bot-Types
  // Berechnung wie auf Bot-Types-Seite:
  // - Wenn Runtime < 24h: Nimm den gesamten Grid Profit
  // - Wenn Runtime >= 24h: Nimm den avgGridProfitDay
  const real24hProfit = useMemo(() => {
    // Verwende timeFilteredBotTypeUpdates für Zeitraum-Filterung
    if (selectedBotName === "Gesamt") {
      if (!availableBotTypes || timeFilteredBotTypeUpdates.length === 0) {
        return 0;
      }
      
      const activeBotTypes = availableBotTypes.filter(bt => bt.isActive);
      let totalReal24h = 0;
      
      activeBotTypes.forEach(botType => {
        const updateMetricsOnly = timeFilteredBotTypeUpdates.filter(
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
      if (!selectedBotTypeData || timeFilteredBotTypeUpdates.length === 0) {
        return 0;
      }
      
      const updateMetricsOnly = timeFilteredBotTypeUpdates.filter(
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
  }, [selectedBotName, availableBotTypes, timeFilteredBotTypeUpdates, selectedBotTypeData]);

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

  const handleDateSelect = (range: { from: Date | undefined; to: Date | undefined } | undefined) => {
    // Robuste Null-Prüfung: range kann undefined sein wenn Kalender zurückgesetzt wird
    if (!range) {
      setDateRange({ from: undefined, to: undefined });
      return;
    }
    
    setDateRange(range);
    // Wenn beide Daten ausgewählt sind, Kalender schließen
    // Felder werden NICHT gefüllt - Kalender und Felder sind separate Optionen
    if (range.from && range.to) {
      setCalendarOpen(false);
    }
  };

  const handleApplySettings = () => {
    // Speichere die aktuellen Einstellungen und aktiviere den Chart
    // Bei Custom: Prüfe ob Kalender oder D/H/M Felder verwendet werden
    // Kalender hat Vorrang wenn beide Daten gesetzt sind
    const useCalendar = dateRange.from && dateRange.to;
    
    setAppliedChartSettings({
      timeRange: selectedTimeRange,
      sequence: chartSequence,
      fromUpdate: selectedFromUpdate,
      untilUpdate: selectedUntilUpdate,
      // D/H/M Felder (nur wenn KEIN Kalender verwendet wird)
      customDays: useCalendar ? '' : customDays,
      customHours: useCalendar ? '' : customHours,
      customMinutes: useCalendar ? '' : customMinutes,
      // Kalender-Daten (nur wenn Kalender verwendet wird)
      customFromDate: useCalendar ? dateRange.from : undefined,
      customToDate: useCalendar ? dateRange.to : undefined,
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
                    value: isMultiSelectCompareMode ? '--' : `${displayedInvestment.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`,
                    icon: Wallet,
                    iconColor: 'bg-blue-100 text-blue-600',
                  },
                  'Gesamtprofit': {
                    label: 'Gesamtprofit',
                    value: isMultiSelectCompareMode ? '--' : `${totalProfit.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`,
                    icon: TrendingUp,
                    iconColor: 'bg-green-100 text-green-600',
                  },
                  'Gesamtprofit %': {
                    label: profitPercentBase === 'gesamtinvestment' ? 'Gesamtprofit % (GI)' : 'Gesamtprofit % (IM)',
                    value: isMultiSelectCompareMode ? '--' : `${totalProfitPercent.toFixed(2)}%`,
                    icon: Percent,
                    iconColor: 'bg-purple-100 text-purple-600',
                  },
                  'Ø Profit/Tag': {
                    label: 'Ø Profit/Tag',
                    value: isMultiSelectCompareMode ? '--' : `${avgDailyProfit.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`,
                    icon: CalendarIcon,
                    iconColor: 'bg-orange-100 text-orange-600',
                  },
                  'Real Profit/Tag': {
                    label: 'Real Profit/Tag',
                    value: isMultiSelectCompareMode ? '--' : `${real24hProfit.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`,
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
            <Card className="p-6 pt-[20px] pb-[20px]">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold">Update Verlauf</h3>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">From:</span>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-2 min-w-[100px]"
                      onClick={() => selectedBotName !== "Gesamt" && updateSelectionMode !== 'confirmed' && !analyzeMode && !isMultiSelectCompareMode && setFromUpdateDialogOpen(true)}
                      disabled={selectedBotName === "Gesamt" || updateSelectionMode === 'confirmed' || analyzeMode || isMultiSelectCompareMode}
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
                      onClick={() => selectedBotName !== "Gesamt" && updateSelectionMode !== 'confirmed' && !analyzeMode && !isMultiSelectCompareMode && setUntilUpdateDialogOpen(true)}
                      disabled={selectedBotName === "Gesamt" || updateSelectionMode === 'confirmed' || analyzeMode || isMultiSelectCompareMode}
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
                {(chartZoomY > 1 || chartZoomX > 1 || chartPanY !== 0 || chartPanX !== 0) && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <ZoomIn className="h-3 w-3" />
                      {chartZoomY.toFixed(1)}x
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
              
              {/* Marker Section with Left Icons */}
              <div className="flex" style={{ marginBottom: '16px' }}>
                {/* Left Icon Panel */}
                <div className="flex flex-col items-center justify-center gap-1" style={{ width: '80px' }}>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className={cn(
                      "h-7 w-7",
                      markerViewActive && !analyzeMode && "ring-2 ring-cyan-600 shadow-[0_0_10px_rgba(8,145,178,0.6)]"
                    )}
                    disabled={analyzeMode}
                    onClick={() => {
                      const newValue = !markerViewActive;
                      setMarkerViewActive(newValue);
                      if (!newValue) {
                        setLockedUpdateIds(new Set());
                        setHoveredUpdateId(null);
                      }
                    }}
                    data-testid="button-marker-view"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className={cn(
                      "h-7 w-7",
                      markerEditActive && !analyzeMode && "ring-2 ring-cyan-600 shadow-[0_0_10px_rgba(8,145,178,0.6)]"
                    )}
                    disabled={analyzeMode}
                    onClick={() => {
                      if (!markerEditActive) {
                        // Beim Aktivieren: vorherige Auswahl löschen
                        setEditSelectedUpdateId(null);
                        setEditHoveredUpdateId(null);
                      } else {
                        // Beim Deaktivieren OHNE Apply: Auswahl zurücksetzen
                        setEditSelectedUpdateId(null);
                        setEditHoveredUpdateId(null);
                      }
                      setMarkerEditActive(!markerEditActive);
                    }}
                    data-testid="button-marker-edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
                
                {/* Marker Container - Dynamic Grid aligned with Chart */}
                <div 
                  className="relative h-20 border rounded-sm flex-1"
                  style={{ 
                    marginRight: '30px',
                    borderColor: 'hsl(var(--border))'
                  }}
                  data-testid="chart-marker-container"
                >
                {/* Dynamic vertical grid lines - synced with chart X-axis */}
                <svg className="absolute inset-0 w-full h-full pointer-events-auto" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
                  {/* Horizontal grid lines (static) */}
                  {[0.25, 0.5, 0.75].map((ratio) => (
                    <line
                      key={`h-${ratio}`}
                      x1="0"
                      y1={`${ratio * 100}%`}
                      x2="100%"
                      y2={`${ratio * 100}%`}
                      stroke="hsl(var(--border))"
                      strokeWidth="1"
                      strokeDasharray="3 3"
                      style={{ pointerEvents: 'none' }}
                    />
                  ))}
                  
                  {/* Vertical grid lines - synced with chart xAxisTicks */}
                  {(() => {
                    const [domainStart, domainEnd] = xAxisDomain;
                    if (typeof domainStart !== 'number' || typeof domainEnd !== 'number') return null;
                    
                    const domainRange = domainEnd - domainStart;
                    if (domainRange <= 0) return null;
                    
                    // Filter ticks within visible domain
                    const visibleTicks = xAxisTicks.filter(t => t >= domainStart && t <= domainEnd);
                    
                    return visibleTicks.map((tick, i) => {
                      const xPercent = ((tick - domainStart) / domainRange) * 100;
                      return (
                        <line
                          key={`v-${i}`}
                          x1={`${xPercent}%`}
                          y1="0"
                          x2={`${xPercent}%`}
                          y2="100%"
                          stroke="hsl(var(--border))"
                          strokeWidth="1"
                          strokeDasharray="3 3"
                          style={{ pointerEvents: 'none' }}
                        />
                      );
                    });
                  })()}
                  
                  {/* Update Connection Lines - Start to End markers */}
                  {(() => {
                    const [domainStart, domainEnd] = xAxisDomain;
                    if (typeof domainStart !== 'number' || typeof domainEnd !== 'number') return null;
                    
                    const domainRange = domainEnd - domainStart;
                    if (domainRange <= 0) return null;
                    
                    // Get updates directly from sortedUpdates (authoritative source)
                    // This ensures we get correct start/end even for comparison mode updates
                    const updateRanges: { version: number; status: string; startTs: number; endTs: number }[] = [];
                    
                    // Filter updates same as chartData logic
                    let filteredUpdates = [...(sortedUpdates || [])];
                    
                    if (appliedChartSettings?.fromUpdate && appliedChartSettings?.untilUpdate) {
                      const fromTs = getUpdateTimestamp(appliedChartSettings.fromUpdate);
                      const untilTs = getUpdateTimestamp(appliedChartSettings.untilUpdate);
                      filteredUpdates = filteredUpdates.filter(u => {
                        const ts = getUpdateTimestamp(u);
                        return ts >= fromTs && ts <= untilTs;
                      });
                    } else if (appliedChartSettings?.timeRange === 'Custom' && appliedChartSettings?.customFromDate && appliedChartSettings?.customToDate) {
                      const fromTs = appliedChartSettings.customFromDate.getTime();
                      const toDate = new Date(appliedChartSettings.customToDate);
                      toDate.setHours(23, 59, 59, 999);
                      const untilTs = toDate.getTime();
                      filteredUpdates = filteredUpdates.filter(u => {
                        const ts = getUpdateTimestamp(u);
                        return ts >= fromTs && ts <= untilTs;
                      });
                    } else if (appliedChartSettings?.timeRange && appliedChartSettings.timeRange !== 'First-Last Update') {
                      const rangeMs = parseTimeRangeToMs(
                        appliedChartSettings.timeRange,
                        appliedChartSettings.customDays,
                        appliedChartSettings.customHours,
                        appliedChartSettings.customMinutes
                      );
                      if (rangeMs !== null && rangeMs > 0) {
                        const now = Date.now();
                        const cutoff = now - rangeMs;
                        filteredUpdates = filteredUpdates.filter(u => getUpdateTimestamp(u) >= cutoff);
                      }
                    }
                    
                    // Sort by end timestamp (thisUpload)
                    filteredUpdates.sort((a, b) => getUpdateTimestamp(a) - getUpdateTimestamp(b));
                    
                    // Build ranges from update objects directly
                    let prevEndTs = 0;
                    filteredUpdates.forEach((update, idx) => {
                      const endTs = update.thisUpload ? parseGermanDate(update.thisUpload)?.getTime() || 0 : 0;
                      let startTs = update.lastUpload ? parseGermanDate(update.lastUpload)?.getTime() || 0 : 0;
                      
                      // For comparison updates where start equals previous end, use previous end
                      if (startTs === 0 || (prevEndTs > 0 && Math.abs(startTs - prevEndTs) < 60000)) {
                        startTs = prevEndTs > 0 ? prevEndTs : endTs;
                      }
                      
                      if (endTs > 0) {
                        updateRanges.push({
                          version: update.version || idx + 1,
                          status: update.status || 'Update Metrics',
                          startTs: startTs || endTs,
                          endTs,
                        });
                        prevEndTs = endTs;
                      }
                    });
                    
                    // Sort by start time
                    updateRanges.sort((a, b) => a.startTs - b.startTs);
                    
                    // Assign vertical lanes to avoid overlaps
                    const lanes: { endTs: number }[] = [];
                    const updateLanes = updateRanges.map(update => {
                      // Find first available lane
                      let laneIndex = lanes.findIndex(lane => lane.endTs < update.startTs);
                      if (laneIndex === -1) {
                        laneIndex = lanes.length;
                        lanes.push({ endTs: update.endTs });
                      } else {
                        lanes[laneIndex].endTs = update.endTs;
                      }
                      return { ...update, lane: laneIndex };
                    });
                    
                    const containerHeight = 80; // h-20 = 80px
                    const lineHeight = 14;
                    const topPadding = 25;
                    
                    return updateLanes.map((update, i) => {
                      const startX = ((update.startTs - domainStart) / domainRange) * 100;
                      const endX = ((update.endTs - domainStart) / domainRange) * 100;
                      const yPos = topPadding + (update.lane * lineHeight);
                      const yPercent = (yPos / containerHeight) * 100;
                      
                      const isClosedBot = update.status === 'Closed Bots';
                      const label = isClosedBot ? `C${update.version}` : `U${update.version}`;
                      
                      // Check if within visible range
                      if (endX < 0 || startX > 100) return null;
                      
                      const clampedStartX = Math.max(0, startX);
                      const clampedEndX = Math.min(100, endX);
                      
                      if (isClosedBot) {
                        // Closed Bot: Only end marker (circle) - positioned below label
                        const closedKey = `c-${update.version}`;
                        
                        // Stift-Modus hat Priorität - wenn aktiv, ignoriere Auge-Modus UND appliedUpdateId
                        let isClosedActive = false;
                        
                        if (markerEditActive) {
                          // Stift-Modus: NUR das ausgewählte oder gehoverte (Single-Select)
                          // Im Stift-Modus wird appliedUpdateId IGNORIERT - nur aktuelle Auswahl zählt
                          const isEditHovered = editHoveredUpdateId === closedKey;
                          const isEditSelected = editSelectedUpdateId === closedKey;
                          isClosedActive = isEditHovered || isEditSelected;
                        } else if (markerViewActive) {
                          // Auge-Modus: Multi-Select (nur wenn Stift NICHT aktiv)
                          const isClosedLocked = lockedUpdateIds.has(closedKey);
                          const isClosedHovered = hoveredUpdateId === closedKey;
                          isClosedActive = isClosedHovered || isClosedLocked;
                        } else {
                          // Kein Modus aktiv: Zeige appliedUpdateId (wenn vorhanden)
                          const isApplied = appliedUpdateId === closedKey;
                          if (isApplied) isClosedActive = true;
                        }
                        const closedStrokeColor = isClosedActive ? "rgb(8, 145, 178)" : "hsl(var(--muted-foreground))";
                        
                        const handleClosedClick = () => {
                          // Stift-Modus hat PRIORITÄT - blockiert Auge-Modus
                          if (markerEditActive) {
                            setEditSelectedUpdateId(prev => prev === closedKey ? null : closedKey);
                            // WICHTIG: Hover zurücksetzen bei Klick, damit nur das angeklickte Element blau bleibt
                            setEditHoveredUpdateId(null);
                            return; // Blockiere Auge-Modus!
                          }
                          // Auge-Modus: Multi-Select Toggle (nur wenn Stift NICHT aktiv)
                          if (markerViewActive) {
                            setLockedUpdateIds(prev => {
                              const newSet = new Set(prev);
                              if (newSet.has(closedKey)) {
                                newSet.delete(closedKey);
                              } else {
                                newSet.add(closedKey);
                              }
                              return newSet;
                            });
                          }
                        };
                        
                        const handleClosedMouseEnter = () => {
                          if (markerViewActive) setHoveredUpdateId(closedKey);
                          // Stift: NUR hovern wenn NICHTS ausgewählt ist (strikt)
                          if (markerEditActive && editSelectedUpdateId === null) {
                            setEditHoveredUpdateId(closedKey);
                          }
                        };
                        
                        const handleClosedMouseLeave = () => {
                          setHoveredUpdateId(null);
                          // Stift: NUR Hover clearen wenn NICHTS ausgewählt ist
                          if (editSelectedUpdateId === null) {
                            setEditHoveredUpdateId(null);
                          }
                        };
                        
                        // Calculate dashed line Y position for closed bot
                        const getClosedBotChartY = () => {
                          if (!isClosedActive) return null;
                          const chartDataArray = transformedChartData || [];
                          if (chartDataArray.length === 0) return null;
                          
                          const activeMetric = activeMetricCards[0];
                          if (!activeMetric) return null;
                          
                          // Find value at closed timestamp
                          const sorted = [...chartDataArray].sort((a, b) => a.timestamp - b.timestamp);
                          let before = null;
                          let after = null;
                          const targetTs = update.endTs;
                          
                          for (let j = 0; j < sorted.length; j++) {
                            if (sorted[j].timestamp <= targetTs) before = sorted[j];
                            if (sorted[j].timestamp >= targetTs && !after) after = sorted[j];
                          }
                          
                          let endValue: number | null = null;
                          if (before && before.timestamp === targetTs) {
                            endValue = before[activeMetric as keyof typeof before] as number;
                          } else if (after && after.timestamp === targetTs) {
                            endValue = after[activeMetric as keyof typeof after] as number;
                          } else if (before && after && before !== after) {
                            const beforeVal = before[activeMetric as keyof typeof before] as number;
                            const afterVal = after[activeMetric as keyof typeof after] as number;
                            const t = (targetTs - before.timestamp) / (after.timestamp - before.timestamp);
                            endValue = beforeVal + t * (afterVal - beforeVal);
                          } else if (before) {
                            endValue = before[activeMetric as keyof typeof before] as number;
                          } else if (after) {
                            endValue = after[activeMetric as keyof typeof after] as number;
                          }
                          
                          if (endValue === null) return null;
                          
                          // Calculate Y position
                          let yMinNum: number, yMaxNum: number;
                          const [yMin, yMax] = yAxisDomain;
                          if (typeof yMin === 'number' && typeof yMax === 'number') {
                            yMinNum = yMin;
                            yMaxNum = yMax;
                          } else {
                            const allVals = chartDataArray.map(d => d[activeMetric as keyof typeof d] as number).filter(v => typeof v === 'number');
                            if (allVals.length === 0) return null;
                            yMinNum = Math.min(...allVals);
                            yMaxNum = Math.max(...allVals);
                          }
                          const yRange = yMaxNum - yMinNum;
                          
                          const markerHeight = 80;
                          const gapHeight = 16;
                          const chartTopMargin = 5;
                          const plotHeight = 225;
                          
                          if (yRange === 0) return 100;
                          const relativeValue = (endValue - yMinNum) / yRange;
                          const chartY = chartTopMargin + (1 - relativeValue) * plotHeight;
                          const rawY = (markerHeight + gapHeight + chartY) / markerHeight * 100;
                          return Math.max(100, rawY);
                        };
                        
                        const closedY2 = getClosedBotChartY();
                        
                        return (
                          <g 
                            key={`cb-${i}`}
                            style={{ cursor: (markerViewActive || markerEditActive) ? 'pointer' : 'default', pointerEvents: 'all' }}
                            onMouseEnter={handleClosedMouseEnter}
                            onMouseLeave={handleClosedMouseLeave}
                            onClick={handleClosedClick}
                          >
                            {/* Invisible hitbox for easier hover */}
                            <rect
                              x={`${clampedEndX - 2}%`}
                              y={`${yPercent - 10}%`}
                              width="4%"
                              height="20%"
                              fill="transparent"
                              style={{ pointerEvents: 'all' }}
                            />
                            <text
                              x={`${clampedEndX}%`}
                              y={`${yPercent - 2}%`}
                              textAnchor="middle"
                              fontSize={9}
                              fill={closedStrokeColor}
                              style={isClosedActive ? { filter: 'drop-shadow(0 0 4px rgba(8, 145, 178, 0.8))' } : {}}
                            >
                              {label}
                            </text>
                            <circle
                              cx={`${clampedEndX}%`}
                              cy={`${yPercent + 8}%`}
                              r={4}
                              fill={closedStrokeColor}
                              style={isClosedActive ? { filter: 'drop-shadow(0 0 6px rgba(8, 145, 178, 0.8))' } : {}}
                            />
                            {/* Dashed line to chart when active */}
                            {isClosedActive && closedY2 !== null && (
                              <line
                                x1={`${clampedEndX}%`}
                                y1={`${yPercent + 12}%`}
                                x2={`${clampedEndX}%`}
                                y2={`${closedY2}%`}
                                stroke="rgb(8, 145, 178)"
                                strokeWidth="1"
                                strokeDasharray="4 3"
                                style={{ filter: 'drop-shadow(0 0 4px rgba(8, 145, 178, 0.6))', pointerEvents: 'none' }}
                              />
                            )}
                          </g>
                        );
                      }
                      
                      // Update Metrics: Line from start to end with markers
                      const updateKey = `u-${update.version}`;
                      
                      // Stift-Modus hat Priorität - wenn aktiv, ignoriere Auge-Modus UND appliedUpdateId
                      let isActive = false;
                      
                      if (markerEditActive) {
                        // Stift-Modus: NUR das ausgewählte oder gehoverte (Single-Select)
                        // Im Stift-Modus wird appliedUpdateId IGNORIERT - nur aktuelle Auswahl zählt
                        const isEditHovered = editHoveredUpdateId === updateKey;
                        const isEditSelected = editSelectedUpdateId === updateKey;
                        isActive = isEditHovered || isEditSelected;
                      } else if (markerViewActive) {
                        // Auge-Modus: Multi-Select (nur wenn Stift NICHT aktiv)
                        const isLocked = lockedUpdateIds.has(updateKey);
                        const isHovered = hoveredUpdateId === updateKey;
                        isActive = isHovered || isLocked;
                      } else {
                        // Kein Modus aktiv: Zeige appliedUpdateId (wenn vorhanden)
                        const isApplied = appliedUpdateId === updateKey;
                        if (isApplied) isActive = true;
                      }
                      const strokeColor = isActive ? "rgb(8, 145, 178)" : "hsl(var(--muted-foreground))";
                      
                      // Click handler
                      const handleClick = () => {
                        // Stift-Modus hat PRIORITÄT - blockiert Auge-Modus
                        if (markerEditActive) {
                          setEditSelectedUpdateId(prev => prev === updateKey ? null : updateKey);
                          // WICHTIG: Hover zurücksetzen bei Klick, damit nur das angeklickte Element blau bleibt
                          setEditHoveredUpdateId(null);
                          return; // Blockiere Auge-Modus!
                        }
                        // Auge-Modus: Multi-Select Toggle (nur wenn Stift NICHT aktiv)
                        if (markerViewActive) {
                          setLockedUpdateIds(prev => {
                            const newSet = new Set(prev);
                            if (newSet.has(updateKey)) {
                              newSet.delete(updateKey);
                            } else {
                              newSet.add(updateKey);
                            }
                            return newSet;
                          });
                        }
                      };
                      
                      const handleMouseEnter = () => {
                        if (markerViewActive) setHoveredUpdateId(updateKey);
                        // Stift: NUR hovern wenn NICHTS ausgewählt ist (strikt)
                        if (markerEditActive && editSelectedUpdateId === null) {
                          setEditHoveredUpdateId(updateKey);
                        }
                      };
                      
                      const handleMouseLeave = () => {
                        setHoveredUpdateId(null);
                        // Stift: NUR Hover clearen wenn NICHTS ausgewählt ist
                        if (editSelectedUpdateId === null) {
                          setEditHoveredUpdateId(null);
                        }
                      };
                      
                      return (
                        <g 
                          key={`u-${i}`}
                          style={{ cursor: (markerViewActive || markerEditActive) ? 'pointer' : 'default', pointerEvents: 'all' }}
                          onMouseEnter={handleMouseEnter}
                          onMouseLeave={handleMouseLeave}
                          onClick={handleClick}
                        >
                          {/* Invisible wider hitbox for easier hover */}
                          <rect
                            x={`${clampedStartX}%`}
                            y={`${yPercent - 8}%`}
                            width={`${clampedEndX - clampedStartX}%`}
                            height="16%"
                            fill="transparent"
                            style={{ pointerEvents: 'all' }}
                          />
                          {/* Horizontal line */}
                          <line
                            x1={`${clampedStartX}%`}
                            y1={`${yPercent}%`}
                            x2={`${clampedEndX}%`}
                            y2={`${yPercent}%`}
                            stroke={strokeColor}
                            strokeWidth="2"
                            style={isActive ? { filter: 'drop-shadow(0 0 6px rgba(8, 145, 178, 0.8))' } : {}}
                          />
                          {/* Start marker (vertical tick) */}
                          <line
                            x1={`${clampedStartX}%`}
                            y1={`${yPercent - 4}%`}
                            x2={`${clampedStartX}%`}
                            y2={`${yPercent + 4}%`}
                            stroke={strokeColor}
                            strokeWidth="2"
                            style={isActive ? { filter: 'drop-shadow(0 0 6px rgba(8, 145, 178, 0.8))' } : {}}
                          />
                          {/* End marker (vertical tick) */}
                          <line
                            x1={`${clampedEndX}%`}
                            y1={`${yPercent - 4}%`}
                            x2={`${clampedEndX}%`}
                            y2={`${yPercent + 4}%`}
                            stroke={strokeColor}
                            strokeWidth="2"
                            style={isActive ? { filter: 'drop-shadow(0 0 6px rgba(8, 145, 178, 0.8))' } : {}}
                          />
                          {/* Dashed lines down to chart points when hovered */}
                          {isActive && (() => {
                            const chartDataArray = transformedChartData || [];
                            if (chartDataArray.length === 0) return null;
                            
                            // Get first active metric to determine Y value
                            const activeMetric = activeMetricCards[0];
                            if (!activeMetric) return null;
                            
                            // Helper: Find value at timestamp with interpolation
                            const getValueAtTs = (targetTs: number): number | null => {
                              // Sort by timestamp
                              const sorted = [...chartDataArray].sort((a, b) => a.timestamp - b.timestamp);
                              
                              // Find bracketing points
                              let before = null;
                              let after = null;
                              for (let i = 0; i < sorted.length; i++) {
                                if (sorted[i].timestamp <= targetTs) before = sorted[i];
                                if (sorted[i].timestamp >= targetTs && !after) after = sorted[i];
                              }
                              
                              // Exact match
                              if (before && before.timestamp === targetTs) {
                                return before[activeMetric as keyof typeof before] as number;
                              }
                              if (after && after.timestamp === targetTs) {
                                return after[activeMetric as keyof typeof after] as number;
                              }
                              
                              // Interpolate between before and after
                              if (before && after && before !== after) {
                                const beforeVal = before[activeMetric as keyof typeof before] as number;
                                const afterVal = after[activeMetric as keyof typeof after] as number;
                                const t = (targetTs - before.timestamp) / (after.timestamp - before.timestamp);
                                return beforeVal + t * (afterVal - beforeVal);
                              }
                              
                              // Clamp to edges
                              if (before) return before[activeMetric as keyof typeof before] as number;
                              if (after) return after[activeMetric as keyof typeof after] as number;
                              return null;
                            };
                            
                            const startValue = getValueAtTs(update.startTs);
                            const endValue = getValueAtTs(update.endTs);
                            
                            // Get Y domain - compute from data if 'auto'
                            let yMinNum: number, yMaxNum: number;
                            const [yMin, yMax] = yAxisDomain;
                            if (typeof yMin === 'number' && typeof yMax === 'number') {
                              yMinNum = yMin;
                              yMaxNum = yMax;
                            } else {
                              // Compute from chart data
                              const allVals = chartDataArray.map(p => p[activeMetric as keyof typeof p] as number).filter(v => typeof v === 'number');
                              yMinNum = Math.min(...allVals);
                              yMaxNum = Math.max(...allVals);
                            }
                            const yRange = yMaxNum - yMinNum;
                            
                            // Chart dimensions: 300px total, margin top=5, XAxis height=70
                            // Plot area = 300 - 5 - 70 = 225px
                            const markerHeight = 80;
                            const gapHeight = 16;
                            const chartTopMargin = 5;
                            const plotHeight = 225;
                            
                            const calcChartY = (value: number) => {
                              if (yRange === 0) return markerHeight + gapHeight + chartTopMargin + plotHeight / 2;
                              const relativeValue = (value - yMinNum) / yRange;
                              const chartY = chartTopMargin + (1 - relativeValue) * plotHeight;
                              return markerHeight + gapHeight + chartY;
                            };
                            
                            // Clamp Y2 to minimum 100% (never go above marker container bottom)
                            const startY2Raw = startValue !== null ? (calcChartY(startValue) / markerHeight) * 100 : 500;
                            const endY2Raw = endValue !== null ? (calcChartY(endValue) / markerHeight) * 100 : 500;
                            const startY2 = Math.max(100, startY2Raw);
                            const endY2 = Math.max(100, endY2Raw);
                            
                            return (
                              <>
                                <line
                                  x1={`${clampedStartX}%`}
                                  y1={`${yPercent + 4}%`}
                                  x2={`${clampedStartX}%`}
                                  y2={`${startY2}%`}
                                  stroke="rgb(8, 145, 178)"
                                  strokeWidth="1"
                                  strokeDasharray="4 3"
                                  style={{ filter: 'drop-shadow(0 0 4px rgba(8, 145, 178, 0.6))', pointerEvents: 'none' }}
                                />
                                <line
                                  x1={`${clampedEndX}%`}
                                  y1={`${yPercent + 4}%`}
                                  x2={`${clampedEndX}%`}
                                  y2={`${endY2}%`}
                                  stroke="rgb(8, 145, 178)"
                                  strokeWidth="1"
                                  strokeDasharray="4 3"
                                  style={{ filter: 'drop-shadow(0 0 4px rgba(8, 145, 178, 0.6))', pointerEvents: 'none' }}
                                />
                              </>
                            );
                          })()}
                          {/* Label */}
                          <text
                            x={`${(clampedStartX + clampedEndX) / 2}%`}
                            y={`${yPercent - 6}%`}
                            textAnchor="middle"
                            fontSize={9}
                            fill={strokeColor}
                            style={isActive ? { filter: 'drop-shadow(0 0 4px rgba(8, 145, 178, 0.8))' } : {}}
                          >
                            {label}
                          </text>
                        </g>
                      );
                    });
                  })()}
                </svg>
                </div>
              </div>
              
              {/* Chart Container with Zoom & Pan Events */}
              {/* Zeige "No Metrics Available" wenn keine Daten vorhanden */}
              {((isMultiSelectCompareMode && compareChartData.data.length === 0) ||
                (!isMultiSelectCompareMode && isMultiBotChartMode && multiBotChartData.data.length === 0) || 
                (!isMultiSelectCompareMode && !isMultiBotChartMode && transformedChartData.length === 0)) ? (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  <div className="text-center">
                    <p className="text-lg font-medium">No Metrics Available</p>
                    <p className="text-sm mt-1">Wähle einen anderen Zeitraum oder Bot-Type</p>
                  </div>
                </div>
              ) : (
              <div
                ref={chartContainerRef}
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
                  data={isMultiSelectCompareMode
                    ? (compareChartData.data.length > 0 ? compareChartData.data : [{ time: '-', timestamp: 0 }])
                    : isMultiBotChartMode 
                      ? (multiBotChartData.data.length > 0 ? multiBotChartData.data : [{ time: '-', timestamp: 0 }])
                      : (transformedChartData.length > 0 ? transformedChartData : [
                          { time: '-', timestamp: 0, 'Gesamtkapital': 0, 'Gesamtprofit': 0, 'Gesamtprofit %': 0, 'Ø Profit/Tag': 0, 'Real Profit/Tag': 0 },
                        ])
                  }
                  margin={{ top: 5, right: 30, left: 20, bottom: 20 }}
                  onMouseMove={handleLineChartMouseMove}
                  onMouseLeave={handleLineChartMouseLeave}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="timestamp"
                    type="number"
                    domain={xAxisDomain}
                    allowDataOverflow={true}
                    ticks={xAxisTicks.length > 0 ? xAxisTicks.filter(t => {
                      // Nur Ticks innerhalb der gezoomten Domain anzeigen
                      const [domainStart, domainEnd] = xAxisDomain;
                      if (typeof domainStart === 'number' && typeof domainEnd === 'number') {
                        return t >= domainStart && t <= domainEnd;
                      }
                      return true;
                    }) : undefined}
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
                      const baseSequence = appliedChartSettings?.sequence || 'days';
                      
                      // ANALYSIEREN-MODUS: Adaptive Time Axis mit dynamischer Zeitauflösung
                      // Formatierung basiert auf Zeitspanne, nicht auf sequence-Einstellung
                      if (analyzeModeBounds) {
                        const { startTs, endTs } = analyzeModeBounds;
                        const durationMs = endTs - startTs;
                        const durationHours = durationMs / (1000 * 60 * 60);
                        const durationDays = durationHours / 24;
                        
                        const currentTs = payload.value;
                        const isFirst = currentTs === startTs;
                        const isLast = currentTs === endTs;
                        const hour = date.getHours();
                        const isMidnight = hour === 0 && date.getMinutes() === 0;
                        
                        let label = '';
                        let isMajor = false;
                        
                        // Start und End immer mit Datum + Uhrzeit
                        if (isFirst || isLast) {
                          const dateStr = date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
                          const timeStr = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                          label = `${dateStr}\n${timeStr}`;
                          isMajor = true;
                        } else if (durationDays <= 7) {
                          // Bei ≤7 Tagen: Stunden-Format mit Datum bei Mitternacht
                          if (isMidnight) {
                            label = date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
                            isMajor = true;
                          } else {
                            label = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                          }
                        } else if (durationDays <= 60) {
                          // Bei 1-8 Wochen: Tages-Format
                          label = date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
                          isMajor = isMidnight;
                        } else {
                          // Bei > 2 Monaten: Wochen-Format
                          label = date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
                          isMajor = date.getDay() === 1; // Montag
                        }
                        
                        // Mehrzeiliges Label für Start/End
                        if (label.includes('\n')) {
                          const lines = label.split('\n');
                          return (
                            <g transform={`translate(${x},${y})`}>
                              <text
                                x={0}
                                y={12}
                                textAnchor="middle"
                                fill="hsl(var(--foreground))"
                                fontSize={10}
                                fontWeight={isMajor ? 600 : 400}
                              >
                                {lines[0]}
                              </text>
                              <text
                                x={0}
                                y={24}
                                textAnchor="middle"
                                fill="hsl(var(--muted-foreground))"
                                fontSize={9}
                              >
                                {lines[1]}
                              </text>
                            </g>
                          );
                        }
                        
                        return (
                          <g transform={`translate(${x},${y})`}>
                            <text
                              x={0}
                              y={12}
                              textAnchor="middle"
                              fill={isMajor ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))"}
                              fontSize={10}
                              fontWeight={isMajor ? 600 : 400}
                            >
                              {label}
                            </text>
                          </g>
                        );
                      }
                      
                      // NORMALER MODUS: ZOOM-basierte automatische Sequence-Anpassung
                      // Bei hohem Zoom automatisch detailliertere Labels zeigen
                      let effectiveSequence = baseSequence;
                      if (chartZoomX >= 6) {
                        // Sehr hoher Zoom: Immer Stunden anzeigen
                        effectiveSequence = 'hours';
                      } else if (chartZoomX >= 3 && baseSequence !== 'hours') {
                        // Mittlerer Zoom: Wenn auf Tage, zeige Stunden
                        effectiveSequence = 'hours';
                      }
                      
                      const sequence = effectiveSequence;
                      
                      // Helper: ISO Kalenderwoche berechnen
                      const getISOWeek = (d: Date): number => {
                        const dt = new Date(d.getTime());
                        dt.setHours(0, 0, 0, 0);
                        dt.setDate(dt.getDate() + 3 - (dt.getDay() + 6) % 7);
                        const week1 = new Date(dt.getFullYear(), 0, 4);
                        return 1 + Math.round(((dt.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
                      };
                      
                      // DYNAMISCHE Intervall-Berechnung basierend auf sichtbarem Zeitraum (mit Zoom)
                      // Nutze die aktuelle Domain statt die Gesamtdaten
                      const [domainStart, domainEnd] = xAxisDomain;
                      const visibleStartTime = typeof domainStart === 'number' ? domainStart : 0;
                      const visibleEndTime = typeof domainEnd === 'number' ? domainEnd : 0;
                      const visibleHours = (visibleEndTime - visibleStartTime) / (1000 * 60 * 60);
                      const visibleDays = visibleHours / 24;
                      
                      // Fallback auf Gesamtdaten wenn Domain nicht verfügbar
                      const timestamps = xAxisTicks.filter(t => t > 0);
                      const startTime = timestamps.length > 0 ? Math.min(...timestamps) : 0;
                      const endTime = timestamps.length > 0 ? Math.max(...timestamps) : 0;
                      const totalHours = visibleHours > 0 ? visibleHours : (endTime - startTime) / (1000 * 60 * 60);
                      const totalDays = visibleDays > 0 ? visibleDays : totalHours / 24;
                      const totalWeeks = totalDays / 7;
                      const totalMonths = totalDays / 30;
                      
                      let label = '';
                      let isMajor = false;  // Major = größere Einheit mit blauer Umrandung
                      let showLabel = false;
                      
                      // FESTE BOUNDARY-TICKS: Start und End IMMER anzeigen (normale Formatierung, nicht blau)
                      const currentTs = payload.value;
                      const isFirstTick = currentTs === startTime;
                      const isLastTick = currentTs === endTime;
                      
                      if (isFirstTick || isLastTick) {
                        label = date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
                        isMajor = false;  // Normale Formatierung ohne blaue Umrandung
                        showLabel = true;
                      } else if (sequence === 'hours') {
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
                    allowDataOverflow={true}
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1 }}
                    tickSize={8}
                    axisLine={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }}
                    tickCount={Math.min(15, Math.max(5, Math.floor(chartZoomY * 3)))}
                    tickFormatter={(value) => {
                      // Bei höherem Zoom mehr Dezimalstellen anzeigen
                      const decimals = chartZoomY >= 5 ? 4 : chartZoomY >= 3 ? 3 : 2;
                      return value.toLocaleString('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
                    }}
                  />
                  <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" strokeOpacity={0.5} />
                  <Tooltip 
                    active={tooltipIsNearPoint}
                    content={(props) => {
                      // Nur anzeigen wenn Maus nah genug am Datenpunkt (15px Radius)
                      if (!tooltipIsNearPoint || !props.active || !props.payload || props.payload.length === 0) {
                        return null;
                      }
                      
                      const dataPoint = props.payload[0]?.payload;
                      if (!dataPoint) return null;
                      
                      const date = new Date(dataPoint.timestamp);
                      const sequence = appliedChartSettings?.sequence || 'days';
                      
                      let dateLabel = '';
                      if (sequence === 'hours') {
                        dateLabel = date.toLocaleString('de-DE', { 
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        });
                      } else if (sequence === 'days') {
                        dateLabel = date.toLocaleString('de-DE', { 
                          weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        });
                      } else {
                        dateLabel = date.toLocaleString('de-DE', { 
                          day: '2-digit', month: '2-digit', year: 'numeric'
                        });
                      }
                      
                      // Prüfe ob dieser Punkt auch der Endpunkt eines vorherigen Updates ist (Vergleichs-Modus)
                      const hasPrevEndValues = dataPoint._prevEndValues && Object.keys(dataPoint._prevEndValues).length > 0;
                      
                      // Prüfe ob dieser Endpunkt AUCH der Startpunkt des nächsten Updates ist (Vergleichs-Modus)
                      const isAlsoStartOfNext = dataPoint._isAlsoStartOfNext === true && dataPoint._nextStartInfo;
                      
                      // Helper: Formatiere einen Metrik-Wert
                      const formatMetricValue = (name: string, value: number) => {
                        const suffix = name === 'Gesamtprofit %' ? '%' : ' USDT';
                        return typeof value === 'number' 
                          ? value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + suffix
                          : value;
                      };
                      
                      // Helper: Formatiere ein Datum als Label
                      const formatDateLabel = (timestamp: number) => {
                        const d = new Date(timestamp);
                        if (sequence === 'hours') {
                          return d.toLocaleString('de-DE', { 
                            day: '2-digit', month: '2-digit', year: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                          });
                        } else if (sequence === 'days') {
                          return d.toLocaleString('de-DE', { 
                            weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                          });
                        } else {
                          return d.toLocaleString('de-DE', { 
                            day: '2-digit', month: '2-digit', year: 'numeric'
                          });
                        }
                      };
                      
                      // Helper: Rendere eine Info-Box mit eigenem Datum und Start/End Markierung
                      const renderInfoBox = (marker: 'End' | 'Start', boxDateLabel: string, isFirstBox: boolean, values: { name: string; value: number; color: string }[], runtimeMs?: number) => (
                        <div 
                          style={{ 
                            backgroundColor: 'hsl(var(--popover))',
                            border: marker === 'End' ? '2px solid #ef4444' : '2px solid #22c55e',
                            borderRadius: '6px',
                            fontSize: '14px',
                            color: 'hsl(var(--foreground))',
                            padding: '8px 12px',
                            marginTop: isFirstBox ? 0 : '8px'
                          }}
                        >
                          <p style={{ fontWeight: 'bold', marginBottom: '4px' }}>{boxDateLabel}</p>
                          <p style={{ 
                            fontWeight: 'bold', 
                            marginBottom: '4px', 
                            fontSize: '11px', 
                            color: marker === 'End' ? '#ef4444' : '#22c55e',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>
                            {marker === 'End' ? 'End Runtime' : 'Start Time'}
                          </p>
                          {values.map((item, idx) => {
                            let displayName = item.name;
                            if (item.name === 'Gesamtkapital' && profitPercentBase === 'investitionsmenge') {
                              displayName = 'Investitionsmenge';
                            }
                            return (
                              <p key={idx} style={{ color: item.color, margin: '2px 0' }}>
                                {displayName}: {formatMetricValue(item.name, item.value)}
                              </p>
                            );
                          })}
                        </div>
                      );
                      
                      // Bei Endpunkt der AUCH Startpunkt des nächsten Vergleichs ist: Zwei Info-Boxen
                      if (isAlsoStartOfNext) {
                        // END Box: Werte direkt aus dataPoint holen
                        const endGesamtprofit = dataPoint['Gesamtprofit'];
                        const endGesamtkapital = dataPoint['Gesamtkapital'];
                        
                        // START Box: Werte aus _nextStartInfo (sind dieselben wie END, aber ohne Runtime)
                        const startInfo = dataPoint._nextStartInfo;
                        const startGesamtprofit = startInfo?.['Gesamtprofit'] ?? endGesamtprofit;
                        const startGesamtkapital = startInfo?.['Gesamtkapital'] ?? endGesamtkapital;
                        
                        // Runtime formatieren (nur für END Box)
                        const runtimeMs = dataPoint.runtimeMs || 0;
                        const formatRuntime = (ms: number) => {
                          if (!ms || ms <= 0) return null;
                          const totalHours = Math.floor(ms / (1000 * 60 * 60));
                          const days = Math.floor(totalHours / 24);
                          const hours = totalHours % 24;
                          const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
                          if (days > 0) return `${days}d ${hours}h ${minutes}m`;
                          if (hours > 0) return `${hours}h ${minutes}m`;
                          return `${minutes}m`;
                        };
                        const runtimeStr = formatRuntime(runtimeMs);
                        
                        // Label für Investitionsmenge/Gesamtkapital
                        const investLabel = profitPercentBase === 'investitionsmenge' ? 'Investitionsmenge' : 'Gesamtkapital';
                        
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {/* END RUNTIME Box (rot) */}
                            <div style={{ 
                              backgroundColor: 'hsl(var(--popover))',
                              border: '2px solid #ef4444',
                              borderRadius: '6px',
                              fontSize: '14px',
                              color: 'hsl(var(--foreground))',
                              padding: '8px 12px'
                            }}>
                              <p style={{ fontWeight: 'bold', marginBottom: '4px' }}>{dateLabel}</p>
                              <p style={{ color: '#16a34a', margin: '2px 0' }}>
                                Gesamtprofit: {endGesamtprofit.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
                              </p>
                              <p style={{ color: '#2563eb', margin: '2px 0' }}>
                                {investLabel}: {endGesamtkapital.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
                              </p>
                              {runtimeStr && (
                                <p style={{ color: 'hsl(var(--muted-foreground))', margin: '2px 0' }}>
                                  Runtime: {runtimeStr}
                                </p>
                              )}
                            </div>
                            {/* START TIME Box (grün) */}
                            <div style={{ 
                              backgroundColor: 'hsl(var(--popover))',
                              border: '2px solid #22c55e',
                              borderRadius: '6px',
                              fontSize: '14px',
                              color: 'hsl(var(--foreground))',
                              padding: '8px 12px'
                            }}>
                              <p style={{ fontWeight: 'bold', marginBottom: '4px' }}>{dateLabel}</p>
                              <p style={{ color: '#16a34a', margin: '2px 0' }}>
                                Gesamtprofit: {startGesamtprofit.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
                              </p>
                              <p style={{ color: '#2563eb', margin: '2px 0' }}>
                                {investLabel}: {startGesamtkapital.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
                              </p>
                              {/* KEINE Runtime bei START */}
                            </div>
                          </div>
                        );
                      }
                      
                      // Bei Vergleichs-Modus mit _prevEndValues: Zwei Info-Boxen
                      // ABER NUR bei STARTPUNKTEN - bei ENDPUNKTEN zeigen wir nur die Standard-Box
                      if (hasPrevEndValues && dataPoint.isStartPoint === true) {
                        // Sammle die Werte für vorheriges Ende und aktuellen Start
                        const prevEndBoxValues: { name: string; value: number; color: string }[] = [];
                        const currentStartBoxValues: { name: string; value: number; color: string }[] = [];
                        
                        props.payload.forEach((entry: any) => {
                          const name = entry.name;
                          const currentValue = entry.value;
                          
                          // Vorheriger Endpunkt-Wert
                          const prevValue = dataPoint._prevEndValues[name];
                          if (prevValue !== undefined) {
                            prevEndBoxValues.push({ name, value: prevValue, color: entry.color });
                          }
                          
                          // Aktueller Startpunkt-Wert
                          currentStartBoxValues.push({ name, value: currentValue, color: entry.color });
                        });
                        
                        // Berechne die Datum-Labels für beide Boxen
                        const prevEndDateLabel = dataPoint._prevEndValues.timestamp > 0 
                          ? formatDateLabel(dataPoint._prevEndValues.timestamp) 
                          : dateLabel;
                        const currentStartDateLabel = dateLabel;
                        
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {renderInfoBox('End', prevEndDateLabel, true, prevEndBoxValues)}
                            {renderInfoBox('Start', currentStartDateLabel, false, currentStartBoxValues)}
                          </div>
                        );
                      }
                      
                      // Standard: Eine Info-Box
                      // Helper: Hole den echten Wert (nicht offsetted) aus den _actual Feldern
                      const getActualValue = (metricName: string, displayValue: number): number => {
                        if (metricName === 'Gesamtprofit' && dataPoint._actualGesamtprofit !== undefined) {
                          return dataPoint._actualGesamtprofit;
                        }
                        if (metricName === 'Ø Profit/Tag' && dataPoint._actualAvgDaily !== undefined) {
                          return dataPoint._actualAvgDaily;
                        }
                        if (metricName === 'Real Profit/Tag' && dataPoint._actualRealDaily !== undefined) {
                          return dataPoint._actualRealDaily;
                        }
                        if (metricName === 'Gesamtkapital' && dataPoint._actualGesamtkapital !== undefined) {
                          return dataPoint._actualGesamtkapital;
                        }
                        if (metricName === 'Gesamtprofit %' && dataPoint._actualProfitPercent !== undefined) {
                          return dataPoint._actualProfitPercent;
                        }
                        // Fallback: Displaywert verwenden
                        return displayValue;
                      };
                      
                      return (
                        <div 
                          style={{ 
                            backgroundColor: 'hsl(var(--popover))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '6px',
                            fontSize: '14px',
                            color: 'hsl(var(--foreground))',
                            padding: '8px 12px'
                          }}
                        >
                          <p style={{ fontWeight: 'bold', marginBottom: '4px' }}>{dateLabel}</p>
                          {props.payload.map((entry: any, index: number) => {
                            const name = entry.name;
                            // Hole den echten Wert (nicht offsetted) für den Tooltip
                            const displayValue = getActualValue(name, entry.value);
                            
                            // Titel anpassen: Wenn Investitionsmenge ausgewählt, zeige "Investitionsmenge" statt "Gesamtkapital"
                            let displayName = name;
                            if (name === 'Gesamtkapital' && profitPercentBase === 'investitionsmenge') {
                              displayName = 'Investitionsmenge';
                            }
                            
                            const suffix = name === 'Gesamtprofit %' ? '%' : ' USDT';
                            const formattedValue = typeof displayValue === 'number' 
                              ? displayValue.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + suffix
                              : displayValue;
                            
                            return (
                              <p key={index} style={{ color: entry.color, margin: '2px 0' }}>
                                {displayName}: {formattedValue}
                              </p>
                            );
                          })}
                          {/* Runtime anzeigen - nur bei Endpunkten (nicht Startpunkten) */}
                          {dataPoint.isStartPoint === false && dataPoint.runtimeMs !== undefined && dataPoint.runtimeMs > 0 && (
                            <p style={{ color: 'hsl(var(--muted-foreground))', margin: '4px 0 0 0', fontSize: '12px' }}>
                              Runtime: {formatRuntimeFromMs(dataPoint.runtimeMs)}
                            </p>
                          )}
                        </div>
                      );
                    }}
                  />
                  {/* Dynamisch Lines rendern - Compare-Mode, Multi-Bot-Mode oder Single-Bot mit Metriken */}
                  {isMultiSelectCompareMode ? (
                    // COMPARE MODUS: Graue Linien für jeden ausgewählten Bot-Type
                    // Farben werden NICHT von Content Cards bestimmt!
                    compareChartData.botTypeNames.map((botTypeName, index) => (
                      <Line 
                        key={`compare-${botTypeName}`}
                        type="monotone" 
                        dataKey={botTypeName}
                        name={botTypeName}
                        stroke="#888888"
                        strokeWidth={2}
                        dot={{ fill: '#888888', r: 4, stroke: '#888888' }}
                        connectNulls
                        isAnimationActive={true}
                        animationDuration={1200}
                        animationBegin={0}
                        animationEasing="ease-out"
                      />
                    ))
                  ) : isMultiBotChartMode ? (
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
                        dot={(props: any) => {
                          const { cx, cy, payload } = props;
                          const color = metricColors[metricName] || '#888888';
                          const isClosedBot = payload?.status === 'Closed Bots';
                          
                          if (isClosedBot) {
                            // Closed Bots: Hohler Kreis (nur Rand, kein Fill)
                            return (
                              <circle
                                key={`dot-${payload?.timestamp}-${metricName}`}
                                cx={cx}
                                cy={cy}
                                r={5}
                                fill="hsl(var(--background))"
                                stroke={color}
                                strokeWidth={2}
                              />
                            );
                          }
                          
                          // Normale Punkte: Gefüllter Kreis
                          return (
                            <circle
                              key={`dot-${payload?.timestamp}-${metricName}`}
                              cx={cx}
                              cy={cy}
                              r={4}
                              fill={color}
                            />
                          );
                        }}
                        connectNulls
                        isAnimationActive={true}
                        animationDuration={1200}
                        animationBegin={0}
                        animationEasing="ease-out"
                      />
                    ))
                  )}
                  {/* Highest Value Marker - unter dem Punkt mit ↑H */}
                  {/* Dynamisch: Weicht Graphen und anderen Markern aus, minimal spacing */}
                  {showHighestValue && !isMultiBotChartMode && (() => {
                    // Sammle alle H-Marker
                    const markers = activeMetricCards
                      .map(m => ({ metric: m, data: extremeValues.highest[m], color: metricColors[m] || '#888' }))
                      .filter(m => m.data) as { metric: string; data: { timestamp: number; value: number }; color: string }[];
                    
                    // Berechne Y-Range für relative Abstände
                    const allY = transformedChartData.flatMap(p => 
                      activeMetricCards.map(m => p[m as keyof typeof p]).filter(v => typeof v === 'number') as number[]
                    );
                    const minY = Math.min(...allY);
                    const maxY = Math.max(...allY);
                    const yRange = maxY - minY || 1;
                    
                    // Minimaler Abstand (ca. 2 Rasterlinien = 3% des Y-Bereichs)
                    const minGap = yRange * 0.03;
                    
                    // Finde alle Y-Werte bei einem Timestamp (für Kollisionserkennung)
                    const getYValuesAt = (ts: number) => {
                      const point = transformedChartData.find(p => Math.abs(p.timestamp - ts) < 60000);
                      if (!point) return [];
                      return activeMetricCards
                        .map(m => point[m as keyof typeof point])
                        .filter(v => typeof v === 'number') as number[];
                    };
                    
                    // Berechne Offset für jeden Marker
                    const resolved = markers.map((marker, i) => {
                      const { timestamp, value } = marker.data;
                      let offset = 8; // Basis-Offset in Pixel
                      
                      // Prüfe ob Graph-Linien unter diesem Punkt sind
                      const yVals = getYValuesAt(timestamp);
                      const linesBelow = yVals.filter(y => y < value && (value - y) < minGap * 3);
                      
                      // Wenn Linien knapp darunter sind → flippe nach oben
                      const flipToTop = linesBelow.length > 0 || (value - minY) < minGap * 2;
                      
                      // Stapeln wenn mehrere H-Marker nah beieinander
                      const prevSameArea = markers.slice(0, i).filter(m => 
                        Math.abs(m.data.timestamp - timestamp) < 3600000 &&
                        Math.abs(m.data.value - value) < minGap * 4
                      ).length;
                      offset += prevSameArea * 12;
                      
                      return { ...marker, offset, flipToTop };
                    });
                    
                    return resolved.map(m => (
                      <ReferenceDot
                        key={`highest-${m.metric}`}
                        x={m.data.timestamp}
                        y={m.data.value}
                        r={0}
                        label={{
                          value: '↑H',
                          position: m.flipToTop ? 'top' : 'bottom',
                          fill: m.color,
                          fontSize: 12,
                          fontWeight: 'bold',
                          offset: m.offset,
                        }}
                      />
                    ));
                  })()}
                  {/* Lowest Value Marker - über dem Punkt mit ↓L */}
                  {/* Dynamisch: Weicht Graphen und anderen Markern aus, minimal spacing */}
                  {showLowestValue && !isMultiBotChartMode && (() => {
                    // Sammle alle L-Marker
                    const markers = activeMetricCards
                      .map(m => ({ metric: m, data: extremeValues.lowest[m], color: metricColors[m] || '#888' }))
                      .filter(m => m.data) as { metric: string; data: { timestamp: number; value: number }; color: string }[];
                    
                    // Berechne Y-Range
                    const allY = transformedChartData.flatMap(p => 
                      activeMetricCards.map(m => p[m as keyof typeof p]).filter(v => typeof v === 'number') as number[]
                    );
                    const yRange = (Math.max(...allY) - Math.min(...allY)) || 1;
                    const minGap = yRange * 0.03;
                    
                    // Finde alle Y-Werte bei einem Timestamp
                    const getYValuesAt = (ts: number) => {
                      const point = transformedChartData.find(p => Math.abs(p.timestamp - ts) < 60000);
                      if (!point) return [];
                      return activeMetricCards
                        .map(m => point[m as keyof typeof point])
                        .filter(v => typeof v === 'number') as number[];
                    };
                    
                    // Berechne Offset für jeden Marker
                    const resolved = markers.map((marker, i) => {
                      const { timestamp, value } = marker.data;
                      let offset = 8;
                      
                      // Prüfe ob Graph-Linien über diesem Punkt sind
                      const yVals = getYValuesAt(timestamp);
                      const linesAbove = yVals.filter(y => y > value && (y - value) < minGap * 3);
                      
                      // Mehr Offset wenn Linien knapp darüber
                      offset += linesAbove.length * 10;
                      
                      // Stapeln wenn mehrere L-Marker nah beieinander
                      const prevSameArea = markers.slice(0, i).filter(m => 
                        Math.abs(m.data.timestamp - timestamp) < 3600000 &&
                        Math.abs(m.data.value - value) < minGap * 4
                      ).length;
                      offset += prevSameArea * 12;
                      
                      return { ...marker, offset };
                    });
                    
                    return resolved.map(m => (
                      <ReferenceDot
                        key={`lowest-${m.metric}`}
                        x={m.data.timestamp}
                        y={m.data.value}
                        r={0}
                        label={{
                          value: '↓L',
                          position: 'top',
                          fill: m.color,
                          fontSize: 12,
                          fontWeight: 'bold',
                          offset: m.offset,
                        }}
                      />
                    ));
                  })()}
                </LineChart>
              </ResponsiveContainer>
              </div>
              )}
            </Card>
          </div>
          
          {/* Right Column - Two Cards stacked, stretches to match left column height */}
          <div className="flex flex-col flex-shrink-0">
            {/* Upper Card - Selected Metric Preview (fills space above Graph-Einstellungen) */}
            <Card className="p-4 w-[296px] mb-4 flex-1 flex flex-col ring-2 ring-cyan-600 shadow-[0_0_15px_rgba(8,145,178,0.6)]">
              {/* Inner Content Card - Update/Closed Bot Details */}
              <Card className="p-3 mb-3" data-testid="card-selected-metric">
                {(() => {
                  // Stift-Modus: Finde das aktive Update
                  // Priorität: Selected > Hovered (nur wenn Stift aktiv) > Applied (dauerhaft)
                  const activeEditId = editSelectedUpdateId || (markerEditActive ? editHoveredUpdateId : null) || appliedUpdateId;
                  
                  if (!activeEditId) {
                    // Default-Anzeige wenn kein Update ausgewählt
                    return (
                      <>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-muted-foreground">Kein Update ausgewählt</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6" title="Vorschau" data-testid="button-preview-metric">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">Gesamt Profit</span>
                          <span className="text-sm font-medium text-muted-foreground">--</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Laufzeit</span>
                          <span className="text-xs text-muted-foreground">--</span>
                        </div>
                      </>
                    );
                  }
                  
                  // Parse Update ID (u-X oder c-X)
                  const isClosedBot = activeEditId.startsWith('c-');
                  const version = parseInt(activeEditId.split('-')[1], 10);
                  
                  // Finde das Update in den Daten
                  const allUpdates = selectedBotTypeData?.id 
                    ? (allBotTypeUpdates || []).filter((u: BotTypeUpdate) => u.botTypeId === selectedBotTypeData.id)
                    : [];
                  
                  const update = allUpdates.find((u: BotTypeUpdate) => 
                    u.version === version && 
                    (isClosedBot ? u.status === 'Closed Bots' : u.status === 'Update Metrics')
                  );
                  
                  if (!update) {
                    return (
                      <>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-muted-foreground">Update nicht gefunden</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6" title="Vorschau" data-testid="button-preview-metric">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">Gesamt Profit</span>
                          <span className="text-sm font-medium text-muted-foreground">--</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Laufzeit</span>
                          <span className="text-xs text-muted-foreground">--</span>
                        </div>
                      </>
                    );
                  }
                  
                  // Berechne Daten für das Update
                  const title = isClosedBot ? `Closed Bot #${version}` : `Update #${version}`;
                  
                  // Gesamt Profit: Bei Closed Bots = profit, bei Update Metrics = overallGridProfitUsdt
                  const profitValue = isClosedBot 
                    ? parseFloat(update.profit || '0') 
                    : parseFloat(update.overallGridProfitUsdt || '0');
                  const profitText = `${profitValue >= 0 ? '+' : ''}$${profitValue.toFixed(2)}`;
                  const profitColor = profitValue >= 0 ? 'text-green-600' : 'text-red-600';
                  
                  // Laufzeit: From (lastUpload) bis Until (thisUpload)
                  // Format: "6.12.2025 21:27" -> "06.12.2025"
                  const formatLaufzeit = (dateStr: string | null | undefined): string => {
                    if (!dateStr) return '';
                    // Parse "6.12.2025 21:27" format
                    const parts = dateStr.split(' ')[0]; // Get date part only
                    if (!parts) return '';
                    const [day, month, year] = parts.split('.');
                    if (!day || !month || !year) return dateStr;
                    return `${day.padStart(2, '0')}.${month.padStart(2, '0')}.${year}`;
                  };
                  const fromDate = formatLaufzeit(update.lastUpload);
                  const untilDate = formatLaufzeit(update.thisUpload);
                  const laufzeitText = fromDate && untilDate 
                    ? `${fromDate} - ${untilDate}`
                    : untilDate 
                      ? untilDate
                      : fromDate 
                        ? fromDate
                        : '--';
                  
                  return (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold">{title}</span>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6" 
                          title="Vorschau"
                          disabled={!appliedUpdateId}
                          onClick={async () => {
                            if (appliedUpdateId && update) {
                              setAppliedUpdateDetails(update);
                              setMetricDetailDialogOpen(true);
                            }
                          }}
                          data-testid="button-preview-metric"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">Gesamt Profit</span>
                        <span className={`text-sm font-medium ${profitColor}`}>{profitText}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Laufzeit</span>
                        <span className="text-xs">{laufzeitText}</span>
                      </div>
                    </>
                  );
                })()}
              </Card>
              
              {/* Separator */}
              <div className="border-t my-2" />
              
              {/* Action Icons Row - Outside inner card */}
              <div className="flex items-center justify-between" data-testid="metric-action-icons">
                <div className="flex items-center gap-2">
                  <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-8 w-8" 
                        title="Suchen"
                        disabled={!markerEditActive || analyzeMode}
                        onClick={() => setSearchDialogOpen(true)}
                        data-testid="button-search-metric"
                      >
                        <Search className="h-4 w-4" />
                      </Button>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className={cn(
                      "h-8 w-8",
                      analyzeMode && "ring-2 ring-cyan-600 shadow-[0_0_10px_rgba(8,145,178,0.6)]"
                    )}
                    title="Analysieren"
                    disabled={!appliedUpdateId}
                    onClick={() => setAnalyzeMode(!analyzeMode)}
                    data-testid="button-analyze-metric"
                  >
                    <LineChartIcon className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="h-8 w-8" 
                    title="Löschen"
                    disabled={!appliedUpdateId || analyzeMode}
                    onClick={() => {
                      // Angewandtes Update entfernen
                      setAppliedUpdateId(null);
                    }}
                    data-testid="button-delete-metric"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <Button 
                  variant="default" 
                  size="sm"
                  disabled={!markerEditActive || !editSelectedUpdateId || analyzeMode}
                  onClick={() => {
                    if (editSelectedUpdateId) {
                      // Auswahl übernehmen: Als "angewandt" speichern
                      setAppliedUpdateId(editSelectedUpdateId);
                      // Stift-Modus deaktivieren
                      setMarkerEditActive(false);
                      // Hover-State clearen
                      setEditHoveredUpdateId(null);
                      // Selected clearen (wird jetzt von appliedUpdateId gehalten)
                      setEditSelectedUpdateId(null);
                    }
                  }}
                  data-testid="button-apply-metric"
                >
                  Apply
                </Button>
              </div>
            </Card>
            
            {/* Settings Container - Graph-Einstellungen (Golden State - 300px height, aligned with chart) */}
            <div className="flex ring-2 ring-cyan-600 shadow-[0_0_15px_rgba(8,145,178,0.6)] rounded-lg" style={{ height: '300px' }}>
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
              <div className={cn("flex items-center justify-between", (updateSelectionMode === 'confirmed' || analyzeMode) && "opacity-50")}>
                <span className="text-sm">Letzten</span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-2"
                  disabled={updateSelectionMode === 'confirmed' || analyzeMode}
                  onClick={() => updateSelectionMode !== 'confirmed' && !analyzeMode && setTimeRangeOpen(true)}
                >
                  {selectedTimeRange}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </div>
              
              {/* Time Range Dialog - Center of Screen */}
              <Dialog open={timeRangeOpen} onOpenChange={(open) => {
                setTimeRangeOpen(open);
                if (!open) {
                  setCustomTimeOpen(false);
                  setCalendarOpen(false);
                }
              }}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <div className="flex items-center gap-2">
                      {customTimeOpen && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => {
                            setCustomTimeOpen(false);
                            setCalendarOpen(false);
                          }}
                        >
                          <ArrowLeft className="h-4 w-4" />
                        </Button>
                      )}
                      <DialogTitle>{customTimeOpen ? 'Custom Zeitraum' : 'Zeitraum auswählen'}</DialogTitle>
                    </div>
                  </DialogHeader>
                  
                  {/* Time Options View */}
                  {!customTimeOpen && (
                    <div className="space-y-2">
                      {['1h', '24h', '7 Days', '30 Days'].map((option) => (
                        <Button
                          key={option}
                          variant={selectedTimeRange === option ? "default" : "outline"}
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => {
                            handleTimeRangeSelect(option);
                            setTimeRangeOpen(false);
                          }}
                        >
                          {option}
                        </Button>
                      ))}
                      <Separator className="my-2" />
                      <Button
                        variant={selectedTimeRange === 'First-Last Update' ? "default" : "outline"}
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => {
                          handleTimeRangeSelect('First-Last Update');
                          setTimeRangeOpen(false);
                        }}
                      >
                        First-Last Update
                      </Button>
                      <Separator className="my-2" />
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => {
                          setSelectedTimeRange('Custom');
                          setCustomTimeOpen(true);
                        }}
                      >
                        Custom
                      </Button>
                    </div>
                  )}
                  
                  {/* Custom View */}
                  {customTimeOpen && (
                    <div className="space-y-4">
                      {/* Input Fields */}
                      {!calendarOpen && (
                        <>
                          <div className="flex items-center justify-center gap-3">
                            <div className="flex flex-col items-center">
                              <Input
                                type="number"
                                placeholder="0"
                                value={customDays}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/[^0-9]/g, '');
                                  setCustomDays(val);
                                  if (val) setDateRange({ from: undefined, to: undefined });
                                }}
                                className="h-10 w-16 text-center no-spinner"
                                min="0"
                                data-testid="input-custom-days"
                              />
                              <span className="text-xs text-muted-foreground mt-1">Tage</span>
                            </div>
                            
                            <div className="flex flex-col items-center">
                              <Input
                                type="number"
                                placeholder="0"
                                value={customHours}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/[^0-9]/g, '');
                                  setCustomHours(val);
                                  if (val) setDateRange({ from: undefined, to: undefined });
                                }}
                                className="h-10 w-16 text-center no-spinner"
                                min="0"
                                data-testid="input-custom-hours"
                              />
                              <span className="text-xs text-muted-foreground mt-1">Stunden</span>
                            </div>
                            
                            <div className="flex flex-col items-center">
                              <Input
                                type="number"
                                placeholder="0"
                                value={customMinutes}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/[^0-9]/g, '');
                                  setCustomMinutes(val);
                                  if (val) setDateRange({ from: undefined, to: undefined });
                                }}
                                className="h-10 w-16 text-center no-spinner"
                                min="0"
                                data-testid="input-custom-minutes"
                              />
                              <span className="text-xs text-muted-foreground mt-1">Minuten</span>
                            </div>
                          </div>
                          
                          <div className="flex justify-center">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-2"
                              onClick={() => {
                                setCalendarOpen(true);
                                setCustomDays('');
                                setCustomHours('');
                                setCustomMinutes('');
                              }}
                              data-testid="button-calendar"
                            >
                              <CalendarIcon className="h-4 w-4" />
                              Kalender öffnen
                            </Button>
                          </div>
                          
                          <Button
                            className="w-full"
                            onClick={() => {
                              handleApplyCustomTime();
                              setTimeRangeOpen(false);
                              setCustomTimeOpen(false);
                            }}
                          >
                            Apply
                          </Button>
                        </>
                      )}
                      
                      {/* Calendar View */}
                      {calendarOpen && (
                        <div className="space-y-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-2"
                            onClick={() => setCalendarOpen(false)}
                          >
                            <ArrowLeft className="h-4 w-4" />
                            Zurück zu Eingabe
                          </Button>
                          <Calendar
                            mode="range"
                            selected={dateRange as any}
                            onSelect={handleDateSelect as any}
                            numberOfMonths={1}
                            className="rounded-md border mx-auto"
                          />
                          <Button
                            className="w-full"
                            onClick={() => {
                              handleApplyCustomTime();
                              setTimeRangeOpen(false);
                              setCustomTimeOpen(false);
                              setCalendarOpen(false);
                            }}
                          >
                            Apply
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </DialogContent>
              </Dialog>
              
              <Separator />
              <div className="space-y-3">
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
              <div className="flex items-end justify-between">
                <div className="flex flex-col">
                  <span className="text-sm">Anzahl Metriks</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-medium bg-muted px-2 py-1 rounded" data-testid="text-update-count">
                      {displayedUpdatesCount.total}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({displayedUpdatesCount.updateMetrics} Update, {displayedUpdatesCount.closedBots} Closed)
                    </span>
                  </div>
                </div>
                <Button 
                  size="sm"
                  onClick={handleApplySettings}
                  data-testid="button-apply-settings"
                >
                  Apply
                </Button>
              </div>
                </div>
              </Card>
            )}
          </div>
          </div>
        </div>

        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <h2 className="text-xl font-bold">
              Alle Einträge
            </h2>
            <div className="flex items-center bg-muted rounded-lg p-1 ring-2 ring-cyan-600 shadow-[0_0_15px_rgba(8,145,178,0.6)]" data-testid="toggle-alle-eintraege-mode">
              <button
                onClick={() => setAlleEintraegeMode('compare')}
                className={cn(
                  "px-3 py-1 text-sm font-medium rounded-md transition-colors",
                  alleEintraegeMode === 'compare' 
                    ? "bg-background text-foreground shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                )}
                data-testid="button-mode-compare"
              >
                Compare
              </button>
              <button
                onClick={() => setAlleEintraegeMode('added')}
                className={cn(
                  "px-3 py-1 text-sm font-medium rounded-md transition-colors",
                  alleEintraegeMode === 'added' 
                    ? "bg-background text-foreground shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                )}
                data-testid="button-mode-added"
              >
                Added
              </button>
            </div>
          </div>
          <BotEntryTable 
            botTypeData={botTypeTableData} 
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={handleSort}
            onRemoveBotType={handleRemoveBotType}
            selectedChartBotTypes={selectedChartBotTypes}
            onToggleChartBotType={(botTypeId) => {
              // UI-Toggle (blau/grau) + Suche oben setzen
              setSelectedChartBotTypes(prev => {
                const newSelection = prev.includes(botTypeId)
                  ? prev.filter(id => id !== botTypeId)
                  : [...prev, botTypeId];
                
                // Wenn genau EINER ausgewählt → Bot-Type Name anzeigen
                if (newSelection.length === 1) {
                  const selectedId = newSelection[0];
                  const botType = availableBotTypes.find(bt => String(bt.id) === String(selectedId));
                  if (botType) {
                    setSelectedBotName(botType.name);
                  }
                }
                // Wenn 2+ ausgewählt → "Custom" anzeigen
                else if (newSelection.length >= 2) {
                  setSelectedBotName("Custom");
                }
                
                return newSelection;
              });
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

        {/* Search Metric Dialog - Popup in center of screen */}
        <Dialog open={searchDialogOpen} onOpenChange={setSearchDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Search className="w-5 h-5" />
                Metrik auswählen
              </DialogTitle>
            </DialogHeader>
            {(() => {
              const visibleUpdates = sortedUpdates || [];
              const needsScroll = visibleUpdates.length > 3;
              
              if (visibleUpdates.length === 0) {
                return <p className="text-sm text-muted-foreground py-4 text-center">Keine Metriken verfügbar</p>;
              }
              
              return (
                <div 
                  className={cn(
                    "space-y-3 p-1",
                    needsScroll && "max-h-[320px] overflow-y-auto pr-2"
                  )}
                >
                  {visibleUpdates.map((update: any) => {
                    const isClosedBot = update.status === 'Closed Bots';
                    const key = isClosedBot ? `c-${update.version}` : `u-${update.version}`;
                    const title = isClosedBot ? `Closed Bot #${update.version}` : `Update #${update.version}`;
                    const isSelected = editSelectedUpdateId === key;
                    
                    // Gesamt Profit berechnen
                    const profitValue = isClosedBot 
                      ? parseFloat(update.profit || '0') 
                      : parseFloat(update.overallGridProfitUsdt || '0');
                    const profitText = `${profitValue >= 0 ? '+' : ''}$${profitValue.toFixed(2)}`;
                    const profitColor = profitValue >= 0 ? 'text-green-600' : 'text-red-600';
                    
                    // Laufzeit berechnen
                    const formatLaufzeit = (dateStr: string | null | undefined): string => {
                      if (!dateStr) return '';
                      const parts = dateStr.split(' ')[0];
                      if (!parts) return '';
                      const [day, month, year] = parts.split('.');
                      if (!day || !month || !year) return dateStr;
                      return `${day.padStart(2, '0')}.${month.padStart(2, '0')}.${year}`;
                    };
                    const fromDate = formatLaufzeit(update.lastUpload);
                    const untilDate = formatLaufzeit(update.thisUpload);
                    const laufzeitText = fromDate && untilDate 
                      ? `${fromDate} - ${untilDate}`
                      : untilDate || fromDate || '--';
                    
                    return (
                      <Card 
                        key={key}
                        className={cn(
                          "p-3 cursor-pointer transition-all hover-elevate",
                          isSelected && "ring-2 ring-cyan-600 bg-cyan-50 dark:bg-cyan-950"
                        )}
                        onClick={() => {
                          setEditSelectedUpdateId(key);
                          setSearchDialogOpen(false);
                        }}
                        data-testid={`search-result-${key}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold">{title}</span>
                        </div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">Gesamt Profit</span>
                          <span className={cn("text-sm font-medium", profitColor)}>{profitText}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Laufzeit</span>
                          <span className="text-xs">{laufzeitText}</span>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>

        {/* Metric Detail Dialog - Shows full update/closed bot details */}
        <Dialog open={metricDetailDialogOpen} onOpenChange={setMetricDetailDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Eye className="w-5 h-5 text-primary" />
                {appliedUpdateDetails?.status} #{appliedUpdateDetails?.version}
              </DialogTitle>
            </DialogHeader>

            {appliedUpdateDetails && (
              <div className="space-y-4">
                {/* 1. Info Section */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Info</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground mb-1">Datum und Uhrzeit</p>
                      <p className="font-medium">{appliedUpdateDetails.date || '-'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Bot-Richtung</p>
                      <p className="font-medium">{appliedUpdateDetails.botDirection || '-'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Hebel</p>
                      <p className="font-medium">{appliedUpdateDetails.leverage || '-'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Anzahl</p>
                      <p className="font-medium">{appliedUpdateDetails.screenshotCount || '-'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Berechnungsmodus</p>
                      <p className="font-medium">{appliedUpdateDetails.calculationMode || 'Normal'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Längste Laufzeit</p>
                      <p className="font-medium">{appliedUpdateDetails.longestRuntime || '-'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Durchschnittliche Laufzeit</p>
                      <p className="font-medium">{appliedUpdateDetails.avgRuntime || '-'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">
                        {appliedUpdateDetails.status === 'Closed Bots' ? 'Laufzeit' : 'Upload Laufzeit'}
                      </p>
                      <p className="font-medium">{appliedUpdateDetails.uploadRuntime || '-'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">
                        {appliedUpdateDetails.status === 'Closed Bots' ? 'Start Date' : 'From'}
                      </p>
                      <p className="font-medium">{appliedUpdateDetails.lastUpload || '-'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">
                        {appliedUpdateDetails.status === 'Closed Bots' ? 'End Date' : 'Until'}
                      </p>
                      <p className="font-medium">{appliedUpdateDetails.thisUpload || '-'}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* 2. Investment Section */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Investment</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground mb-1">Investitionsmenge (USDT)</p>
                      <p className="font-medium">{appliedUpdateDetails.investment || '0.00'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Extra Margin</p>
                      <p className="font-medium">{appliedUpdateDetails.extraMargin || '0.00'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Gesamtinvestment</p>
                      <p className="font-medium">{appliedUpdateDetails.totalInvestment || '0.00'}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* 3. Gesamter Profit / P&L Section */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Gesamter Profit / P&L</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground mb-1">Gesamtprofit (USDT)</p>
                      <p className={`font-medium ${parseFloat(appliedUpdateDetails.profit || '0') >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {parseFloat(appliedUpdateDetails.profit || '0') >= 0 ? '+' : ''}{parseFloat(appliedUpdateDetails.profit || '0').toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Gesamtprofit (%) - Gesamtinvestment</p>
                      <p className="font-medium">{appliedUpdateDetails.profitPercent_gesamtinvestment || '-'}%</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Gesamtprofit (%) - Investitionsmenge</p>
                      <p className="font-medium">{appliedUpdateDetails.profitPercent_investitionsmenge || '-'}%</p>
                    </div>
                  </CardContent>
                </Card>

                {/* 4. Trend P&L Section */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Trend P&L</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground mb-1">Trend P&L (USDT)</p>
                      <p className="font-medium">{appliedUpdateDetails.overallTrendPnlUsdt || '-'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Trend P&L (%) - Gesamtinvestment</p>
                      <p className="font-medium">{appliedUpdateDetails.overallTrendPnlPercent_gesamtinvestment || '-'}%</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Trend P&L (%) - Investitionsmenge</p>
                      <p className="font-medium">{appliedUpdateDetails.overallTrendPnlPercent_investitionsmenge || '-'}%</p>
                    </div>
                  </CardContent>
                </Card>

                {/* 5. Grid Trading Section - Complete with all sub-sections */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Grid Trading</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Gesamter Grid Profit */}
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground mb-1">Gesamter Grid Profit (USDT)</p>
                        <p className={`font-medium ${parseFloat(appliedUpdateDetails.overallGridProfitUsdt || '0') >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {parseFloat(appliedUpdateDetails.overallGridProfitUsdt || '0') >= 0 ? '+' : ''}{parseFloat(appliedUpdateDetails.overallGridProfitUsdt || '0').toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Gesamter Grid Profit (%) - Gesamtinvestment</p>
                        <p className="font-medium">{appliedUpdateDetails.overallGridProfitPercent_gesamtinvestment || '-'}%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Gesamter Grid Profit (%) - Investitionsmenge</p>
                        <p className="font-medium">{appliedUpdateDetails.overallGridProfitPercent_investitionsmenge || '-'}%</p>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    {/* Ø Grid Profit */}
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground mb-1">Ø Grid Profit (USDT)</p>
                        <p className="font-medium">{appliedUpdateDetails.highestGridProfit || '-'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Ø Grid Profit (%) - Gesamtinvestment</p>
                        <p className="font-medium">{appliedUpdateDetails.highestGridProfitPercent_gesamtinvestment || '-'}%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Ø Grid Profit (%) - Investitionsmenge</p>
                        <p className="font-medium">{appliedUpdateDetails.highestGridProfitPercent_investitionsmenge || '-'}%</p>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    {/* Ø Grid Profit / Zeit */}
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground mb-1">Ø Grid Profit / Stunde</p>
                        <p className="font-medium">{appliedUpdateDetails.avgGridProfitHour || '-'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Ø Grid Profit / Tag</p>
                        <p className="font-medium">{appliedUpdateDetails.avgGridProfitDay || '-'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Ø Grid Profit / Woche</p>
                        <p className="font-medium">{appliedUpdateDetails.avgGridProfitWeek || '-'}</p>
                      </div>
                    </div>
                    
                    {/* Last Grid Profit Durchschnitt (Zeit) */}
                    <Separator />
                    <p className="text-sm font-semibold text-muted-foreground">Last Grid Profit Durchschnitt (Zeit)</p>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground mb-1">Stunde</p>
                        <p className="font-medium">{appliedUpdateDetails.lastAvgGridProfitHour || '-'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Tag</p>
                        <p className="font-medium">{appliedUpdateDetails.lastAvgGridProfitDay || '-'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Woche</p>
                        <p className="font-medium">{appliedUpdateDetails.lastAvgGridProfitWeek || '-'}</p>
                      </div>
                    </div>
                    
                    {/* Change (Differenz zum vorherigen Upload) */}
                    <Separator />
                    <p className="text-sm font-semibold text-muted-foreground">Change (Differenz zum vorherigen Upload)</p>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground mb-1">Stunde ($)</p>
                        <p className="font-medium">{appliedUpdateDetails.changeHourDollar || '-'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Tag ($)</p>
                        <p className="font-medium">{appliedUpdateDetails.changeDayDollar || '-'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Woche ($)</p>
                        <p className="font-medium">{appliedUpdateDetails.changeWeekDollar || '-'}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground mb-1">Stunde (%)</p>
                        <p className="font-medium">{appliedUpdateDetails.changeHourPercent ? `${appliedUpdateDetails.changeHourPercent}%` : '-'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Tag (%)</p>
                        <p className="font-medium">{appliedUpdateDetails.changeDayPercent ? `${appliedUpdateDetails.changeDayPercent}%` : '-'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Woche (%)</p>
                        <p className="font-medium">{appliedUpdateDetails.changeWeekPercent ? `${appliedUpdateDetails.changeWeekPercent}%` : '-'}</p>
                      </div>
                    </div>
                    
                    {/* Last Upload (Ø Grid Profit) und Change */}
                    <Separator />
                    <p className="text-sm font-semibold text-muted-foreground">Last Upload (Ø Grid Profit) und Change</p>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground mb-1">Last Upload (Ø Grid Profit)</p>
                        <p className="font-medium">{appliedUpdateDetails.lastAvgGridProfitUsdt || '-'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Change ($)</p>
                        <p className="font-medium">{appliedUpdateDetails.avgGridProfitChangeDollar || '-'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Change (%)</p>
                        <p className="font-medium">{appliedUpdateDetails.avgGridProfitChangePercent ? `${appliedUpdateDetails.avgGridProfitChangePercent}%` : '-'}</p>
                      </div>
                    </div>
                    
                    {/* Notizen Section */}
                    {appliedUpdateDetails.notes && (
                      <>
                        <Separator />
                        <div className="text-sm">
                          <p className="text-muted-foreground mb-2 font-medium">Notizen</p>
                          <div className="whitespace-pre-wrap bg-muted/30 p-3 rounded-md">
                            {appliedUpdateDetails.notes}
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Erstellt am */}
                <div className="text-xs text-muted-foreground text-center">
                  Erstellt am: {appliedUpdateDetails.createdAt ? new Date(appliedUpdateDetails.createdAt as Date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
