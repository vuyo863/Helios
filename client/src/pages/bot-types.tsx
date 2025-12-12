import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BotType, BotTypeUpdate, BotEntry } from "@shared/schema";
import { Layers, Calendar, Pencil, Eye, Plus, Check, X, TrendingUp, Trash2, FileText, RotateCcw, Archive, MessageCircle, RefreshCw, ChevronUp, ChevronDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parse, parseISO, isValid } from "date-fns";
import { de } from "date-fns/locale";
import { useState, useEffect } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { useUpdateNotification } from "@/lib/update-notification-context";

// Helper function to parse runtime string like "1d 14h 28m" to hours
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

// Formatiert Werte mit "+" Präfix bei positiven Zahlen (für USDT und Prozent)
// NICHT für Mengenangaben wie Investment/Gesamtinvestment verwenden!
// decimals: Anzahl der Nachkommastellen (Standard: 2 für Prozent, 4 für USDT)
function formatWithSign(value: string | number | null | undefined, suffix: string = '', decimals: number = 2): string {
  if (value === null || value === undefined || value === '' || value === '-') {
    return '-';
  }
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return '-';
  
  // Formatiere mit maximalen Nachkommastellen
  let formatted = numValue.toFixed(decimals);
  
  // Entferne nachgestellte Nullen (aber behalte mindestens 2 Dezimalstellen)
  if (decimals > 2) {
    // Entferne alle nachgestellten Nullen nach dem Dezimalpunkt
    formatted = formatted.replace(/\.?0+$/, '');
    
    // Wenn kein Dezimaltrennzeichen mehr vorhanden, füge .00 hinzu
    if (!formatted.includes('.')) {
      formatted += '.00';
    } else {
      // Stelle sicher, dass mindestens 2 Dezimalstellen vorhanden sind
      const decimalPart = formatted.split('.')[1] || '';
      if (decimalPart.length === 1) {
        formatted += '0';
      }
    }
  }
  
  if (numValue > 0) {
    return `+${formatted}${suffix}`;
  }
  return `${formatted}${suffix}`;
}

// Spezielle Funktion für USDT-Werte mit bis zu 4 Nachkommastellen
function formatUsdtWithSign(value: string | number | null | undefined): string {
  return formatWithSign(value, '', 4);
}

