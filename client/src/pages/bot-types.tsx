import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { BotType } from "@shared/schema";
import { Layers, Calendar, Pencil, Eye, Plus, Check, X } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function BotTypesPage() {
  const { data: botTypes = [], isLoading } = useQuery<BotType[]>({
    queryKey: ['/api/bot-types'],
  });

  const [editingBotTypeId, setEditingBotTypeId] = useState<string | null>(null);
  const [editedValues, setEditedValues] = useState<{ name: string; description: string }>({
    name: '',
    description: ''
  });

  const { toast } = useToast();

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
          <Button 
            variant="default" 
            className="gap-2"
            data-testid="button-create-bot-type"
          >
            <Plus className="w-4 h-4" />
            Create Bot Type
          </Button>
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
                    <div className="flex items-center justify-between gap-2 pt-2 border-t">
                      <div className="flex items-center gap-2">
                        {botType.color && (
                          <Badge 
                            variant="outline" 
                            style={{ 
                              backgroundColor: `${botType.color}20`, 
                              borderColor: botType.color,
                              color: botType.color
                            }}
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
                            data-testid={`button-view-${botType.id}`}
                          >
                            <Eye className="w-4 h-4" />
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
      </div>
    </div>
  );
}
