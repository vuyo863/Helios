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
import { Badge } from "@/components/ui/badge";
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

// Helper function to parse German date format (d.M.yyyy HH:mm:ss or dd.MM.yyyy HH:mm)
// WICHTIG: Erlaubt 1-2 Ziffern für Tag und Monat (z.B. "6.12.2025" oder "26.11.2025")
function parseGermanDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  
  // Format: "6.12.2025 21:27" or "24.11.2025 16:42:12" or "08.12.2025 12:42"
  // \d{1,2} erlaubt 1 oder 2 Ziffern für Tag und Monat
  const match = dateStr.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?/);
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
  const [addedModeView, setAddedModeView] = useState<'analysis' | 'overlay'>('analysis');
  const [hoveredBotTypeId, setHoveredBotTypeId] = useState<string | null>(null);
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
  // Snapshot der activeMetricCards VOR dem Analyze-Modus
  // Wird beim Verlassen des Analyze-Modus wiederhergestellt
  const [preAnalyzeActiveMetricCards, setPreAnalyzeActiveMetricCards] = useState<string[] | null>(null);
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
  
  // Compare Mode Eye Blink: Wenn auf Eye-Icon einer Content Card geklickt wird
  // Blinkt die Verbindungslinie 3x langsam (NUR im Compare Mode, NICHT im Analyze Mode)
  const [compareCardEyeBlinking, setCompareCardEyeBlinking] = useState<string | null>(null); // cardId die blinkt
  const [compareBlinkKey, setCompareBlinkKey] = useState(0); // Key um Animation neu zu triggern
  const [blinkingUpdateKey, setBlinkingUpdateKey] = useState<string | null>(null); // Der spezifische updateKey der blinkt
  
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
  const [mouseDownPos, setMouseDownPos] = useState<{ x: number; y: number } | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  // Threshold für Drag vs Click - unter diesem Wert ist es ein Click
  const DRAG_THRESHOLD = 5;
  
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
    // Speichere Startposition, aber setze isDragging noch NICHT auf true
    // isDragging wird erst bei Bewegung über Threshold gesetzt
    setMouseDownPos({ x: e.clientX, y: e.clientY });
    setDragStartY(e.clientY);
    setDragStartX(e.clientX);
    setDragStartPanY(chartPanY);
    setDragStartPanX(chartPanX);
  };
  
  const handleChartMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    // Prüfe ob Maus gedrückt ist
    if (!mouseDownPos) return;
    
    // Berechne Bewegung seit MouseDown
    const deltaY = e.clientY - mouseDownPos.y;
    const deltaX = e.clientX - mouseDownPos.x;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    // Erst ab Threshold ist es ein Drag (nicht nur Click)
    if (distance > DRAG_THRESHOLD) {
      setIsDragging(true);
      // Pan: Mausbewegung in Y/X-Offset umrechnen
      const panDeltaY = e.clientY - dragStartY;
      const panDeltaX = e.clientX - dragStartX;
      const sensitivityY = 2 / chartZoomY;
      const sensitivityX = 2 / chartZoomX;
      setChartPanY(dragStartPanY + panDeltaY * sensitivityY);
      setChartPanX(dragStartPanX + panDeltaX * sensitivityX);
    }
  };
  
  const handleChartMouseUp = () => {
    setIsDragging(false);
    setMouseDownPos(null);
  };
  
  const handleChartMouseLeave = () => {
    setIsDragging(false);
    setMouseDownPos(null);
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
          
          // COMPARE/ADDED MODUS: Suche in allBotTypeUpdates für alle ausgewählten Bot-Types
          // Identifiziere den Bot-Type aus dem Tooltip-Namen
          let updatesToSearch: typeof sortedUpdates = [];
          let hoveredBotTypeName: string | null = null;
          
          if ((isMultiSelectCompareMode || isMultiBotChartMode) && selectedChartBotTypes.length >= 2) {
            // Finde welcher Bot-Type im Tooltip angezeigt wird (der nächste Punkt)
            // activePayload enthält Einträge für alle Linien - finde den mit einem Wert
            for (const entry of state.activePayload) {
              if (entry.value !== null && entry.value !== undefined && entry.name) {
                hoveredBotTypeName = entry.name;
                break;
              }
            }
            
            // Sammle alle Updates von ausgewählten Bot-Types
            selectedChartBotTypes.forEach(botTypeId => {
              const updates = allBotTypeUpdates.filter(u => u.botTypeId === botTypeId);
              updatesToSearch.push(...updates);
            });
          } else {
            // Normaler Modus: Nur sortedUpdates
            updatesToSearch = sortedUpdates || [];
          }
          
          // Find matching update by checking if this timestamp matches start or end
          // In Compare/Added mode: Auch den Bot-Type matchen wenn möglich
          const matchingUpdate = updatesToSearch.find(u => {
            const endTs = u.thisUpload ? parseGermanDate(u.thisUpload)?.getTime() : null;
            const startTs = u.lastUpload ? parseGermanDate(u.lastUpload)?.getTime() : null;
            const timestampMatches = (endTs && Math.abs(endTs - hoveredTs) < 60000) || 
                                     (startTs && Math.abs(startTs - hoveredTs) < 60000);
            
            // In Compare/Added mode: Optional Bot-Type prüfen
            // Im Added-Mode: "Gesamt" ist der Name im Tooltip - matche erstes Update am Timestamp
            if ((isMultiSelectCompareMode || isMultiBotChartMode) && timestampMatches) {
              // Im Added-Mode: "Gesamt" = aggregierte Linie
              // Da nur EINE Linie existiert, nehmen wir den ersten Match
              // (find() gibt sowieso nur den ersten zurück)
              if (isMultiBotChartMode && hoveredBotTypeName === 'Gesamt') {
                return timestampMatches; // Erstes Update am Timestamp
              }
              // Compare-Mode: Bot-Type explizit matchen
              if (isMultiSelectCompareMode && hoveredBotTypeName) {
                const botType = availableBotTypes.find(bt => bt.id === u.botTypeId);
                return botType?.name === hoveredBotTypeName;
              }
            }
            
            return timestampMatches;
          });
          
          if (matchingUpdate) {
            // COMPARE/ADDED MODUS: Key enthält botTypeId als Prefix
            // Format: "${botTypeId}:c-${version}" oder "${botTypeId}:u-${version}"
            const keyPrefix = (isMultiSelectCompareMode || isMultiBotChartMode) && matchingUpdate.botTypeId 
              ? `${matchingUpdate.botTypeId}:` 
              : '';
            
            // Bestimme den Modus-Namen für Logging
            const modeLabel = isMultiSelectCompareMode ? 'COMPARE' : (isMultiBotChartMode ? 'ADDED' : 'NORMAL');
            
            if (matchingUpdate.status === 'Closed Bots') {
              const newKey = `${keyPrefix}c-${matchingUpdate.version}`;
              fetch('/api/log-hover', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  event: 'Closed Bot activated',
                  key: newKey,
                  botTypeName: hoveredBotTypeName,
                  timestamp: hoveredTs,
                  mode: modeLabel,
                  direction: 'Chart → Marker'
                })
              }).catch(() => {});
              setHoveredUpdateId(newKey);
            } else if (matchingUpdate.status === 'Update Metrics') {
              const newKey = `${keyPrefix}u-${matchingUpdate.version}`;
              fetch('/api/log-hover', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  event: 'Update Metrics activated',
                  key: newKey,
                  botTypeName: hoveredBotTypeName,
                  timestamp: hoveredTs,
                  mode: modeLabel,
                  direction: 'Chart → Marker'
                })
              }).catch(() => {});
              setHoveredUpdateId(newKey);
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
  // WICHTIG: Verwende effectiveSelectedBotTypeData für Analyze Single Metric Mode
  // Aber effectiveSelectedBotTypeData ist noch nicht definiert an dieser Stelle!
  // Deshalb: Prüfe auch analyzeSingleMetricInfo falls vorhanden
  const effectiveBotTypeIdForQuery = useMemo(() => {
    // Wenn Analyze Single Metric Mode aktiv, verwende die extrahierte Bot-Type-ID
    if (analyzeMode && appliedUpdateId?.includes(':')) {
      const colonIndex = appliedUpdateId.indexOf(':');
      return appliedUpdateId.substring(0, colonIndex);
    }
    return selectedBotTypeData?.id || null;
  }, [analyzeMode, appliedUpdateId, selectedBotTypeData?.id]);
  
  const { data: selectedBotTypeUpdates = [] } = useQuery<any[]>({
    queryKey: ['/api/bot-types', effectiveBotTypeIdForQuery || 'none', 'updates'],
    enabled: !!effectiveBotTypeIdForQuery,
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

  // Sortierte Updates für From/Until Dialoge: ALLE Updates von allen ausgewählten Bot-Types
  // Im Compare/Added-Modus zeigt der Dialog Updates aller ausgewählten Bot-Types
  const sortedUpdatesForDialogs = useMemo(() => {
    // Bestimme welche Bot-Type IDs wir zeigen sollen
    let idsToShow: string[] = [];
    
    if (selectedChartBotTypes.length >= 2) {
      // Compare/Added Modus: Alle ausgewählten Bot-Types
      idsToShow = selectedChartBotTypes.map(id => String(id));
    } else if (selectedChartBotTypes.length === 1) {
      // Ein einzelner Bot-Type aus der Auswahl
      idsToShow = [String(selectedChartBotTypes[0])];
    } else if (selectedBotTypeData?.id) {
      // MainChart Modus: Nur der aktuell ausgewählte Bot-Type
      idsToShow = [String(selectedBotTypeData.id)];
    }
    
    let updatesToShow: any[] = [];
    
    if (idsToShow.length > 0 && allBotTypeUpdates.length > 0) {
      // Filtere Updates basierend auf den ausgewählten Bot-Type IDs
      updatesToShow = allBotTypeUpdates.filter(update => 
        idsToShow.includes(String(update.botTypeId))
      );
    } else if (selectedBotTypeUpdates.length > 0) {
      // Fallback: Verwende die einzelne Query
      updatesToShow = selectedBotTypeUpdates;
    }
    
    if (!updatesToShow.length) return [];
    
    // Sortieren nach gewähltem Kriterium
    return [...updatesToShow].sort((a, b) => {
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
  }, [selectedChartBotTypes, allBotTypeUpdates, selectedBotTypeUpdates, selectedBotTypeData?.id, updateSortBy, updateSortDirection]);

  // Gefilterte Updates für Until-Dialog: Nur Updates die NACH dem From-Update-Datum liegen
  const filteredUpdatesForUntil = useMemo(() => {
    if (!selectedFromUpdate) return sortedUpdatesForDialogs;
    
    const fromTimestamp = getUpdateTimestamp(selectedFromUpdate);
    if (fromTimestamp === 0) return sortedUpdatesForDialogs;
    
    // Nur Updates mit späterem Datum als das From-Update anzeigen
    return sortedUpdatesForDialogs.filter(update => {
      const updateTimestamp = getUpdateTimestamp(update);
      return updateTimestamp > fromTimestamp;
    });
  }, [sortedUpdatesForDialogs, selectedFromUpdate]);

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
  // COMPARE-MODUS und ADDED-MODUS: Zählt Updates aller ausgewählten Bot-Types
  const displayedUpdatesCount = useMemo(() => {
    // COMPARE-MODUS inline berechnet (alleEintraegeMode === 'compare' && 2+ Bot-Types)
    // WICHTIG: Nicht im Analyze Single Metric Mode (analyzeMode + appliedUpdateId enthält ":")
    const isAnalyzeSingleMetricModeInline = analyzeMode && appliedUpdateId && appliedUpdateId.includes(':');
    const isCompareMode = alleEintraegeMode === 'compare' && selectedChartBotTypes.length >= 2 && !isAnalyzeSingleMetricModeInline;
    
    // ADDED-MODUS: alleEintraegeMode === 'added' && 2+ Bot-Types
    const isAddedMode = alleEintraegeMode === 'added' && selectedChartBotTypes.length >= 2;
    
    // ADDED-MODUS: Verwende Updates aller ausgewählten Bot-Types
    if (isAddedMode && allBotTypeUpdates.length > 0) {
      const selectedIds = selectedChartBotTypes.map(id => String(id));
      let filteredUpdates = allBotTypeUpdates.filter(update => 
        selectedIds.includes(String(update.botTypeId))
      );
      
      // Zeitfilter anwenden - Custom-Kalender hat Priorität
      if (selectedTimeRange === 'Custom' && dateRange.from && dateRange.to) {
        // Kalender-Custom: Filtere nach Datumsbereich
        const fromTs = dateRange.from.getTime();
        const toDate = new Date(dateRange.to);
        toDate.setHours(23, 59, 59, 999);
        const toTs = toDate.getTime();
        
        filteredUpdates = filteredUpdates.filter(update => {
          const updateTimestamp = getUpdateTimestamp(update);
          return updateTimestamp >= fromTs && updateTimestamp <= toTs;
        });
      } else if (selectedTimeRange !== 'First-Last Update') {
        const rangeMs = parseTimeRangeToMs(
          selectedTimeRange,
          customDays,
          customHours,
          customMinutes
        );
        
        if (rangeMs !== null && rangeMs > 0) {
          const now = Date.now();
          const cutoffTimestamp = now - rangeMs;
          
          filteredUpdates = filteredUpdates.filter(update => {
            const updateTimestamp = getUpdateTimestamp(update);
            return updateTimestamp >= cutoffTimestamp;
          });
        }
      }
      
      const updateMetrics = filteredUpdates.filter(u => u.status === 'Update Metrics').length;
      const closedBots = filteredUpdates.filter(u => u.status === 'Closed Bots').length;
      
      return { total: filteredUpdates.length, updateMetrics, closedBots };
    }
    
    // COMPARE-MODUS: Verwende Updates aller ausgewählten Bot-Types
    if (isCompareMode && allBotTypeUpdates.length > 0) {
      const selectedIds = selectedChartBotTypes.map(id => String(id));
      let filteredUpdates = allBotTypeUpdates.filter(update => 
        selectedIds.includes(String(update.botTypeId))
      );
      
      // Zeitfilter anwenden - Custom-Kalender hat Priorität
      if (selectedTimeRange === 'Custom' && dateRange.from && dateRange.to) {
        // Kalender-Custom: Filtere nach Datumsbereich
        const fromTs = dateRange.from.getTime();
        const toDate = new Date(dateRange.to);
        toDate.setHours(23, 59, 59, 999);
        const toTs = toDate.getTime();
        
        filteredUpdates = filteredUpdates.filter(update => {
          const updateTimestamp = getUpdateTimestamp(update);
          return updateTimestamp >= fromTs && updateTimestamp <= toTs;
        });
      } else if (selectedTimeRange !== 'First-Last Update') {
        const rangeMs = parseTimeRangeToMs(
          selectedTimeRange,
          customDays,
          customHours,
          customMinutes
        );
        
        if (rangeMs !== null && rangeMs > 0) {
          const now = Date.now();
          const cutoffTimestamp = now - rangeMs;
          
          filteredUpdates = filteredUpdates.filter(update => {
            const updateTimestamp = getUpdateTimestamp(update);
            return updateTimestamp >= cutoffTimestamp;
          });
        }
      }
      
      const updateMetrics = filteredUpdates.filter(u => u.status === 'Update Metrics').length;
      const closedBots = filteredUpdates.filter(u => u.status === 'Closed Bots').length;
      
      return { total: filteredUpdates.length, updateMetrics, closedBots };
    }
    
    // NORMAL-MODUS: Verwende sortedUpdates (einzelner Bot-Type)
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
    else if (selectedTimeRange === 'Custom' && dateRange.from && dateRange.to) {
      // Kalender-Custom: Filtere nach Datumsbereich
      const fromTs = dateRange.from.getTime();
      const toDate = new Date(dateRange.to);
      toDate.setHours(23, 59, 59, 999);
      const toTs = toDate.getTime();
      
      filteredUpdates = sortedUpdates.filter(update => {
        const updateTimestamp = getUpdateTimestamp(update);
        return updateTimestamp >= fromTs && updateTimestamp <= toTs;
      });
    } else if (selectedTimeRange !== 'First-Last Update') {
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
  }, [sortedUpdates, selectedFromUpdate, selectedUntilUpdate, selectedTimeRange, customDays, customHours, customMinutes, alleEintraegeMode, allBotTypeUpdates, selectedChartBotTypes, analyzeMode, appliedUpdateId, dateRange]);

  // Farben für die verschiedenen Metriken (passend zu den Card-Farben)
  const metricColors: Record<string, string> = {
    'Gesamtkapital': '#2563eb',      // Blau
    'Gesamtprofit': '#16a34a',       // Grün
    'Gesamtprofit %': '#9333ea',     // Lila
    'Ø Profit/Tag': '#ea580c',       // Orange
    'Real Profit/Tag': '#ca8a04',    // Gelb/Gold
  };
  
  // SAFE KEY MAPPING: Konvertiert Metrik-Namen in sichere dataKey-Schlüssel für Recharts
  // Recharts interpretiert Leerzeichen und % als Pfad-Delimiter, daher brauchen wir sichere Schlüssel
  const metricToSafeKey: Record<string, string> = {
    'Gesamtkapital': 'metric_gesamtkapital',
    'Gesamtprofit': 'metric_gesamtprofit',
    'Gesamtprofit %': 'metric_gesamtprofitPercent',
    'Ø Profit/Tag': 'metric_avgProfitDay',
    'Real Profit/Tag': 'metric_realProfitDay',
  };
  
  // Alle Metrik-Namen als Array (für Iteration)
  const ALL_METRICS = ['Gesamtkapital', 'Gesamtprofit', 'Gesamtprofit %', 'Ø Profit/Tag', 'Real Profit/Tag'];

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
  
  // Compare-Modus Farben: ROT und BLAU immer zuerst, dann weitere Farben
  const COMPARE_MODE_COLORS = [
    '#dc2626', // Rot - immer erste Linie
    '#2563eb', // Blau - immer zweite Linie
    '#16a34a', // Grün
    '#ea580c', // Orange
    '#ca8a04', // Gelb/Gold
    '#9333ea', // Lila
    '#0891b2', // Cyan
    '#7c3aed', // Violett
    '#059669', // Emerald
    '#d946ef', // Fuchsia
    '#f97316', // Orange-hell
    '#14b8a6', // Teal
  ];

  // Hole Farbe für Bot-Type basierend auf Index
  const getBotTypeColor = (index: number): string => {
    return BOT_TYPE_COLORS[index % BOT_TYPE_COLORS.length];
  };
  
  // Hole Farbe für Compare-Modus: Rot/Blau zuerst, dann weitere
  const getCompareColor = (index: number): string => {
    return COMPARE_MODE_COLORS[index % COMPARE_MODE_COLORS.length];
  };
  
  // Farb-Map für Compare-Modus: BotTypeId -> Farbe (basierend auf Auswahl-Reihenfolge)
  const compareColorMap = useMemo(() => {
    const colorMap: Record<string, string> = {};
    selectedChartBotTypes.forEach((botTypeId, index) => {
      colorMap[botTypeId] = getCompareColor(index);
    });
    return colorMap;
  }, [selectedChartBotTypes]);

  // Added-Modus: 2+ Bot-Types ausgewählt + Toggle auf "Added"
  // Zeigt eine Gesamtlinie mit additiver Summierung aller aktiven Bot-Werte
  const isMultiBotChartMode = alleEintraegeMode === 'added' && selectedChartBotTypes.length >= 2;

  // Compare/Added Modus: 2+ Bot-Types ausgewählt
  // Bei 2+ werden From/Until deaktiviert, Content Cards zeigen "--"
  const isMultiSelectCompareModeBase = alleEintraegeMode === 'compare' && selectedChartBotTypes.length >= 2;

  // AUSNAHME-ZUSTAND: Analyze Mode in Compare Mode
  // Wenn analyzeMode aktiv und appliedUpdateId ein Compare-Format hat ({botTypeId}:u-X)
  // Dann wird Compare Mode "pausiert" und wir arbeiten wie im Normal Mode mit einer einzelnen Metrik
  const analyzeSingleMetricInfo = useMemo(() => {
    if (!analyzeMode || !appliedUpdateId || !appliedUpdateId.includes(':')) {
      return null;
    }
    
    // Parse Compare-Format: "{botTypeId}:u-X" oder "{botTypeId}:c-X"
    const colonIndex = appliedUpdateId.indexOf(':');
    const botTypeId = appliedUpdateId.substring(0, colonIndex);
    const updatePart = appliedUpdateId.substring(colonIndex + 1);
    const isClosedBot = updatePart.startsWith('c-');
    const version = parseInt(updatePart.split('-')[1], 10);
    
    // Finde den Bot-Type Namen
    const botType = availableBotTypes.find(bt => String(bt.id) === botTypeId);
    const botTypeName = botType?.name || 'Unknown';
    
    return { 
      botTypeId, 
      updatePart, 
      isClosedBot, 
      version,
      botTypeName,
      originalKey: appliedUpdateId
    };
  }, [analyzeMode, appliedUpdateId, availableBotTypes]);

  // Wenn Analyze Single Metric aktiv: Compare Mode wird DEAKTIVIERT
  // Das ermöglicht normale Chart-Darstellung und Content Card Funktionalität
  const isAnalyzeSingleMetricMode = analyzeSingleMetricInfo !== null;
  const isMultiSelectCompareMode = isMultiSelectCompareModeBase && !isAnalyzeSingleMetricMode;

  // EFFEKTIVER Bot-Type für Chart-Daten:
  // - Normal Mode: selectedBotTypeData (basiert auf selectedBotName)
  // - Analyze Single Metric Mode: Bot-Type aus der ausgewählten Metrik
  const effectiveSelectedBotTypeData = useMemo(() => {
    if (isAnalyzeSingleMetricMode && analyzeSingleMetricInfo) {
      // Finde den Bot-Type basierend auf der extrahierten ID
      const botType = availableBotTypes.find(bt => String(bt.id) === analyzeSingleMetricInfo.botTypeId);
      return botType || null;
    }
    return selectedBotTypeData;
  }, [isAnalyzeSingleMetricMode, analyzeSingleMetricInfo, availableBotTypes, selectedBotTypeData]);

  // Bei 2+ Bot-Types: Graph-Einstellungen auf Default setzen
  // UND: activeMetricCards auf nur EINE Metrik zurücksetzen (Compare Mode erlaubt nur 1)
  useEffect(() => {
    if (isMultiSelectCompareMode) {
      setSelectedTimeRange('First-Last Update');
      setShowHighestValue(false);
      setShowLowestValue(false);
      setChartSequence('days');
      setSelectedFromUpdate(null);
      setSelectedUntilUpdate(null);
      
      // WICHTIG: Wenn mehr als 1 Metrik-Card aktiv, auf nur die erste zurücksetzen
      // Dies fixt den Bug: Analyze Mode erlaubt Multi-Select, Compare Mode nur Single-Select
      setActiveMetricCards(prev => {
        if (prev.length > 1) {
          return [prev[0]]; // Nur die erste Metrik behalten
        }
        return prev;
      });
    }
  }, [isMultiSelectCompareMode]);

  // Added Modus: "Gesamt" wenn ALLE aktiven Bot-Types ausgewählt, sonst "Custom"
  // Compare Modus: immer "Custom" bei 2+ Selection
  useEffect(() => {
    if (selectedChartBotTypes.length >= 2) {
      if (alleEintraegeMode === 'added') {
        const activeBotTypes = availableBotTypes.filter(bt => bt.isActive);
        const allActiveSelected = activeBotTypes.length > 0 && 
          activeBotTypes.every(bt => selectedChartBotTypes.includes(String(bt.id)));
        setSelectedBotName(allActiveSelected ? "Gesamt" : "Custom");
      } else {
        // Compare Modus: immer "Custom"
        setSelectedBotName("Custom");
      }
    }
  }, [alleEintraegeMode, selectedChartBotTypes, availableBotTypes]);

  // ========== COMPARE MODUS - SEPARATE SECTION ==========
  // Diese Logik ist komplett unabhängig von den Graph-Einstellungen (Golden State)
  // Linien werden GRAU angezeigt (nicht von Content Cards bestimmt)
  
  // Compare-Modus: Chart-Daten für alle ausgewählten Bot-Types
  // WICHTIG: Gleiche Logik wie chartData - ZWEI Punkte pro Update (Start + Ende)
  // Findet automatisch das früheste und späteste Datum aller Bot-Types
  const compareChartData = useMemo(() => {
    // WICHTIG: Auch im Analyze-Mode müssen wir Daten berechnen
    // isMultiSelectCompareMode ist false im Analyze-Mode, aber wir brauchen die Daten trotzdem
    if ((!isMultiSelectCompareMode && !isAnalyzeSingleMetricMode) || allBotTypeUpdates.length === 0) {
      return { data: [], botTypeNames: [] as string[], minTimestamp: 0, maxTimestamp: 0 };
    }

    // Im Analyze-Modus: Verwende den Bot-Type des analysierten Updates
    // Auch wenn er nicht in selectedChartBotTypes ist (z.B. bei Closed Bots)
    let selectedIds = selectedChartBotTypes.map(id => String(id));
    if (isAnalyzeSingleMetricMode && analyzeSingleMetricInfo) {
      const analyzeBotTypeId = analyzeSingleMetricInfo.botTypeId;
      if (!selectedIds.includes(analyzeBotTypeId)) {
        selectedIds = [...selectedIds, analyzeBotTypeId];
      }
    }
    
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
      return { data: [], botTypeNames, minTimestamp: 0, maxTimestamp: 0 };
    }
    
    // ========== ZEITFILTER AUS GRAPH-EINSTELLUNGEN ==========
    // Wende dieselben Zeitfilter an wie im Normal-Modus (wenn appliedChartSettings vorhanden)
    if (appliedChartSettings && appliedChartSettings.timeRange !== 'First-Last Update') {
      // Priorität 1: Custom mit Kalender-Auswahl
      if (appliedChartSettings.timeRange === 'Custom' && appliedChartSettings.customFromDate && appliedChartSettings.customToDate) {
        const fromTs = appliedChartSettings.customFromDate.getTime();
        const toDate = new Date(appliedChartSettings.customToDate);
        toDate.setHours(23, 59, 59, 999);
        const untilTs = toDate.getTime();
        
        relevantUpdates = relevantUpdates.filter(update => {
          const ts = getUpdateTimestamp(update);
          return ts >= fromTs && ts <= untilTs;
        });
      }
      // Priorität 2: "Letzten"-Zeitraum Filter (1h, 24h, 7 Days, 30 Days, Custom mit D/H/M)
      else {
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
            const ts = getUpdateTimestamp(update);
            return ts >= cutoffTimestamp;
          });
        }
      }
    }
    
    if (relevantUpdates.length === 0) {
      return { data: [], botTypeNames, minTimestamp: 0, maxTimestamp: 0 };
    }
    // ========== ENDE ZEITFILTER ==========

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
    // WICHTIG: Identische Logik wie MainChart (Golden State) für Start-Punkt Erstellung
    selectedBotTypesInfo.forEach(botType => {
      const updates = updatesByBotType[botType.name] || [];
      
      // Speichere vorherigen End-Timestamp für Überlappungs-Prüfung
      let prevEndTimestamp = 0;
      
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
        
        // Berechne den Wert basierend auf ausgewählter Metrik (activeMetricCards[0])
        // Im Compare Mode ist nur EINE Metrik aktiv
        const selectedMetric = activeMetricCards.length > 0 ? activeMetricCards[0] : 'Gesamtprofit';
        
        let metricValue = 0;
        const investment = parseFloat(update.totalInvestment || update.investment || '0') || 0;
        const baseInvestment = parseFloat(update.investment || '0') || 0;
        const relevantInvestment = profitPercentBase === 'gesamtinvestment' ? investment : baseInvestment;
        
        // Helper: Berechne Wert für eine spezifische Metrik
        const calculateMetricValue = (metric: string): number => {
          if (update.status === 'Closed Bots') {
            const profit = parseFloat(update.profit || '0') || 0;
            switch (metric) {
              case 'Gesamtkapital':
                return relevantInvestment;
              case 'Gesamtprofit':
                return profit;
              case 'Gesamtprofit %':
                return relevantInvestment > 0 ? (profit / relevantInvestment) * 100 : 0;
              case 'Ø Profit/Tag':
                return parseFloat(update.avgGridProfitDay || '0') || 0;
              case 'Real Profit/Tag':
                const runtimeStr = update.avgRuntime || '';
                const runtimeHours = parseRuntimeToHours(runtimeStr);
                return runtimeHours < 24 ? profit : parseFloat(update.avgGridProfitDay || '0') || 0;
              default:
                return profit;
            }
          } else {
            const gridProfit = parseFloat(update.overallGridProfitUsdt || '0') || 0;
            switch (metric) {
              case 'Gesamtkapital':
                return relevantInvestment;
              case 'Gesamtprofit':
                return gridProfit;
              case 'Gesamtprofit %':
                return relevantInvestment > 0 ? (gridProfit / relevantInvestment) * 100 : 0;
              case 'Ø Profit/Tag':
                return parseFloat(update.avgGridProfitDay || '0') || 0;
              case 'Real Profit/Tag':
                const runtimeStr = update.avgRuntime || '';
                const runtimeHours = parseRuntimeToHours(runtimeStr);
                return runtimeHours < 24 ? gridProfit : parseFloat(update.avgGridProfitDay || '0') || 0;
              default:
                return gridProfit;
            }
          }
        };
        
        // Berechne den primären Metrik-Wert
        metricValue = calculateMetricValue(selectedMetric);
        
        // ANALYZE MODE: Berechne ALLE Metrik-Werte für Multi-Metrik-Unterstützung
        const allMetricValues: Record<string, number> = {};
        if (isAnalyzeSingleMetricMode) {
          const allMetrics = ['Gesamtkapital', 'Gesamtprofit', 'Gesamtprofit %', 'Ø Profit/Tag', 'Real Profit/Tag'];
          allMetrics.forEach(metric => {
            allMetricValues[metric] = calculateMetricValue(metric);
          });
        }
        
        // Fallback für alte Variable
        const profitValue = metricValue;
        
        // === IDENTISCHE LOGIK WIE MAINCHART FÜR START-PUNKT ===
        // Prüfe ob Vergleichs-Modus (wie in MainChart chartData)
        const hasAbsoluteFields = update.overallGridProfitUsdtAbsolute !== null && update.overallGridProfitUsdtAbsolute !== undefined;
        let isVergleichsModus = false;
        
        if (hasAbsoluteFields) {
          const absoluteValue = parseFloat(update.overallGridProfitUsdtAbsolute || '0') || 0;
          isVergleichsModus = Math.abs(profitValue - absoluteValue) > 0.01;
        } else {
          isVergleichsModus = update.calculationMode === 'Normal';
        }
        
        // Start-Punkt überspringen wenn:
        // 1. Closed Bots - nur End-Punkt
        // 2. Vergleichs-Modus und NICHT erstes Update - Linie läuft flüssig weiter
        // 3. Start überlappt mit vorherigem End (innerhalb 1 Minute)
        const isClosedBots = update.status === 'Closed Bots';
        const hasPreviousEndPoint = prevEndTimestamp !== 0;
        const isFirstUpdate = !hasPreviousEndPoint;
        const startOverlapsPrevEnd = hasPreviousEndPoint && Math.abs(startTimestamp - prevEndTimestamp) < 60000;
        const skipStartPoint = isClosedBots || (isVergleichsModus && !isFirstUpdate) || startOverlapsPrevEnd;
        
        // Erstelle Start-Punkt NUR wenn nicht übersprungen werden soll
        if (update.lastUpload && startTimestamp !== endTimestamp && !skipStartPoint) {
          const startPoint: Record<string, any> = {
            time: new Date(startTimestamp).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
            timestamp: startTimestamp,
            isStartPoint: true,
            botTypeName: botType.name,
          };
          // Initialisiere alle Bot-Types mit null
          selectedBotTypesInfo.forEach(bt => {
            startPoint[bt.name] = null;
            startPoint[`${bt.name}_status`] = null;
          });
          // Start-Punkt IMMER mit 0 (wie MainChart) - nicht mit previousEndValue!
          startPoint[botType.name] = 0;
          startPoint[`${botType.name}_status`] = update.status;
          
          // ANALYZE MODE: Füge alle Metrik-Werte mit 0 als Startpunkt hinzu (sichere Schlüssel)
          // WICHTIG: Wenn Gesamtkapital aktiv ist, Startpunkt = Gesamtkapital (nicht 0)
          if (isAnalyzeSingleMetricMode) {
            const gesamtkapitalActive = activeMetricCards.includes('Gesamtkapital');
            const gesamtkapitalValue = gesamtkapitalActive ? relevantInvestment : 0;
            
            ALL_METRICS.forEach(metric => {
              const safeKey = metricToSafeKey[metric];
              if (safeKey) {
                // Wenn Gesamtkapital aktiv ist, andere Metriken starten bei Gesamtkapital
                if (gesamtkapitalActive && metric !== 'Gesamtkapital' && metric !== 'Gesamtprofit %') {
                  startPoint[safeKey] = gesamtkapitalValue;
                } else if (metric === 'Gesamtkapital') {
                  // Gesamtkapital selbst startet bei seinem eigenen Wert
                  startPoint[safeKey] = gesamtkapitalActive ? gesamtkapitalValue : 0;
                } else {
                  startPoint[safeKey] = 0;
                }
              }
            });
          }
          
          dataPoints.push(startPoint);
        }
        
        // Berechne Runtime in Millisekunden (End - Start)
        // Bei Closed Bots: keine Runtime (nur ein Punkt mit End Date)
        const runtimeMs = isClosedBots ? undefined : endTimestamp - startTimestamp;
        
        // Berechne Gesamtprofit und Gesamtkapital für den Tooltip
        const gridProfit = update.status === 'Closed Bots' 
          ? parseFloat(update.profit || '0') || 0
          : parseFloat(update.overallGridProfitUsdt || '0') || 0;
        const gesamtkapital = parseFloat(update.totalInvestment || update.investment || '0') || 0;
        
        // Erstelle End-Punkt (immer)
        const endPoint: Record<string, any> = {
          time: new Date(endTimestamp).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
          timestamp: endTimestamp,
          isStartPoint: false,
          botTypeName: botType.name,
          runtimeMs: runtimeMs,
          'Gesamtprofit': gridProfit,
          'Gesamtkapital': gesamtkapital,
        };
        // Initialisiere alle Bot-Types mit null
        selectedBotTypesInfo.forEach(bt => {
          endPoint[bt.name] = null;
          endPoint[`${bt.name}_status`] = null;
        });
        // Setze den Wert für diesen Bot-Type
        endPoint[botType.name] = profitValue;
        endPoint[`${botType.name}_status`] = update.status;
        
        // ANALYZE MODE: Füge alle Metrik-Werte als separate Felder hinzu (sichere Schlüssel)
        // WICHTIG: Wenn Gesamtkapital aktiv ist, andere Metriken auf Gesamtkapital basieren lassen
        if (isAnalyzeSingleMetricMode && Object.keys(allMetricValues).length > 0) {
          const gesamtkapitalActive = activeMetricCards.includes('Gesamtkapital');
          const gesamtkapitalValue = allMetricValues['Gesamtkapital'] || 0;
          
          Object.entries(allMetricValues).forEach(([metric, value]) => {
            const safeKey = metricToSafeKey[metric];
            if (safeKey) {
              // Wenn Gesamtkapital aktiv ist UND dies NICHT Gesamtkapital selbst ist,
              // dann addiere Gesamtkapital als Basis (wie im MainChart)
              if (gesamtkapitalActive && metric !== 'Gesamtkapital' && metric !== 'Gesamtprofit %') {
                endPoint[safeKey] = gesamtkapitalValue + value;
              } else {
                endPoint[safeKey] = value;
              }
            }
          });
        }
        
        dataPoints.push(endPoint);
        
        // Speichere End-Timestamp für nächste Iteration
        prevEndTimestamp = endTimestamp;
      });
    });

    // Berechne min/max Timestamps
    const minTimestamp = allTimestamps.length > 0 ? Math.min(...allTimestamps) : 0;
    const maxTimestamp = allTimestamps.length > 0 ? Math.max(...allTimestamps) : 0;

    // Sortiere Datenpunkte nach Zeitstempel
    dataPoints.sort((a, b) => a.timestamp - b.timestamp);
    
    // Zweiter Durchlauf: Markiere Endpunkte, die AUCH Startpunkte des nächsten Updates sind
    // Dies passiert wenn lastUpload vom nächsten Update = thisUpload vom aktuellen Update
    // Gruppiere nach Bot-Type für diese Prüfung
    selectedBotTypesInfo.forEach(botType => {
      const botTypePoints = dataPoints.filter(p => p.botTypeName === botType.name);
      
      for (let i = 0; i < botTypePoints.length; i++) {
        const currentPoint = botTypePoints[i];
        
        // Nur Endpunkte prüfen
        if (currentPoint.isStartPoint !== false) continue;
        
        // Suche nach dem nächsten Startpunkt desselben Bot-Types
        // Der nächste Startpunkt hat einen Timestamp >= dem aktuellen Endpunkt
        for (let j = i + 1; j < botTypePoints.length; j++) {
          const nextPoint = botTypePoints[j];
          
          if (nextPoint.isStartPoint === true) {
            // Prüfe ob der Startpunkt zeitlich nah genug ist (innerhalb 1 Minute = gleicher Punkt)
            const timeDiff = Math.abs(nextPoint.timestamp - currentPoint.timestamp);
            if (timeDiff < 60000) { // 1 Minute Toleranz
              // Dieser Endpunkt ist AUCH der Startpunkt des nächsten Updates
              currentPoint._isAlsoStartOfNext = true;
              currentPoint._nextStartBotType = botType.name;
              currentPoint._nextStartValue = nextPoint[botType.name] || 0;
            }
            break; // Nur den nächsten Startpunkt prüfen
          }
        }
      }
    });

    return { data: dataPoints, botTypeNames, minTimestamp, maxTimestamp };
  }, [isMultiSelectCompareMode, isAnalyzeSingleMetricMode, analyzeSingleMetricInfo, selectedChartBotTypes, allBotTypeUpdates, availableBotTypes, activeMetricCards, profitPercentBase, appliedChartSettings]);
  // ========== ENDE COMPARE MODUS SECTION ==========

  // ========== ADDED MODUS - NUR END-EVENTS ==========
  // NEU: Zeigt NUR End-Events als separate Punkte (keine Start-Events, keine Aggregation)
  // Jeder Bot der endet bekommt seinen eigenen Punkt mit seinem individuellen Profit
  // Bei mehreren End-Events am gleichen Zeitpunkt: Separate Punkte auf verschiedenen Y-Positionen
  const multiBotChartData = useMemo(() => {
    if (!isMultiBotChartMode || allBotTypeUpdates.length === 0) {
      return { data: [], botTypeNames: [] as string[], minTimestamp: 0, maxTimestamp: 0 };
    }

    const selectedIds = selectedChartBotTypes.map(id => String(id));
    const selectedBotTypesInfo = availableBotTypes.filter(bt => 
      selectedIds.includes(String(bt.id))
    );
    const botTypeNames = selectedBotTypesInfo.map(bt => bt.name);

    // Filtere Updates für die ausgewählten Bot-Types
    let relevantUpdates = allBotTypeUpdates.filter(update => 
      selectedIds.includes(String(update.botTypeId))
    );

    if (relevantUpdates.length === 0) {
      return { data: [], botTypeNames, minTimestamp: 0, maxTimestamp: 0 };
    }

    // Wende Zeitfilter an (wie im Compare-Modus)
    if (appliedChartSettings && appliedChartSettings.timeRange !== 'First-Last Update') {
      if (appliedChartSettings.timeRange === 'Custom' && appliedChartSettings.customFromDate && appliedChartSettings.customToDate) {
        const fromTs = appliedChartSettings.customFromDate.getTime();
        const toDate = new Date(appliedChartSettings.customToDate);
        toDate.setHours(23, 59, 59, 999);
        const untilTs = toDate.getTime();
        relevantUpdates = relevantUpdates.filter(update => {
          const ts = getUpdateTimestamp(update);
          return ts >= fromTs && ts <= untilTs;
        });
      } else {
        const rangeMs = parseTimeRangeToMs(
          appliedChartSettings.timeRange,
          appliedChartSettings.customDays,
          appliedChartSettings.customHours,
          appliedChartSettings.customMinutes
        );
        if (rangeMs !== null && rangeMs > 0) {
          const cutoff = Date.now() - rangeMs;
          relevantUpdates = relevantUpdates.filter(update => getUpdateTimestamp(update) >= cutoff);
        }
      }
    }

    if (relevantUpdates.length === 0) {
      return { data: [], botTypeNames, minTimestamp: 0, maxTimestamp: 0 };
    }

    // ========== NUR END-EVENTS SAMMELN ==========
    // Jeder End-Event wird ein separater Datenpunkt
    interface EndEvent {
      timestamp: number;
      botTypeId: string;
      botTypeName: string;
      profit: number; // Gesamtprofit dieses Bots
      metricValues: Record<string, number | undefined>;
      updateVersion: number;
      isClosedBot: boolean;
      runtimeMs?: number;
    }

    const endEvents: EndEvent[] = [];

    relevantUpdates.forEach(update => {
      const botType = selectedBotTypesInfo.find(bt => String(bt.id) === String(update.botTypeId));
      if (!botType) return;

      const isClosedBot = update.status === 'Closed Bots';
      
      // Berechne Profit für diesen Bot
      const profit = isClosedBot 
        ? parseFloat(update.profit || '0') || 0
        : parseFloat(update.overallGridProfitUsdt || '0') || 0;
      
      // Berechne Werte für ALLE verfügbaren Metriken
      // Closed Bots haben keine täglichen Profit-Werte - undefined damit kein Punkt gerendert wird
      const metricValues: Record<string, number | undefined> = {
        'Gesamtprofit': profit,
        'Gesamtkapital': parseFloat(update.totalInvestment || '0') || 0,
        'Gesamtprofit %': isClosedBot ? undefined : parseFloat(update.gridProfitPercent || '0') || 0,
        'Ø Profit/Tag': isClosedBot ? undefined : parseFloat(update.avgGridProfitDay || '0') || 0,
        'Real Profit/Tag': isClosedBot ? undefined : parseFloat(update.avgGridProfitDay || '0') || 0,
      };

      // NUR End-Zeitpunkt (thisUpload) - keine Start-Events mehr!
      if (update.thisUpload) {
        const endDate = parseGermanDate(update.thisUpload);
        if (endDate) {
          // Berechne Runtime (Differenz zwischen Start und End)
          let runtimeMs: number | undefined = undefined;
          if (update.lastUpload) {
            const startDate = parseGermanDate(update.lastUpload);
            if (startDate) {
              runtimeMs = endDate.getTime() - startDate.getTime();
            }
          }
          
          endEvents.push({
            timestamp: endDate.getTime(),
            botTypeId: String(update.botTypeId),
            botTypeName: botType.name,
            profit,
            metricValues,
            updateVersion: update.version,
            isClosedBot,
            runtimeMs
          });
        }
      }
    });

    if (endEvents.length === 0) {
      return { data: [], botTypeNames, minTimestamp: 0, maxTimestamp: 0 };
    }

    // Sortiere End-Events chronologisch
    endEvents.sort((a, b) => a.timestamp - b.timestamp);

    // ========== ERSTELLE DATENPUNKTE - JEDER END-EVENT SEPARAT ==========
    // Jeder End-Event bekommt seinen eigenen Datenpunkt mit individuellem Profit
    const dataPoints: Array<Record<string, any>> = [];

    // Prüfe ob Gesamtkapital als Metrik-Karte aktiv ist (inline, da hasGesamtkapitalActive erst später definiert wird)
    const isGesamtkapitalSelected = activeMetricCards.includes('Gesamtkapital');
    
    endEvents.forEach((event, index) => {
      // Hole die Kapital- und alle Metrik-Werte
      const kapital = event.metricValues['Gesamtkapital'] ?? 0;
      const rawProfit = event.profit;
      const rawProfitPercent = event.metricValues['Gesamtprofit %'];
      const rawAvgDaily = event.metricValues['Ø Profit/Tag'];
      const rawRealDaily = event.metricValues['Real Profit/Tag'];
      
      // WICHTIG: Wenn Gesamtkapital aktiv ist, werden ALLE Metriken bei (Kapital + Wert) angezeigt
      // So erscheinen positive Werte ÜBER der Kapital-Linie, negative UNTER
      // Die rohen Werte werden separat für den Tooltip gespeichert
      const adjustedProfit = isGesamtkapitalSelected ? (kapital + rawProfit) : rawProfit;
      const adjustedProfitPercent = isGesamtkapitalSelected && rawProfitPercent !== undefined ? (kapital + rawProfitPercent) : rawProfitPercent;
      const adjustedAvgDaily = isGesamtkapitalSelected && rawAvgDaily !== undefined ? (kapital + rawAvgDaily) : rawAvgDaily;
      const adjustedRealDaily = isGesamtkapitalSelected && rawRealDaily !== undefined ? (kapital + rawRealDaily) : rawRealDaily;
      
      // Erstelle Datenpunkt für diesen einzelnen End-Event
      const point: Record<string, any> = {
        time: new Date(event.timestamp).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
        timestamp: event.timestamp,
        // Y-Wert ist der individuelle Profit dieses Bots
        Gesamt: adjustedProfit,
        'Gesamt_Gesamtprofit': adjustedProfit, // Adjusted für Chart-Position
        '_raw_Gesamtprofit': rawProfit, // Roh-Wert für Tooltip
        'Gesamt_Gesamtkapital': kapital,
        'Gesamt_Gesamtprofit %': adjustedProfitPercent, // Adjusted für Chart-Position
        '_raw_Gesamtprofit %': rawProfitPercent, // Roh-Wert für Tooltip
        'Gesamt_Ø Profit/Tag': adjustedAvgDaily, // Adjusted für Chart-Position
        '_raw_Ø Profit/Tag': rawAvgDaily, // Roh-Wert für Tooltip
        'Gesamt_Real Profit/Tag': adjustedRealDaily, // Adjusted für Chart-Position
        '_raw_Real Profit/Tag': rawRealDaily, // Roh-Wert für Tooltip
        // Individuelle Bot-Infos für Tooltip
        _botTypeName: event.botTypeName,
        _profit: event.profit,
        _runtimeMs: event.runtimeMs,
        _isClosedBot: event.isClosedBot,
        _updateVersion: event.updateVersion,
        _eventIndex: index,
        // Legacy-Felder für Kompatibilität
        _activeBotCount: 1,
        _primaryEventType: 'end',
        _hasClosedBot: event.isClosedBot,
        _endEvents: [{ 
          botTypeName: event.botTypeName, 
          type: 'end' as const, 
          isClosedBot: event.isClosedBot,
          updateVersion: event.updateVersion,
          runtimeMs: event.runtimeMs,
          metricValues: event.metricValues
        }],
        _startEvents: [],
        _eventInfos: [{ 
          botTypeName: event.botTypeName, 
          type: 'end' as const, 
          isClosedBot: event.isClosedBot,
          updateVersion: event.updateVersion,
          runtimeMs: event.runtimeMs,
          metricValues: event.metricValues
        }]
      };

      // Speichere Bot-Type spezifischen Wert
      point[event.botTypeName] = event.profit;

      dataPoints.push(point);
    });

    const minTimestamp = endEvents[0]?.timestamp || 0;
    const maxTimestamp = endEvents[endEvents.length - 1]?.timestamp || 0;

    return { data: dataPoints, botTypeNames, minTimestamp, maxTimestamp };
  }, [isMultiBotChartMode, selectedChartBotTypes, allBotTypeUpdates, availableBotTypes, appliedChartSettings, activeMetricCards]);

  // ADDED MODE: Berechne Highest und Lowest Value für JEDE aktive Metrik
  // Nicht nur für "Gesamt", sondern für alle Content Cards die aktiv sind
  const addedExtremeValues = useMemo(() => {
    if (!isMultiBotChartMode || !multiBotChartData.data || multiBotChartData.data.length === 0) {
      return { 
        highest: null as { timestamp: number; value: number } | null, 
        lowest: null as { timestamp: number; value: number } | null,
        // NEU: Pro-Metrik High/Low Werte
        perMetric: {} as Record<string, { highest: { timestamp: number; value: number } | null; lowest: { timestamp: number; value: number } | null }>
      };
    }
    
    // Gesamt-Linie High/Low (für Abwärtskompatibilität)
    let maxVal = -Infinity;
    let minVal = Infinity;
    let maxPoint: { timestamp: number; value: number } | null = null;
    let minPoint: { timestamp: number; value: number } | null = null;
    
    multiBotChartData.data.forEach((point: any) => {
      const value = point['Gesamt'];
      if (typeof value === 'number' && !isNaN(value)) {
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
    
    // NEU: Berechne High/Low für JEDE aktive Metrik
    const perMetricExtremes: Record<string, { highest: { timestamp: number; value: number } | null; lowest: { timestamp: number; value: number } | null }> = {};
    
    // Alle 5 Metriken durchgehen
    const allMetrics = ['Gesamtprofit', 'Ø Profit/Tag', 'Real Profit/Tag', 'Gesamtkapital', 'Gesamtprofit %'];
    
    allMetrics.forEach(metricName => {
      let metricMax = -Infinity;
      let metricMin = Infinity;
      let metricMaxPoint: { timestamp: number; value: number } | null = null;
      let metricMinPoint: { timestamp: number; value: number } | null = null;
      
      // Der Schlüssel im Datenpunkt ist "Gesamt_<MetrikName>"
      const dataKey = `Gesamt_${metricName}`;
      
      multiBotChartData.data.forEach((point: any) => {
        const value = point[dataKey];
        if (typeof value === 'number' && !isNaN(value)) {
          if (value > metricMax) {
            metricMax = value;
            metricMaxPoint = { timestamp: point.timestamp, value };
          }
          if (value < metricMin) {
            metricMin = value;
            metricMinPoint = { timestamp: point.timestamp, value };
          }
        }
      });
      
      perMetricExtremes[metricName] = { highest: metricMaxPoint, lowest: metricMinPoint };
    });
    
    return { highest: maxPoint, lowest: minPoint, perMetric: perMetricExtremes };
  }, [isMultiBotChartMode, multiBotChartData.data]);

  // ADDED MODE: Aggregierte Werte für Content Cards
  // ZEITGEWICHTETE Berechnung für Gesamtinvestment und Investitionsmenge
  // ZEITFILTER-SENSITIV: Nur Updates/Teile im gewählten Zeitraum berücksichtigen
  const addedModeAggregatedValues = useMemo(() => {
    if (!isMultiBotChartMode || !multiBotChartData.data || multiBotChartData.data.length === 0) {
      return null;
    }
    
    // Helper: Parse Timestamp aus "DD.MM.YYYY HH:MM" Format
    const parseTimestamp = (dateStr: string | null | undefined): number | null => {
      if (!dateStr) return null;
      const match = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})/);
      if (!match) return null;
      const [, day, month, year, hour, minute] = match;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute)).getTime();
    };
    
    // ========== ZEITFILTER BESTIMMEN ==========
    // Prüfe ob ein Zeitfilter aktiv ist und bestimme den Zeitraum
    let filterFromTs: number | null = null;
    let filterUntilTs: number | null = null;
    let isTimeFiltered = false;
    
    // Verwende appliedChartSettings für den Added Modus
    const settings = appliedChartSettings;
    
    if (settings) {
      // Priorität 1: From/Until manuell ausgewählt
      if (settings.fromUpdate && settings.untilUpdate) {
        const fromUpdate = allBotTypeUpdates.find(u => u.id === settings.fromUpdate);
        const untilUpdate = allBotTypeUpdates.find(u => u.id === settings.untilUpdate);
        if (fromUpdate && untilUpdate) {
          filterFromTs = parseTimestamp(fromUpdate.thisUpload);
          filterUntilTs = parseTimestamp(untilUpdate.thisUpload);
          isTimeFiltered = true;
        }
      }
      // Priorität 2: Custom mit Kalender-Auswahl (von-bis Datum)
      else if (settings.timeRange === 'Custom' && settings.customFromDate && settings.customToDate) {
        filterFromTs = settings.customFromDate.getTime();
        const toDate = new Date(settings.customToDate);
        toDate.setHours(23, 59, 59, 999);
        filterUntilTs = toDate.getTime();
        isTimeFiltered = true;
      }
      // Priorität 3: "Letzten"-Zeitraum Filter (1h, 24h, 7 Days, 30 Days, Custom mit D/H/M)
      else if (settings.timeRange && settings.timeRange !== 'First-Last Update') {
        const rangeMs = parseTimeRangeToMs(
          settings.timeRange,
          settings.customDays,
          settings.customHours,
          settings.customMinutes
        );
        if (rangeMs !== null && rangeMs > 0) {
          filterUntilTs = Date.now();
          filterFromTs = filterUntilTs - rangeMs;
          isTimeFiltered = true;
        }
      }
      // Priorität 4: First-Last Update = Alle Updates (kein Filter)
    }
    
    // ========== ZEITGEWICHTETE BERECHNUNG - ALLE UPDATES ZUSAMMEN ==========
    // KORREKTE LOGIK: Alle Updates von allen ausgewählten Bot-Types zusammen
    // als "ein großer Bot-Type" berechnen (nicht pro Bot-Type addieren!)
    
    // ALLE Update Metrics von ALLEN ausgewählten Bot-Types zusammen
    const allSelectedUpdateMetrics = allBotTypeUpdates.filter(
      update => selectedChartBotTypes.includes(update.botTypeId) && update.status === "Update Metrics"
    );
    
    let timeWeightedTotalInvestment = 0;
    let timeWeightedBaseInvestment = 0;
    
    if (allSelectedUpdateMetrics.length > 0) {
      let sumTotalInvTimesRuntime = 0;
      let sumBaseInvTimesRuntime = 0;
      let sumRuntime = 0;
      
      allSelectedUpdateMetrics.forEach(update => {
        const totalInv = parseFloat(update.totalInvestment || '0') || 0;
        const baseInv = parseFloat(update.investment || '0') || 0;
        
        // Runtime = durchschnittliche Laufzeit (avgRuntime) - IMMER verwenden!
        const runtimeMs = parseRuntimeToHours(update.avgRuntime) * 60 * 60 * 1000;
        
        if (runtimeMs > 0) {
          // ZEITFILTER: Prüfen ob Update im Zeitfenster liegt
          if (isTimeFiltered && filterFromTs !== null && filterUntilTs !== null) {
            const fromTs = parseTimestamp(update.lastUpload);
            const untilTs = parseTimestamp(update.thisUpload);
            
            if (fromTs && untilTs) {
              // Prüfen ob Update im Zeitfenster liegt (Überlappung existiert)
              const effectiveFrom = Math.max(fromTs, filterFromTs);
              const effectiveUntil = Math.min(untilTs, filterUntilTs);
              
              // Nur wenn Überlappung existiert → Update ist im Zeitfenster
              if (effectiveUntil > effectiveFrom) {
                // WICHTIG: avgRuntime verwenden, NICHT from-until!
                sumTotalInvTimesRuntime += totalInv * runtimeMs;
                sumBaseInvTimesRuntime += baseInv * runtimeMs;
                sumRuntime += runtimeMs;
              }
            }
          } else {
            // Kein Zeitfilter (First-Last): avgRuntime direkt verwenden
            sumTotalInvTimesRuntime += totalInv * runtimeMs;
            sumBaseInvTimesRuntime += baseInv * runtimeMs;
            sumRuntime += runtimeMs;
          }
        }
      });
      
      // EINE zeitgewichtete Berechnung über ALLE Updates
      if (sumRuntime > 0) {
        timeWeightedTotalInvestment = sumTotalInvTimesRuntime / sumRuntime;
        timeWeightedBaseInvestment = sumBaseInvTimesRuntime / sumRuntime;
      }
    }
    
    // Andere Metriken aus den Chart-Daten summieren (Profit, etc.)
    let totalProfit = 0;
    let totalRealDailyProfit = 0;
    let count = 0;
    
    multiBotChartData.data.forEach((point: any) => {
      // WICHTIG: Verwende die ROHEN Werte (_raw_*) für die Content Cards
      const profit = point['_raw_Gesamtprofit'] ?? point._profit ?? 0;
      const realDaily = point['_raw_Real Profit/Tag'] ?? 0;
      
      totalProfit += profit;
      totalRealDailyProfit += realDaily;
      count++;
    });
    
    // ========== Ø PROFIT/TAG ==========
    // ALLE Updates: totalProfit / totalHours * 24 (wie Gesamt-Modus)
    // NUR TEILWEISE Updates (echter Zeitfilter): avgGridProfitDay Durchschnitt
    let avgDailyProfitSum = 0;
    
    selectedChartBotTypes.forEach(botTypeId => {
      // Alle Update Metrics für diesen Bot-Type
      const allUpdatesForBotType = allBotTypeUpdates.filter(
        update => update.botTypeId === botTypeId && update.status === 'Update Metrics'
      );
      
      // Gefilterte Updates bestimmen
      let filteredUpdates = allUpdatesForBotType;
      if (isTimeFiltered && filterFromTs !== null && filterUntilTs !== null) {
        filteredUpdates = allUpdatesForBotType.filter(update => {
          const fromTs = parseTimestamp(update.lastUpload);
          const untilTs = parseTimestamp(update.thisUpload);
          if (fromTs && untilTs) {
            const effectiveFrom = Math.max(fromTs, filterFromTs);
            const effectiveUntil = Math.min(untilTs, filterUntilTs);
            return effectiveUntil > effectiveFrom;
          }
          return false;
        });
      }
      
      if (filteredUpdates.length > 0) {
        // Prüfen ob ALLE Updates enthalten sind
        const allUpdatesIncluded = filteredUpdates.length === allUpdatesForBotType.length;
        
        if (allUpdatesIncluded) {
          // ALLE Updates: totalProfit / totalHours * 24 (wie Gesamt-Modus)
          let totalProfit = 0;
          let totalHours = 0;
          
          filteredUpdates.forEach(update => {
            const gridProfit = parseFloat(update.overallGridProfitUsdt || '0') || 0;
            const runtimeHours = parseRuntimeToHours(update.avgRuntime);
            totalProfit += gridProfit;
            totalHours += runtimeHours;
          });
          
          if (totalHours > 0) {
            const avg24hProfit = (totalProfit / totalHours) * 24;
            avgDailyProfitSum += avg24hProfit;
          }
        } else {
          // NUR TEILWEISE Updates: avgGridProfitDay Durchschnitt verwenden
          let sumAvgGridProfitDay = 0;
          filteredUpdates.forEach(update => {
            const avgGridProfitDay = parseFloat(update.avgGridProfitDay || '0') || 0;
            sumAvgGridProfitDay += avgGridProfitDay;
          });
          const botTypeAvg = sumAvgGridProfitDay / filteredUpdates.length;
          avgDailyProfitSum += botTypeAvg;
        }
      }
    });
    
    // Investment basierend auf profitPercentBase auswählen
    const displayedInv = profitPercentBase === 'gesamtinvestment' 
      ? timeWeightedTotalInvestment 
      : timeWeightedBaseInvestment;
    
    // Gesamtprofit % DIREKT berechnen: (totalProfit / displayedInvestment) * 100
    // Gleiche Logik wie bei "Gesamt" Modus
    const calculatedProfitPercent = displayedInv > 0 ? (totalProfit / displayedInv) * 100 : 0;
    
    // Durchschnittswerte für tägliche Profite
    const avgDailyProfit = avgDailyProfitSum;
    const avgRealDailyProfit = count > 0 ? totalRealDailyProfit / count : 0;
    
    return {
      profit: totalProfit,
      investment: displayedInv,
      totalInvestment: timeWeightedTotalInvestment,
      baseInvestment: timeWeightedBaseInvestment,
      profitPercent: calculatedProfitPercent,
      avgDailyProfit: avgDailyProfit,
      realDailyProfit: avgRealDailyProfit,
      metricCount: count
    };
  }, [isMultiBotChartMode, multiBotChartData.data, selectedChartBotTypes, allBotTypeUpdates, profitPercentBase, appliedChartSettings]);
  // ========== ENDE ADDED MODUS SECTION ==========

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
    
    // Parse Update ID - unterstützt beide Formate:
    // Normal-Modus: "u-X" oder "c-X"
    // Compare-Modus: "{botTypeId}:u-X" oder "{botTypeId}:c-X"
    let parsedBotTypeId: string | null = null;
    let updatePart = appliedUpdateId;
    
    if (appliedUpdateId.includes(':')) {
      // Compare-Modus: extrahiere botTypeId und update-Teil
      const colonIndex = appliedUpdateId.indexOf(':');
      parsedBotTypeId = appliedUpdateId.substring(0, colonIndex);
      updatePart = appliedUpdateId.substring(colonIndex + 1);
    }
    
    const isClosedBot = updatePart.startsWith('c-');
    const version = parseInt(updatePart.split('-')[1], 10);
    
    // Finde das Update in den Daten
    // Compare-Modus: Suche im spezifischen Bot-Type
    // Normal-Modus: Suche im ausgewählten Bot-Type
    const targetBotTypeId = parsedBotTypeId || effectiveSelectedBotTypeData?.id;
    const allUpdates = targetBotTypeId 
      ? (allBotTypeUpdates || []).filter((u: BotTypeUpdate) => u.botTypeId === targetBotTypeId)
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
    
    // WICHTIG: Konsistent mit getUpdateTimestamp() bleiben!
    // compareChartData verwendet thisUpload für alle Updates (auch Closed Bots)
    // Für Closed Bots: lastUpload (Start) und thisUpload (End) - NICHT startDate/endDate!
    // Für Update Metrics: lastUpload (Start) und thisUpload (End)
    let startTs: number | null;
    let endTs: number | null;
    
    // Beide Typen verwenden lastUpload/thisUpload für Konsistenz mit Chart-Daten
    startTs = parseTs(update.lastUpload);
    endTs = parseTs(update.thisUpload);
    
    // Mindestens ein Zeitstempel muss vorhanden sein
    if (startTs === null && endTs === null) {
      return null;
    }
    
    // Falls einer fehlt: Fallback auf den vorhandenen
    if (startTs === null) startTs = endTs! - (24 * 60 * 60 * 1000); // 1 Tag vorher
    if (endTs === null) endTs = startTs + (24 * 60 * 60 * 1000); // 1 Tag nachher
    
    return { startTs, endTs, update, isClosedBot, version };
  }, [analyzeMode, appliedUpdateId, effectiveSelectedBotTypeData, allBotTypeUpdates]);

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

  // COMPARE MODE: Berechne Highest und Lowest Value für jede Bot-Type-Linie
  // Im Compare-Modus wird die ausgewählte Metrik (activeMetricCards[0]) für JEDEN Bot-Type berechnet
  const compareExtremeValues = useMemo(() => {
    if (!isMultiSelectCompareMode || !compareChartData.data || compareChartData.data.length === 0) {
      return { 
        highest: {} as Record<string, { timestamp: number; value: number; botTypeName: string; color: string }>, 
        lowest: {} as Record<string, { timestamp: number; value: number; botTypeName: string; color: string }> 
      };
    }
    
    const chartData = compareChartData.data;
    const botTypeNames = compareChartData.botTypeNames || [];
    
    const highest: Record<string, { timestamp: number; value: number; botTypeName: string; color: string }> = {};
    const lowest: Record<string, { timestamp: number; value: number; botTypeName: string; color: string }> = {};
    
    // Für jeden Bot-Type den höchsten und niedrigsten Wert finden
    botTypeNames.forEach((botTypeName, idx) => {
      let maxVal = -Infinity;
      let minVal = Infinity;
      let maxTimestamp = 0;
      let maxValue = 0;
      let minTimestamp = 0;
      let minValue = 0;
      let foundMax = false;
      let foundMin = false;
      
      chartData.forEach((point: any) => {
        const value = point[botTypeName];
        if (typeof value === 'number' && !isNaN(value)) {
          if (value > maxVal) {
            maxVal = value;
            maxTimestamp = point.timestamp;
            maxValue = value;
            foundMax = true;
          }
          if (value < minVal) {
            minVal = value;
            minTimestamp = point.timestamp;
            minValue = value;
            foundMin = true;
          }
        }
      });
      
      const color = getCompareColor(idx);
      
      if (foundMax) {
        highest[botTypeName] = { 
          timestamp: maxTimestamp, 
          value: maxValue, 
          botTypeName, 
          color 
        };
      }
      if (foundMin) {
        lowest[botTypeName] = { 
          timestamp: minTimestamp, 
          value: minValue, 
          botTypeName, 
          color 
        };
      }
    });
    
    return { highest, lowest };
  }, [isMultiSelectCompareMode, compareChartData.data, compareChartData.botTypeNames]);


  // Berechne X-Achsen-Ticks basierend auf Sequence (Granularität)
  // WICHTIG: Der Zeitraum (From bis Until) bleibt IMMER gleich!
  // Tick-Intervalle:
  // - Stunden → Stunden-Ticks, Labels = Uhrzeit + ab und zu Datum
  // - Tage → Tages-Ticks, Labels = Datum
  // - Wochen → TAGES-Ticks (!), Labels = Datum + ab und zu KW
  // - Monate → TAGES-Ticks (!), Labels = Datum + ab und zu Monat
  const xAxisTicks = useMemo(() => {
    // ANALYSIEREN-MODUS hat PRIORITÄT - auch im Compare-Modus!
    // WICHTIG: 1:1 wie Compare-Mode mit Zoom & Pan Unterstützung!
    if (analyzeModeBounds) {
      const { startTs: baseStartTs, endTs: baseEndTs } = analyzeModeBounds;
      const totalRange = baseEndTs - baseStartTs;
      
      // Sichtbare Zeitspanne basierend auf Zoom berechnen (wie Compare-Mode!)
      const visibleRange = totalRange / chartZoomX;
      const visibleHours = visibleRange / (60 * 60 * 1000);
      const visibleDays = visibleRange / (24 * 60 * 60 * 1000);
      const visibleWeeks = visibleRange / (7 * 24 * 60 * 60 * 1000);
      
      // Berechne gezoomte Start/End-Zeitstempel (wie Compare-Mode!)
      const padding = totalRange > 0 ? totalRange * 0.05 : 24 * 60 * 60 * 1000;
      const baseMin = baseStartTs - padding;
      const baseMax = baseEndTs + padding;
      const baseRange = baseMax - baseMin;
      
      let startTs = baseStartTs;
      let endTs = baseEndTs;
      
      if (chartZoomX > 1 || chartPanX !== 0) {
        const zoomedRange = baseRange / chartZoomX;
        const center = (baseMin + baseMax) / 2;
        const chartWidth = 600;
        const panOffset = -(chartPanX / chartWidth) * baseRange;
        
        startTs = center - zoomedRange / 2 + panOffset;
        endTs = center + zoomedRange / 2 + panOffset;
      }
      
      // AUTOMATISCHE SEQUENCE-DOWNGRADE basierend auf sichtbarer Zeitspanne
      // FRÜHER auf Stunden umschalten für bessere Lesbarkeit!
      let effectiveSequence = 'days';
      if (visibleDays < 7) {
        effectiveSequence = 'hours';
      }
      
      // ZOOM-ANGEPASSTE TICK-INTERVALLE (wie Compare-Mode!)
      let tickInterval: number;
      
      if (effectiveSequence === 'hours') {
        if (visibleHours <= 6) {
          tickInterval = 30 * 60 * 1000; // 30 Minuten
        } else if (visibleHours <= 12) {
          tickInterval = 60 * 60 * 1000; // 1 Stunde
        } else if (visibleHours <= 24) {
          tickInterval = 2 * 60 * 60 * 1000; // 2 Stunden
        } else if (visibleHours <= 48) {
          tickInterval = 4 * 60 * 60 * 1000; // 4 Stunden
        } else if (visibleHours <= 96) {
          tickInterval = 6 * 60 * 60 * 1000; // 6 Stunden
        } else {
          tickInterval = 12 * 60 * 60 * 1000; // 12 Stunden
        }
      } else {
        // TAGES-MODUS
        if (visibleDays <= 7) {
          tickInterval = 24 * 60 * 60 * 1000; // 1 Tag
        } else if (visibleDays <= 14) {
          tickInterval = 2 * 24 * 60 * 60 * 1000; // 2 Tage
        } else if (visibleDays <= 30) {
          tickInterval = 3 * 24 * 60 * 60 * 1000; // 3 Tage
        } else if (visibleDays <= 60) {
          tickInterval = 7 * 24 * 60 * 60 * 1000; // 1 Woche
        } else {
          tickInterval = 14 * 24 * 60 * 60 * 1000; // 2 Wochen
        }
      }
      
      const ticks: number[] = [];
      ticks.push(startTs);
      
      // RUNDUNG basierend auf effectiveSequence (1:1 wie Compare-Mode!)
      const currentDate = new Date(startTs);
      
      if (effectiveSequence === 'hours' && tickInterval < 24 * 60 * 60 * 1000) {
        // STUNDEN: Runde auf volle Stunde
        currentDate.setMinutes(0, 0, 0);
        if (currentDate.getTime() <= startTs) {
          currentDate.setTime(currentDate.getTime() + 60 * 60 * 1000);
        }
      } else {
        // TAGE: Runde auf Mitternacht
        currentDate.setHours(0, 0, 0, 0);
        if (currentDate.getTime() <= startTs) {
          currentDate.setTime(currentDate.getTime() + 24 * 60 * 60 * 1000);
        }
      }
      
      let currentTs = currentDate.getTime();
      const minGap = tickInterval * 0.3;
      
      // Nur Ticks mit genug Abstand hinzufügen (1:1 wie Compare-Mode!)
      while (currentTs < endTs - minGap) {
        if (currentTs > startTs + minGap) {
          ticks.push(currentTs);
        }
        currentTs += tickInterval;
      }
      
      // End-Datum nur hinzufügen wenn mindestens minGap Abstand zum letzten Tick
      const lastTick = ticks[ticks.length - 1];
      if (lastTick !== endTs && (endTs - lastTick) >= minGap) {
        ticks.push(endTs);
      }
      
      return ticks;
    }
    
    // COMPARE MODUS: Tick-Generierung für den Vergleichsmodus
    // WICHTIG: Sequence-Einstellung berücksichtigen + automatische Downgrade beim Zoomen!
    if (isMultiSelectCompareMode && compareChartData.minTimestamp > 0 && compareChartData.maxTimestamp > 0) {
      const baseStartTs = compareChartData.minTimestamp;
      const baseEndTs = compareChartData.maxTimestamp;
      const totalRange = baseEndTs - baseStartTs;
      
      // Sequence-Einstellung aus Graph-Einstellungen (Basis-Einstellung)
      const baseSequence = appliedChartSettings?.sequence || 'days';
      
      // Sichtbare Zeitspanne basierend auf Zoom berechnen
      const visibleRange = totalRange / chartZoomX;
      const visibleHours = visibleRange / (60 * 60 * 1000);
      const visibleDays = visibleRange / (24 * 60 * 60 * 1000);
      const visibleWeeks = visibleRange / (7 * 24 * 60 * 60 * 1000);
      
      // AUTOMATISCHE SEQUENCE-DOWNGRADE beim Zoomen
      // Months → Weeks → Days → Hours basierend auf sichtbarer Zeitspanne
      let effectiveSequence = baseSequence;
      
      if (baseSequence === 'months') {
        // Months: Downgrade zu Weeks wenn < 8 Wochen sichtbar
        // Downgrade zu Days wenn < 2 Wochen sichtbar
        // Downgrade zu Hours wenn < 3 Tage sichtbar
        if (visibleDays < 3) {
          effectiveSequence = 'hours';
        } else if (visibleDays < 14) {
          effectiveSequence = 'days';
        } else if (visibleDays < 56) {
          effectiveSequence = 'weeks';
        }
      } else if (baseSequence === 'weeks') {
        // Weeks: Downgrade zu Days wenn < 2 Wochen sichtbar
        // Downgrade zu Hours wenn < 3 Tage sichtbar
        if (visibleDays < 3) {
          effectiveSequence = 'hours';
        } else if (visibleDays < 14) {
          effectiveSequence = 'days';
        }
      } else if (baseSequence === 'days') {
        // Days: Downgrade zu Hours wenn < 3 Tage sichtbar
        if (visibleDays < 3) {
          effectiveSequence = 'hours';
        }
      }
      // Hours bleibt immer Hours (kleinste Einheit)
      
      // Berechne gezoomte Start/End-Zeitstempel
      const padding = totalRange > 0 ? totalRange * 0.05 : 24 * 60 * 60 * 1000;
      const baseMin = baseStartTs - padding;
      const baseMax = baseEndTs + padding;
      const baseRange = baseMax - baseMin;
      
      let startTs = baseStartTs;
      let endTs = baseEndTs;
      
      if (chartZoomX > 1 || chartPanX !== 0) {
        const zoomedRange = baseRange / chartZoomX;
        const center = (baseMin + baseMax) / 2;
        const chartWidth = 600;
        const panOffset = -(chartPanX / chartWidth) * baseRange;
        
        startTs = center - zoomedRange / 2 + panOffset;
        endTs = center + zoomedRange / 2 + panOffset;
      }
      
      // SEQUENCE-BASIERTE TICK-INTERVALLE (mit effectiveSequence)
      let tickInterval: number;
      
      if (effectiveSequence === 'hours') {
        // STUNDEN-MODUS
        if (visibleHours <= 6) {
          tickInterval = 30 * 60 * 1000; // 30 Minuten
        } else if (visibleHours <= 12) {
          tickInterval = 60 * 60 * 1000; // 1 Stunde
        } else if (visibleHours <= 24) {
          tickInterval = 2 * 60 * 60 * 1000; // 2 Stunden
        } else if (visibleHours <= 48) {
          tickInterval = 4 * 60 * 60 * 1000; // 4 Stunden
        } else if (visibleHours <= 96) {
          tickInterval = 6 * 60 * 60 * 1000; // 6 Stunden
        } else {
          tickInterval = 12 * 60 * 60 * 1000; // 12 Stunden
        }
      } else if (effectiveSequence === 'weeks') {
        // WOCHEN-MODUS
        if (visibleWeeks <= 4) {
          tickInterval = 7 * 24 * 60 * 60 * 1000; // 1 Woche
        } else if (visibleWeeks <= 8) {
          tickInterval = 14 * 24 * 60 * 60 * 1000; // 2 Wochen
        } else if (visibleWeeks <= 16) {
          tickInterval = 28 * 24 * 60 * 60 * 1000; // 4 Wochen
        } else {
          tickInterval = 56 * 24 * 60 * 60 * 1000; // 8 Wochen
        }
      } else if (effectiveSequence === 'months') {
        // MONATS-MODUS
        const visibleMonths = visibleDays / 30;
        if (visibleMonths <= 3) {
          tickInterval = 30 * 24 * 60 * 60 * 1000; // 1 Monat
        } else if (visibleMonths <= 6) {
          tickInterval = 60 * 24 * 60 * 60 * 1000; // 2 Monate
        } else if (visibleMonths <= 12) {
          tickInterval = 90 * 24 * 60 * 60 * 1000; // 3 Monate
        } else {
          tickInterval = 180 * 24 * 60 * 60 * 1000; // 6 Monate
        }
      } else {
        // TAGES-MODUS (default)
        if (visibleDays <= 7) {
          tickInterval = 24 * 60 * 60 * 1000; // 1 Tag
        } else if (visibleDays <= 14) {
          tickInterval = 2 * 24 * 60 * 60 * 1000; // 2 Tage
        } else if (visibleDays <= 30) {
          tickInterval = 3 * 24 * 60 * 60 * 1000; // 3 Tage
        } else if (visibleDays <= 60) {
          tickInterval = 7 * 24 * 60 * 60 * 1000; // 1 Woche
        } else {
          tickInterval = 14 * 24 * 60 * 60 * 1000; // 2 Wochen
        }
      }
      
      const ticks: number[] = [];
      ticks.push(startTs);
      
      // Rundung basierend auf effectiveSequence (angepasst an Zoom-Level)
      const currentDate = new Date(startTs);
      
      if (effectiveSequence === 'hours' && tickInterval < 24 * 60 * 60 * 1000) {
        // STUNDEN: Runde auf volle Stunde
        currentDate.setMinutes(0, 0, 0);
        if (currentDate.getTime() <= startTs) {
          currentDate.setTime(currentDate.getTime() + 60 * 60 * 1000);
        }
      } else if (effectiveSequence === 'weeks') {
        // WOCHEN: Runde auf Montag 00:00
        currentDate.setHours(0, 0, 0, 0);
        const dayOfWeek = currentDate.getDay();
        const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7;
        if (daysUntilMonday === 0 && currentDate.getTime() <= startTs) {
          currentDate.setTime(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        } else {
          currentDate.setTime(currentDate.getTime() + daysUntilMonday * 24 * 60 * 60 * 1000);
        }
      } else if (effectiveSequence === 'months') {
        // MONATE: Runde auf 1. des nächsten Monats
        currentDate.setHours(0, 0, 0, 0);
        currentDate.setDate(1);
        currentDate.setMonth(currentDate.getMonth() + 1);
      } else {
        // TAGE: Runde auf Mitternacht
        currentDate.setHours(0, 0, 0, 0);
        if (currentDate.getTime() <= startTs) {
          currentDate.setTime(currentDate.getTime() + 24 * 60 * 60 * 1000);
        }
      }
      
      let currentTs = currentDate.getTime();
      const minGap = tickInterval * 0.3;
      
      while (currentTs < endTs - minGap) {
        if (currentTs > startTs + minGap) {
          ticks.push(currentTs);
        }
        currentTs += tickInterval;
      }
      
      // End-Datum nur hinzufügen wenn mindestens minGap Abstand zum letzten Tick
      const lastTick = ticks[ticks.length - 1];
      if (lastTick !== endTs && (endTs - lastTick) >= minGap) {
        ticks.push(endTs);
      }
      
      return ticks;
    }
    
    // ADDED MODUS: Tick-Generierung für den Gesamt-Modus (analog zu Compare)
    // WICHTIG: Sequence-Einstellung berücksichtigen + automatische Downgrade beim Zoomen!
    if (isMultiBotChartMode && multiBotChartData.minTimestamp > 0 && multiBotChartData.maxTimestamp > 0) {
      const baseStartTs = multiBotChartData.minTimestamp;
      const baseEndTs = multiBotChartData.maxTimestamp;
      const totalRange = baseEndTs - baseStartTs;
      
      // Sequence-Einstellung aus Graph-Einstellungen (Basis-Einstellung)
      const baseSequence = appliedChartSettings?.sequence || 'days';
      
      // Sichtbare Zeitspanne basierend auf Zoom berechnen
      const visibleRange = totalRange / chartZoomX;
      const visibleHours = visibleRange / (60 * 60 * 1000);
      const visibleDays = visibleRange / (24 * 60 * 60 * 1000);
      const visibleWeeks = visibleRange / (7 * 24 * 60 * 60 * 1000);
      
      // AUTOMATISCHE SEQUENCE-DOWNGRADE beim Zoomen
      // Months → Weeks → Days → Hours basierend auf sichtbarer Zeitspanne
      // WICHTIG: Bei "months" soll nur bei STARKEM Zoom downgraded werden!
      let effectiveSequence = baseSequence;
      
      if (baseSequence === 'months') {
        // Months bleibt "months" auch bei kurzen Zeiträumen (30 Tage)
        // Nur bei sehr starkem Zoom (< 14 Tage sichtbar) wechseln
        if (visibleDays < 3) {
          effectiveSequence = 'hours';
        } else if (visibleDays < 14) {
          effectiveSequence = 'days';
        }
        // Bei >= 14 Tagen bleibt es "months" (KEIN Wechsel zu weeks!)
      } else if (baseSequence === 'weeks') {
        if (visibleDays < 3) {
          effectiveSequence = 'hours';
        } else if (visibleDays < 14) {
          effectiveSequence = 'days';
        }
      } else if (baseSequence === 'days') {
        if (visibleDays < 3) {
          effectiveSequence = 'hours';
        }
      }
      // Hours bleibt immer Hours (kleinste Einheit)
      
      // Berechne gezoomte Start/End-Zeitstempel
      const padding = totalRange > 0 ? totalRange * 0.05 : 24 * 60 * 60 * 1000;
      const baseMin = baseStartTs - padding;
      const baseMax = baseEndTs + padding;
      const baseRange = baseMax - baseMin;
      
      let startTs = baseStartTs;
      let endTs = baseEndTs;
      
      if (chartZoomX > 1 || chartPanX !== 0) {
        const zoomedRange = baseRange / chartZoomX;
        const center = (baseMin + baseMax) / 2;
        const chartWidth = 600;
        const panOffset = -(chartPanX / chartWidth) * baseRange;
        
        startTs = center - zoomedRange / 2 + panOffset;
        endTs = center + zoomedRange / 2 + panOffset;
      }
      
      let tickInterval: number;
      
      // SEQUENCE-BASIERTE TICK-INTERVALLE
      if (effectiveSequence === 'hours') {
        if (visibleHours <= 6) {
          tickInterval = 30 * 60 * 1000;
        } else if (visibleHours <= 12) {
          tickInterval = 60 * 60 * 1000;
        } else if (visibleHours <= 24) {
          tickInterval = 2 * 60 * 60 * 1000;
        } else if (visibleHours <= 48) {
          tickInterval = 4 * 60 * 60 * 1000;
        } else if (visibleHours <= 96) {
          tickInterval = 6 * 60 * 60 * 1000;
        } else {
          tickInterval = 12 * 60 * 60 * 1000;
        }
      } else if (effectiveSequence === 'weeks') {
        // WOCHEN-MODUS - Optimiert für bessere Tick-Verteilung bei 30 Tagen
        if (visibleWeeks <= 6) {
          tickInterval = 7 * 24 * 60 * 60 * 1000; // 1 Woche (alle 7 Tage)
        } else if (visibleWeeks <= 12) {
          tickInterval = 14 * 24 * 60 * 60 * 1000; // 2 Wochen
        } else if (visibleWeeks <= 24) {
          tickInterval = 28 * 24 * 60 * 60 * 1000; // 4 Wochen
        } else {
          tickInterval = 56 * 24 * 60 * 60 * 1000; // 8 Wochen
        }
      } else if (effectiveSequence === 'months') {
        // MONATS-MODUS - Immer genau 3 Ticks: Anfang, Mitte, Ende
        // Bei kurzen Zeiträumen (< 6 Monate) zeigen wir genau 3 Striche
        const visibleMonths = visibleDays / 30;
        if (visibleMonths <= 6) {
          // Spezielle Logik: Genau 3 Ticks (Anfang, Mitte, Ende)
          const ticks: number[] = [];
          ticks.push(startTs); // Anfang
          ticks.push(Math.round((startTs + endTs) / 2)); // Mitte
          ticks.push(endTs); // Ende
          return ticks;
        } else if (visibleMonths <= 12) {
          tickInterval = 60 * 24 * 60 * 60 * 1000; // 2 Monate
        } else if (visibleMonths <= 24) {
          tickInterval = 90 * 24 * 60 * 60 * 1000; // 3 Monate
        } else {
          tickInterval = 180 * 24 * 60 * 60 * 1000; // 6 Monate
        }
      } else {
        // TAGES-MODUS (default) - EXAKT WIE COMPARE-MODUS
        if (visibleDays <= 7) {
          tickInterval = 24 * 60 * 60 * 1000; // 1 Tag
        } else if (visibleDays <= 14) {
          tickInterval = 2 * 24 * 60 * 60 * 1000; // 2 Tage
        } else if (visibleDays <= 30) {
          tickInterval = 3 * 24 * 60 * 60 * 1000; // 3 Tage
        } else if (visibleDays <= 60) {
          tickInterval = 7 * 24 * 60 * 60 * 1000; // 1 Woche
        } else {
          tickInterval = 14 * 24 * 60 * 60 * 1000; // 2 Wochen
        }
      }
      
      const ticks: number[] = [];
      ticks.push(startTs);
      
      // Rundung basierend auf effectiveSequence (angepasst an Zoom-Level) - EXAKT WIE COMPARE-MODUS
      const currentDate = new Date(startTs);
      
      if (effectiveSequence === 'hours' && tickInterval < 24 * 60 * 60 * 1000) {
        currentDate.setMinutes(0, 0, 0);
        if (currentDate.getTime() <= startTs) {
          currentDate.setTime(currentDate.getTime() + 60 * 60 * 1000);
        }
      } else if (effectiveSequence === 'weeks') {
        currentDate.setHours(0, 0, 0, 0);
        const dayOfWeek = currentDate.getDay();
        const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7;
        if (daysUntilMonday === 0 && currentDate.getTime() <= startTs) {
          currentDate.setTime(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        } else {
          currentDate.setTime(currentDate.getTime() + daysUntilMonday * 24 * 60 * 60 * 1000);
        }
      } else if (effectiveSequence === 'months') {
        currentDate.setHours(0, 0, 0, 0);
        currentDate.setDate(1);
        currentDate.setMonth(currentDate.getMonth() + 1);
      } else {
        currentDate.setHours(0, 0, 0, 0);
        if (currentDate.getTime() <= startTs) {
          currentDate.setTime(currentDate.getTime() + 24 * 60 * 60 * 1000);
        }
      }
      
      let currentTs = currentDate.getTime();
      // ADDED MODUS: Größerer minGap (50% statt 30%) um Überlappung bei nahen Datenpunkten zu verhindern
      // Im Compare-Modus sind die Daten regelmäßiger verteilt, hier können Bot-Ends sehr nahe beieinander sein
      const minGap = tickInterval * 0.5;
      
      while (currentTs < endTs - minGap) {
        if (currentTs > startTs + minGap) {
          ticks.push(currentTs);
        }
        currentTs += tickInterval;
      }
      
      // End-Datum nur hinzufügen wenn mindestens minGap Abstand
      const lastTick = ticks[ticks.length - 1];
      if (lastTick !== endTs && (endTs - lastTick) >= minGap) {
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
    
    // Basis-Sequence aus Graph-Einstellungen
    const baseSequence = appliedChartSettings?.sequence || 'days';
    
    // TICK-DENSITY-CAP: Max. 8-12 Major-Ticks (Pro-Trading-UI-Level)
    // Berechne sichtbare Zeitspanne basierend auf Zoom
    const totalRange = endTime - startTime;
    const visibleRange = totalRange / chartZoomX; // Sichtbarer Bereich bei Zoom
    
    // Ziel: 8-12 Ticks im sichtbaren Bereich
    // Die Sequence bestimmt die BASIS-Einheit, Intervall wird dynamisch angepasst
    const visibleHours = visibleRange / (60 * 60 * 1000);
    const visibleDays = visibleRange / (24 * 60 * 60 * 1000);
    const visibleWeeks = visibleRange / (7 * 24 * 60 * 60 * 1000);
    
    // AUTOMATISCHE SEQUENCE-DOWNGRADE beim Zoomen
    // Months → Weeks → Days → Hours basierend auf sichtbarer Zeitspanne
    let effectiveSequence = baseSequence;
    
    if (baseSequence === 'months') {
      if (visibleDays < 3) {
        effectiveSequence = 'hours';
      } else if (visibleDays < 14) {
        effectiveSequence = 'days';
      } else if (visibleDays < 56) {
        effectiveSequence = 'weeks';
      }
    } else if (baseSequence === 'weeks') {
      if (visibleDays < 3) {
        effectiveSequence = 'hours';
      } else if (visibleDays < 14) {
        effectiveSequence = 'days';
      }
    } else if (baseSequence === 'days') {
      if (visibleDays < 3) {
        effectiveSequence = 'hours';
      }
    }
    
    let tickInterval: number;
    
    // SEQUENCE-BASIERTE TICK-INTERVALLE (mit effectiveSequence)
    if (effectiveSequence === 'hours') {
      // STUNDEN-MODUS: Ticks in Stunden-Einheiten
      if (visibleHours <= 6) {
        tickInterval = 30 * 60 * 1000; // 30 Minuten
      } else if (visibleHours <= 12) {
        tickInterval = 60 * 60 * 1000; // 1 Stunde
      } else if (visibleHours <= 24) {
        tickInterval = 2 * 60 * 60 * 1000; // 2 Stunden
      } else if (visibleHours <= 48) {
        tickInterval = 4 * 60 * 60 * 1000; // 4 Stunden
      } else if (visibleHours <= 96) {
        tickInterval = 6 * 60 * 60 * 1000; // 6 Stunden
      } else {
        tickInterval = 12 * 60 * 60 * 1000; // 12 Stunden
      }
    } else if (effectiveSequence === 'weeks') {
      // WOCHEN-MODUS: Ticks in Wochen-Einheiten
      if (visibleWeeks <= 4) {
        tickInterval = 7 * 24 * 60 * 60 * 1000; // 1 Woche
      } else if (visibleWeeks <= 8) {
        tickInterval = 14 * 24 * 60 * 60 * 1000; // 2 Wochen
      } else if (visibleWeeks <= 16) {
        tickInterval = 28 * 24 * 60 * 60 * 1000; // 4 Wochen
      } else {
        tickInterval = 56 * 24 * 60 * 60 * 1000; // 8 Wochen
      }
    } else if (effectiveSequence === 'months') {
      // MONATS-MODUS: Ticks in Monats-Einheiten (ca. 30 Tage)
      const visibleMonths = visibleDays / 30;
      if (visibleMonths <= 3) {
        tickInterval = 30 * 24 * 60 * 60 * 1000; // 1 Monat
      } else if (visibleMonths <= 6) {
        tickInterval = 60 * 24 * 60 * 60 * 1000; // 2 Monate
      } else if (visibleMonths <= 12) {
        tickInterval = 90 * 24 * 60 * 60 * 1000; // 3 Monate
      } else {
        tickInterval = 180 * 24 * 60 * 60 * 1000; // 6 Monate
      }
    } else {
      // TAGES-MODUS (default): Ticks in Tages-Einheiten (funktioniert bereits gut)
      if (visibleDays <= 7) {
        tickInterval = 24 * 60 * 60 * 1000; // 1 Tag
      } else if (visibleDays <= 14) {
        tickInterval = 2 * 24 * 60 * 60 * 1000; // 2 Tage
      } else if (visibleDays <= 30) {
        tickInterval = 3 * 24 * 60 * 60 * 1000; // 3 Tage
      } else if (visibleDays <= 60) {
        tickInterval = 7 * 24 * 60 * 60 * 1000; // 1 Woche
      } else {
        tickInterval = 14 * 24 * 60 * 60 * 1000; // 2 Wochen
      }
    }
    
    // FESTE BOUNDARY-TICKS: Start- und Enddatum IMMER sichtbar
    const ticks: number[] = [];
    
    // 1. IMMER mit startTime beginnen (feste Grenze)
    ticks.push(startTime);
    
    // 2. Adaptive Zwischen-Ticks generieren (Rundung basierend auf effectiveSequence)
    const startDate = new Date(startTime);
    
    if (effectiveSequence === 'hours' && tickInterval < 24 * 60 * 60 * 1000) {
      // STUNDEN: Runde auf nächste volle Stunde
      startDate.setMinutes(0, 0, 0);
      if (startDate.getTime() <= startTime) {
        startDate.setTime(startDate.getTime() + 60 * 60 * 1000);
      }
    } else if (effectiveSequence === 'weeks') {
      // WOCHEN: Runde auf nächsten Montag 00:00
      startDate.setHours(0, 0, 0, 0);
      const dayOfWeek = startDate.getDay();
      const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7;
      if (daysUntilMonday === 0 && startDate.getTime() <= startTime) {
        startDate.setTime(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      } else {
        startDate.setTime(startDate.getTime() + daysUntilMonday * 24 * 60 * 60 * 1000);
      }
    } else if (effectiveSequence === 'months') {
      // MONATE: Runde auf 1. des nächsten Monats
      startDate.setHours(0, 0, 0, 0);
      startDate.setDate(1);
      startDate.setMonth(startDate.getMonth() + 1);
    } else {
      // TAGE (default): Runde auf nächste Mitternacht
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
  }, [chartData, appliedChartSettings?.sequence, chartZoomX, chartPanX, analyzeModeBounds, isMultiSelectCompareMode, compareChartData, isMultiBotChartMode, multiBotChartData]);

  // Prüfe ob Ticks am selben Tag liegen → dann Uhrzeiten anzeigen
  // REGEL: Sobald ein Datum auf der X-Achse WIEDERHOLT wird, müssen Uhrzeiten erscheinen!
  const analyzeTicksHaveDuplicateDays = useMemo(() => {
    if (!analyzeModeBounds || xAxisTicks.length < 2) return false;
    
    // Gruppiere Ticks nach Datum (YYYY-MM-DD)
    const dateGroups = new Map<string, number>();
    xAxisTicks.forEach(ts => {
      const date = new Date(ts);
      const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      dateGroups.set(dateKey, (dateGroups.get(dateKey) || 0) + 1);
    });
    
    // Prüfe ob irgendein Tag mehr als 1x vorkommt
    let hasDuplicates = false;
    dateGroups.forEach(count => {
      if (count > 1) hasDuplicates = true;
    });
    return hasDuplicates;
  }, [analyzeModeBounds, xAxisTicks]);

  // Berechne Y-Achsen-Domain dynamisch basierend auf aktiven Metriken + Zoom/Pan
  // WICHTIG: Padding hinzufügen damit Punkte am Rand nicht abgeschnitten werden
  const yAxisDomain = useMemo((): [number | string, number | string] => {
    // ANALYZE SINGLE METRIC MODE hat PRIORITÄT
    // Berechne Y-Domain aus ALLEN aktiven Metrik-Schlüsseln (Multi-Metrik-Unterstützung)
    if (isAnalyzeSingleMetricMode && analyzeSingleMetricInfo && analyzeModeBounds && compareChartData.data.length > 0) {
      const { startTs, endTs } = analyzeModeBounds;
      const botTypeName = analyzeSingleMetricInfo.botTypeName;
      
      const allValues: number[] = [];
      compareChartData.data.forEach(point => {
        // Nur Punkte im Zeitraum des Updates und vom richtigen Bot-Type
        if (point.timestamp >= startTs && point.timestamp <= endTs && point.botTypeName === botTypeName) {
          // WICHTIG: Sammle Werte von ALLEN aktiven Metrik-Schlüsseln (Multi-Metrik!)
          activeMetricCards.forEach(metricName => {
            const safeKey = metricToSafeKey[metricName];
            if (safeKey) {
              const val = point[safeKey];
              if (typeof val === 'number' && !isNaN(val)) {
                allValues.push(val);
              }
            }
          });
        }
      });
      
      if (allValues.length === 0) return ['auto', 'auto'];
      
      const minVal = Math.min(...allValues);
      const maxVal = Math.max(...allValues);
      const dataRange = maxVal - minVal;
      // Mehr Padding für bessere Sichtbarkeit (25%)
      const padding = dataRange > 0 ? dataRange * 0.25 : Math.abs(maxVal) * 0.25 || 100;
      
      const baseLower = minVal - padding;
      const baseUpper = maxVal + padding;
      const baseRange = baseUpper - baseLower;
      
      // Bei Zoom 1 und Pan 0: Zeige den vollen Bereich
      if (chartZoomY === 1 && chartPanY === 0) {
        return [baseLower, baseUpper];
      }
      
      // Zoom & Pan anwenden (gleiche Logik wie Compare Mode)
      const zoomedRange = baseRange / chartZoomY;
      const center = (baseLower + baseUpper) / 2;
      
      // Pan-Offset (gleiche Skalierung wie Compare Mode)
      const panOffset = (chartPanY / 300) * baseRange;
      
      let zoomedLower = center - zoomedRange / 2 + panOffset;
      let zoomedUpper = center + zoomedRange / 2 + panOffset;
      
      // Extra Padding unten beim Zoomen (10% der sichtbaren Range)
      const zoomPadding = zoomedRange * 0.1;
      zoomedLower = zoomedLower - zoomPadding;
      
      return [zoomedLower, zoomedUpper];
    }
    
    // COMPARE MODUS: Berechne Y-Domain aus compareChartData
    // WICHTIG: Zoom und Pan auch hier anwenden!
    if (isMultiSelectCompareMode && compareChartData.data.length > 0) {
      const allValues: number[] = [];
      compareChartData.botTypeNames.forEach(botTypeName => {
        compareChartData.data.forEach(point => {
          const val = point[botTypeName];
          if (typeof val === 'number' && !isNaN(val)) {
            allValues.push(val);
          }
        });
      });
      
      if (allValues.length === 0) return ['auto', 'auto'];
      
      const minVal = Math.min(...allValues);
      const maxVal = Math.max(...allValues);
      const dataRange = maxVal - minVal;
      const padding = dataRange > 0 ? dataRange * 0.2 : Math.abs(maxVal) * 0.2 || 10;
      
      const baseLower = minVal - padding;
      const baseUpper = maxVal + padding;
      const baseRange = baseUpper - baseLower;
      
      // Bei Zoom 1 und Pan 0: Zeige den vollen Bereich
      if (chartZoomY === 1 && chartPanY === 0) {
        return [baseLower, baseUpper];
      }
      
      // Zoom & Pan anwenden (gleiche Logik wie MainChart)
      const zoomedRange = baseRange / chartZoomY;
      const center = (baseLower + baseUpper) / 2;
      
      // Pan-Offset (gleiche Skalierung wie MainChart)
      const panOffset = (chartPanY / 300) * baseRange;
      
      let zoomedLower = center - zoomedRange / 2 + panOffset;
      let zoomedUpper = center + zoomedRange / 2 + panOffset;
      
      // Extra Padding unten beim Zoomen (10% der sichtbaren Range)
      const zoomPadding = zoomedRange * 0.1;
      zoomedLower = zoomedLower - zoomPadding;
      
      return [zoomedLower, zoomedUpper];
    }
    
    // ADDED MODUS: Berechne Y-Domain aus multiBotChartData (alle aktiven Metriken)
    // WICHTIG: Gleiche Logik wie MainChart mit ausreichend Padding oben UND unten
    if (isMultiBotChartMode && multiBotChartData.data.length > 0) {
      const allValues: number[] = [];
      // Sammle Werte von ALLEN aktiven Metriken (multi-metric support)
      // WICHTIG: Auch _dot_Gesamt_* Werte berücksichtigen für korrekte Y-Domain bei End-Events
      activeMetricCards.forEach(metricName => {
        const dataKey = `Gesamt_${metricName}`;
        const dotDataKey = `_dot_Gesamt_${metricName}`;
        multiBotChartData.data.forEach((point: any) => {
          const val = point[dataKey];
          if (typeof val === 'number' && !isNaN(val)) {
            allValues.push(val);
          }
          // Auch den höheren Dot-Wert berücksichtigen
          const dotVal = point[dotDataKey];
          if (typeof dotVal === 'number' && !isNaN(dotVal)) {
            allValues.push(dotVal);
          }
        });
      });
      
      if (allValues.length === 0) return ['auto', 'auto'];
      
      const minVal = Math.min(...allValues);
      const maxVal = Math.max(...allValues);
      
      let baseLower: number;
      let baseUpper: number;
      
      // Berechne Basis-Domain mit ausreichend Padding (15% auf jeder Seite für mehr Puffer)
      // GLEICHE LOGIK WIE MAINCHART für konsistente Darstellung
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
        // GLEICHE LOGIK WIE MAINCHART
        const bottomPadding = Math.max(padding, minBottomPadding);
        baseLower = Math.max(-bottomPadding * 0.5, minVal - bottomPadding);
        baseUpper = maxVal + padding;
      } else {
        // Profit-Metriken ohne negative Werte: bei 0 oder leicht darunter starten
        // GLEICHE LOGIK WIE MAINCHART
        const bottomPadding = Math.max(padding, minBottomPadding);
        baseLower = -bottomPadding * 0.5;
        baseUpper = maxVal + padding;
      }
      
      const baseRange = baseUpper - baseLower;
      
      // Bei Zoom 1 und Pan 0: Zeige den vollen Bereich
      if (chartZoomY === 1 && chartPanY === 0) {
        return [baseLower, baseUpper];
      }
      
      // Zoom & Pan anwenden (gleiche Logik wie MainChart)
      const zoomedRange = baseRange / chartZoomY;
      const center = (baseLower + baseUpper) / 2;
      
      // Pan-Offset (gleiche Skalierung wie MainChart)
      const panOffset = (chartPanY / 300) * baseRange;
      
      let zoomedLower = center - zoomedRange / 2 + panOffset;
      let zoomedUpper = center + zoomedRange / 2 + panOffset;
      
      // Extra Padding unten beim Zoomen (10% der sichtbaren Range)
      const zoomPadding = zoomedRange * 0.1;
      zoomedLower = zoomedLower - zoomPadding;
      
      return [zoomedLower, zoomedUpper];
    }
    
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
  }, [transformedChartData, activeMetricCards, hasGesamtkapitalActive, chartZoomY, chartPanY, isMultiSelectCompareMode, compareChartData, isMultiBotChartMode, multiBotChartData, isAnalyzeSingleMetricMode, analyzeSingleMetricInfo, analyzeModeBounds]);

  // Berechne X-Achsen-Domain (Zeit) basierend auf Zoom & Pan
  // WICHTIG: Padding hinzufügen damit Punkte am Rand nicht abgeschnitten werden
  // Bei analyzeMode: Nur den Zeitraum des ausgewählten Updates zeigen
  const xAxisDomain = useMemo((): [number | string, number | string] => {
    // ANALYSIEREN-MODUS hat PRIORITÄT - auch im Compare-Modus!
    // Nur das ausgewählte Update anzeigen - MIT Zoom & Pan Unterstützung!
    if (analyzeModeBounds) {
      const { startTs, endTs } = analyzeModeBounds;
      // CLOSED BOTS: startTs = endTs, also range = 0
      // In diesem Fall: Zeige den Punkt in der Mitte mit angemessener Padding
      const rawRange = endTs - startTs;
      
      // Wenn range = 0 (Closed Bot), verwende 1 Tag als Mindest-Range
      // damit der Punkt in der Mitte erscheint
      const range = rawRange > 0 ? rawRange : 24 * 60 * 60 * 1000;
      const padding = range * 0.05;
      
      // Wenn es ein Closed Bot ist (rawRange = 0), zentriere den Punkt
      const center = rawRange > 0 ? (startTs + endTs) / 2 : startTs;
      const baseMin = center - range / 2 - padding;
      const baseMax = center + range / 2 + padding;
      const baseRange = baseMax - baseMin;
      
      // Bei Zoom 1 und Pan 0: Zeige den vollen Bereich mit Padding
      if (chartZoomX === 1 && chartPanX === 0) {
        return [baseMin, baseMax];
      }
      
      // Zoom anwenden (zoomedRange = kleinerer Bereich bei höherem Zoom)
      const zoomedRange = baseRange / chartZoomX;
      const zoomCenter = (baseMin + baseMax) / 2;
      
      // Pan-Offset: chartPanX in Pixel, umrechnen auf Zeit-Einheiten
      const chartWidth = 600;
      const panOffset = -(chartPanX / chartWidth) * baseRange;
      
      const zoomedStart = zoomCenter - zoomedRange / 2 + panOffset;
      const zoomedEnd = zoomCenter + zoomedRange / 2 + panOffset;
      
      return [zoomedStart, zoomedEnd];
    }
    
    // COMPARE MODUS: Nutze frühestes und spätestes Datum aller ausgewählten Bot-Types
    // WICHTIG: Zoom und Pan auch hier anwenden!
    if (isMultiSelectCompareMode && compareChartData.minTimestamp > 0 && compareChartData.maxTimestamp > 0) {
      const range = compareChartData.maxTimestamp - compareChartData.minTimestamp;
      const padding = range > 0 ? range * 0.05 : 24 * 60 * 60 * 1000; // 5% oder 1 Tag
      
      const baseMin = compareChartData.minTimestamp - padding;
      const baseMax = compareChartData.maxTimestamp + padding;
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
    }
    
    // ADDED MODUS: Nutze frühestes und spätestes Datum aller ausgewählten Bot-Types (analog zu Compare)
    if (isMultiBotChartMode && multiBotChartData.minTimestamp > 0 && multiBotChartData.maxTimestamp > 0) {
      const range = multiBotChartData.maxTimestamp - multiBotChartData.minTimestamp;
      const padding = range > 0 ? range * 0.05 : 24 * 60 * 60 * 1000; // 5% oder 1 Tag
      
      const baseMin = multiBotChartData.minTimestamp - padding;
      const baseMax = multiBotChartData.maxTimestamp + padding;
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
  }, [transformedChartData, chartZoomX, chartPanX, analyzeModeBounds, isMultiSelectCompareMode, compareChartData, isMultiBotChartMode, multiBotChartData]);

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
  // GESAMT MODUS: ALLE Updates zusammen gewichten (wie ein großer Bot-Type)
  // EINZELNER BOT-TYPE: Zeitgewichtete Berechnung pro Bot-Type
  const totalInvestment = useMemo(() => {
    // Verwende timeFilteredBotTypeUpdates statt allBotTypeUpdates für Zeitraum-Filterung
    if (selectedBotName === "Gesamt") {
      // Prüfe ob alle benötigten Daten vorhanden sind
      if (!availableBotTypes || timeFilteredBotTypeUpdates.length === 0) {
        // Falls Daten fehlen, nutze Entries als Fallback
        return filteredEntriesForStats.reduce((sum, entry) => sum + parseFloat(entry.investment), 0);
      }
      
      // KORREKTE BERECHNUNG: ALLE Updates zusammen als "ein großer Bot-Type"
      // Nicht pro Bot-Type addieren, sondern alle zusammen gewichten
      const activeBotTypeIds = availableBotTypes.filter(bt => bt.isActive).map(bt => bt.id);
      
      // ALLE Update Metrics von ALLEN aktiven Bot-Types zusammen
      const allUpdateMetrics = timeFilteredBotTypeUpdates.filter(
        update => activeBotTypeIds.includes(update.botTypeId) && update.status === "Update Metrics"
      );
      
      if (allUpdateMetrics.length === 0) {
        return 0;
      }
      
      // EINE zeitgewichtete Berechnung über ALLE Updates
      // Runtime = durchschnittliche Laufzeit (avgRuntime) - gleich wie Bot-Type-Seite
      let sumInvestmentTimesRuntime = 0;
      let sumRuntime = 0;
      
      allUpdateMetrics.forEach(update => {
        const investment = parseFloat(update.totalInvestment || '0') || 0;
        const runtimeMs = parseRuntimeToHours(update.avgRuntime) * 60 * 60 * 1000;
        
        if (runtimeMs > 0) {
          sumInvestmentTimesRuntime += investment * runtimeMs;
          sumRuntime += runtimeMs;
        }
      });
      
      return sumRuntime > 0 ? sumInvestmentTimesRuntime / sumRuntime : 0;
    } else {
      // Für spezifischen Bot-Type: Zeitgewichtete Berechnung
      if (!selectedBotTypeData || timeFilteredBotTypeUpdates.length === 0) {
        return filteredEntriesForStats.reduce((sum, entry) => sum + parseFloat(entry.investment), 0);
      }
      
      // Nur Updates mit Status "Update Metrics" für diesen Bot-Type
      const updateMetricsOnly = timeFilteredBotTypeUpdates.filter(
        update => update.botTypeId === selectedBotTypeData.id && update.status === "Update Metrics"
      );
      
      if (updateMetricsOnly.length > 0) {
        // ZEITGEWICHTETE Berechnung mit avgRuntime
        let sumInvestmentTimesRuntime = 0;
        let sumRuntime = 0;
        
        updateMetricsOnly.forEach(update => {
          const investment = parseFloat(update.totalInvestment || '0') || 0;
          const runtimeMs = parseRuntimeToHours(update.avgRuntime) * 60 * 60 * 1000;
          
          if (runtimeMs > 0) {
            sumInvestmentTimesRuntime += investment * runtimeMs;
            sumRuntime += runtimeMs;
          }
        });
        
        if (sumRuntime > 0) {
          return sumInvestmentTimesRuntime / sumRuntime;
        }
      }
      
      return 0;
    }
  }, [selectedBotName, availableBotTypes, timeFilteredBotTypeUpdates, filteredEntriesForStats, selectedBotTypeData]);
  
  // Berechne totalBaseInvestment (Investitionsmenge-Ø) - ZEITGEWICHTETE BERECHNUNG
  // GESAMT MODUS: ALLE Updates zusammen gewichten (wie ein großer Bot-Type)
  // EINZELNER BOT-TYPE: Zeitgewichtete Berechnung pro Bot-Type
  const totalBaseInvestment = useMemo(() => {
    // Verwende timeFilteredBotTypeUpdates für Zeitraum-Filterung
    if (selectedBotName === "Gesamt") {
      if (!availableBotTypes || timeFilteredBotTypeUpdates.length === 0) {
        return 0;
      }
      
      // KORREKTE BERECHNUNG: ALLE Updates zusammen als "ein großer Bot-Type"
      const activeBotTypeIds = availableBotTypes.filter(bt => bt.isActive).map(bt => bt.id);
      
      // ALLE Update Metrics von ALLEN aktiven Bot-Types zusammen
      const allUpdateMetrics = timeFilteredBotTypeUpdates.filter(
        update => activeBotTypeIds.includes(update.botTypeId) && update.status === "Update Metrics"
      );
      
      if (allUpdateMetrics.length === 0) {
        return 0;
      }
      
      // EINE zeitgewichtete Berechnung über ALLE Updates
      // Runtime = durchschnittliche Laufzeit (avgRuntime) - gleich wie Bot-Type-Seite
      let sumInvestmentTimesRuntime = 0;
      let sumRuntime = 0;
      
      allUpdateMetrics.forEach(update => {
        const investment = parseFloat(update.investment || '0') || 0;
        const runtimeMs = parseRuntimeToHours(update.avgRuntime) * 60 * 60 * 1000;
        
        if (runtimeMs > 0) {
          sumInvestmentTimesRuntime += investment * runtimeMs;
          sumRuntime += runtimeMs;
        }
      });
      
      return sumRuntime > 0 ? sumInvestmentTimesRuntime / sumRuntime : 0;
    } else {
      if (!selectedBotTypeData || timeFilteredBotTypeUpdates.length === 0) {
        return 0;
      }
      
      // Nur Updates mit Status "Update Metrics" für diesen Bot-Type
      const updateMetricsOnly = timeFilteredBotTypeUpdates.filter(
        update => update.botTypeId === selectedBotTypeData.id && update.status === "Update Metrics"
      );
      
      if (updateMetricsOnly.length > 0) {
        // ZEITGEWICHTETE Berechnung mit avgRuntime
        let sumInvestmentTimesRuntime = 0;
        let sumRuntime = 0;
        
        updateMetricsOnly.forEach(update => {
          const investment = parseFloat(update.investment || '0') || 0;
          const runtimeMs = parseRuntimeToHours(update.avgRuntime) * 60 * 60 * 1000;
          
          if (runtimeMs > 0) {
            sumInvestmentTimesRuntime += investment * runtimeMs;
            sumRuntime += runtimeMs;
          }
        });
        
        if (sumRuntime > 0) {
          return sumInvestmentTimesRuntime / sumRuntime;
        }
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

  // Ø Profit/Tag: Pro Bot-Type berechnen wie auf Bot-Type-Seite, dann ADDIEREN
  // Formel pro Bot-Type: totalProfit / totalHours * 24
  // Die Bot-Type-Durchschnitte werden addiert, weil Bots gleichzeitig laufen
  const avgDailyProfit = useMemo(() => {
    // Verwende timeFilteredBotTypeUpdates für Zeitraum-Filterung
    if (selectedBotName === "Gesamt") {
      if (!availableBotTypes || timeFilteredBotTypeUpdates.length === 0) {
        return 0;
      }
      
      const activeBotTypes = availableBotTypes.filter(bt => bt.isActive);
      
      // Pro Bot-Type berechnen wie auf Bot-Type-Seite, dann addieren
      let totalAvgProfitDay = 0;
      
      activeBotTypes.forEach(botType => {
        const updateMetricsOnly = timeFilteredBotTypeUpdates.filter(
          update => update.botTypeId === botType.id && update.status === 'Update Metrics'
        );
        
        if (updateMetricsOnly.length > 0) {
          // WIE AUF BOT-TYPE-SEITE: totalProfit / totalHours * 24
          let totalProfit = 0;
          let totalHours = 0;
          
          updateMetricsOnly.forEach(update => {
            const gridProfit = parseFloat(update.overallGridProfitUsdt || '0') || 0;
            const runtimeHours = parseRuntimeToHours(update.avgRuntime);
            totalProfit += gridProfit;
            totalHours += runtimeHours;
          });
          
          if (totalHours > 0) {
            const avg24hProfit = (totalProfit / totalHours) * 24;
            totalAvgProfitDay += avg24hProfit;
          }
        }
      });
      
      return totalAvgProfitDay;
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

  // ANALYZE SINGLE METRIC MODE: Extrahiere Werte aus dem ausgewählten Update
  // Diese Werte überschreiben die aggregierten Content Card Werte
  const analyzeSingleMetricValues = useMemo(() => {
    if (!isAnalyzeSingleMetricMode || !analyzeSingleMetricInfo || !allBotTypeUpdates) {
      return null;
    }
    
    const { botTypeId, isClosedBot, version } = analyzeSingleMetricInfo;
    
    // Finde das spezifische Update
    const update = allBotTypeUpdates.find((u: BotTypeUpdate) => 
      String(u.botTypeId) === botTypeId && 
      u.version === version && 
      (isClosedBot ? u.status === 'Closed Bots' : u.status === 'Update Metrics')
    );
    
    if (!update) {
      return null;
    }
    
    // Extrahiere die relevanten Werte aus dem Update
    const investment = parseFloat(update.totalInvestment || update.investment || '0') || 0;
    const baseInvestment = parseFloat(update.investment || '0') || 0;
    
    // Profit: Je nach Status unterschiedliche Felder
    const profit = isClosedBot 
      ? parseFloat(update.profit || '0') || 0
      : parseFloat(update.overallGridProfitUsdt || '0') || 0;
    
    // Profit %: Berechne basierend auf profitPercentBase Auswahl
    // - 'gesamtinvestment': Verwende totalInvestment (investment)
    // - 'investitionsmenge': Verwende baseInvestment
    const profitBase = profitPercentBase === 'investitionsmenge' ? baseInvestment : investment;
    const profitPercent = profitBase > 0 ? (profit / profitBase) * 100 : 0;
    
    // Ø Profit/Tag: avgGridProfitDay (korrekter Feldname!)
    const avgDaily = parseFloat(update.avgGridProfitDay || '0') || 0;
    
    // Real Profit/Tag: Berechnung basierend auf Runtime
    // Wenn Runtime < 24h: Grid Profit gesamt, sonst avgGridProfitDay
    const runtimeStr = update.avgRuntime || '';
    const runtimeHours = parseRuntimeToHours(runtimeStr);
    const realDaily = runtimeHours < 24 ? profit : avgDaily;
    
    return {
      investment,
      baseInvestment,
      profit,
      profitPercent,
      avgDailyProfit: avgDaily,
      realDailyProfit: realDaily,
      updateName: update.name || `Update ${version}`,
      botTypeName: analyzeSingleMetricInfo.botTypeName
    };
  }, [isAnalyzeSingleMetricMode, analyzeSingleMetricInfo, allBotTypeUpdates, profitPercentBase]);

  // COMPARE MODE: Berechne höchste Werte aller Bot-Types im Chart-Zeitraum
  // Diese Werte werden in den Content Cards angezeigt
  // WICHTIG: Verwendet dieselbe Zeitfilter-Logik wie compareChartData!
  const compareHighestValues = useMemo(() => {
    if (!isMultiSelectCompareMode || !allBotTypeUpdates || selectedChartBotTypes.length === 0) {
      return null;
    }
    
    // Hole alle Updates der ausgewählten Bot-Types
    let filteredUpdates = allBotTypeUpdates.filter((update: BotTypeUpdate) => 
      selectedChartBotTypes.includes(String(update.botTypeId))
    );
    
    if (filteredUpdates.length === 0) return null;
    
    // ========== ZEITFILTER AUS GRAPH-EINSTELLUNGEN (wie compareChartData) ==========
    if (appliedChartSettings && appliedChartSettings.timeRange !== 'First-Last Update') {
      // Priorität 1: Custom mit Kalender-Auswahl
      if (appliedChartSettings.timeRange === 'Custom' && appliedChartSettings.customFromDate && appliedChartSettings.customToDate) {
        const fromTs = appliedChartSettings.customFromDate.getTime();
        const toDate = new Date(appliedChartSettings.customToDate);
        toDate.setHours(23, 59, 59, 999);
        const untilTs = toDate.getTime();
        
        filteredUpdates = filteredUpdates.filter((update: BotTypeUpdate) => {
          const ts = getUpdateTimestamp(update);
          return ts >= fromTs && ts <= untilTs;
        });
      }
      // Priorität 2: "Letzten"-Zeitraum Filter (1h, 24h, 7 Days, 30 Days, Custom mit D/H/M)
      else {
        const rangeMs = parseTimeRangeToMs(
          appliedChartSettings.timeRange,
          appliedChartSettings.customDays,
          appliedChartSettings.customHours,
          appliedChartSettings.customMinutes
        );
        
        if (rangeMs !== null && rangeMs > 0) {
          const now = Date.now();
          const cutoffTimestamp = now - rangeMs;
          
          filteredUpdates = filteredUpdates.filter((update: BotTypeUpdate) => {
            const ts = getUpdateTimestamp(update);
            return ts >= cutoffTimestamp;
          });
        }
      }
    }
    // ========== ENDE ZEITFILTER ==========
    
    if (filteredUpdates.length === 0) {
      // Fallback: Alle ausgewählten Updates verwenden
      return calculateHighestFromUpdates(
        allBotTypeUpdates.filter((u: BotTypeUpdate) => selectedChartBotTypes.includes(String(u.botTypeId))),
        profitPercentBase
      );
    }
    
    return calculateHighestFromUpdates(filteredUpdates, profitPercentBase);
  }, [isMultiSelectCompareMode, allBotTypeUpdates, selectedChartBotTypes, appliedChartSettings, profitPercentBase]);
  
  // Helper-Funktion: Berechne höchste Werte aus einer Liste von Updates
  // Trackt auch welches Update (updateKey) den höchsten Wert für jede Metrik hat
  // WICHTIG: Verwendet -Infinity als Startwert um auch negative Werte korrekt zu erfassen!
  function calculateHighestFromUpdates(updates: BotTypeUpdate[], percentBase: string) {
    // Starte mit -Infinity um auch negative Werte zu erfassen
    let highestInvestment = -Infinity;
    let highestBaseInvestment = -Infinity;
    let highestProfit = -Infinity;
    let highestProfitPercent = -Infinity;
    let highestAvgDaily = -Infinity;
    let highestRealDaily = -Infinity;
    let winnerBotType = '';
    
    // Track updateKeys für jede Metrik
    let investmentUpdateKey = '';
    let baseInvestmentUpdateKey = '';
    let profitUpdateKey = '';
    let profitPercentUpdateKey = '';
    let avgDailyUpdateKey = '';
    let realDailyUpdateKey = '';
    
    // Wenn keine Updates, gib 0 zurück
    if (updates.length === 0) {
      return {
        investment: 0,
        baseInvestment: 0,
        profit: 0,
        profitPercent: 0,
        avgDailyProfit: 0,
        realDailyProfit: 0,
        winnerBotType: '',
        updateKeys: {
          investment: '',
          baseInvestment: '',
          profit: '',
          profitPercent: '',
          avgDailyProfit: '',
          realDailyProfit: ''
        }
      };
    }
    
    updates.forEach((update: BotTypeUpdate) => {
      const investment = parseFloat(update.totalInvestment || update.investment || '0') || 0;
      const baseInvestment = parseFloat(update.investment || '0') || 0;
      
      // Profit: Je nach Status
      const isClosedBot = update.status === 'Closed Bots';
      const profit = isClosedBot 
        ? parseFloat(update.profit || '0') || 0
        : parseFloat(update.overallGridProfitUsdt || '0') || 0;
      
      // Profit %: Basierend auf gewähltem Investment-Typ
      const relevantInvestment = percentBase === 'gesamtinvestment' ? investment : baseInvestment;
      const profitPercent = relevantInvestment > 0 ? (profit / relevantInvestment) * 100 : 0;
      
      // Ø Profit/Tag
      const avgDaily = parseFloat(update.avgGridProfitDay || '0') || 0;
      
      // Real Profit/Tag
      const runtimeStr = update.avgRuntime || '';
      const runtimeHours = parseRuntimeToHours(runtimeStr);
      const realDaily = runtimeHours < 24 ? profit : avgDaily;
      
      // Generiere updateKey: {botTypeId}:{u|c}-{version}
      const version = update.version || 1;
      const keyPrefix = isClosedBot ? 'c' : 'u';
      const updateKey = `${update.botTypeId}:${keyPrefix}-${version}`;
      
      // Aktualisiere höchste Werte UND tracke updateKeys
      // Vergleich mit > funktioniert jetzt auch für negative Werte weil Startwert -Infinity ist
      if (investment > highestInvestment) {
        highestInvestment = investment;
        investmentUpdateKey = updateKey;
      }
      if (baseInvestment > highestBaseInvestment) {
        highestBaseInvestment = baseInvestment;
        baseInvestmentUpdateKey = updateKey;
      }
      if (profit > highestProfit) {
        highestProfit = profit;
        profitUpdateKey = updateKey;
        winnerBotType = String(update.botTypeId);
      }
      if (profitPercent > highestProfitPercent) {
        highestProfitPercent = profitPercent;
        profitPercentUpdateKey = updateKey;
      }
      if (avgDaily > highestAvgDaily) {
        highestAvgDaily = avgDaily;
        avgDailyUpdateKey = updateKey;
      }
      if (realDaily > highestRealDaily) {
        highestRealDaily = realDaily;
        realDailyUpdateKey = updateKey;
      }
    });
    
    // Falls noch -Infinity (sollte nicht passieren bei Updates > 0), setze auf 0
    return {
      investment: highestInvestment === -Infinity ? 0 : highestInvestment,
      baseInvestment: highestBaseInvestment === -Infinity ? 0 : highestBaseInvestment,
      profit: highestProfit === -Infinity ? 0 : highestProfit,
      profitPercent: highestProfitPercent === -Infinity ? 0 : highestProfitPercent,
      avgDailyProfit: highestAvgDaily === -Infinity ? 0 : highestAvgDaily,
      realDailyProfit: highestRealDaily === -Infinity ? 0 : highestRealDaily,
      winnerBotType,
      // UpdateKeys für jede Metrik
      updateKeys: {
        investment: investmentUpdateKey,
        baseInvestment: baseInvestmentUpdateKey,
        profit: profitUpdateKey,
        profitPercent: profitPercentUpdateKey,
        avgDailyProfit: avgDailyUpdateKey,
        realDailyProfit: realDailyUpdateKey
      }
    };
  }

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
    // ANALYZE SINGLE METRIC MODE: Multi-Select erlaubt!
    // ADDED MODE (isMultiBotChartMode): Multi-Select erlaubt!
    // Im Compare-Mode ohne Analyze: Nur EINE Metrik-Card erlauben
    // Single-Bot Mode: Multi-Select erlaubt
    const allowMultiSelect = isAnalyzeSingleMetricMode || selectedChartBotTypes.length <= 1 || isMultiBotChartMode;
    
    if (allowMultiSelect) {
      // Multi-Select erlaubt: Normales Toggle-Verhalten
      if (activeMetricCards.includes(cardName)) {
        // Mindestens eine Metrik muss aktiv bleiben
        if (activeMetricCards.length > 1) {
          setActiveMetricCards(prev => prev.filter(name => name !== cardName));
        }
      } else {
        setActiveMetricCards(prev => [...prev, cardName]);
      }
    } else {
      // Multi-Bot-Mode (Compare) ohne Analyze: Nur EINE Metrik-Card erlauben
      const newMetrics = activeMetricCards.includes(cardName) && activeMetricCards.length === 1
        ? [] 
        : [cardName];
      setActiveMetricCards(newMetrics);
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
          
          {/* Suchleiste + Stift-Button - im Analyze-Status ausgegraut */}
          <div className={cn("flex items-center gap-2", analyzeMode && "opacity-50 pointer-events-none")}>
            <Popover open={open} onOpenChange={(o) => !analyzeMode && setOpen(o)}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="w-[300px] justify-between"
                  disabled={analyzeMode}
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
                // ANALYZE SINGLE METRIC MODE: Verwende Werte aus der einzelnen Metrik
                // COMPARE MODE: Zeige höchste Werte aller Bot-Types im Chart-Zeitraum
                // Sonst: Verwende aggregierte Werte
                const getCardValue = (cardId: string): string => {
                  // ANALYZE SINGLE METRIC MODE hat PRIORITÄT
                  // Zeige nur Werte der ausgewählten einzelnen Metrik
                  if (isAnalyzeSingleMetricMode && analyzeSingleMetricValues) {
                    // Werte aus der einzelnen ausgewählten Metrik
                    switch (cardId) {
                      case 'Gesamtkapital':
                        const analyzeInv = profitPercentBase === 'gesamtinvestment' 
                          ? analyzeSingleMetricValues.investment 
                          : analyzeSingleMetricValues.baseInvestment;
                        return `${analyzeInv.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`;
                      case 'Gesamtprofit':
                        return `${analyzeSingleMetricValues.profit.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`;
                      case 'Gesamtprofit %':
                        return `${analyzeSingleMetricValues.profitPercent.toFixed(2)}%`;
                      case 'Ø Profit/Tag':
                        return `${analyzeSingleMetricValues.avgDailyProfit.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`;
                      case 'Real Profit/Tag':
                        return `${analyzeSingleMetricValues.realDailyProfit.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`;
                      default:
                        return '--';
                    }
                  }
                  
                  // COMPARE MODE: Zeige höchste Werte aus dem Chart-Zeitraum
                  if (isMultiSelectCompareMode && compareHighestValues) {
                    switch (cardId) {
                      case 'Gesamtkapital':
                        const compInv = profitPercentBase === 'gesamtinvestment' 
                          ? compareHighestValues.investment 
                          : compareHighestValues.baseInvestment;
                        return `${compInv.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`;
                      case 'Gesamtprofit':
                        return `${compareHighestValues.profit.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`;
                      case 'Gesamtprofit %':
                        return `${compareHighestValues.profitPercent.toFixed(2)}%`;
                      case 'Ø Profit/Tag':
                        return `${compareHighestValues.avgDailyProfit.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`;
                      case 'Real Profit/Tag':
                        return `${compareHighestValues.realDailyProfit.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`;
                      default:
                        return '--';
                    }
                  }
                  
                  // ADDED MODE: Zeige aggregierte Werte aus den im Graph angezeigten Metriken
                  if (isMultiBotChartMode && addedModeAggregatedValues) {
                    switch (cardId) {
                      case 'Gesamtkapital':
                        return `${addedModeAggregatedValues.investment.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`;
                      case 'Gesamtprofit':
                        return `${addedModeAggregatedValues.profit.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`;
                      case 'Gesamtprofit %':
                        return `${addedModeAggregatedValues.profitPercent.toFixed(2)}%`;
                      case 'Ø Profit/Tag':
                        return `${addedModeAggregatedValues.avgDailyProfit.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`;
                      case 'Real Profit/Tag':
                        return `${addedModeAggregatedValues.realDailyProfit.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`;
                      default:
                        return '--';
                    }
                  }
                  
                  // Normale aggregierte Werte
                  switch (cardId) {
                    case 'Gesamtkapital':
                      return `${displayedInvestment.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`;
                    case 'Gesamtprofit':
                      return `${totalProfit.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`;
                    case 'Gesamtprofit %':
                      return `${totalProfitPercent.toFixed(2)}%`;
                    case 'Ø Profit/Tag':
                      return `${avgDailyProfit.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`;
                    case 'Real Profit/Tag':
                      return `${real24hProfit.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`;
                    default:
                      return '--';
                  }
                };
                
                const cardConfig: Record<string, { label: string; value: string; icon: any; iconColor: string }> = {
                  'Gesamtkapital': {
                    label: profitPercentBase === 'gesamtinvestment' ? 'Gesamtkapital' : 'Investitionsmenge',
                    value: getCardValue('Gesamtkapital'),
                    icon: Wallet,
                    iconColor: 'bg-blue-100 text-blue-600',
                  },
                  'Gesamtprofit': {
                    label: 'Gesamtprofit',
                    value: getCardValue('Gesamtprofit'),
                    icon: TrendingUp,
                    iconColor: 'bg-green-100 text-green-600',
                  },
                  'Gesamtprofit %': {
                    label: profitPercentBase === 'gesamtinvestment' ? 'Gesamtprofit % (GI)' : 'Gesamtprofit % (IM)',
                    value: getCardValue('Gesamtprofit %'),
                    icon: Percent,
                    iconColor: 'bg-purple-100 text-purple-600',
                  },
                  'Ø Profit/Tag': {
                    label: 'Ø Profit/Tag',
                    value: getCardValue('Ø Profit/Tag'),
                    icon: CalendarIcon,
                    iconColor: 'bg-orange-100 text-orange-600',
                  },
                  'Real Profit/Tag': {
                    label: 'Real Profit/Tag',
                    value: getCardValue('Real Profit/Tag'),
                    icon: Zap,
                    iconColor: 'bg-yellow-100 text-yellow-600',
                  },
                };
                
                const config = cardConfig[cardId];
                if (!config) return null;
                
                // Handler für Compare Mode Eye Blink
                const handleCompareEyeClick = (e: React.MouseEvent, cardId: string) => {
                  e.stopPropagation(); // Verhindert Card-Toggle
                  // Nur im Compare Mode (nicht im Analyze Mode) blinken
                  if (isMultiSelectCompareMode && !isAnalyzeSingleMetricMode && compareHighestValues?.updateKeys) {
                    // Finde den updateKey für die geklickte Metrik-Card
                    let updateKeyForCard = '';
                    switch (cardId) {
                      case 'Gesamtkapital':
                        updateKeyForCard = profitPercentBase === 'gesamtinvestment' 
                          ? compareHighestValues.updateKeys.investment 
                          : compareHighestValues.updateKeys.baseInvestment;
                        break;
                      case 'Gesamtprofit':
                        updateKeyForCard = compareHighestValues.updateKeys.profit;
                        break;
                      case 'Gesamtprofit %':
                        updateKeyForCard = compareHighestValues.updateKeys.profitPercent;
                        break;
                      case 'Ø Profit/Tag':
                        updateKeyForCard = compareHighestValues.updateKeys.avgDailyProfit;
                        break;
                      case 'Real Profit/Tag':
                        updateKeyForCard = compareHighestValues.updateKeys.realDailyProfit;
                        break;
                    }
                    
                    setCompareCardEyeBlinking(cardId);
                    setBlinkingUpdateKey(updateKeyForCard || null);
                    setCompareBlinkKey(prev => prev + 1);
                    // Nach Animation zurücksetzen (2.4s + etwas Puffer)
                    setTimeout(() => {
                      setCompareCardEyeBlinking(null);
                      setBlinkingUpdateKey(null);
                    }, 2600);
                  }
                };
                
                // Helper: Eye Icon für Compare Mode (nur auf aktiver Card, im Compare Mode, nicht im Analyze Mode)
                const renderEyeIcon = () => {
                  if (!isMultiSelectCompareMode || isAnalyzeSingleMetricMode || !activeMetricCards.includes(cardId) || isCardEditMode) {
                    return undefined;
                  }
                  return (
                    <div 
                      onClick={(e) => handleCompareEyeClick(e, cardId)}
                      data-testid={`button-compare-eye-${cardId.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                      className={`p-0.5 rounded-full cursor-pointer transition-all hover:bg-cyan-100 ${compareCardEyeBlinking === cardId ? 'bg-cyan-100' : ''}`}
                    >
                      <Eye className="h-3 w-3 text-cyan-600" />
                    </div>
                  );
                };
                
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
                        eyeIcon={renderEyeIcon()}
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
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-bold">Update Verlauf</h3>
                  {/* Toggle für Added-Mode: Analysis vs Overlay - deaktiviert im Analyze-Mode */}
                  {isMultiBotChartMode && (
                    <div className={`flex items-center bg-muted rounded-md p-0.5 ${analyzeMode ? 'opacity-50' : ''}`}>
                      <button
                        onClick={() => !analyzeMode && setAddedModeView('analysis')}
                        disabled={analyzeMode}
                        className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                          analyzeMode 
                            ? 'cursor-not-allowed text-muted-foreground'
                            : addedModeView === 'analysis'
                              ? 'bg-background text-foreground shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                        }`}
                        data-testid="toggle-analysis-mode"
                      >
                        Analysis
                      </button>
                      <button
                        onClick={() => !analyzeMode && setAddedModeView('overlay')}
                        disabled={analyzeMode}
                        className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                          analyzeMode 
                            ? 'cursor-not-allowed text-muted-foreground'
                            : addedModeView === 'overlay'
                              ? 'bg-background text-foreground shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                        }`}
                        data-testid="toggle-overlay-mode"
                      >
                        Overlay
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 ml-4">
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
                    
                    // Get updates - Compare/Added Mode: alle ausgewählten Bot-Types, sonst nur sortedUpdates
                    const updateRanges: { version: number; status: string; startTs: number; endTs: number; botTypeName?: string; botTypeId?: string }[] = [];
                    
                    // COMPARE/ADDED MODUS: Alle Updates von allen ausgewählten Bot-Types
                    let filteredUpdates: typeof sortedUpdates = [];
                    
                    // ANALYZE SINGLE METRIC MODE: NUR das ausgewählte Update anzeigen
                    if (isAnalyzeSingleMetricMode && analyzeSingleMetricInfo) {
                      // Finde NUR das eine ausgewählte Update
                      const { botTypeId, version, isClosedBot } = analyzeSingleMetricInfo;
                      const matchingUpdate = allBotTypeUpdates.find(u => 
                        String(u.botTypeId) === botTypeId && 
                        u.version === version &&
                        (isClosedBot ? u.status === 'Closed Bots' : u.status === 'Update Metrics')
                      );
                      if (matchingUpdate) {
                        filteredUpdates = [matchingUpdate];
                      }
                    } else if ((isMultiSelectCompareMode || isMultiBotChartMode) && selectedChartBotTypes.length > 0) {
                      // Sammle Updates von allen ausgewählten Bot-Types
                      selectedChartBotTypes.forEach(botTypeId => {
                        const updates = allBotTypeUpdates.filter(u => u.botTypeId === botTypeId);
                        filteredUpdates.push(...updates);
                      });
                    } else {
                      filteredUpdates = [...(sortedUpdates || [])];
                    }
                    
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
                          botTypeId: update.botTypeId ? String(update.botTypeId) : undefined,
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
                        // Im Compare/Added-Modus: BotTypeId in den Key aufnehmen für eindeutige Zuordnung
                        const closedKey = (isMultiSelectCompareMode || isMultiBotChartMode) && update.botTypeId 
                          ? `${update.botTypeId}:c-${update.version}` 
                          : `c-${update.version}`;
                        
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
                        // Farbe: Aktiv = neonblau, sonst grau ODER im Compare/Added-Modus die Bot-Type-Farbe
                        let closedStrokeColor: string;
                        if (isClosedActive) {
                          closedStrokeColor = "rgb(8, 145, 178)"; // Neonblau wenn aktiv/gehoverd
                        } else if ((isMultiSelectCompareMode || isMultiBotChartMode) && update.botTypeId) {
                          // Compare/Added-Modus: Verwende die Farbe des Bot-Types
                          closedStrokeColor = compareColorMap[update.botTypeId] || "hsl(var(--muted-foreground))";
                        } else {
                          closedStrokeColor = "hsl(var(--muted-foreground))"; // Grau als Default
                        }
                        
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
                          if (markerViewActive) {
                            fetch('/api/log-hover', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                event: 'Closed Bot marker hovered',
                                key: closedKey,
                                botTypeName: update.botTypeId ? availableBotTypes.find(bt => bt.id === update.botTypeId)?.name : null,
                                timestamp: update.endTs,
                                mode: isMultiSelectCompareMode ? 'COMPARE' : 'NORMAL',
                                direction: 'Marker → Chart'
                              })
                            }).catch(() => {});
                            setHoveredUpdateId(closedKey);
                          }
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
                          
                          // Im Compare-Modus: Verwende compareChartData und Bot-Type-Name
                          if (isMultiSelectCompareMode) {
                            const chartDataArray = compareChartData.data || [];
                            if (chartDataArray.length === 0) return null;
                            
                            // Finde Bot-Type-Name für dieses Update
                            const botType = availableBotTypes.find(bt => String(bt.id) === String(update.botTypeId));
                            if (!botType) return null;
                            const metricKey = botType.name;
                            
                            // Find value at closed timestamp
                            const targetTs = update.endTs;
                            const sorted = [...chartDataArray].sort((a, b) => a.timestamp - b.timestamp);
                            let before: any = null;
                            let after: any = null;
                            
                            for (let j = 0; j < sorted.length; j++) {
                              const val = sorted[j][metricKey];
                              if (val !== null && val !== undefined) {
                                if (sorted[j].timestamp <= targetTs) before = sorted[j];
                                if (sorted[j].timestamp >= targetTs && !after) after = sorted[j];
                              }
                            }
                            
                            let endValue: number | null = null;
                            if (before && before.timestamp === targetTs) {
                              endValue = before[metricKey] as number;
                            } else if (after && after.timestamp === targetTs) {
                              endValue = after[metricKey] as number;
                            } else if (before && after && before !== after) {
                              const beforeVal = before[metricKey] as number;
                              const afterVal = after[metricKey] as number;
                              const t = (targetTs - before.timestamp) / (after.timestamp - before.timestamp);
                              endValue = beforeVal + t * (afterVal - beforeVal);
                            } else if (before) {
                              endValue = before[metricKey] as number;
                            } else if (after) {
                              endValue = after[metricKey] as number;
                            }
                            
                            if (endValue === null) return null;
                            
                            // Calculate Y position using yAxisDomain (gleiche Logik wie normale Updates)
                            let yMinNum: number, yMaxNum: number;
                            const [yMin, yMax] = yAxisDomain;
                            if (typeof yMin === 'number' && typeof yMax === 'number') {
                              yMinNum = yMin;
                              yMaxNum = yMax;
                            } else {
                              // Fallback: Berechne aus Chart-Daten
                              const allVals = chartDataArray.flatMap(d => 
                                compareChartData.botTypeNames.map(name => d[name]).filter(v => typeof v === 'number')
                              ) as number[];
                              if (allVals.length === 0) return null;
                              yMinNum = Math.min(...allVals);
                              yMaxNum = Math.max(...allVals);
                            }
                            const yRange = yMaxNum - yMinNum;
                            if (yRange === 0) return null;
                            
                            const markerHeight = 80;
                            const gapHeight = 16;
                            const chartTopMargin = 5;
                            const plotHeight = 225;
                            
                            // Gleiche Berechnung wie bei normalen Updates
                            const relativeValue = (endValue - yMinNum) / yRange;
                            const chartY = chartTopMargin + (1 - relativeValue) * plotHeight;
                            const rawY = markerHeight + gapHeight + chartY;
                            return Math.max(100, (rawY / markerHeight) * 100);
                          }
                          
                          // ADDED MODUS: Verwende multiBotChartData und "Gesamt"-Wert
                          if (isMultiBotChartMode) {
                            const chartDataArray = multiBotChartData.data || [];
                            if (chartDataArray.length === 0) return null;
                            
                            // Im Added-Modus: Verwende "Gesamt" als Metrik (aggregierte Linie)
                            const metricKey = 'Gesamt';
                            
                            // Find value at closed timestamp
                            const targetTs = update.endTs;
                            const sorted = [...chartDataArray].sort((a, b) => a.timestamp - b.timestamp);
                            let before: any = null;
                            let after: any = null;
                            
                            for (let j = 0; j < sorted.length; j++) {
                              const val = sorted[j][metricKey];
                              if (val !== null && val !== undefined) {
                                if (sorted[j].timestamp <= targetTs) before = sorted[j];
                                if (sorted[j].timestamp >= targetTs && !after) after = sorted[j];
                              }
                            }
                            
                            let endValue: number | null = null;
                            if (before && before.timestamp === targetTs) {
                              endValue = before[metricKey] as number;
                            } else if (after && after.timestamp === targetTs) {
                              endValue = after[metricKey] as number;
                            } else if (before && after && before !== after) {
                              const beforeVal = before[metricKey] as number;
                              const afterVal = after[metricKey] as number;
                              const t = (targetTs - before.timestamp) / (after.timestamp - before.timestamp);
                              endValue = beforeVal + t * (afterVal - beforeVal);
                            } else if (before) {
                              endValue = before[metricKey] as number;
                            } else if (after) {
                              endValue = after[metricKey] as number;
                            }
                            
                            if (endValue === null) return null;
                            
                            // Calculate Y position using yAxisDomain
                            let yMinNum: number, yMaxNum: number;
                            const [yMin, yMax] = yAxisDomain;
                            if (typeof yMin === 'number' && typeof yMax === 'number') {
                              yMinNum = yMin;
                              yMaxNum = yMax;
                            } else {
                              // Fallback: Berechne aus Chart-Daten
                              const allVals = chartDataArray.map(d => d[metricKey]).filter(v => typeof v === 'number') as number[];
                              if (allVals.length === 0) return null;
                              yMinNum = Math.min(...allVals);
                              yMaxNum = Math.max(...allVals);
                            }
                            const yRange = yMaxNum - yMinNum;
                            if (yRange === 0) return null;
                            
                            const markerHeight = 80;
                            const gapHeight = 16;
                            const chartTopMargin = 5;
                            const plotHeight = 225;
                            
                            const relativeValue = (endValue - yMinNum) / yRange;
                            const chartY = chartTopMargin + (1 - relativeValue) * plotHeight;
                            const rawY = markerHeight + gapHeight + chartY;
                            return Math.max(100, (rawY / markerHeight) * 100);
                          }
                          
                          // Single-Bot Modus: Verwende transformedChartData
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
                            {/* Dashed line to chart when active OR when Eye blink is active for THIS specific update */}
                            {/* KEIN zusätzlicher Kreis hier - die Line-Komponente rendert bereits den Kreis */}
                            {/* Eye Blink nur wenn blinkingUpdateKey === dieser closedKey! */}
                            {/* ANALYZE MODE: Keine gestrichelte Linie für Closed Bots (wie bei anderen Metriken) */}
                            {!isAnalyzeSingleMetricMode && (isClosedActive || (blinkingUpdateKey === closedKey)) && closedY2 !== null && (() => {
                              // Compare Mode Eye Blink: NUR wenn dieser spezifische Update blinken soll!
                              const shouldBlinkClosedLine = blinkingUpdateKey === closedKey;
                              return (
                                <g 
                                  key={shouldBlinkClosedLine ? `closed-blink-${compareBlinkKey}` : undefined}
                                  className={shouldBlinkClosedLine ? 'compare-eye-blink' : undefined}
                                >
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
                                </g>
                              );
                            })()}
                          </g>
                        );
                      }
                      
                      // Update Metrics: Line from start to end with markers
                      // Im Compare/Added-Modus: BotTypeId in den Key aufnehmen für eindeutige Zuordnung
                      const updateKey = (isMultiSelectCompareMode || isMultiBotChartMode) && update.botTypeId 
                        ? `${update.botTypeId}:u-${update.version}` 
                        : `u-${update.version}`;
                      
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
                      // Farbe: Aktiv = neonblau, sonst grau ODER im Compare/Added-Modus die Bot-Type-Farbe
                      let strokeColor: string;
                      if (isActive) {
                        strokeColor = "rgb(8, 145, 178)"; // Neonblau wenn aktiv/gehoverd
                      } else if ((isMultiSelectCompareMode || isMultiBotChartMode) && update.botTypeId) {
                        // Compare/Added-Modus: Verwende die Farbe des Bot-Types
                        strokeColor = compareColorMap[update.botTypeId] || "hsl(var(--muted-foreground))";
                      } else {
                        strokeColor = "hsl(var(--muted-foreground))"; // Grau als Default
                      }
                      
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
                        if (markerViewActive) {
                          fetch('/api/log-hover', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              event: 'Update Metrics marker hovered',
                              key: updateKey,
                              botTypeName: update.botTypeId ? availableBotTypes.find(bt => bt.id === update.botTypeId)?.name : null,
                              timestamp: update.endTs,
                              mode: isMultiSelectCompareMode ? 'COMPARE' : 'NORMAL',
                              direction: 'Marker → Chart'
                            })
                          }).catch(() => {});
                          setHoveredUpdateId(updateKey);
                        }
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
                          {/* Dashed lines down to chart points when hovered OR when Eye blink is active for THIS update */}
                          {/* WICHTIG: Eye Blink nur wenn blinkingUpdateKey === dieser updateKey */}
                          {/* ANALYZE MODE: Keine gestrichelten Linien, da der Chart anders funktioniert */}
                          {!isAnalyzeSingleMetricMode && (isActive || (blinkingUpdateKey === updateKey)) && (() => {
                            // COMPARE MODUS: Verwende compareChartData - Linie nur bis zum Datenpunkt
                            if (isMultiSelectCompareMode) {
                              const chartDataArray = compareChartData.data || [];
                              if (chartDataArray.length === 0) return null;
                              
                              // Get Y domain
                              let yMinNum: number, yMaxNum: number;
                              const [yMin, yMax] = yAxisDomain;
                              if (typeof yMin === 'number' && typeof yMax === 'number') {
                                yMinNum = yMin;
                                yMaxNum = yMax;
                              } else {
                                return null;
                              }
                              const yRange = yMaxNum - yMinNum;
                              if (yRange === 0) return null;
                              
                              const markerHeight = 80;
                              const gapHeight = 16;
                              const chartTopMargin = 5;
                              const plotHeight = 225;
                              
                              const calcChartY = (value: number) => {
                                const relativeValue = (value - yMinNum) / yRange;
                                const chartY = chartTopMargin + (1 - relativeValue) * plotHeight;
                                return markerHeight + gapHeight + chartY;
                              };
                              
                              // Finde den Bot-Type-Namen für dieses Update
                              const updateBotType = availableBotTypes.find(bt => String(bt.id) === String(update.botTypeId));
                              const updateBotTypeName = updateBotType?.name || null;
                              
                              // Finde den tatsächlichen Wert am Start- und End-Timestamp
                              // WICHTIG: Nur den Wert vom Bot-Type verwenden, zu dem dieses Update gehört!
                              const findValueAtTs = (targetTs: number): number | null => {
                                if (!updateBotTypeName) return null;
                                
                                // Finde den nächsten Punkt der TATSÄCHLICH einen Wert für diesen Bot-Type hat
                                // (nicht einfach den nächsten Punkt - der könnte zu einem anderen Bot-Type gehören!)
                                let closestPoint = null;
                                let closestDist = Infinity;
                                
                                for (const point of chartDataArray) {
                                  // WICHTIG: Nur Punkte berücksichtigen die einen Wert für diesen Bot-Type haben!
                                  const val = point[updateBotTypeName];
                                  if (typeof val !== 'number' || isNaN(val)) continue;
                                  
                                  const dist = Math.abs(point.timestamp - targetTs);
                                  if (dist < closestDist) {
                                    closestDist = dist;
                                    closestPoint = point;
                                  }
                                }
                                
                                if (!closestPoint) return null;
                                
                                // Wert zurückgeben (wir wissen bereits dass er existiert)
                                return closestPoint[updateBotTypeName] as number;
                              };
                              
                              const startValue = findValueAtTs(update.startTs);
                              const endValue = findValueAtTs(update.endTs);
                              
                              // Berechne Y-Position nur wenn Werte gefunden wurden
                              const startY2Raw = startValue !== null ? calcChartY(startValue) : null;
                              const endY2Raw = endValue !== null ? calcChartY(endValue) : null;
                              
                              if (startY2Raw === null && endY2Raw === null) return null;
                              
                              const startY2 = startY2Raw !== null ? Math.max(100, (startY2Raw / markerHeight) * 100) : null;
                              const endY2 = endY2Raw !== null ? Math.max(100, (endY2Raw / markerHeight) * 100) : null;
                              
                              // Compare Mode Eye Blink: NUR wenn dieser spezifische Update blinken soll!
                              const shouldBlinkLine = blinkingUpdateKey === updateKey;
                              
                              // GOLDEN STATE: Compare Mode zeigt IMMER beide Linien (Start + End)
                              // (Im Added-Modus wird nur End angezeigt - siehe separater Block)
                              
                              return (
                                <g 
                                  key={shouldBlinkLine ? `blink-${compareBlinkKey}` : undefined}
                                  className={shouldBlinkLine ? 'compare-eye-blink' : undefined}
                                >
                                  {startY2 !== null && (
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
                                  )}
                                  {endY2 !== null && (
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
                                  )}
                                </g>
                              );
                            }
                            
                            // ADDED MODUS: Verwende multiBotChartData und "Gesamt"-Wert
                            if (isMultiBotChartMode) {
                              const chartDataArray = multiBotChartData.data || [];
                              if (chartDataArray.length === 0) return null;
                              
                              // Get Y domain
                              let yMinNum: number, yMaxNum: number;
                              const [yMin, yMax] = yAxisDomain;
                              if (typeof yMin === 'number' && typeof yMax === 'number') {
                                yMinNum = yMin;
                                yMaxNum = yMax;
                              } else {
                                return null;
                              }
                              const yRange = yMaxNum - yMinNum;
                              if (yRange === 0) return null;
                              
                              const markerHeight = 80;
                              const gapHeight = 16;
                              const chartTopMargin = 5;
                              const plotHeight = 225;
                              
                              const calcChartY = (value: number) => {
                                const relativeValue = (value - yMinNum) / yRange;
                                const chartY = chartTopMargin + (1 - relativeValue) * plotHeight;
                                return markerHeight + gapHeight + chartY;
                              };
                              
                              // Im Added-Modus: Verwende "Gesamt" als Metrik (aggregierte Linie)
                              const metricKey = 'Gesamt';
                              
                              // Finde den "Gesamt"-Wert am Start- und End-Timestamp
                              const findValueAtTs = (targetTs: number): number | null => {
                                let closestPoint = null;
                                let closestDist = Infinity;
                                
                                for (const point of chartDataArray) {
                                  const val = point[metricKey];
                                  if (typeof val !== 'number' || isNaN(val)) continue;
                                  
                                  const dist = Math.abs(point.timestamp - targetTs);
                                  if (dist < closestDist) {
                                    closestDist = dist;
                                    closestPoint = point;
                                  }
                                }
                                
                                if (!closestPoint) return null;
                                return closestPoint[metricKey] as number;
                              };
                              
                              const startValue = findValueAtTs(update.startTs);
                              const endValue = findValueAtTs(update.endTs);
                              
                              // Berechne Y-Position nur wenn Werte gefunden wurden
                              const startY2Raw = startValue !== null ? calcChartY(startValue) : null;
                              const endY2Raw = endValue !== null ? calcChartY(endValue) : null;
                              
                              if (startY2Raw === null && endY2Raw === null) return null;
                              
                              const startY2 = startY2Raw !== null ? Math.max(100, (startY2Raw / markerHeight) * 100) : null;
                              const endY2 = endY2Raw !== null ? Math.max(100, (endY2Raw / markerHeight) * 100) : null;
                              
                              // Added Mode Eye Blink: NUR wenn dieser spezifische Update blinken soll!
                              const shouldBlinkLine = blinkingUpdateKey === updateKey;
                              
                              // GOLDEN STATE: Added/Edit-Modus zeigt IMMER NUR die END-Linie (keine START-Linie)
                              // Dies gilt unabhängig davon ob Auge/Stift aktiv ist oder nach Apply
                              const showStartLine = false;
                              
                              return (
                                <g 
                                  key={shouldBlinkLine ? `added-blink-${compareBlinkKey}` : undefined}
                                  className={shouldBlinkLine ? 'compare-eye-blink' : undefined}
                                >
                                  {showStartLine && startY2 !== null && (
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
                                  )}
                                  {endY2 !== null && (
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
                                  )}
                                </g>
                              );
                            }
                            
                            // NORMALER MODUS
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
                            
                            // GOLDEN STATE: MainChart zeigt IMMER beide Linien (Start + End)
                            // (Im Added-Modus wird nur End angezeigt - siehe separater Block)
                            
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
              {((isAnalyzeSingleMetricMode && (!analyzeModeBounds || compareChartData.data.length === 0)) ||
                (!isAnalyzeSingleMetricMode && isMultiSelectCompareMode && compareChartData.data.length === 0) ||
                (!isAnalyzeSingleMetricMode && !isMultiSelectCompareMode && isMultiBotChartMode && multiBotChartData.data.length === 0) || 
                (!isAnalyzeSingleMetricMode && !isMultiSelectCompareMode && !isMultiBotChartMode && transformedChartData.length === 0)) ? (
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
                className={cn("select-none relative", isDragging && "cursor-grabbing")}
                style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
              >
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  key={investmentBaseKey}
                  data={
                    // ANALYZE SINGLE METRIC MODE (Compare): Verwende compareChartData aber gefiltert auf analyzeModeBounds
                    isAnalyzeSingleMetricMode && analyzeSingleMetricInfo && analyzeModeBounds
                      ? (() => {
                          // Filtere compareChartData auf den Zeitraum des ausgewählten Updates
                          const { startTs, endTs } = analyzeModeBounds;
                          const botTypeName = analyzeSingleMetricInfo.botTypeName;
                          // Filtere Daten: Nur Punkte die zum ausgewählten Bot-Type gehören UND im Zeitraum liegen
                          // Prüfe auf metric_* Felder (für Multi-Metrik-Support)
                          const filteredData = compareChartData.data.filter(point => 
                            point.timestamp >= startTs && 
                            point.timestamp <= endTs &&
                            point.botTypeName === botTypeName
                          );
                          return filteredData.length > 0 ? filteredData : [{ time: '-', timestamp: 0 }];
                        })()
                      : isMultiSelectCompareMode
                        ? (compareChartData.data.length > 0 ? compareChartData.data : [{ time: '-', timestamp: 0 }])
                        : isMultiBotChartMode 
                          ? (multiBotChartData.data.length > 0 ? multiBotChartData.data : [{ time: '-', timestamp: 0 }])
                          // NORMAL MODE: Wenn analyzeModeBounds aktiv, filtere transformedChartData
                          : analyzeModeBounds
                            ? (() => {
                                const { startTs, endTs } = analyzeModeBounds;
                                const filteredData = transformedChartData.filter(point => 
                                  point.timestamp >= startTs && point.timestamp <= endTs
                                );
                                return filteredData.length > 0 ? filteredData : [{ time: '-', timestamp: 0 }];
                              })()
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
                    minTickGap={isMultiSelectCompareMode ? 50 : 50}
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
                      
                      // COMPARE MODUS: Adaptive Formatierung basierend auf Zoom-Level
                      // WICHTIG: Nur wenn KEIN analyzeModeBounds aktiv ist! Sonst übernimmt der Analyze Status Block
                      if (isMultiSelectCompareMode && compareChartData.minTimestamp > 0 && !analyzeModeBounds) {
                        // Berechne sichtbare Zeitspanne basierend auf Zoom
                        const totalRange = compareChartData.maxTimestamp - compareChartData.minTimestamp;
                        const visibleRange = totalRange / chartZoomX;
                        const visibleHours = visibleRange / (60 * 60 * 1000);
                        const visibleDays = visibleRange / (24 * 60 * 60 * 1000);
                        
                        const hour = date.getHours();
                        const isMidnight = hour === 0 && date.getMinutes() === 0;
                        
                        let label = '';
                        let showTwoLines = false;
                        
                        if (visibleHours <= 36) {
                          // Sehr eng gezoomt: Zeige Stunden + Datum bei Mitternacht
                          if (isMidnight) {
                            const dateStr = date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
                            label = dateStr;
                            showTwoLines = false;
                          } else {
                            const timeStr = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                            label = timeStr;
                          }
                        } else if (visibleDays <= 7) {
                          // Mittel gezoomt: Datum + optionale Uhrzeit bei nicht-Mitternacht
                          const dateStr = date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
                          if (!isMidnight && visibleHours <= 72) {
                            const timeStr = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                            label = `${dateStr}\n${timeStr}`;
                            showTwoLines = true;
                          } else {
                            label = dateStr;
                          }
                        } else {
                          // Weit rausgezoomt: Nur Datum
                          label = date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
                        }
                        
                        if (showTwoLines && label.includes('\n')) {
                          const lines = label.split('\n');
                          return (
                            <g transform={`translate(${x},${y})`}>
                              <text x={0} y={12} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize={10}>
                                {lines[0]}
                              </text>
                              <text x={0} y={24} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize={9}>
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
                              fill="hsl(var(--muted-foreground))"
                              fontSize={10}
                            >
                              {label}
                            </text>
                          </g>
                        );
                      }
                      
                      // ADDED MODUS: Adaptive Formatierung basierend auf Zoom-Level (1:1 wie Compare-Modus)
                      // WICHTIG: Nur wenn KEIN analyzeModeBounds aktiv ist! Sonst übernimmt der Analyze Status Block
                      if (isMultiBotChartMode && multiBotChartData.minTimestamp > 0 && !analyzeModeBounds) {
                        // Berechne sichtbare Zeitspanne basierend auf Zoom
                        const totalRange = multiBotChartData.maxTimestamp - multiBotChartData.minTimestamp;
                        const visibleRange = totalRange / chartZoomX;
                        const visibleHours = visibleRange / (60 * 60 * 1000);
                        const visibleDays = visibleRange / (24 * 60 * 60 * 1000);
                        
                        const hour = date.getHours();
                        const isMidnight = hour === 0 && date.getMinutes() === 0;
                        
                        // Dynamische Textausrichtung basierend auf Timestamp-Position
                        // Erster Datenpunkt: start (nach rechts ausgerichtet)
                        // Letzter Datenpunkt: end (nach links ausgerichtet)
                        // Alles dazwischen: middle (zentriert)
                        const currentTs = payload.value;
                        const isFirstDataPoint = currentTs === multiBotChartData.minTimestamp;
                        const isLastDataPoint = currentTs === multiBotChartData.maxTimestamp;
                        
                        let textAnchor: "start" | "middle" | "end" = "middle";
                        if (isFirstDataPoint) {
                          textAnchor = "start";
                        } else if (isLastDataPoint) {
                          textAnchor = "end";
                        }
                        
                        let label = '';
                        let showTwoLines = false;
                        
                        if (visibleHours <= 36) {
                          // Sehr eng gezoomt: Zeige Stunden + Datum bei Mitternacht
                          if (isMidnight) {
                            const dateStr = date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
                            label = dateStr;
                            showTwoLines = false;
                          } else {
                            const timeStr = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                            label = timeStr;
                          }
                        } else if (visibleDays <= 7) {
                          // Mittel gezoomt: Datum + optionale Uhrzeit bei nicht-Mitternacht
                          const dateStr = date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
                          if (!isMidnight && visibleHours <= 72) {
                            const timeStr = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                            label = `${dateStr}\n${timeStr}`;
                            showTwoLines = true;
                          } else {
                            label = dateStr;
                          }
                        } else {
                          // Weit rausgezoomt: Nur Datum
                          label = date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
                        }
                        
                        if (showTwoLines && label.includes('\n')) {
                          const lines = label.split('\n');
                          return (
                            <g transform={`translate(${x},${y})`}>
                              <text x={0} y={12} textAnchor={textAnchor} fill="hsl(var(--muted-foreground))" fontSize={10}>
                                {lines[0]}
                              </text>
                              <text x={0} y={24} textAnchor={textAnchor} fill="hsl(var(--muted-foreground))" fontSize={9}>
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
                              textAnchor={textAnchor}
                              fill="hsl(var(--muted-foreground))"
                              fontSize={10}
                            >
                              {label}
                            </text>
                          </g>
                        );
                      }
                      
                      // ANALYSIEREN-MODUS: Adaptive Time Axis mit dynamischer Zeitauflösung
                      // Formatierung basiert auf SICHTBARER Zeitspanne (mit Zoom), nicht auf sequence-Einstellung
                      if (analyzeModeBounds) {
                        const { startTs, endTs } = analyzeModeBounds;
                        const totalDurationMs = endTs - startTs;
                        // WICHTIG: Sichtbare Zeitspanne = Gesamtspanne / Zoom-Faktor
                        const visibleDurationMs = totalDurationMs / chartZoomX;
                        const visibleHours = visibleDurationMs / (1000 * 60 * 60);
                        const visibleDays = visibleHours / 24;
                        
                        const currentTs = payload.value;
                        const isFirst = currentTs === startTs;
                        const isLast = currentTs === endTs;
                        const hour = date.getHours();
                        const isMidnight = hour === 0 && date.getMinutes() === 0;
                        
                        let label = '';
                        let isMajor = false;
                        
                        // WICHTIG: Wenn Duplikat-Tage existieren → IMMER Uhrzeit anzeigen!
                        // analyzeTicksHaveDuplicateDays prüft ob ein Datum mehrfach vorkommt
                        const needsTimeLabels = analyzeTicksHaveDuplicateDays || visibleDays <= 3;
                        
                        // 1:1 WIE COMPARE-MODE! Basierend auf visibleHours/visibleDays
                        // Start und End immer mit Datum + Uhrzeit
                        if (isFirst || isLast) {
                          const dateStr = date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
                          const timeStr = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                          label = `${dateStr}\n${timeStr}`;
                          isMajor = true;
                        } else if (needsTimeLabels || visibleDays <= 7) {
                          // Bei Duplikat-Tagen oder ≤7 Tagen sichtbar: IMMER Datum + Uhrzeit anzeigen!
                          const dateStr = date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
                          const timeStr = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                          if (isMidnight && !needsTimeLabels) {
                            // Bei Mitternacht ohne Duplikate: Nur Datum (markiert den Tageswechsel)
                            label = dateStr;
                            isMajor = true;
                          } else {
                            // Bei Duplikaten ODER nicht-Mitternacht: Datum + Uhrzeit!
                            label = `${dateStr}\n${timeStr}`;
                          }
                        } else if (visibleDays <= 60) {
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
                    tickCount={isMultiSelectCompareMode ? 8 : Math.min(15, Math.max(5, Math.floor(chartZoomY * 3)))}
                    tickFormatter={(value) => {
                      // Bei höherem Zoom mehr Dezimalstellen anzeigen
                      const decimals = isMultiSelectCompareMode ? 2 : (chartZoomY >= 5 ? 4 : chartZoomY >= 3 ? 3 : 2);
                      return value.toLocaleString('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
                    }}
                  />
                  <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" strokeOpacity={0.5} />
                  <Tooltip 
                    active={tooltipIsNearPoint}
                    content={(props) => {
                      // Normaler Hover-Modus
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
                        
                        props.payload?.forEach((entry: any) => {
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
                      
                      // COMPARE MODUS: Spezial-Fall wenn Endpunkt AUCH Startpunkt des nächsten ist
                      // Zeige ZWEI Boxen mit Bezeichnungen "End Runtime" und "Start Time"
                      if (isMultiSelectCompareMode && dataPoint._isAlsoStartOfNext === true) {
                        const botTypeName = dataPoint.botTypeName || '';
                        const botTypeValue = dataPoint[botTypeName] || 0;
                        const runtimeMs = dataPoint.runtimeMs || 0;
                        
                        // Finde Farbe für diesen Bot-Type
                        const botType = availableBotTypes.find(bt => bt.name === botTypeName);
                        const botTypeId = botType ? String(botType.id) : '';
                        const botTypeColor = compareColorMap[botTypeId] || '#16a34a';
                        
                        // Einheit basierend auf ausgewählter Metrik
                        const selectedMetric = activeMetricCards.length > 0 ? activeMetricCards[0] : 'Gesamtprofit';
                        const metricSuffix = selectedMetric === 'Gesamtprofit %' ? '%' : ' USDT';
                        
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {/* END RUNTIME Box - Umrandung in Bot-Type Farbe */}
                            <div style={{ 
                              backgroundColor: 'hsl(var(--popover))',
                              border: `2px solid ${botTypeColor}`,
                              borderRadius: '6px',
                              fontSize: '14px',
                              color: 'hsl(var(--foreground))',
                              padding: '8px 12px'
                            }}>
                              <p style={{ fontWeight: 'bold', marginBottom: '4px' }}>{dateLabel}</p>
                              <p style={{ 
                                fontWeight: 'bold', 
                                marginBottom: '4px', 
                                fontSize: '11px', 
                                color: '#ef4444',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                              }}>
                                End Runtime
                              </p>
                              <p style={{ color: botTypeColor, margin: '2px 0' }}>
                                {botTypeName}: {botTypeValue.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{metricSuffix}
                              </p>
                              {runtimeMs > 0 && (
                                <p style={{ color: 'hsl(var(--muted-foreground))', margin: '2px 0' }}>
                                  Runtime: {formatRuntimeFromMs(runtimeMs)}
                                </p>
                              )}
                            </div>
                            {/* START TIME Box - Umrandung in Bot-Type Farbe */}
                            <div style={{ 
                              backgroundColor: 'hsl(var(--popover))',
                              border: `2px solid ${botTypeColor}`,
                              borderRadius: '6px',
                              fontSize: '14px',
                              color: 'hsl(var(--foreground))',
                              padding: '8px 12px'
                            }}>
                              <p style={{ fontWeight: 'bold', marginBottom: '4px' }}>{dateLabel}</p>
                              <p style={{ 
                                fontWeight: 'bold', 
                                marginBottom: '4px', 
                                fontSize: '11px', 
                                color: '#22c55e',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                              }}>
                                Start Time
                              </p>
                              <p style={{ color: botTypeColor, margin: '2px 0' }}>
                                {botTypeName}: {botTypeValue.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{metricSuffix}
                              </p>
                              {/* KEINE Runtime bei START */}
                            </div>
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
                      
                      // ANALYZE MODE TOOLTIP: Zeige alle aktiven Metriken mit echten Werten und Farben
                      if (isAnalyzeSingleMetricMode && analyzeSingleMetricInfo) {
                        const botTypeName = analyzeSingleMetricInfo.botTypeName;
                        const isStartPoint = dataPoint.isStartPoint === true;
                        const runtimeMs = dataPoint.runtimeMs;
                        
                        // Hole echte Werte aus den Datenpunkt-Feldern (Gesamtprofit, Gesamtkapital)
                        const gesamtprofit = dataPoint['Gesamtprofit'] || 0;
                        const gesamtkapital = dataPoint['Gesamtkapital'] || 0;
                        
                        // Umrandungsfarbe = erste aktive Metrik
                        const primaryMetric = activeMetricCards.length > 0 ? activeMetricCards[0] : 'Gesamtprofit';
                        const borderColor = metricColors[primaryMetric] || '#22c55e';
                        
                        // Berechne echte Metrik-Werte (nicht offsetted)
                        // WICHTIG: Verwende analyzeSingleMetricValues für korrekte Werte (wie Content Card)
                        // Diese Werte sind bereits vorberechnet und konsistent mit der Content Card
                        const getAnalyzeMetricValue = (metricName: string): number => {
                          // Für Startpunkte: zeige 0 (oder Gesamtkapital wenn aktiv)
                          if (isStartPoint) {
                            if (metricName === 'Gesamtkapital') return gesamtkapital;
                            return 0;
                          }
                          // Für Endpunkte: Verwende vorberechnete Werte aus analyzeSingleMetricValues
                          // Dies stellt sicher dass Tooltip und Content Card dieselben Werte zeigen
                          switch (metricName) {
                            case 'Gesamtkapital':
                              return analyzeSingleMetricValues?.investment || gesamtkapital;
                            case 'Gesamtprofit':
                              return analyzeSingleMetricValues?.profit || gesamtprofit;
                            case 'Gesamtprofit %':
                              return analyzeSingleMetricValues?.profitPercent || (gesamtkapital > 0 ? (gesamtprofit / gesamtkapital) * 100 : 0);
                            case 'Ø Profit/Tag':
                              // WICHTIG: Verwende vorberechneten avgDailyProfit aus Update (avgGridProfitDay)
                              // Dieser Wert ist konsistent mit der Content Card
                              return analyzeSingleMetricValues?.avgDailyProfit || 0;
                            case 'Real Profit/Tag':
                              // WICHTIG: Verwende vorberechneten realDailyProfit aus Update
                              // Dieser Wert ist konsistent mit der Content Card
                              return analyzeSingleMetricValues?.realDailyProfit || gesamtprofit;
                            default:
                              return 0;
                          }
                        };
                        
                        return (
                          <div 
                            style={{ 
                              backgroundColor: 'hsl(var(--popover))',
                              border: `2px solid ${borderColor}`,
                              borderRadius: '6px',
                              fontSize: '14px',
                              color: 'hsl(var(--foreground))',
                              padding: '8px 12px'
                            }}
                          >
                            {/* Datum */}
                            <p style={{ fontWeight: 'bold', marginBottom: '4px' }}>{dateLabel}</p>
                            
                            {/* Bot-Type Name */}
                            <p style={{ fontSize: '12px', color: 'hsl(var(--foreground))', margin: '2px 0', fontWeight: 'bold' }}>
                              {botTypeName}
                            </p>
                            
                            {/* Alle aktiven Metriken mit ihren Farben */}
                            {activeMetricCards.map((metricName, idx) => {
                              const value = getAnalyzeMetricValue(metricName);
                              const color = metricColors[metricName] || '#888888';
                              const suffix = metricName === 'Gesamtprofit %' ? '%' : ' USDT';
                              
                              return (
                                <p key={idx} style={{ fontSize: '12px', color, margin: '4px 0' }}>
                                  {metricName}: {value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{suffix}
                                </p>
                              );
                            })}
                            
                            {/* Runtime nur bei Endpunkten */}
                            {!isStartPoint && runtimeMs && runtimeMs > 0 && (
                              <p style={{ fontSize: '11px', color: 'hsl(var(--muted-foreground))', margin: '4px 0 0 0' }}>
                                Runtime: {formatRuntimeFromMs(runtimeMs)}
                              </p>
                            )}
                          </div>
                        );
                      }
                      
                      // ADDED/PORTFOLIO MODUS: Jeder Punkt ist ein einzelner End-Event
                      // Zeigt: Datum, End, Bot-Type Name, ALLE ausgewählten Metriken mit Farben, Runtime
                      if (isMultiBotChartMode) {
                        // Individuelle Bot-Infos aus dem Datenpunkt
                        const botTypeName = dataPoint._botTypeName || '';
                        const runtimeMs = dataPoint._runtimeMs;
                        const isClosedBot = dataPoint._isClosedBot || false;
                        
                        // Hole alle Metrik-Werte aus den _endEvents (für alle ausgewählten Metriken)
                        const eventMetricValues = dataPoint._endEvents?.[0]?.metricValues || {};
                        
                        // Fallback auf direkte Datenpunkt-Werte
                        const getMetricValue = (metricName: string): number | undefined => {
                          // Erst aus metricValues versuchen
                          if (eventMetricValues[metricName] !== undefined) {
                            return eventMetricValues[metricName];
                          }
                          // Dann aus Gesamt_-prefixed Feldern
                          const gesamtKey = `Gesamt_${metricName}`;
                          if (dataPoint[gesamtKey] !== undefined) {
                            return dataPoint[gesamtKey];
                          }
                          // Fallback für Gesamtprofit
                          if (metricName === 'Gesamtprofit') {
                            return dataPoint._profit || dataPoint['Gesamt'] || 0;
                          }
                          return undefined;
                        };
                        
                        // Umrandungsfarbe = erste aktive Metrik (oder grün als Fallback)
                        const primaryMetric = activeMetricCards.length > 0 ? activeMetricCards[0] : 'Gesamtprofit';
                        const borderColor = metricColors[primaryMetric] || '#22c55e';
                        
                        // Runtime formatieren
                        const runtimeStr = runtimeMs && runtimeMs > 0 
                          ? formatRuntimeFromMs(runtimeMs)
                          : null;
                        
                        return (
                          <div 
                            style={{ 
                              backgroundColor: 'hsl(var(--popover))',
                              border: `2px solid ${borderColor}`,
                              borderRadius: '6px',
                              fontSize: '14px',
                              color: 'hsl(var(--foreground))',
                              padding: '8px 12px'
                            }}
                          >
                            
                            {/* Datum */}
                            <p style={{ fontWeight: 'bold', marginBottom: '4px' }}>{dateLabel}</p>
                            
                            {/* Bot-Type Name */}
                            <p style={{ fontSize: '12px', color: 'hsl(var(--foreground))', margin: '2px 0', fontWeight: 'bold' }}>
                              {botTypeName}
                            </p>
                            
                            {/* Alle ausgewählten Metriken mit ihren jeweiligen Farben */}
                            {activeMetricCards.map((metricName, idx) => {
                              const value = getMetricValue(metricName);
                              // Closed Bots haben keine %, Ø Profit/Tag, Real Profit/Tag Werte
                              if (value === undefined) return null;
                              
                              const color = metricColors[metricName] || '#888888';
                              const suffix = metricName === 'Gesamtprofit %' ? '%' : ' USDT';
                              
                              return (
                                <p key={idx} style={{ fontSize: '12px', color, margin: '4px 0' }}>
                                  {metricName}: {value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{suffix}
                                </p>
                              );
                            })}
                            
                            {/* Runtime */}
                            {runtimeStr && (
                              <p style={{ fontSize: '11px', color: 'hsl(var(--muted-foreground))', margin: '2px 0' }}>
                                Runtime: {runtimeStr}
                              </p>
                            )}
                          </div>
                        );
                      }
                      
                      // LEGACY-CODE (wird nicht mehr verwendet im Added-Mode)
                      // Behalte für Abwärtskompatibilität falls benötigt
                      if (false && isMultiBotChartMode) {
                        const startEvents = dataPoint._startEvents || [];
                        const endEvents = dataPoint._endEvents || [];
                        const hasClosedBot = dataPoint._hasClosedBot || false;
                        const primaryEventType = dataPoint._primaryEventType || 'none';
                        const primaryMetric = activeMetricCards.length > 0 ? activeMetricCards[0] : 'Gesamtprofit';
                        const borderColor = metricColors[primaryMetric] || '#22c55e';
                        const typeLabel = primaryEventType === 'end' ? 'END' : (primaryEventType === 'start' ? 'START' : '');
                        const typeLabelColor = primaryEventType === 'end' ? '#ef4444' : '#22c55e';
                        const startBotNames = startEvents.map((e: any) => e.botTypeName).filter((v: string, i: number, a: string[]) => a.indexOf(v) === i);
                        const endBotNames = endEvents.map((e: any) => e.botTypeName).filter((v: string, i: number, a: string[]) => a.indexOf(v) === i);
                        
                        return (
                          <div 
                            style={{ 
                              backgroundColor: 'hsl(var(--popover))',
                              border: `2px solid ${borderColor}`,
                              borderRadius: '6px',
                              fontSize: '14px',
                              color: 'hsl(var(--foreground))',
                              padding: '8px 12px'
                            }}
                          >
                            <p style={{ fontWeight: 'bold', marginBottom: '4px' }}>{dateLabel}</p>
                            {typeLabel && (
                              <p style={{ 
                                fontWeight: 'bold', 
                                marginBottom: '4px', 
                                fontSize: '11px', 
                                color: typeLabelColor,
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                              }}>
                                {typeLabel}{hasClosedBot ? ' (Closed Bot)' : ''}
                              </p>
                            )}
                            {startEvents.length > 0 && startEvents.map((event: any, idx: number) => (
                              <div key={`start-${idx}`} style={{ marginBottom: '4px' }}>
                                <p style={{ fontSize: '11px', color: '#22c55e', margin: '2px 0', fontWeight: 'bold' }}>
                                  Start: {event.botTypeName}
                                </p>
                              </div>
                            ))}
                            {endEvents.length > 0 && endEvents.map((event: any, idx: number) => {
                              const runtimeStr = event.runtimeMs && event.runtimeMs > 0 
                                ? formatRuntimeFromMs(event.runtimeMs)
                                : null;
                              const metricValues = event.metricValues || {};
                              return (
                                <div key={`end-${idx}`} style={{ marginBottom: '4px' }}>
                                  <p style={{ fontSize: '11px', color: '#ef4444', margin: '2px 0', fontWeight: 'bold' }}>
                                    End: {event.botTypeName}{event.isClosedBot ? ' (Closed)' : ''}
                                  </p>
                                  {activeMetricCards.map((metricName, mIdx) => {
                                    const value = metricValues[metricName] || 0;
                                    const color = metricColors[metricName] || '#888888';
                                    const suffix = metricName === 'Gesamtprofit %' ? '%' : ' USDT';
                                    return (
                                      <p key={`end-metric-${mIdx}`} style={{ fontSize: '11px', color, margin: '0 0 0 8px' }}>
                                        {metricName}: {value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{suffix}
                                      </p>
                                    );
                                  })}
                                  {runtimeStr && (
                                    <p style={{ fontSize: '11px', color: 'hsl(var(--muted-foreground))', margin: '2px 0 0 8px' }}>
                                      Runtime: {runtimeStr}
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                            
                            {/* Gesamtwert wenn mehrere End-Events vorhanden sind */}
                            {endEvents.length > 1 && (
                              <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px solid hsl(var(--border))' }}>
                                {activeMetricCards.map((metricName, mIdx) => {
                                  const totalValue = endEvents.reduce((sum: number, event: any) => {
                                    return sum + (event.metricValues?.[metricName] || 0);
                                  }, 0);
                                  const color = metricColors[metricName] || '#888888';
                                  const suffix = metricName === 'Gesamtprofit %' ? '%' : ' USDT';
                                  return (
                                    <p key={`total-${mIdx}`} style={{ fontSize: '12px', color, margin: '2px 0', fontWeight: 'bold' }}>
                                      Gesamtwert: {totalValue.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{suffix}
                                    </p>
                                  );
                                })}
                              </div>
                            )}
                            
                          </div>
                        );
                      }
                      
                      // COMPARE MODUS: Einfache Box mit Bot-Type Name und Bezeichnung
                      // Zeigt NUR die ausgewählte Metrik (Bot-Type Wert), KEINE zweite Zeile
                      // Umrandung in Bot-Type Farbe, Schrift "END RUNTIME" rot / "START TIME" grün
                      if (isMultiSelectCompareMode) {
                        const botTypeName = dataPoint.botTypeName || '';
                        const botTypeValue = dataPoint[botTypeName] || 0;
                        const runtimeMs = dataPoint.runtimeMs || 0;
                        const isEndPoint = dataPoint.isStartPoint === false;
                        
                        // Finde Farbe für diesen Bot-Type (für Umrandung)
                        const botType = availableBotTypes.find(bt => bt.name === botTypeName);
                        const botTypeId = botType ? String(botType.id) : '';
                        const botTypeColor = compareColorMap[botTypeId] || '#16a34a';
                        
                        // Umrandung = Bot-Type Farbe, Schrift = rot/grün je nach End/Start
                        const typeLabel = isEndPoint ? 'End Runtime' : 'Start Time';
                        const typeLabelColor = isEndPoint ? '#ef4444' : '#22c55e';
                        
                        // Einheit basierend auf ausgewählter Metrik
                        const selectedMetric = activeMetricCards.length > 0 ? activeMetricCards[0] : 'Gesamtprofit';
                        const metricSuffix = selectedMetric === 'Gesamtprofit %' ? '%' : ' USDT';
                        
                        return (
                          <div 
                            style={{ 
                              backgroundColor: 'hsl(var(--popover))',
                              border: `2px solid ${botTypeColor}`,
                              borderRadius: '6px',
                              fontSize: '14px',
                              color: 'hsl(var(--foreground))',
                              padding: '8px 12px'
                            }}
                          >
                            <p style={{ fontWeight: 'bold', marginBottom: '4px' }}>{dateLabel}</p>
                            <p style={{ 
                              fontWeight: 'bold', 
                              marginBottom: '4px', 
                              fontSize: '11px', 
                              color: typeLabelColor,
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              {typeLabel}
                            </p>
                            <p style={{ color: botTypeColor, margin: '2px 0' }}>
                              {botTypeName}: {botTypeValue.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{metricSuffix}
                            </p>
                            {/* Runtime nur bei Endpunkten */}
                            {isEndPoint && runtimeMs > 0 && (
                              <p style={{ color: 'hsl(var(--muted-foreground))', margin: '2px 0' }}>
                                Runtime: {formatRuntimeFromMs(runtimeMs)}
                              </p>
                            )}
                          </div>
                        );
                      }
                      
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
                          {props.payload?.map((entry: any, index: number) => {
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
                  {/* ANALYZE SINGLE METRIC MODE: Verwende Compare-Modus Rendering aber NUR für den ausgewählten Bot-Type */}
                  {isAnalyzeSingleMetricMode && analyzeSingleMetricInfo ? (
                    // ANALYZE MODE: Zeige Linien für alle aktiven Metriken mit Metrik-Farben
                    // Jede aktivierte Content-Card bekommt eine eigene Linie
                    (() => {
                      const { botTypeId, botTypeName } = analyzeSingleMetricInfo;
                      
                      // Rendere eine Linie pro aktiver Metrik-Card
                      return activeMetricCards.map((metricName, metricIndex) => {
                        // Linienfarbe = Metrik-Farbe (passend zur Content-Card)
                        const lineColor = metricColors[metricName] || '#16a34a'; // Default grün
                        
                        // dataKey: Verwende den sicheren Schlüssel für Recharts (keine Sonderzeichen)
                        const safeKey = metricToSafeKey[metricName] || 'metric_gesamtprofit';
                        
                        return (
                          <Line 
                            key={`analyze-${metricName}-${botTypeName}`}
                            type="monotone" 
                            dataKey={safeKey}
                            name={metricName}
                            stroke={lineColor}
                            strokeWidth={2}
                            dot={(props: any) => {
                              const { cx, cy, payload } = props;
                              const closedStatusKey = `${botTypeName}_status`;
                              const isClosedBot = payload?.[closedStatusKey] === 'Closed Bots';
                              const pointValue = payload?.[safeKey];
                              
                              // Wenn kein Wert vorhanden, keinen Kreis rendern
                              if (pointValue === null || pointValue === undefined) {
                                return <g key={`dot-analyze-empty-${metricName}-${payload?.timestamp}`} />;
                              }
                              
                              if (isClosedBot) {
                                return (
                                  <circle
                                    key={`dot-analyze-closed-${metricName}-${payload?.timestamp}`}
                                    cx={cx}
                                    cy={cy}
                                    r={5}
                                    fill="hsl(var(--background))"
                                    stroke={lineColor}
                                    strokeWidth={2}
                                  />
                                );
                              }
                              
                              return (
                                <circle
                                  key={`dot-analyze-${metricName}-${payload?.timestamp}`}
                                  cx={cx}
                                  cy={cy}
                                  r={4}
                                  fill={lineColor}
                                />
                              );
                            }}
                            connectNulls
                            isAnimationActive={true}
                            animationDuration={1200}
                            animationBegin={metricIndex * 100}
                            animationEasing="ease-out"
                          />
                        );
                      });
                    })()
                  ) : isMultiSelectCompareMode ? (
                    // COMPARE MODUS: Farbige Linien für jeden ausgewählten Bot-Type
                    // Rot und Blau zuerst, dann weitere Farben
                    // Hover-Effekt: Linie leuchtet auf wenn Bot-Type in Tabelle gehoverd
                    compareChartData.botTypeNames.map((botTypeName, index) => {
                      // Finde Bot-Type-ID für diesen Namen - Farbe basiert auf ID, nicht Index!
                      const botType = availableBotTypes.find(bt => bt.name === botTypeName);
                      const botTypeId = botType ? String(botType.id) : '';
                      // Farbe aus compareColorMap (basiert auf selectedChartBotTypes Reihenfolge)
                      const lineColor = compareColorMap[botTypeId] || getCompareColor(index);
                      
                      const isHovered = botTypeId && hoveredBotTypeId === botTypeId;
                      const isAnyHovered = hoveredBotTypeId !== null;
                      
                      // Wenn gehoverd: Diese Linie hervorheben, andere dimmen
                      const strokeOpacity = isAnyHovered ? (isHovered ? 1 : 0.3) : 1;
                      const strokeW = isHovered ? 3 : 2;
                      const dotR = isHovered ? 5 : 4;
                      
                      return (
                        <Line 
                          key={`compare-${botTypeName}`}
                          type="monotone" 
                          dataKey={botTypeName}
                          name={botTypeName}
                          stroke={lineColor}
                          strokeWidth={strokeW}
                          strokeOpacity={strokeOpacity}
                          dot={(props: any) => {
                            const { cx, cy, payload } = props;
                            // Prüfe ob dieser Datenpunkt ein Closed Bot für diesen Bot-Type ist
                            const closedStatusKey = `${botTypeName}_status`;
                            const isClosedBot = payload?.[closedStatusKey] === 'Closed Bots';
                            const dotTimestamp = payload?.timestamp;
                            
                            // Finde den passenden Update-Key für diesen Punkt
                            // Im Compare-Modus: Bot-Type-ID im Key für eindeutige Zuordnung
                            // WICHTIG: Nur der EXAKTE Punkt soll matchen, nicht alle in der Nähe
                            // KRITISCH: Prüfe ob dieser Punkt für DIESEN Bot-Type relevant ist
                            const pointBotTypeName = payload?.botTypeName;
                            const isStartPoint = payload?.isStartPoint === true;
                            const pointValue = payload?.[botTypeName];
                            
                            // Nur Punkte für DIESEN Bot-Type können matchen
                            // MUSS sowohl den richtigen botTypeName haben ALS AUCH einen Wert (nicht null)
                            const isRelevantPoint = pointBotTypeName === botTypeName && pointValue !== null && pointValue !== undefined;
                            
                            const findMatchingUpdateKey = () => {
                              // WICHTIG: Nur Punkte die zu diesem Bot-Type gehören können matchen
                              if (!dotTimestamp || !botTypeId || !isRelevantPoint) return null;
                              
                              // Durchsuche allBotTypeUpdates nach passendem Update - NUR für diesen Bot-Type
                              const relevantUpdates = allBotTypeUpdates.filter(u => 
                                String(u.botTypeId) === String(botTypeId)
                              );
                              
                              // Finde NUR exakte Matches
                              for (const update of relevantUpdates) {
                                const endTs = update.thisUpload ? parseGermanDate(update.thisUpload)?.getTime() || 0 : 0;
                                const startTs = update.lastUpload ? parseGermanDate(update.lastUpload)?.getTime() || 0 : endTs;
                                const isClosedBotUpdate = update.status === 'Closed Bots';
                                // Im Compare-Modus: BotTypeId in den Key aufnehmen
                                const key = isClosedBotUpdate 
                                  ? `${botTypeId}:c-${update.version}` 
                                  : `${botTypeId}:u-${update.version}`;
                                
                                // Bei Closed Bots: NUR der End-Punkt zählt (NICHT Start-Punkt!)
                                if (isClosedBotUpdate) {
                                  // Closed Bots: Nur End-Punkt, NICHT Start-Punkt
                                  if (isStartPoint) continue; // Skip Start-Punkte bei Closed Bots
                                  
                                  const endDelta = Math.abs(endTs - dotTimestamp);
                                  if (endDelta < 60000) { // 60 Sekunden Toleranz
                                    return key;
                                  }
                                } else {
                                  // Normale Updates: Start ODER Ende
                                  const startDelta = Math.abs(startTs - dotTimestamp);
                                  const endDelta = Math.abs(endTs - dotTimestamp);
                                  
                                  // Prüfe ob dieser Punkt zum Start oder Ende gehört
                                  if (isStartPoint && startDelta < 60000) {
                                    return key;
                                  }
                                  if (!isStartPoint && endDelta < 60000) {
                                    return key;
                                  }
                                }
                              }
                              
                              return null;
                            };
                            
                            // Matching Key auch im Stift-Modus berechnen
                            const matchingKey = (markerViewActive || markerEditActive) ? findMatchingUpdateKey() : null;
                            // Punkt ist aktiv basierend auf dem aktuellen Modus:
                            // - Auge-Modus: hoveredUpdateId oder lockedUpdateIds
                            // - Stift-Modus: editHoveredUpdateId oder editSelectedUpdateId
                            const isPointActive = matchingKey !== null && (
                              (markerViewActive && (hoveredUpdateId === matchingKey || lockedUpdateIds.has(matchingKey))) ||
                              (markerEditActive && (editHoveredUpdateId === matchingKey || editSelectedUpdateId === matchingKey))
                            );
                            
                            // Hover-Handler für bidirektionale Interaktion (Auge UND Stift Modus)
                            const handleDotMouseEnter = () => {
                              if ((markerViewActive || markerEditActive) && matchingKey) {
                                setHoveredUpdateId(matchingKey);
                              }
                            };
                            const handleDotMouseLeave = () => {
                              if (markerViewActive || markerEditActive) {
                                setHoveredUpdateId(null);
                              }
                            };
                            const handleDotClick = () => {
                              if ((markerViewActive || markerEditActive) && matchingKey) {
                                setLockedUpdateIds(prev => {
                                  const newSet = new Set(prev);
                                  if (newSet.has(matchingKey)) {
                                    newSet.delete(matchingKey);
                                  } else {
                                    newSet.add(matchingKey);
                                  }
                                  return newSet;
                                });
                              }
                            };
                            
                            // WICHTIG: Wenn dieser Datenpunkt keinen Wert für diesen Bot-Type hat,
                            // keinen Kreis rendern! (verhindert doppelte Kreise in Compare-Modus)
                            if (pointValue === null || pointValue === undefined) {
                              return <g key={`dot-compare-empty-${payload?.timestamp}-${botTypeName}`} />;
                            }
                            
                            // Aktiver Punkt: Neon-Blau Glow
                            // WICHTIG: pointerEvents: 'all' damit Hover auf SVG-Kreisen funktioniert!
                            const activeStyle = isPointActive ? { 
                              filter: 'drop-shadow(0 0 6px rgba(8, 145, 178, 0.8))',
                              cursor: 'pointer',
                              pointerEvents: 'all' as const
                            } : { 
                              cursor: (markerViewActive || markerEditActive) ? 'pointer' : 'default',
                              pointerEvents: 'all' as const
                            };
                            const activeStroke = isPointActive ? 'rgb(8, 145, 178)' : lineColor;
                            const activeStrokeWidth = isPointActive ? 3 : 2;
                            
                            if (isClosedBot) {
                              // Closed Bots: Hohler Kreis (nur Rand, kein Fill)
                              return (
                                <circle
                                  key={`dot-compare-${payload?.timestamp}-${botTypeName}`}
                                  cx={cx}
                                  cy={cy}
                                  r={dotR + 1}
                                  fill="hsl(var(--background))"
                                  stroke={activeStroke}
                                  strokeWidth={activeStrokeWidth}
                                  strokeOpacity={strokeOpacity}
                                  style={activeStyle}
                                  onMouseEnter={handleDotMouseEnter}
                                  onMouseLeave={handleDotMouseLeave}
                                  onClick={handleDotClick}
                                />
                              );
                            }
                            
                            // Normale Punkte: Gefüllter Kreis
                            return (
                              <circle
                                key={`dot-compare-${payload?.timestamp}-${botTypeName}`}
                                cx={cx}
                                cy={cy}
                                r={isPointActive ? dotR + 1 : dotR}
                                fill={isPointActive ? 'rgb(8, 145, 178)' : lineColor}
                                stroke={activeStroke}
                                strokeOpacity={strokeOpacity}
                                style={activeStyle}
                                onMouseEnter={handleDotMouseEnter}
                                onMouseLeave={handleDotMouseLeave}
                                onClick={handleDotClick}
                              />
                            );
                          }}
                          connectNulls
                          isAnimationActive={true}
                          animationDuration={1200}
                          animationBegin={0}
                          animationEasing="ease-out"
                          style={isHovered ? { filter: `drop-shadow(0 0 4px ${lineColor})` } : {}}
                        />
                      );
                    })
                  ) : isMultiBotChartMode ? (
                    // Added-Modus: NUR END-EVENTS als separate Punkte
                    // Jeder End-Event hat seinen eigenen Y-Wert (individueller Profit)
                    // Linie verbindet alle End-Events chronologisch
                    activeMetricCards.map((metricName) => {
                      const dataKey = `Gesamt_${metricName}`;
                      const color = metricColors[metricName] || '#888888';
                      
                      return (
                        <Line 
                          key={`added-${metricName}`}
                          type="linear"
                          dataKey={dataKey}
                          name={metricName}
                          stroke={color}
                          strokeWidth={2}
                          dot={(props: any) => {
                            const { cx, cy, payload, value, index } = props;
                            const isClosedBot = payload?._isClosedBot;
                            const eventIndex = payload?._eventIndex ?? 0;
                            const updateVersion = payload?._updateVersion;
                            const botTypeName = payload?._botTypeName;
                            
                            // WICHTIG: Wenn kein gültiger Y-Wert vorhanden, keinen Punkt rendern
                            if (value === undefined || value === null || isNaN(cy) || isNaN(cx)) {
                              return <g key={`dot-added-empty-${metricName}-${eventIndex}`} />;
                            }
                            
                            // Prüfe ob dieser Punkt aktiv ist (gestrichelte Linie zeigt darauf)
                            // Finde botTypeId aus botTypeName
                            const botType = availableBotTypes.find(bt => bt.name === botTypeName);
                            const botTypeId = botType ? String(botType.id) : '';
                            const pointUpdateKey = botTypeId && updateVersion !== undefined
                              ? (isClosedBot ? `${botTypeId}:c-${updateVersion}` : `${botTypeId}:u-${updateVersion}`)
                              : null;
                            
                            // Punkt ist aktiv basierend auf dem aktuellen Modus:
                            // - Auge-Modus: hoveredUpdateId oder lockedUpdateIds
                            // - Stift-Modus: editHoveredUpdateId oder editSelectedUpdateId
                            const isPointActive = pointUpdateKey !== null && (
                              (markerViewActive && (hoveredUpdateId === pointUpdateKey || lockedUpdateIds.has(pointUpdateKey))) ||
                              (markerEditActive && (editHoveredUpdateId === pointUpdateKey || editSelectedUpdateId === pointUpdateKey))
                            );
                            
                            // Neon-Blau Styling wenn aktiv
                            const activeStroke = isPointActive ? 'rgb(8, 145, 178)' : color;
                            const activeStrokeWidth = isPointActive ? 3 : (isClosedBot ? 2 : 0);
                            const activeStyle = isPointActive ? { 
                              filter: 'drop-shadow(0 0 6px rgba(8, 145, 178, 0.8))'
                            } : {};
                            
                            return (
                              <circle
                                key={`dot-added-${metricName}-${eventIndex}`}
                                cx={cx}
                                cy={cy}
                                r={isPointActive ? 6 : 5}
                                fill={isClosedBot ? "hsl(var(--background))" : (isPointActive ? 'rgb(8, 145, 178)' : color)}
                                stroke={activeStroke}
                                strokeWidth={activeStrokeWidth}
                                style={activeStyle}
                              />
                            );
                          }}
                          connectNulls
                          isAnimationActive={true}
                          animationDuration={1200}
                          animationBegin={0}
                          animationEasing="ease-out"
                        />
                      );
                    })
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
                  
                  {/* ========== COMPARE MODE: Highest Value Markers ========== */}
                  {/* Zeigt ↑H Marker für jeden Bot-Type im Compare-Modus */}
                  {showHighestValue && isMultiSelectCompareMode && (() => {
                    const markers = Object.entries(compareExtremeValues.highest)
                      .map(([botTypeName, data]) => ({ botTypeName, data }))
                      .filter(m => m.data) as { botTypeName: string; data: { timestamp: number; value: number; botTypeName: string; color: string } }[];
                    
                    if (markers.length === 0) return null;
                    
                    // Berechne Y-Range für relative Abstände
                    const chartData = compareChartData.data || [];
                    const botTypeNames = compareChartData.botTypeNames || [];
                    const allY = chartData.flatMap((p: any) => 
                      botTypeNames.map(name => p[name]).filter((v: any) => typeof v === 'number') as number[]
                    );
                    const minY = allY.length > 0 ? Math.min(...allY) : 0;
                    const maxY = allY.length > 0 ? Math.max(...allY) : 1;
                    const yRange = maxY - minY || 1;
                    const minGap = yRange * 0.03;
                    
                    // Finde alle Y-Werte bei einem Timestamp
                    const getYValuesAt = (ts: number) => {
                      const point = chartData.find((p: any) => Math.abs(p.timestamp - ts) < 60000);
                      if (!point) return [];
                      return botTypeNames
                        .map(name => (point as any)[name])
                        .filter((v: any) => typeof v === 'number') as number[];
                    };
                    
                    // Berechne Offset für jeden Marker
                    const resolved = markers.map((marker, i) => {
                      const { timestamp, value, color } = marker.data;
                      let offset = 8;
                      
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
                      
                      return { ...marker, offset, flipToTop, color };
                    });
                    
                    return resolved.map(m => (
                      <ReferenceDot
                        key={`compare-highest-${m.botTypeName}`}
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
                  
                  {/* ========== COMPARE MODE: Lowest Value Markers ========== */}
                  {/* Zeigt ↓L Marker für jeden Bot-Type im Compare-Modus */}
                  {showLowestValue && isMultiSelectCompareMode && (() => {
                    const markers = Object.entries(compareExtremeValues.lowest)
                      .map(([botTypeName, data]) => ({ botTypeName, data }))
                      .filter(m => m.data) as { botTypeName: string; data: { timestamp: number; value: number; botTypeName: string; color: string } }[];
                    
                    if (markers.length === 0) return null;
                    
                    // Berechne Y-Range
                    const chartData = compareChartData.data || [];
                    const botTypeNames = compareChartData.botTypeNames || [];
                    const allY = chartData.flatMap((p: any) => 
                      botTypeNames.map(name => p[name]).filter((v: any) => typeof v === 'number') as number[]
                    );
                    const maxY = allY.length > 0 ? Math.max(...allY) : 1;
                    const minY = allY.length > 0 ? Math.min(...allY) : 0;
                    const yRange = maxY - minY || 1;
                    const minGap = yRange * 0.03;
                    
                    // Finde alle Y-Werte bei einem Timestamp
                    const getYValuesAt = (ts: number) => {
                      const point = chartData.find((p: any) => Math.abs(p.timestamp - ts) < 60000);
                      if (!point) return [];
                      return botTypeNames
                        .map(name => (point as any)[name])
                        .filter((v: any) => typeof v === 'number') as number[];
                    };
                    
                    // Berechne Offset für jeden Marker
                    const resolved = markers.map((marker, i) => {
                      const { timestamp, value, color } = marker.data;
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
                      
                      return { ...marker, offset, color };
                    });
                    
                    return resolved.map(m => (
                      <ReferenceDot
                        key={`compare-lowest-${m.botTypeName}`}
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
                  
                  {/* ========== ADDED MODE: Highest Value Marker für JEDE aktive Metrik ========== */}
                  {/* Zeigt ↑H Marker für jede Content Card die aktiv ist */}
                  {showHighestValue && isMultiBotChartMode && (() => {
                    // Finde alle aktiven Metriken (Content Cards die sichtbar sind)
                    const activeMetrics = activeMetricCards.filter(m => m !== 'Gesamtprofit');
                    // Gesamtprofit ist immer aktiv im Added-Mode, also fügen wir sie hinzu
                    const allActiveMetrics = ['Gesamtprofit', ...activeMetrics];
                    
                    return allActiveMetrics.map((metricName, index) => {
                      const extreme = addedExtremeValues.perMetric?.[metricName];
                      if (!extreme?.highest) return null;
                      
                      // Farbe aus metricColors holen
                      const color = metricColors[metricName] || '#888888';
                      
                      // Offset für Überlappungsvermeidung
                      const offset = 8 + (index * 14);
                      
                      return (
                        <ReferenceDot
                          key={`added-highest-${metricName}`}
                          x={extreme.highest.timestamp}
                          y={extreme.highest.value}
                          r={0}
                          label={{
                            value: '↑H',
                            position: 'bottom',
                            fill: color,
                            fontSize: 12,
                            fontWeight: 'bold',
                            offset: offset,
                          }}
                        />
                      );
                    });
                  })()}
                  
                  {/* ========== ADDED MODE: Lowest Value Marker für JEDE aktive Metrik ========== */}
                  {/* Zeigt ↓L Marker für jede Content Card die aktiv ist */}
                  {showLowestValue && isMultiBotChartMode && (() => {
                    // Finde alle aktiven Metriken (Content Cards die sichtbar sind)
                    const activeMetrics = activeMetricCards.filter(m => m !== 'Gesamtprofit');
                    // Gesamtprofit ist immer aktiv im Added-Mode, also fügen wir sie hinzu
                    const allActiveMetrics = ['Gesamtprofit', ...activeMetrics];
                    
                    return allActiveMetrics.map((metricName, index) => {
                      const extreme = addedExtremeValues.perMetric?.[metricName];
                      if (!extreme?.lowest) return null;
                      
                      // Farbe aus metricColors holen
                      const color = metricColors[metricName] || '#888888';
                      
                      // Offset für Überlappungsvermeidung
                      const offset = 8 + (index * 14);
                      
                      return (
                        <ReferenceDot
                          key={`added-lowest-${metricName}`}
                          x={extreme.lowest.timestamp}
                          y={extreme.lowest.value}
                          r={0}
                          label={{
                            value: '↓L',
                            position: 'top',
                            fill: color,
                            fontSize: 12,
                            fontWeight: 'bold',
                            offset: offset,
                          }}
                        />
                      );
                    });
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
                  
                  // Parse Update ID - unterstützt beide Formate:
                  // Normal-Modus: "u-X" oder "c-X"
                  // Compare-Modus: "{botTypeId}:u-X" oder "{botTypeId}:c-X"
                  let parsedBotTypeId: string | null = null;
                  let updatePart = activeEditId;
                  
                  if (activeEditId.includes(':')) {
                    // Compare-Modus: extrahiere botTypeId und update-Teil
                    const colonIndex = activeEditId.indexOf(':');
                    parsedBotTypeId = activeEditId.substring(0, colonIndex);
                    updatePart = activeEditId.substring(colonIndex + 1);
                  }
                  
                  const isClosedBot = updatePart.startsWith('c-');
                  const version = parseInt(updatePart.split('-')[1], 10);
                  
                  // Finde das Update in den Daten
                  // Compare-Modus: Suche in dem spezifischen Bot-Type
                  // Normal-Modus: Suche im ausgewählten Bot-Type
                  const targetBotTypeId = parsedBotTypeId || effectiveSelectedBotTypeData?.id;
                  const allUpdates = targetBotTypeId 
                    ? (allBotTypeUpdates || []).filter((u: BotTypeUpdate) => u.botTypeId === targetBotTypeId)
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
                    onClick={() => {
                      if (!analyzeMode) {
                        // Analyze-Modus EINSCHALTEN: Snapshot der activeMetricCards speichern
                        setPreAnalyzeActiveMetricCards([...activeMetricCards]);
                      } else {
                        // Analyze-Modus AUSSCHALTEN: Gespeicherte activeMetricCards wiederherstellen
                        if (preAnalyzeActiveMetricCards) {
                          setActiveMetricCards(preAnalyzeActiveMetricCards);
                          setPreAnalyzeActiveMetricCards(null);
                        }
                      }
                      setAnalyzeMode(!analyzeMode);
                    }}
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
            {/* Im Analyze-Status komplett ausgegraut und nicht anklickbar */}
            <div className={cn(
              "flex ring-2 ring-cyan-600 shadow-[0_0_15px_rgba(8,145,178,0.6)] rounded-lg",
              analyzeMode && "opacity-50 pointer-events-none"
            )} style={{ height: '300px' }}>
            {/* Collapse Toggle Strip - Left Side */}
            <div 
              className={cn(
                "flex flex-col items-center justify-start pt-3 w-10 bg-muted/30 cursor-pointer hover-elevate border",
                settingsCollapsed ? "rounded-md" : "rounded-l-md border-r-0"
              )}
              onClick={() => !analyzeMode && setSettingsCollapsed(!settingsCollapsed)}
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

        {/* Alle Einträge Bereich - im Analyze-Status komplett ausgegraut */}
        <div className={cn("mb-8", analyzeMode && "opacity-50 pointer-events-none")}>
          <div className="flex items-center gap-4 mb-4">
            <h2 className="text-xl font-bold">
              Alle Einträge
            </h2>
            <div className="flex items-center bg-muted rounded-lg p-1 ring-2 ring-cyan-600 shadow-[0_0_15px_rgba(8,145,178,0.6)]" data-testid="toggle-alle-eintraege-mode">
              <button
                onClick={() => !analyzeMode && setAlleEintraegeMode('compare')}
                disabled={analyzeMode}
                className={cn(
                  "px-3 py-1 text-sm font-medium rounded-md transition-colors",
                  analyzeMode 
                    ? "cursor-not-allowed"
                    : alleEintraegeMode === 'compare' 
                      ? "bg-background text-foreground shadow-sm" 
                      : "text-muted-foreground hover:text-foreground"
                )}
                data-testid="button-mode-compare"
              >
                Compare
              </button>
              <button
                onClick={() => !analyzeMode && setAlleEintraegeMode('added')}
                disabled={analyzeMode}
                className={cn(
                  "px-3 py-1 text-sm font-medium rounded-md transition-colors",
                  analyzeMode 
                    ? "cursor-not-allowed"
                    : alleEintraegeMode === 'added' 
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
                // Wenn 2+ ausgewählt → "Gesamt" oder "Custom" je nach Added Modus
                else if (newSelection.length >= 2) {
                  // Added Modus: "Gesamt" wenn ALLE aktiven Bot-Types ausgewählt, sonst "Custom"
                  if (alleEintraegeMode === 'added') {
                    const activeBotTypes = availableBotTypes.filter(bt => bt.isActive);
                    const allActiveSelected = activeBotTypes.length > 0 && 
                      activeBotTypes.every(bt => newSelection.includes(String(bt.id)));
                    setSelectedBotName(allActiveSelected ? "Gesamt" : "Custom");
                  } else {
                    // Compare Modus: immer "Custom"
                    setSelectedBotName("Custom");
                  }
                }
                
                return newSelection;
              });
            }}
            isCompareMode={isMultiSelectCompareMode || isMultiBotChartMode}
            compareColors={compareColorMap}
            hoveredBotType={hoveredBotTypeId}
            onBotTypeHover={setHoveredBotTypeId}
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
              <DialogTitle>From Update auswählen - {selectedChartBotTypes.length >= 2 
                ? `${selectedChartBotTypes.length} Bot-Types` 
                : selectedBotName}</DialogTitle>
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
              {sortedUpdatesForDialogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Keine Updates vorhanden
                </div>
              ) : (
                sortedUpdatesForDialogs.map((update) => {
                  const profitValue = parseFloat(update.profit || '0') || 0;
                  const closedBotsTitleColor = update.status === 'Closed Bots' 
                    ? (profitValue > 0 ? 'text-green-600' : profitValue < 0 ? 'text-red-600' : '')
                    : '';
                  const gridProfit24h = update.avgGridProfitDay || '0.00';
                  const updateBotTypeName = availableBotTypes.find(bt => String(bt.id) === String(update.botTypeId))?.name || '';
                  
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
                        <div className="flex items-center gap-2 mb-2">
                          <p className={`font-semibold text-sm ${closedBotsTitleColor}`}>
                            {update.status} #{update.version}
                          </p>
                          {selectedChartBotTypes.length >= 2 && updateBotTypeName && (
                            <Badge variant="outline" className="text-xs">{updateBotTypeName}</Badge>
                          )}
                        </div>
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
              <DialogTitle>Until Update auswählen - {selectedChartBotTypes.length >= 2 
                ? `${selectedChartBotTypes.length} Bot-Types` 
                : selectedBotName}</DialogTitle>
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
                  const updateBotTypeName = availableBotTypes.find(bt => String(bt.id) === String(update.botTypeId))?.name || '';
                  
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
                        <div className="flex items-center gap-2 mb-2">
                          <p className={`font-semibold text-sm ${closedBotsTitleColor}`}>
                            {update.status} #{update.version}
                          </p>
                          {selectedChartBotTypes.length >= 2 && updateBotTypeName && (
                            <Badge variant="outline" className="text-xs">{updateBotTypeName}</Badge>
                          )}
                        </div>
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
              // Compare-Modus: Alle Updates der ausgewählten Bot-Types
              // Normal-Modus: Nur sortedUpdates des einen Bot-Types
              const isCompareMode = selectedChartBotTypes.length >= 2;
              
              let visibleUpdates: any[] = [];
              if (isCompareMode) {
                // Alle Updates der ausgewählten Bot-Types
                visibleUpdates = (allBotTypeUpdates || [])
                  .filter((u: BotTypeUpdate) => selectedChartBotTypes.includes(u.botTypeId))
                  .sort((a: BotTypeUpdate, b: BotTypeUpdate) => {
                    const dateA = a.thisUpload ? new Date(a.thisUpload).getTime() : 0;
                    const dateB = b.thisUpload ? new Date(b.thisUpload).getTime() : 0;
                    return dateB - dateA; // Neueste zuerst
                  });
              } else {
                visibleUpdates = sortedUpdates || [];
              }
              
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
                    // Compare-Modus: Key mit botTypeId-Prefix
                    // Normal-Modus: Einfaches Key-Format
                    const baseKey = isClosedBot ? `c-${update.version}` : `u-${update.version}`;
                    const key = isCompareMode && update.botTypeId ? `${update.botTypeId}:${baseKey}` : baseKey;
                    
                    // Im Compare-Modus: Bot-Type-Name zum Titel hinzufügen
                    const botTypeName = update.botTypeId ? availableBotTypes.find(bt => bt.id === update.botTypeId)?.name : null;
                    const baseTitle = isClosedBot ? `Closed Bot #${update.version}` : `Update #${update.version}`;
                    const title = isCompareMode && botTypeName ? `${botTypeName}: ${baseTitle}` : baseTitle;
                    
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
