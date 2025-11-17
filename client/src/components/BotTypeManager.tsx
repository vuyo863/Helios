import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { BotType } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Check, Trash2, Edit, Search } from "lucide-react";

interface BotTypeManagerProps {
  selectedBotTypeId: string | null;
  onSelectBotType: (botTypeId: string | null) => void;
  onEditBotType?: (botType: BotType) => void;
  initialTab?: "existing" | "create";
}

export default function BotTypeManager({ selectedBotTypeId, onSelectBotType, onEditBotType, initialTab = "existing" }: BotTypeManagerProps) {
  const { toast } = useToast();
  const [newBotType, setNewBotType] = useState({
    name: '',
    description: '',
    color: '#3B82F6',
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [botTypeToDelete, setBotTypeToDelete] = useState<BotType | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editingBotTypeId, setEditingBotTypeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: botTypes = [], isLoading } = useQuery<BotType[]>({
    queryKey: ['/api/bot-types'],
  });

  const filteredBotTypes = useMemo(() => {
    if (!searchQuery.trim()) return botTypes;
    const query = searchQuery.toLowerCase();
    return botTypes.filter(
      (botType) =>
        botType.name.toLowerCase().includes(query) ||
        botType.description?.toLowerCase().includes(query)
    );
  }, [botTypes, searchQuery]);

  const createBotTypeMutation = useMutation({
    mutationFn: async (data: typeof newBotType) => {
      return await apiRequest('POST', '/api/bot-types', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bot-types'] });
      toast({
        title: "Bot-Typ erstellt",
        description: "Der neue Bot-Typ wurde erfolgreich erstellt.",
      });
      setNewBotType({ name: '', description: '', color: '#3B82F6' });
      setActiveTab("existing");
    },
    onError: () => {
      toast({
        title: "Fehler",
        description: "Der Bot-Typ konnte nicht erstellt werden.",
        variant: "destructive",
      });
    },
  });

  const updateBotTypeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof newBotType }) => {
      return await apiRequest('PUT', `/api/bot-types/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bot-types'] });
      toast({
        title: "Bot-Typ aktualisiert",
        description: "Der Bot-Typ wurde erfolgreich aktualisiert.",
      });
      handleCancelEdit();
    },
    onError: () => {
      toast({
        title: "Fehler",
        description: "Der Bot-Typ konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    },
  });

  const deleteBotTypeMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/bot-types/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bot-types'] });
      queryClient.invalidateQueries({ queryKey: ['/api/entries'] });
      toast({
        title: "Bot-Typ gelöscht",
        description: "Der Bot-Typ wurde erfolgreich gelöscht.",
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

  const handleCreateBotType = (e: React.FormEvent) => {
    e.preventDefault();
    if (editMode && editingBotTypeId) {
      updateBotTypeMutation.mutate({ id: editingBotTypeId, data: newBotType });
    } else {
      createBotTypeMutation.mutate(newBotType);
    }
  };

  const handleDeleteClick = (botType: BotType, e: React.MouseEvent) => {
    e.stopPropagation();
    setBotTypeToDelete(botType);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (botTypeToDelete) {
      deleteBotTypeMutation.mutate(botTypeToDelete.id);
    }
  };

  const handleEditClick = (botType: BotType, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditMode(true);
    setEditingBotTypeId(botType.id);
    setNewBotType({
      name: botType.name,
      description: botType.description || '',
      color: botType.color || '#3B82F6',
    });
    setActiveTab("create");
    if (onEditBotType) {
      onEditBotType(botType);
    }
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setEditingBotTypeId(null);
    setNewBotType({ name: '', description: '', color: '#3B82F6' });
    setActiveTab("existing");
  };

  const colorOptions = [
    { name: 'Blau', value: '#3B82F6' },
    { name: 'Grün', value: '#10B981' },
    { name: 'Lila', value: '#8B5CF6' },
    { name: 'Rot', value: '#EF4444' },
    { name: 'Orange', value: '#F59E0B' },
    { name: 'Pink', value: '#EC4899' },
  ];

  const handleTabChange = (value: string) => {
    if (value === "existing" || value === "create") {
      setActiveTab(value);
    }
  };

  return (
    <Card className="p-6">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="existing" data-testid="tab-existing-bots">Bestehende Bots</TabsTrigger>
          <TabsTrigger value="create" data-testid="tab-create-bot-type">Create Bot Type</TabsTrigger>
        </TabsList>

        <TabsContent value="existing">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Bot-Typ auswählen</h3>
              <span className="text-sm text-muted-foreground">
                {botTypes.length} {botTypes.length === 1 ? 'Typ' : 'Typen'}
              </span>
            </div>

            {botTypes.length > 0 && (
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Bot-Typ suchen..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-bot-type"
                />
              </div>
            )}

            {isLoading ? (
              <p className="text-sm text-muted-foreground">Lädt...</p>
            ) : botTypes.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground mb-4">
                  Keine Bot-Typen vorhanden. Erstellen Sie einen neuen Bot-Typ.
                </p>
                <Button
                  onClick={() => setActiveTab("create")}
                  data-testid="button-goto-create"
                >
                  Bot-Typ erstellen
                </Button>
              </div>
            ) : filteredBotTypes.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">
                  Keine Bot-Typen gefunden für "{searchQuery}"
                </p>
              </div>
            ) : filteredBotTypes.length + 1 <= 5 ? (
              <div className="grid grid-cols-1 gap-3">
                <Button
                  variant={selectedBotTypeId === null ? 'default' : 'outline'}
                  className="justify-start h-auto py-3 px-4"
                  onClick={() => onSelectBotType(null)}
                  data-testid="button-select-no-type"
                >
                  <div className="flex items-center gap-3 w-full">
                    <div className="w-4 h-4 rounded-full bg-gray-400" />
                    <div className="flex-1 text-left">
                      <div className="font-medium">Kein Bot-Typ</div>
                      <div className="text-xs text-muted-foreground">Ohne Kategorisierung</div>
                    </div>
                    {selectedBotTypeId === null && <Check className="w-4 h-4" />}
                  </div>
                </Button>
                
                {filteredBotTypes.map((botType) => (
                  <div key={botType.id} className="relative">
                    <Button
                      variant={selectedBotTypeId === botType.id ? 'default' : 'outline'}
                      className="justify-start h-auto py-3 px-4 w-full"
                      onClick={() => onSelectBotType(botType.id)}
                      data-testid={`button-select-bot-type-${botType.id}`}
                    >
                      <div className="flex items-center gap-3 w-full pr-16">
                        <div
                          className="w-4 h-4 rounded-full shrink-0"
                          style={{ backgroundColor: botType.color || '#3B82F6' }}
                        />
                        <div className="flex-1 text-left min-w-0">
                          <div className="font-medium truncate">{botType.name}</div>
                          {botType.description && (
                            <div className="text-xs text-muted-foreground line-clamp-1">{botType.description}</div>
                          )}
                        </div>
                        {selectedBotTypeId === botType.id && <Check className="w-4 h-4 shrink-0" />}
                      </div>
                    </Button>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => handleEditClick(botType, e)}
                        data-testid={`button-edit-bot-type-${botType.id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={(e) => handleDeleteClick(botType, e)}
                        data-testid={`button-delete-bot-type-${botType.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <ScrollArea className="h-[380px]">
                <div className="grid grid-cols-1 gap-3 pr-4">
                  <Button
                    variant={selectedBotTypeId === null ? 'default' : 'outline'}
                    className="justify-start h-auto py-3 px-4"
                    onClick={() => onSelectBotType(null)}
                    data-testid="button-select-no-type"
                  >
                    <div className="flex items-center gap-3 w-full">
                      <div className="w-4 h-4 rounded-full bg-gray-400" />
                      <div className="flex-1 text-left">
                        <div className="font-medium">Kein Bot-Typ</div>
                        <div className="text-xs text-muted-foreground">Ohne Kategorisierung</div>
                      </div>
                      {selectedBotTypeId === null && <Check className="w-4 h-4" />}
                    </div>
                  </Button>
                  
                  {filteredBotTypes.map((botType) => (
                    <div key={botType.id} className="relative">
                      <Button
                        variant={selectedBotTypeId === botType.id ? 'default' : 'outline'}
                        className="justify-start h-auto py-3 px-4 w-full"
                        onClick={() => onSelectBotType(botType.id)}
                        data-testid={`button-select-bot-type-${botType.id}`}
                      >
                        <div className="flex items-center gap-3 w-full pr-16">
                          <div
                            className="w-4 h-4 rounded-full shrink-0"
                            style={{ backgroundColor: botType.color || '#3B82F6' }}
                          />
                          <div className="flex-1 text-left min-w-0">
                            <div className="font-medium truncate">{botType.name}</div>
                            {botType.description && (
                              <div className="text-xs text-muted-foreground line-clamp-1">{botType.description}</div>
                            )}
                          </div>
                          {selectedBotTypeId === botType.id && <Check className="w-4 h-4 shrink-0" />}
                        </div>
                      </Button>
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => handleEditClick(botType, e)}
                          data-testid={`button-edit-bot-type-${botType.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={(e) => handleDeleteClick(botType, e)}
                          data-testid={`button-delete-bot-type-${botType.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </TabsContent>

        <TabsContent value="create">
          <div>
            <h3 className="text-lg font-bold mb-4">
              {editMode ? 'Bot-Typ bearbeiten' : 'Neuen Bot-Typ erstellen'}
            </h3>
            <form onSubmit={handleCreateBotType} className="space-y-4">
              <div>
                <Label htmlFor="botTypeName">Name</Label>
                <Input
                  id="botTypeName"
                  type="text"
                  placeholder="z.B. Grid Trading Bots"
                  value={newBotType.name}
                  onChange={(e) => setNewBotType({ ...newBotType, name: e.target.value })}
                  required
                  data-testid="input-bot-type-name"
                />
              </div>

              <div>
                <Label htmlFor="botTypeDescription">Beschreibung (optional)</Label>
                <Textarea
                  id="botTypeDescription"
                  placeholder="Beschreiben Sie den Bot-Typ..."
                  value={newBotType.description}
                  onChange={(e) => setNewBotType({ ...newBotType, description: e.target.value })}
                  rows={2}
                  data-testid="textarea-bot-type-description"
                />
              </div>

              <div>
                <Label className="mb-2 block">Farbe</Label>
                <div className="flex gap-2 flex-wrap">
                  {colorOptions.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      className={`w-10 h-10 rounded-lg border-2 hover-elevate ${
                        newBotType.color === color.value ? 'border-foreground' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color.value }}
                      onClick={() => setNewBotType({ ...newBotType, color: color.value })}
                      title={color.name}
                      data-testid={`button-color-${color.name.toLowerCase()}`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={createBotTypeMutation.isPending || updateBotTypeMutation.isPending}
                  data-testid="button-save-bot-type"
                >
                  {editMode 
                    ? (updateBotTypeMutation.isPending ? 'Wird gespeichert...' : 'Save') 
                    : (createBotTypeMutation.isPending ? 'Wird erstellt...' : 'Bot-Typ erstellen')
                  }
                </Button>
                {editMode && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancelEdit}
                    data-testid="button-cancel-edit"
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </div>
        </TabsContent>
      </Tabs>

      {selectedBotTypeId && (
        <div className="mt-4 pt-4 border-t">
          <p className="text-sm text-muted-foreground mb-2">Ausgewählter Bot-Typ:</p>
          <Badge variant="secondary" className="gap-2" data-testid="badge-selected-bot-type">
            <div
              className="w-3 h-3 rounded-full"
              style={{
                backgroundColor: botTypes.find((bt) => bt.id === selectedBotTypeId)?.color || '#3B82F6',
              }}
            />
            {botTypes.find((bt) => bt.id === selectedBotTypeId)?.name || 'Unbekannt'}
          </Badge>
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bot-Typ löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie die Inhalte und die Kategorie "{botTypeToDelete?.name}" sicher löschen? 
              Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              data-testid="button-confirm-delete"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Yes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
