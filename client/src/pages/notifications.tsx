
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Bell, ChevronDown, ChevronUp, Plus, Pencil, Save, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TrendPrice {
  id: string;
  name: string;
  isActive: boolean;
}

interface TrendPriceSettings {
  trendPriceId: string;
  threshold: string;
  notifyOnIncrease: boolean;
  notifyOnDecrease: boolean;
  customMessage: string;
}

export default function Notifications() {
  const [availableTrendPrices] = useState<TrendPrice[]>([
    { id: '1', name: 'BTC/USDT', isActive: false },
    { id: '2', name: 'ETH/USDT', isActive: false },
    { id: '3', name: 'SOL/USDT', isActive: false },
    { id: '4', name: 'BNB/USDT', isActive: false },
  ]);

  const [selectedTrendPrices, setSelectedTrendPrices] = useState<string[]>([]);
  const [appliedTrendPrices, setAppliedTrendPrices] = useState<string[]>([]);
  const [expandedDropdowns, setExpandedDropdowns] = useState<string[]>([]);
  const [trendPriceSettings, setTrendPriceSettings] = useState<Record<string, TrendPriceSettings>>({});
  const [editMode, setEditMode] = useState<Record<string, boolean>>({});

  const handleToggleTrendPrice = (id: string) => {
    setSelectedTrendPrices(prev => 
      prev.includes(id) ? prev.filter(tpId => tpId !== id) : [...prev, id]
    );
  };

  const handleApply = () => {
    setAppliedTrendPrices(selectedTrendPrices);
    // Initialize settings for new trend prices
    selectedTrendPrices.forEach(tpId => {
      if (!trendPriceSettings[tpId]) {
        setTrendPriceSettings(prev => ({
          ...prev,
          [tpId]: {
            trendPriceId: tpId,
            threshold: '',
            notifyOnIncrease: false,
            notifyOnDecrease: false,
            customMessage: ''
          }
        }));
      }
    });
  };

  const toggleDropdown = (id: string) => {
    setExpandedDropdowns(prev =>
      prev.includes(id) ? prev.filter(tpId => tpId !== id) : [...prev, id]
    );
  };

  const updateSetting = (trendPriceId: string, field: keyof TrendPriceSettings, value: any) => {
    setTrendPriceSettings(prev => ({
      ...prev,
      [trendPriceId]: {
        ...prev[trendPriceId],
        [field]: value
      }
    }));
  };

  const toggleEditMode = (trendPriceId: string) => {
    setEditMode(prev => ({
      ...prev,
      [trendPriceId]: !prev[trendPriceId]
    }));
  };

  const getTrendPriceName = (id: string) => {
    return availableTrendPrices.find(tp => tp.id === id)?.name || id;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Bell className="w-8 h-8 text-primary" />
          <h1 className="text-2xl font-bold" data-testid="heading-notifications">Notifications</h1>
        </div>

        {/* Trendpreis Auswahl Content Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Trendpreise auswählen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {availableTrendPrices.map((trendPrice) => (
                <div
                  key={trendPrice.id}
                  className="flex items-center space-x-2 p-3 rounded-lg border hover-elevate cursor-pointer"
                  onClick={() => handleToggleTrendPrice(trendPrice.id)}
                >
                  <Checkbox
                    checked={selectedTrendPrices.includes(trendPrice.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedTrendPrices(prev => [...prev, trendPrice.id]);
                      } else {
                        setSelectedTrendPrices(prev => prev.filter(id => id !== trendPrice.id));
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="text-sm font-medium">{trendPrice.name}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button 
                onClick={handleApply}
                disabled={selectedTrendPrices.length === 0}
                data-testid="button-apply-trendprices"
              >
                Apply
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Benachrichtigungen Liste */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Benachrichtigungen</h2>
          
          {appliedTrendPrices.length === 0 ? (
            <Card className="p-8 text-center">
              <div className="flex flex-col items-center gap-4 text-muted-foreground">
                <Bell className="w-12 h-12 opacity-50" />
                <p>Keine Trendpreise ausgewählt. Wählen Sie oben Trendpreise aus und klicken Sie auf Apply.</p>
              </div>
            </Card>
          ) : (
            appliedTrendPrices.map((trendPriceId) => {
              const settings = trendPriceSettings[trendPriceId] || {
                trendPriceId,
                threshold: '',
                notifyOnIncrease: false,
                notifyOnDecrease: false,
                customMessage: ''
              };
              const isExpanded = expandedDropdowns.includes(trendPriceId);
              const isEditing = editMode[trendPriceId];

              return (
                <Card key={trendPriceId} className="overflow-hidden">
                  <CardHeader 
                    className="cursor-pointer hover-elevate flex flex-row items-center justify-between"
                    onClick={() => toggleDropdown(trendPriceId)}
                  >
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-lg">{getTrendPriceName(trendPriceId)}</CardTitle>
                      {settings.threshold && (
                        <span className="text-sm text-muted-foreground">
                          Schwelle: {settings.threshold} USDT
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {!isExpanded && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleEditMode(trendPriceId);
                          }}
                        >
                          {isEditing ? <Save className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
                        </Button>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </div>
                  </CardHeader>

                  {isExpanded && (
                    <CardContent className="space-y-6 pt-0">
                      <div className="flex items-center justify-between pb-4 border-b">
                        <h3 className="font-semibold">Einstellungen</h3>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleEditMode(trendPriceId)}
                        >
                          {isEditing ? <Save className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
                        </Button>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <Label htmlFor={`threshold-${trendPriceId}`}>Schwellenwert (USDT)</Label>
                          <Input
                            id={`threshold-${trendPriceId}`}
                            type="number"
                            step="0.01"
                            placeholder="z.B. 50000"
                            value={settings.threshold}
                            onChange={(e) => updateSetting(trendPriceId, 'threshold', e.target.value)}
                            disabled={!isEditing}
                            className={cn(!isEditing && "opacity-70")}
                          />
                        </div>

                        <div className="space-y-3">
                          <Label>Benachrichtigungen bei:</Label>
                          <div className="flex items-center space-x-2 p-3 rounded-lg border">
                            <Checkbox
                              id={`increase-${trendPriceId}`}
                              checked={settings.notifyOnIncrease}
                              onCheckedChange={(checked) => 
                                updateSetting(trendPriceId, 'notifyOnIncrease', checked)
                              }
                              disabled={!isEditing}
                            />
                            <Label 
                              htmlFor={`increase-${trendPriceId}`}
                              className={cn("cursor-pointer", !isEditing && "opacity-70")}
                            >
                              Preiserhöhung über Schwellenwert
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2 p-3 rounded-lg border">
                            <Checkbox
                              id={`decrease-${trendPriceId}`}
                              checked={settings.notifyOnDecrease}
                              onCheckedChange={(checked) => 
                                updateSetting(trendPriceId, 'notifyOnDecrease', checked)
                              }
                              disabled={!isEditing}
                            />
                            <Label 
                              htmlFor={`decrease-${trendPriceId}`}
                              className={cn("cursor-pointer", !isEditing && "opacity-70")}
                            >
                              Preissenkung unter Schwellenwert
                            </Label>
                          </div>
                        </div>

                        <div>
                          <Label htmlFor={`message-${trendPriceId}`}>Benutzerdefinierte Nachricht (Optional)</Label>
                          <Input
                            id={`message-${trendPriceId}`}
                            placeholder="z.B. BTC erreicht wichtige Marke"
                            value={settings.customMessage}
                            onChange={(e) => updateSetting(trendPriceId, 'customMessage', e.target.value)}
                            disabled={!isEditing}
                            className={cn(!isEditing && "opacity-70")}
                          />
                        </div>
                      </div>

                      {isEditing && (
                        <div className="flex justify-end gap-2 pt-4 border-t">
                          <Button
                            variant="outline"
                            onClick={() => toggleEditMode(trendPriceId)}
                          >
                            Abbrechen
                          </Button>
                          <Button onClick={() => toggleEditMode(trendPriceId)}>
                            Speichern
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