export default function BotTypesPage() {
  const { data: botTypes = [], isLoading } = useQuery<BotType[]>({
    queryKey: ['/api/bot-types'],
  });

  const { data: botEntries = [] } = useQuery<BotEntry[]>({
    queryKey: ['/api/bot-entries'],
  });
  
  // Load all updates for all bot types (for calculating totals on cards)
  const { data: allUpdates = [] } = useQuery<BotTypeUpdate[]>({
    queryKey: ['/api/bot-type-updates'],
  });

  const [editingBotTypeId, setEditingBotTypeId] = useState<string | null>(null);
  const [editedValues, setEditedValues] = useState<{ name: string; description: string; wontLiqBudget: string }>({
    name: '',
    description: '',
    wontLiqBudget: ''
  });
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedBotType, setSelectedBotType] = useState<BotType | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [botTypeToDelete, setBotTypeToDelete] = useState<BotType | null>(null);
  const [updateDetailDialogOpen, setUpdateDetailDialogOpen] = useState(false);
  const [selectedUpdate, setSelectedUpdate] = useState<BotTypeUpdate | null>(null);
  
  // Notizen-Dialog State
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [notesUpdate, setNotesUpdate] = useState<BotTypeUpdate | null>(null);
  const [editingNotes, setEditingNotes] = useState('');
  
  // Update Notification State
  const [updateConfirmDialogOpen, setUpdateConfirmDialogOpen] = useState(false);
  const { pendingUpdate, clearPendingUpdate } = useUpdateNotification();
  
  // Sortierung State für Update Verlauf
  const [sortBy, setSortBy] = useState<'datum' | 'gridProfit' | 'gridProfit24h' | 'gesInvest'>('datum');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');

  const { toast } = useToast();
  
  // Check if any modal is open
  const anyModalOpen = viewDialogOpen || deleteDialogOpen || updateDetailDialogOpen || notesDialogOpen;
  
  // Listen for pending updates and show confirmation dialog if a modal is open
  useEffect(() => {
    if (pendingUpdate && anyModalOpen) {
      setUpdateConfirmDialogOpen(true);
      clearPendingUpdate();
    } else if (pendingUpdate && !anyModalOpen) {
      // No modal open, just refresh data silently
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && typeof key[0] === 'string' && key[0].startsWith('/api/bot-type');
        }
      });
      clearPendingUpdate();
    }
  }, [pendingUpdate, anyModalOpen, clearPendingUpdate]);
  
  // Handle update confirmation
  const handleUpdateConfirm = () => {
    // Invalidate all bot-type queries
    queryClient.invalidateQueries({ 
      predicate: (query) => {
        const key = query.queryKey;
        return Array.isArray(key) && typeof key[0] === 'string' && key[0].startsWith('/api/bot-type');
      }
    });
    // Close all modals
    setViewDialogOpen(false);
    setDeleteDialogOpen(false);
    setUpdateDetailDialogOpen(false);
    setNotesDialogOpen(false);
    setUpdateConfirmDialogOpen(false);
    toast({
      title: "Daten aktualisiert",
      description: "Die Daten wurden erfolgreich aktualisiert.",
    });
  };
  
  // Handle update dismiss
  const handleUpdateDismiss = () => {
    setUpdateConfirmDialogOpen(false);
    // Do nothing - just close the confirmation dialog
  };

  // Fetch updates for selected bot type
  const { data: updates = [] } = useQuery<BotTypeUpdate[]>({
    queryKey: ['/api/bot-types', selectedBotType?.id, 'updates'],
    enabled: !!selectedBotType?.id,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; name: string; description: string; wontLiqBudget: string }) => {
      return await apiRequest('PUT', `/api/bot-types/${data.id}`, {
        name: data.name,
        description: data.description,
        wontLiqBudget: data.wontLiqBudget
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bot-types'] });
      setEditingBotTypeId(null);
      toast({
        title: "Erfolgreich gespeichert",
        description: "Bot Type wurde erfolgreich aktualisiert.",
      });
    },
    onError: () => {
      toast({
        title: "Fehler",
        description: "Bot Type konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    }
  });

  const handleEditClick = (botType: BotType) => {
    setEditingBotTypeId(botType.id);
    setEditedValues({
      name: botType.name,
      description: botType.description || '',
      wontLiqBudget: botType.wontLiqBudget || ''
    });
  };

  const handleSave = (id: string) => {
    updateMutation.mutate({
      id,
      name: editedValues.name,
      description: editedValues.description,
      wontLiqBudget: editedValues.wontLiqBudget
    });
  };

  const handleCancel = () => {
    setEditingBotTypeId(null);
    setEditedValues({ name: '', description: '', wontLiqBudget: '' });
  };

  const handleViewClick = (botType: BotType) => {
    setSelectedBotType(botType);
    setViewDialogOpen(true);
  };
  
  // Notizen bearbeiten
  const handleNotesClick = (update: BotTypeUpdate) => {
    setNotesUpdate(update);
    setEditingNotes(update.notes || '');
    setNotesDialogOpen(true);
  };
  
  const updateNotesMutation = useMutation({
    mutationFn: async (data: { updateId: string; notes: string }) => {
      return await apiRequest('PATCH', `/api/bot-type-updates/${data.updateId}/notes`, {
        notes: data.notes
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bot-types', selectedBotType?.id, 'updates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/bot-type-updates'] });
      setNotesDialogOpen(false);
      setNotesUpdate(null);
      toast({
        title: "Notizen gespeichert",
        description: "Die Notizen wurden erfolgreich aktualisiert.",
      });
    },
    onError: () => {
      toast({
        title: "Fehler",
        description: "Die Notizen konnten nicht gespeichert werden.",
        variant: "destructive",
      });
    }
  });
  
  const handleNotesSave = () => {
    if (notesUpdate) {
      updateNotesMutation.mutate({
        updateId: notesUpdate.id,
        notes: editingNotes
      });
    }
  };

  const deleteBotTypeMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/bot-types/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bot-types'] });
      queryClient.invalidateQueries({ queryKey: ['/api/entries'] });
      toast({
        title: "Bot-Typ gelöscht",
        description: "Der Bot-Typ und alle zugehörigen Daten wurden erfolgreich gelöscht.",
      });
      setDeleteDialogOpen(false);
      setBotTypeToDelete(null);
    },
    onError: () => {
      toast({
        title: "Fehler",
        description: "Der Bot-Typ konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    },
  });

  const archiveBotTypeMutation = useMutation({
    mutationFn: async ({ id, isArchived, isActive }: { id: string; isArchived?: boolean; isActive?: boolean }) => {
      if (isActive !== undefined) {
        return await apiRequest('PATCH', `/api/bot-types/${id}/active`, { isActive });
      }
      return await apiRequest('PATCH', `/api/bot-types/${id}/archive`, { isArchived });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/bot-types'] });
      if (variables.isActive !== undefined) {
        toast({
          title: variables.isActive ? "Bot-Typ aktiviert" : "Bot-Typ deaktiviert",
          description: variables.isActive 
            ? "Der Bot-Typ wurde erfolgreich aktiviert." 
            : "Der Bot-Typ wurde erfolgreich deaktiviert.",
        });
      } else {
        toast({
          title: variables.isArchived ? "Bot-Typ archiviert" : "Bot-Typ wiederhergestellt",
          description: variables.isArchived 
            ? "Der Bot-Typ wurde erfolgreich archiviert." 
            : "Der Bot-Typ wurde erfolgreich wiederhergestellt.",
        });
        setDeleteDialogOpen(false);
        setBotTypeToDelete(null);
      }
    },
    onError: () => {
      toast({
        title: "Fehler",
        description: "Die Aktion konnte nicht durchgeführt werden.",
        variant: "destructive",
      });
    },
  });

  const handleDeleteClick = (botType: BotType) => {
    setBotTypeToDelete(botType);
    setDeleteDialogOpen(true);
  };

  const handleArchiveConfirm = () => {
    if (botTypeToDelete) {
      archiveBotTypeMutation.mutate({ id: botTypeToDelete.id, isArchived: true });
    }
  };

  const handleRestoreConfirm = (botType: BotType) => {
    archiveBotTypeMutation.mutate({ id: botType.id, isArchived: false });
  };

  const handleDeleteConfirm = () => {
    if (botTypeToDelete) {
      deleteBotTypeMutation.mutate(botTypeToDelete.id);
    }
  };

  const activeBotTypes = botTypes.filter(bt => !bt.isArchived);
  const archivedBotTypes = botTypes.filter(bt => bt.isArchived);


  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <Skeleton className="h-10 w-64 mb-2" />
            <Skeleton className="h-6 w-96" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold mb-2" data-testid="text-page-title">Bot Types</h1>
            <p className="text-muted-foreground text-lg">
              Verwalten Sie Ihre Bot-Kategorien und Strategien
            </p>
          </div>
          <Link href="/upload?createBotType=true">
            <Button 
              variant="default" 
              className="gap-2"
              data-testid="button-create-bot-type"
            >
              <Plus className="w-4 h-4" />
              Create Bot Type
            </Button>
          </Link>
        </div>

        {activeBotTypes.length === 0 && archivedBotTypes.length === 0 ? (
          <Card className="p-12 text-center">
            <CardContent>
              <Layers className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">Keine Bot Types gefunden</h3>
              <p className="text-muted-foreground">
                Erstellen Sie Bot Types, um Ihre Trading-Strategien zu kategorisieren.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeBotTypes.map((botType) => {
              const isEditing = editingBotTypeId === botType.id;
              // Calculate total Grid Profit from all updates for this bot type
              const updatesForType = allUpdates.filter(update => update.botTypeId === botType.id);
              
              // Gesamt Profit: Alle Updates, aber unterschiedliche Felder je nach Status
              // - Update Metrics: overallGridProfitUsdt (Grid Profit)
              // - Closed Bots: profit (Gesamt Profit)
              const totalGridProfit = updatesForType.reduce((sum, update) => {
                if (update.status === 'Closed Bots') {
                  return sum + (parseFloat(update.profit || '0') || 0);
                } else {
                  return sum + (parseFloat(update.overallGridProfitUsdt || '0') || 0);
                }
              }, 0);
              
              // Calculate 24h average profit using WEIGHTED average (Methode 2)
              // WICHTIG: Nur "Update Metrics" verwenden, Closed Bots werden NICHT einberechnet
              // 1. Sum all Grid Profits (nur Update Metrics)
              // 2. Sum all runtimes in hours
              // 3. profitPerHour = totalProfit / totalHours
              // 4. profit24h = profitPerHour * 24
              let avg24hProfit = 0;
              const updateMetricsOnly = updatesForType.filter(update => update.status === 'Update Metrics');
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
              
              return (
                <Card 
                  key={botType.id} 
                  className="hover-elevate active-elevate-2 transition-all"
                  data-testid={`card-bot-type-${botType.id}`}
                >
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        {isEditing ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Layers className="w-5 h-5 text-primary flex-shrink-0" />
                              <Input
                                value={editedValues.name}
                                onChange={(e) => setEditedValues(prev => ({ ...prev, name: e.target.value }))}
                                className="text-xl font-semibold"
                                placeholder="Bot Type Name"
                                data-testid={`input-name-${botType.id}`}
                              />
                            </div>
                            <Textarea
                              value={editedValues.description}
                              onChange={(e) => setEditedValues(prev => ({ ...prev, description: e.target.value }))}
                              className="text-sm min-h-[60px]"
                              placeholder="Beschreibung (optional)"
                              data-testid={`input-description-${botType.id}`}
                            />
                            <div>
                              <label className="text-xs text-muted-foreground">Wont Liq. Budget (USDT)</label>
                              <Input
                                type="number"
                                step="0.01"
                                value={editedValues.wontLiqBudget}
                                onChange={(e) => setEditedValues(prev => ({ ...prev, wontLiqBudget: e.target.value }))}
                                className="text-sm"
                                placeholder="0.00"
                                data-testid={`input-wont-liq-${botType.id}`}
                              />
                            </div>
                          </div>
                        ) : (
                          <>
                            <CardTitle className="text-xl mb-1 flex items-center gap-2">
                              <Layers className="w-5 h-5 text-primary" />
                              {botType.name}
                              {botType.isActive && (
                                <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800">
                                  Aktiv
                                </Badge>
                              )}
                            </CardTitle>
                            {botType.description && (
                              <CardDescription className="text-sm mt-2">
                                {botType.description}
                              </CardDescription>
                            )}
                          </>
                        )}
                      </div>
                      {botType.color && (
                        <div 
                          className="w-8 h-8 rounded-md border-2 border-border flex-shrink-0"
                          style={{ backgroundColor: botType.color }}
                          data-testid={`color-indicator-${botType.id}`}
                        />
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>
                        Last Updated: {(() => {
                          // Finde das neueste Update nach createdAt aus allen Updates für diesen Bot-Typ
                          if (updatesForType.length === 0) {
                            return format(new Date(botType.createdAt), "dd.MM.yyyy", { locale: de });
                          }
                          const latestUpdate = [...updatesForType].sort((a, b) => {
                            const dateA = a.createdAt ? new Date(a.createdAt as Date).getTime() : 0;
                            const dateB = b.createdAt ? new Date(b.createdAt as Date).getTime() : 0;
                            return dateB - dateA;
                          })[0];
                          return latestUpdate?.createdAt 
                            ? format(new Date(latestUpdate.createdAt as Date), "dd.MM.yyyy", { locale: de }) 
                            : format(new Date(botType.createdAt), "dd.MM.yyyy", { locale: de });
                        })()}
                      </span>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Gesamt Profit:</span>
                        <span className="font-medium text-primary" data-testid={`text-total-profit-${botType.id}`}>
                          {totalGridProfit > 0 ? '+' : ''}{totalGridProfit.toFixed(2)} USDT
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">24h Ø Profit:</span>
                        <span className="font-medium" data-testid={`text-avg-profit-${botType.id}`}>
                          {avg24hProfit > 0 ? '+' : ''}{avg24hProfit.toFixed(2)} USDT
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Gesamtinvestment-Ø:</span>
                        <span className="font-medium" data-testid={`text-avg-investment-${botType.id}`}>
                          {updatesForType.length > 0 
                            ? (updatesForType.reduce((sum, u) => sum + (parseFloat(u.totalInvestment || '0') || 0), 0) / updatesForType.length).toFixed(2)
                            : '0.00'} USDT
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Runtime:</span>
                        <span className="font-medium" data-testid={`text-runtime-${botType.id}`}>
                          {(() => {
                            if (updatesForType.length === 0) return '-';
                            
                            // Helper: Parse runtime string (e.g. "12d 5h 30m 22s") to milliseconds
                            const parseRuntimeToMs = (runtime: string): number => {
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
                            };
                            
                            // Helper: Parse German date format (dd.MM.yyyy HH:mm:ss or dd.MM.yyyy HH:mm)
                            const parseGermanDate = (dateStr: string): Date | null => {
                              if (!dateStr) return null;
                              // Try with seconds first
                              let parsed = parse(dateStr, "dd.MM.yyyy HH:mm:ss", new Date(), { locale: de });
                              if (isValid(parsed)) return parsed;
                              // Try without seconds
                              parsed = parse(dateStr, "dd.MM.yyyy HH:mm", new Date(), { locale: de });
                              if (isValid(parsed)) return parsed;
                              // Try ISO format
                              parsed = parseISO(dateStr);
                              if (isValid(parsed)) return parsed;
                              // Fallback to native Date
                              parsed = new Date(dateStr);
                              if (isValid(parsed)) return parsed;
                              return null;
                            };
                            
                            // Finde das früheste Startdatum aus allen Updates (Update Metrics + Closed Bots)
                            const allDates: Date[] = [];
                            updatesForType.forEach(update => {
                              // Für Closed Bots: Startdatum = thisUpload - longestRuntime
                              if (update.status === 'Closed Bots' && update.thisUpload && update.longestRuntime) {
                                const endDate = parseGermanDate(update.thisUpload as string);
                                if (endDate) {
                                  const runtimeMs = parseRuntimeToMs(update.longestRuntime as string);
                                  const startDate = new Date(endDate.getTime() - runtimeMs);
                                  if (isValid(startDate)) {
                                    allDates.push(startDate);
                                  }
                                }
                              }
                              // Für Update Metrics: date ist das Startdatum
                              else if (update.status === 'Update Metrics' && update.date) {
                                const dateVal = parseGermanDate(update.date as string);
                                if (dateVal) {
                                  allDates.push(dateVal);
                                }
                              }
                            });
                            
                            if (allDates.length === 0) return '-';
                            
                            const metricStarted = allDates.reduce((earliest, current) => 
                              current < earliest ? current : earliest
                            );
                            
                            const lastUpdated = updatesForType[0]?.createdAt;
                            if (!lastUpdated) return '-';
                            
                            const startDate = metricStarted;
                            const endDate = new Date(lastUpdated);
                            const diffMs = endDate.getTime() - startDate.getTime();
                            
                            const diffMinutes = Math.floor(diffMs / (1000 * 60));
                            const diffHours = Math.floor(diffMinutes / 60);
                            const diffDays = Math.floor(diffHours / 24);
                            
                            const days = diffDays;
                            const hours = diffHours % 24;
                            const minutes = diffMinutes % 60;
                            
                            const parts = [];
                            if (days > 0) parts.push(`${days}d`);
                            if (hours > 0) parts.push(`${hours}h`);
                            if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
                            
                            return parts.join(' ');
                          })()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Wont Liq. Budget:</span>
                        <span className="font-medium" data-testid={`text-wont-liq-${botType.id}`}>
                          {botType.wontLiqBudget || '0.00'} USDT
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-2 border-t">
                      <div className="flex items-center gap-2">
                        {botType.color && (
                          <Badge 
                            variant="secondary"
                            data-testid={`badge-color-${botType.id}`}
                          >
                            {botType.color}
                          </Badge>
                        )}
                        {isEditing && (
                          <div className="flex items-center gap-1">
                            <Button 
                              size="sm"
                              variant="default"
                              onClick={() => handleSave(botType.id)}
                              disabled={updateMutation.isPending}
                              data-testid={`button-save-${botType.id}`}
                              className="h-8 gap-1"
                            >
                              <Check className="w-3 h-3" />
                              Save
                            </Button>
                            <Button 
                              size="sm"
                              variant="outline"
                              onClick={handleCancel}
                              disabled={updateMutation.isPending}
                              data-testid={`button-cancel-${botType.id}`}
                              className="h-8 gap-1"
                            >
                              <X className="w-3 h-3" />
                              Cancel
                            </Button>
                          </div>
                        )}
                      </div>
                      {!isEditing && (
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={botType.isActive || false}
                            onCheckedChange={(checked) => {
                              archiveBotTypeMutation.mutate({ 
                                id: botType.id, 
                                isActive: checked 
                              });
                            }}
                            data-testid={`switch-active-${botType.id}`}
                            className="scale-75"
                          />
                          <Button 
                            size="icon" 
                            variant="ghost"
                            className="w-8 h-8"
                            onClick={() => handleEditClick(botType)}
                            data-testid={`button-edit-${botType.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost"
                            className="w-8 h-8"
                            onClick={() => handleViewClick(botType)}
                            data-testid={`button-view-${botType.id}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost"
                            className="w-8 h-8 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteClick(botType)}
                            data-testid={`button-delete-${botType.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {archivedBotTypes.length > 0 && (
            <>
              <Separator className="my-8" />
              <div className="mb-6">
                <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                  <Archive className="w-6 h-6 text-muted-foreground" />
                  Archiv
                </h2>
                <p className="text-muted-foreground">
                  Archivierte Bot-Types
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {archivedBotTypes.map((botType) => {
                  const entriesForType = botEntries.filter(entry => entry.botTypeId === botType.id);
                  const updatesForTypeArchived = allUpdates.filter(update => update.botTypeId === botType.id);
                  const totalProfit = entriesForType.reduce((sum, entry) => sum + (parseFloat(entry.profit) || 0), 0);
                  const avgProfit = entriesForType.length > 0 ? totalProfit / entriesForType.length : 0;
                  
                  return (
                    <Card 
                      key={botType.id} 
                      className="opacity-60 pointer-events-none relative"
                      data-testid={`card-bot-type-archived-${botType.id}`}
                    >
                      <CardHeader className="pb-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <CardTitle className="text-xl mb-1 flex items-center gap-2">
                              <Layers className="w-5 h-5 text-muted-foreground" />
                              {botType.name}
                            </CardTitle>
                            {botType.description && (
                              <CardDescription className="text-sm mt-2">
                                {botType.description}
                              </CardDescription>
                            )}
                          </div>
                          {botType.color && (
                            <div 
                              className="w-8 h-8 rounded-md border-2 border-border flex-shrink-0 opacity-50"
                              style={{ backgroundColor: botType.color }}
                            />
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="w-4 h-4" />
                          <span>
                            Last Updated: {(() => {
                              // Finde das neueste Update nach createdAt aus allen Updates für diesen Bot-Typ
                              if (updatesForTypeArchived.length === 0) {
                                return format(new Date(botType.createdAt), "dd.MM.yyyy", { locale: de });
                              }
                              const latestUpdate = [...updatesForTypeArchived].sort((a, b) => {
                                const dateA = a.createdAt ? new Date(a.createdAt as Date).getTime() : 0;
                                const dateB = b.createdAt ? new Date(b.createdAt as Date).getTime() : 0;
                                return dateB - dateA;
                              })[0];
                              return latestUpdate?.createdAt 
                                ? format(new Date(latestUpdate.createdAt as Date), "dd.MM.yyyy", { locale: de }) 
                                : format(new Date(botType.createdAt), "dd.MM.yyyy", { locale: de });
                            })()}
                          </span>
                        </div>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Gesamt Profit:</span>
                            <span className="font-medium">
                              {totalProfit > 0 ? '+' : ''}{totalProfit.toFixed(2)} USDT
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">24h Ø Profit:</span>
                            <span className="font-medium">
                              {avgProfit > 0 ? '+' : ''}{avgProfit.toFixed(2)} USDT
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-end pt-2 border-t pointer-events-auto">
                          <Button 
                            size="sm"
                            variant="outline"
                            onClick={() => handleRestoreConfirm(botType)}
                            className="gap-2"
                            data-testid={`button-restore-${botType.id}`}
                          >
                            <RotateCcw className="w-4 h-4" />
                            Wiederherstellen
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
          </>
        )}

        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-2xl">
                <Layers className="w-6 h-6 text-primary" />
                {selectedBotType?.name}
              </DialogTitle>
            </DialogHeader>

            {selectedBotType && (
              <div className="space-y-4">
                {updates.length === 0 ? (
                  <div className="py-12 text-center space-y-4">
                    <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
                      <TrendingUp className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Noch keine Metriken</h3>
                      <p className="text-sm text-muted-foreground mb-6">
                        Starten Sie die Metrik-Erfassung für diesen Bot-Typ
                      </p>
                      <Link href={`/upload?botTypeId=${selectedBotType.id}`}>
                        <Button 
                          variant="default" 
                          className="bg-green-600 hover:bg-green-700 gap-2"
                          data-testid="button-start-metrics"
                        >
                          <Plus className="w-4 h-4" />
                          Start Metrics
                        </Button>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Last Updated</p>
                        <p className="font-semibold">
                          {(() => {
                            // Finde das neueste Update nach createdAt
                            const latestUpdate = [...updates].sort((a, b) => {
                              const dateA = a.createdAt ? new Date(a.createdAt as Date).getTime() : 0;
                              const dateB = b.createdAt ? new Date(b.createdAt as Date).getTime() : 0;
                              return dateB - dateA;
                            })[0];
                            return latestUpdate?.createdAt 
                              ? format(new Date(latestUpdate.createdAt as Date), "dd.MM.yyyy HH:mm", { locale: de }) 
                              : '-';
                          })()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Metric Started</p>
                        <p className="font-semibold">
                          {(() => {
                            // Helper: Parse runtime string (e.g. "12d 5h 30m 22s") to milliseconds
                            const parseRuntimeToMs = (runtime: string): number => {
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
                            };
                            
                            // Helper: Parse German date format (dd.MM.yyyy HH:mm:ss or dd.MM.yyyy HH:mm)
                            const parseGermanDate = (dateStr: string): Date | null => {
                              if (!dateStr) return null;
                              // Try with seconds first
                              let parsed = parse(dateStr, "dd.MM.yyyy HH:mm:ss", new Date(), { locale: de });
                              if (isValid(parsed)) return parsed;
                              // Try without seconds
                              parsed = parse(dateStr, "dd.MM.yyyy HH:mm", new Date(), { locale: de });
                              if (isValid(parsed)) return parsed;
                              // Try ISO format
                              parsed = parseISO(dateStr);
                              if (isValid(parsed)) return parsed;
                              // Fallback to native Date
                              parsed = new Date(dateStr);
                              if (isValid(parsed)) return parsed;
                              return null;
                            };
                            
                            // Finde das früheste Startdatum aus allen Updates (Update Metrics + Closed Bots)
                            const allDates: Date[] = [];
                            updates.forEach(update => {
                              // Für Closed Bots: Startdatum = thisUpload - longestRuntime
                              if (update.status === 'Closed Bots' && update.thisUpload && update.longestRuntime) {
                                const endDate = parseGermanDate(update.thisUpload as string);
                                if (endDate) {
                                  const runtimeMs = parseRuntimeToMs(update.longestRuntime as string);
                                  const startDate = new Date(endDate.getTime() - runtimeMs);
                                  if (isValid(startDate)) {
                                    allDates.push(startDate);
                                  }
                                }
                              }
                              // Für Update Metrics: date ist das Startdatum
                              else if (update.status === 'Update Metrics' && update.date) {
                                const dateVal = parseGermanDate(update.date as string);
                                if (dateVal) {
                                  allDates.push(dateVal);
                                }
                              }
                            });
                            
                            if (allDates.length === 0) return '-';
                            
                            // Finde das früheste Datum
                            const earliestDate = allDates.reduce((earliest, current) => 
                              current < earliest ? current : earliest
                            );
                            
                            return format(earliestDate, "dd.MM.yyyy HH:mm", { locale: de });
                          })()}
                        </p>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-sm text-muted-foreground">Update Verlauf</h4>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Sortieren:</span>
                          <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
                            <SelectTrigger className="h-7 w-[140px] text-xs" data-testid="select-sort-by">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="datum" data-testid="option-sort-datum">Datum</SelectItem>
                              <SelectItem value="gridProfit" data-testid="option-sort-grid-profit">Grid Profit</SelectItem>
                              <SelectItem value="gridProfit24h" data-testid="option-sort-grid-profit-24h">Grid Profit 24H Ø</SelectItem>
                              <SelectItem value="gesInvest" data-testid="option-sort-ges-invest">Ges. Invest</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            size="icon"
                            variant={sortDirection === 'desc' ? 'default' : 'outline'}
                            className="h-7 w-7"
                            onClick={() => setSortDirection('desc')}
                            title="Absteigend (Höchste zuerst)"
                            data-testid="button-sort-desc"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant={sortDirection === 'asc' ? 'default' : 'outline'}
                            className="h-7 w-7"
                            onClick={() => setSortDirection('asc')}
                            title="Aufsteigend (Niedrigste zuerst)"
                            data-testid="button-sort-asc"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      {[...updates].sort((a, b) => {
                        let valueA: number = 0;
                        let valueB: number = 0;
                        
                        switch (sortBy) {
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
                        
                        return sortDirection === 'desc' ? valueB - valueA : valueA - valueB;
                      }).map((update) => {
                        // Berechne Grid Profit 24H Ø
                        const gridProfit24h = update.avgGridProfitDay || '0.00';
                        
                        // Für Closed Bots: Titel-Farbe basierend auf Gesamt Profit
                        const profitValue = parseFloat(update.profit || '0') || 0;
                        const closedBotsTitleColor = update.status === 'Closed Bots' 
                          ? (profitValue > 0 ? 'text-green-600' : profitValue < 0 ? 'text-red-600' : '')
                          : '';
                        
                        return (
                        <Card 
                          key={update.id} 
                          className="hover-elevate active-elevate-2 transition-all"
                          data-testid={`card-update-${update.id}`}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <p className={`font-semibold text-sm mb-2 ${closedBotsTitleColor}`}>
                                  {update.status} #{update.version}
                                </p>
                                <div className="flex flex-col gap-y-1 text-xs">
                                  {/* Zeile 1: Datum (From/Until oder Start/End Date für Closed Bots) */}
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
                                        <Calendar className="w-3 h-3" />
                                        {update.createdAt 
                                          ? format(new Date(update.createdAt as Date), "dd.MM.yyyy HH:mm", { locale: de })
                                          : '-'
                                        }
                                      </span>
                                    )}
                                  </div>
                                  {/* Zeile 2: Für Closed Bots nur "Gesamt Profit", für Update Metrics "Grid Profit 24H Ø + Grid Profit" */}
                                  <div className="flex items-center flex-wrap gap-x-6">
                                    {update.status === 'Closed Bots' ? (
                                      <span className="flex items-center gap-1.5">
                                        <span className="text-muted-foreground">Gesamt Profit:</span>
                                        <span className="font-medium text-primary">{formatUsdtWithSign(update.profit)} USDT</span>
                                      </span>
                                    ) : (
                                      <>
                                        <span className="flex items-center gap-1.5">
                                          <span className="text-muted-foreground">Grid Profit 24H Ø:</span>
                                          <span className="font-medium text-primary">{formatWithSign(gridProfit24h)} USDT</span>
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                          <span className="text-muted-foreground">Grid Profit:</span>
                                          <span className="font-medium text-primary">{formatUsdtWithSign(update.overallGridProfitUsdt)} USDT</span>
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
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <Button 
                                  size="icon" 
                                  variant="ghost"
                                  className="w-8 h-8"
                                  onClick={() => handleNotesClick(update)}
                                  data-testid={`button-notes-update-${update.id}`}
                                  title="Notizen bearbeiten"
                                >
                                  <MessageCircle className={`w-4 h-4 ${update.notes ? 'text-primary' : ''}`} />
                                </Button>
                                <Button 
                                  size="icon" 
                                  variant="ghost"
                                  className="w-8 h-8"
                                  onClick={() => {
                                    setSelectedUpdate(update);
                                    setUpdateDetailDialogOpen(true);
                                  }}
                                  data-testid={`button-view-update-${update.id}`}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Link href="/reports">
                                  <Button 
                                    size="icon" 
                                    variant="ghost"
                                    className="w-8 h-8"
                                    data-testid={`button-view-report-${update.id}`}
                                  >
                                    <FileText className="w-4 h-4" />
                                  </Button>
                                </Link>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Was möchten Sie mit "{botTypeToDelete?.name}" tun?</AlertDialogTitle>
              <AlertDialogDescription>
                Wählen Sie eine Aktion für diesen Bot-Typ.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              <AlertDialogCancel data-testid="button-cancel-delete">Abbrechen</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleArchiveConfirm}
                data-testid="button-confirm-archive"
                className="bg-muted text-muted-foreground hover:bg-muted/80"
              >
                <Archive className="w-4 h-4 mr-2" />
                Archivieren
              </AlertDialogAction>
              <AlertDialogAction 
                onClick={handleDeleteConfirm}
                data-testid="button-confirm-delete"
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Löschen
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={updateDetailDialogOpen} onOpenChange={setUpdateDetailDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Eye className="w-5 h-5 text-primary" />
                {selectedUpdate?.status} #{selectedUpdate?.version}
              </DialogTitle>
            </DialogHeader>

            {selectedUpdate && (
              <div className="space-y-6">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Info</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground mb-1">Datum und Uhrzeit</p>
                      <p className="font-medium">{selectedUpdate.date || '-'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Bot-Richtung</p>
                      <p className="font-medium">{selectedUpdate.botDirection || '-'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Hebel</p>
                      <p className="font-medium">{selectedUpdate.leverage || '-'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Anzahl</p>
                      <p className="font-medium">{selectedUpdate.screenshotCount || '-'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Berechnungsmodus</p>
                      <p className="font-medium">{selectedUpdate.calculationMode || 'Normal'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Längste Laufzeit</p>
                      <p className="font-medium">{selectedUpdate.longestRuntime || '-'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Durchschnittliche Laufzeit</p>
                      <p className="font-medium">{selectedUpdate.avgRuntime || '-'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">
                        {selectedUpdate.status === 'Closed Bots' ? 'Laufzeit' : 'Upload Laufzeit'}
                      </p>
                      <p className="font-medium">{selectedUpdate.uploadRuntime || '-'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">
                        {selectedUpdate.status === 'Closed Bots' ? 'Start Date' : 'From'}
                      </p>
                      <p className="font-medium">{selectedUpdate.lastUpload || '-'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">
                        {selectedUpdate.status === 'Closed Bots' ? 'End Date' : 'Until'}
                      </p>
                      <p className="font-medium">{selectedUpdate.thisUpload || '-'}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Investment</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground mb-1">Investitionsmenge (USDT)</p>
                      <p className="font-medium">{selectedUpdate.investment || '0.00'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Extra Margin</p>
                      <p className="font-medium">{selectedUpdate.extraMargin || '0.00'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Gesamtinvestment</p>
                      <p className="font-medium">{selectedUpdate.totalInvestment || '0.00'}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Gesamter Profit / P&L</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground mb-1">Gesamtprofit (USDT)</p>
                      <p className="font-medium text-primary">{formatUsdtWithSign(selectedUpdate.profit)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Gesamtprofit (%) - Gesamtinvestment</p>
                      <p className="font-medium">{formatWithSign(selectedUpdate.profitPercent_gesamtinvestment, '%')}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Gesamtprofit (%) - Investitionsmenge</p>
                      <p className="font-medium">{formatWithSign(selectedUpdate.profitPercent_investitionsmenge, '%')}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Trend P&L</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground mb-1">Trend P&L (USDT)</p>
                      <p className="font-medium">{formatUsdtWithSign(selectedUpdate.overallTrendPnlUsdt)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Trend P&L (%) - Gesamtinvestment</p>
                      <p className="font-medium">{formatWithSign(selectedUpdate.overallTrendPnlPercent_gesamtinvestment, '%')}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Trend P&L (%) - Investitionsmenge</p>
                      <p className="font-medium">{formatWithSign(selectedUpdate.overallTrendPnlPercent_investitionsmenge, '%')}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Grid Trading</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground mb-1">Gesamter Grid Profit (USDT)</p>
                        <p className="font-medium">{formatUsdtWithSign(selectedUpdate.overallGridProfitUsdt)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Gesamter Grid Profit (%) - Gesamtinvestment</p>
                        <p className="font-medium">{formatWithSign(selectedUpdate.overallGridProfitPercent_gesamtinvestment, '%')}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Gesamter Grid Profit (%) - Investitionsmenge</p>
                        <p className="font-medium">{formatWithSign(selectedUpdate.overallGridProfitPercent_investitionsmenge, '%')}</p>
                      </div>
                    </div>
                    <Separator />
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground mb-1">Ø Grid Profit (USDT)</p>
                        <p className="font-medium">{formatUsdtWithSign(selectedUpdate.highestGridProfit)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Ø Grid Profit (%) - Gesamtinvestment</p>
                        <p className="font-medium">{formatWithSign(selectedUpdate.highestGridProfitPercent_gesamtinvestment, '%')}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Ø Grid Profit (%) - Investitionsmenge</p>
                        <p className="font-medium">{formatWithSign(selectedUpdate.highestGridProfitPercent_investitionsmenge, '%')}</p>
                      </div>
                    </div>
                    <Separator />
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground mb-1">Ø Grid Profit / Stunde</p>
                        <p className="font-medium">{formatWithSign(selectedUpdate.avgGridProfitHour)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Ø Grid Profit / Tag</p>
                        <p className="font-medium">{formatWithSign(selectedUpdate.avgGridProfitDay)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Ø Grid Profit / Woche</p>
                        <p className="font-medium">{formatWithSign(selectedUpdate.avgGridProfitWeek)}</p>
                      </div>
                    </div>
                    
                    {/* Last Grid Profit Durchschnitt (Zeit) - immer anzeigen */}
                    <Separator />
                    <p className="text-sm font-semibold text-muted-foreground">Last Grid Profit Durchschnitt (Zeit)</p>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground mb-1">Stunde</p>
                        <p className="font-medium">{selectedUpdate.lastAvgGridProfitHour ? formatWithSign(selectedUpdate.lastAvgGridProfitHour) : '-'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Tag</p>
                        <p className="font-medium">{selectedUpdate.lastAvgGridProfitDay ? formatWithSign(selectedUpdate.lastAvgGridProfitDay) : '-'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Woche</p>
                        <p className="font-medium">{selectedUpdate.lastAvgGridProfitWeek ? formatWithSign(selectedUpdate.lastAvgGridProfitWeek) : '-'}</p>
                      </div>
                    </div>
                    
                    {/* Change-Werte - immer anzeigen */}
                    <Separator />
                    <p className="text-sm font-semibold text-muted-foreground">Change (Differenz zum vorherigen Upload)</p>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground mb-1">Stunde ($)</p>
                        <p className="font-medium">{selectedUpdate.changeHourDollar ? formatWithSign(selectedUpdate.changeHourDollar) : '-'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Tag ($)</p>
                        <p className="font-medium">{selectedUpdate.changeDayDollar ? formatWithSign(selectedUpdate.changeDayDollar) : '-'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Woche ($)</p>
                        <p className="font-medium">{selectedUpdate.changeWeekDollar ? formatWithSign(selectedUpdate.changeWeekDollar) : '-'}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground mb-1">Stunde (%)</p>
                        <p className="font-medium">{selectedUpdate.changeHourPercent ? formatWithSign(selectedUpdate.changeHourPercent, '%') : '-'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Tag (%)</p>
                        <p className="font-medium">{selectedUpdate.changeDayPercent ? formatWithSign(selectedUpdate.changeDayPercent, '%') : '-'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Woche (%)</p>
                        <p className="font-medium">{selectedUpdate.changeWeekPercent ? formatWithSign(selectedUpdate.changeWeekPercent, '%') : '-'}</p>
                      </div>
                    </div>
                    
                    {/* Last Upload (Ø Grid Profit) und Change */}
                    <Separator />
                    <p className="text-sm font-semibold text-muted-foreground">Last Upload (Ø Grid Profit) und Change</p>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground mb-1">Last Upload (Ø Grid Profit)</p>
                        <p className="font-medium">{selectedUpdate.lastAvgGridProfitUsdt ? formatWithSign(selectedUpdate.lastAvgGridProfitUsdt) : '-'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Change ($)</p>
                        <p className="font-medium">{selectedUpdate.avgGridProfitChangeDollar ? formatWithSign(selectedUpdate.avgGridProfitChangeDollar) : '-'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Change (%)</p>
                        <p className="font-medium">{selectedUpdate.avgGridProfitChangePercent ? formatWithSign(selectedUpdate.avgGridProfitChangePercent, '%') : '-'}</p>
                      </div>
                    </div>
                    
                    {/* Notizen Section */}
                    {selectedUpdate.notes && (
                      <>
                        <Separator />
                        <div className="text-sm">
                          <p className="text-muted-foreground mb-2 font-medium">Notizen</p>
                          <div className="whitespace-pre-wrap bg-muted/30 p-3 rounded-md">
                            {selectedUpdate.notes}
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                <div className="text-xs text-muted-foreground text-center">
                  Erstellt am: {selectedUpdate.createdAt ? format(new Date(selectedUpdate.createdAt as Date), "dd.MM.yyyy HH:mm", { locale: de }) : '-'}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
        
        {/* Notizen bearbeiten Dialog */}
        <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-primary" />
                Notizen - {notesUpdate?.status} #{notesUpdate?.version}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Textarea
                value={editingNotes}
                onChange={(e) => setEditingNotes(e.target.value)}
                placeholder="Notizen hinzufuegen..."
                className="min-h-[150px] resize-y"
                data-testid="textarea-edit-notes"
              />
              <div className="flex gap-2 justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => setNotesDialogOpen(false)}
                  data-testid="button-notes-dialog-cancel"
                >
                  Abbrechen
                </Button>
                <Button 
                  onClick={handleNotesSave}
                  disabled={updateNotesMutation.isPending}
                  data-testid="button-notes-dialog-save"
                >
                  {updateNotesMutation.isPending ? 'Speichern...' : 'Speichern'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        
        {/* Update Confirmation Dialog */}
        <AlertDialog open={updateConfirmDialogOpen} onOpenChange={setUpdateConfirmDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-primary" />
                Neue Daten verfuegbar
              </AlertDialogTitle>
              <AlertDialogDescription>
                Es wurden neue Daten auf der Upload-Seite gespeichert. Moechten Sie die Ansicht aktualisieren?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleUpdateDismiss} data-testid="button-update-dismiss">
                Abbrechen
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleUpdateConfirm} data-testid="button-update-confirm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Update now
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
