import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { BotType } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Check } from "lucide-react";

interface BotTypeManagerProps {
  selectedBotTypeId: string | null;
  onSelectBotType: (botTypeId: string | null) => void;
}

export default function BotTypeManager({ selectedBotTypeId, onSelectBotType }: BotTypeManagerProps) {
  const { toast } = useToast();
  const [newBotType, setNewBotType] = useState({
    name: '',
    description: '',
    color: '#3B82F6',
  });

  const { data: botTypes = [], isLoading } = useQuery<BotType[]>({
    queryKey: ['/api/bot-types'],
  });

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
    },
    onError: () => {
      toast({
        title: "Fehler",
        description: "Der Bot-Typ konnte nicht erstellt werden.",
        variant: "destructive",
      });
    },
  });

  const handleCreateBotType = (e: React.FormEvent) => {
    e.preventDefault();
    createBotTypeMutation.mutate(newBotType);
  };

  const colorOptions = [
    { name: 'Blau', value: '#3B82F6' },
    { name: 'Grün', value: '#10B981' },
    { name: 'Lila', value: '#8B5CF6' },
    { name: 'Rot', value: '#EF4444' },
    { name: 'Orange', value: '#F59E0B' },
    { name: 'Pink', value: '#EC4899' },
  ];

  return (
    <Card className="p-6">
      <Tabs defaultValue="existing" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="existing" data-testid="tab-existing-bots">Bestehende Bots</TabsTrigger>
          <TabsTrigger value="create" data-testid="tab-create-bot-type">Create Bot Type</TabsTrigger>
        </TabsList>

        <TabsContent value="existing">
          <div>
            <h3 className="text-lg font-bold mb-4">Bot-Typ auswählen</h3>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Lädt...</p>
            ) : botTypes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Keine Bot-Typen vorhanden. Erstellen Sie einen neuen Bot-Typ.
              </p>
            ) : (
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
                
                {botTypes.map((botType) => (
                  <Button
                    key={botType.id}
                    variant={selectedBotTypeId === botType.id ? 'default' : 'outline'}
                    className="justify-start h-auto py-3 px-4"
                    onClick={() => onSelectBotType(botType.id)}
                    data-testid={`button-select-bot-type-${botType.id}`}
                  >
                    <div className="flex items-center gap-3 w-full">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: botType.color || '#3B82F6' }}
                      />
                      <div className="flex-1 text-left">
                        <div className="font-medium">{botType.name}</div>
                        {botType.description && (
                          <div className="text-xs text-muted-foreground">{botType.description}</div>
                        )}
                      </div>
                      {selectedBotTypeId === botType.id && <Check className="w-4 h-4" />}
                    </div>
                  </Button>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="create">
          <div>
            <h3 className="text-lg font-bold mb-4">Neuen Bot-Typ erstellen</h3>
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

              <Button
                type="submit"
                className="w-full"
                disabled={createBotTypeMutation.isPending}
                data-testid="button-create-bot-type"
              >
                {createBotTypeMutation.isPending ? 'Wird erstellt...' : 'Bot-Typ erstellen'}
              </Button>
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
    </Card>
  );
}
