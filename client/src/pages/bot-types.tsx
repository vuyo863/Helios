import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
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
import { Layers, Calendar, Pencil, Eye, Plus, Check, X, TrendingUp, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

export default function BotTypesPage() {
  const { data: botTypes = [], isLoading } = useQuery<BotType[]>({
    queryKey: ['/api/bot-types'],
  });

  const { data: botEntries = [] } = useQuery<BotEntry[]>({
    queryKey: ['/api/bot-entries'],
  });

  const [editingBotTypeId, setEditingBotTypeId] = useState<string | null>(null);
  const [editedValues, setEditedValues] = useState<{ name: string; description: string }>({
    name: '',
    description: ''
  });
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedBotType, setSelectedBotType] = useState<BotType | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [botTypeToDelete, setBotTypeToDelete] = useState<BotType | null>(null);

  const { toast } = useToast();

  // Fetch updates for selected bot type
  const { data: updates = [] } = useQuery<BotTypeUpdate[]>({
    queryKey: ['/api/bot-types', selectedBotType?.id, 'updates'],
    enabled: !!selectedBotType?.id,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; name: string; description: string }) => {
      return await apiRequest('PUT', `/api/bot-types/${data.id}`, {
        name: data.name,
        description: data.description
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
      description: botType.description || ''
    });
  };

  const handleSave = (id: string) => {
    updateMutation.mutate({
      id,
      name: editedValues.name,
      description: editedValues.description
    });
  };

  const handleCancel = () => {
    setEditingBotTypeId(null);
    setEditedValues({ name: '', description: '' });
  };

  const handleViewClick = (botType: BotType) => {
    setSelectedBotType(botType);
    setViewDialogOpen(true);
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

  const handleDeleteClick = (botType: BotType) => {
    setBotTypeToDelete(botType);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (botTypeToDelete) {
      deleteBotTypeMutation.mutate(botTypeToDelete.id);
    }
  };


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

        {botTypes.length === 0 ? (
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {botTypes.map((botType) => {
              const isEditing = editingBotTypeId === botType.id;
              const entriesForType = botEntries.filter(entry => entry.botTypeId === botType.id);
              const totalProfit = entriesForType.reduce((sum, entry) => sum + (parseFloat(entry.profit) || 0), 0);
              const avgProfit = entriesForType.length > 0 ? totalProfit / entriesForType.length : 0;
              
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
                          </div>
                        ) : (
                          <>
                            <CardTitle className="text-xl mb-1 flex items-center gap-2">
                              <Layers className="w-5 h-5 text-primary" />
                              {botType.name}
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
                        Last Updated: {format(new Date(botType.createdAt), "dd.MM.yyyy", { locale: de })}
                      </span>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Gesamt Profit:</span>
                        <span className="font-medium text-primary" data-testid={`text-total-profit-${botType.id}`}>
                          {totalProfit.toFixed(2)} USDT
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">24h Ø Profit:</span>
                        <span className="font-medium" data-testid={`text-avg-profit-${botType.id}`}>
                          {avgProfit.toFixed(2)} USDT
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
                          {updates[0]?.createdAt ? format(new Date(updates[0].createdAt as Date), "dd.MM.yyyy HH:mm", { locale: de }) : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Metric Started</p>
                        <p className="font-semibold">
                          {updates[updates.length - 1]?.createdAt ? format(new Date(updates[updates.length - 1].createdAt as Date), "dd.MM.yyyy HH:mm", { locale: de }) : '-'}
                        </p>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm text-muted-foreground mb-3">Update Verlauf</h4>
                      {updates.map((update) => (
                        <Card 
                          key={update.id} 
                          className="hover-elevate active-elevate-2 transition-all"
                          data-testid={`card-update-${update.id}`}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex-1">
                                <p className="font-semibold text-sm mb-1">
                                  {update.status} #{update.version}
                                </p>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {update.createdAt ? format(new Date(update.createdAt as Date), "dd.MM.yyyy HH:mm", { locale: de }) : '-'}
                                  </span>
                                </div>
                              </div>
                              <Link href="/reports">
                                <Button 
                                  size="icon" 
                                  variant="ghost"
                                  className="w-8 h-8 flex-shrink-0"
                                  data-testid={`button-view-report-${update.id}`}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </Link>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
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
              <AlertDialogTitle>Bot-Typ löschen?</AlertDialogTitle>
              <AlertDialogDescription>
                Möchten Sie "{botTypeToDelete?.name}" und alle zugehörigen Updates, Berichte und Informationen wirklich löschen? 
                Diese Aktion kann nicht rückgängig gemacht werden.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete">Abbrechen</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDeleteConfirm}
                data-testid="button-confirm-delete"
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Löschen
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
