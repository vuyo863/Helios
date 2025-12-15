
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Bell, ChevronDown, ChevronUp, Search, X, Pencil, Save } from "lucide-react";
import { cn } from "@/lib/utils";

interface TrendPrice {
  id: string;
  name: string;
  price?: string;
}

interface TrendPriceSettings {
  trendPriceId: string;
  threshold: string;
  notifyOnIncrease: boolean;
  notifyOnDecrease: boolean;
  customMessage: string;
}

export default function Notifications() {
  // Verfügbare Trading Pairs für Suche
  const [availableTradingPairs] = useState<TrendPrice[]>([
    { id: '1', name: 'BTC/USDT', price: '45,234.50' },
    { id: '2', name: 'ETH/USDT', price: '2,345.67' },
    { id: '3', name: 'SOL/USDT', price: '98.45' },
    { id: '4', name: 'BNB/USDT', price: '312.89' },
    { id: '5', name: 'XRP/USDT', price: '0.5234' },
    { id: '6', name: 'ADA/USDT', price: '0.4567' },
    { id: '7', name: 'DOGE/USDT', price: '0.0823' },
    { id: '8', name: 'MATIC/USDT', price: '0.8912' },
  ]);

  const [searchQuery, setSearchQuery] = useState('');
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [expandedDropdowns, setExpandedDropdowns] = useState<string[]>([]);
  const [trendPriceSettings, setTrendPriceSettings] = useState<Record<string, TrendPriceSettings>>({});
  const [editMode, setEditMode] = useState<Record<string, boolean>>({});

  // Gefilterte Vorschläge basierend auf Suchanfrage
  const filteredSuggestions = availableTradingPairs.filter(pair => 
    pair.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    !watchlist.includes(pair.id)
  );

  const addToWatchlist = (id: string) => {
    if (!watchlist.includes(id)) {
      setWatchlist(prev => [...prev, id]);
      // Initialize settings for new trend price
      setTrendPriceSettings(prev => ({
        ...prev,
        [id]: {
          trendPriceId: id,
          threshold: '',
          notifyOnIncrease: false,
          notifyOnDecrease: false,
          customMessage: ''
        }
      }));
      setSearchQuery('');
    }
  };

  const removeFromWatchlist = (id: string) => {
    setWatchlist(prev => prev.filter(tpId => tpId !== id));
    setExpandedDropdowns(prev => prev.filter(tpId => tpId !== id));
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
    return availableTradingPairs.find(tp => tp.id === id)?.name || id;
  };

  const getTrendPrice = (id: string) => {
    return availableTradingPairs.find(tp => tp.id === id);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Bell className="w-8 h-8 text-primary" />
          <h1 className="text-2xl font-bold" data-testid="heading-notifications">Notifications</h1>
        </div>

        {/* Trendpreis Suche & Watchlist Content Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Trendpreise & Watchlist</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Linke Seite: Suchfunktion mit Vorschlägen */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="search-trading-pairs" className="text-base font-semibold mb-3 block">
                    Trading Pairs suchen
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="search-trading-pairs"
                      placeholder="z.B. BTC/USDT, ETH/USDT..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                      data-testid="input-search-trading-pairs"
                    />
                  </div>
                </div>

                {/* Vorschläge */}
                {searchQuery && (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-muted px-3 py-2">
                      <p className="text-sm font-medium">Vorschläge</p>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {filteredSuggestions.length > 0 ? (
                        filteredSuggestions.map((pair) => (
                          <div
                            key={pair.id}
                            className="flex items-center justify-between p-3 hover-elevate cursor-pointer border-b last:border-b-0"
                            onClick={() => addToWatchlist(pair.id)}
                            data-testid={`suggestion-${pair.name}`}
                          >
                            <div>
                              <p className="font-medium">{pair.name}</p>
                              <p className="text-sm text-muted-foreground">{pair.price} USDT</p>
                            </div>
                            <Button variant="ghost" size="sm">
                              Hinzufügen
                            </Button>
                          </div>
                        ))
                      ) : (
                        <div className="p-4 text-center text-muted-foreground text-sm">
                          Keine Ergebnisse gefunden
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Rechte Seite: Watchlist */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">
                    Watchlist ({watchlist.length})
                  </Label>
                </div>
                
                <div className="border rounded-lg min-h-[200px]">
                  {watchlist.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                      <Bell className="w-8 h-8 opacity-50 mb-2" />
                      <p className="text-sm">Keine Trendpreise in der Watchlist</p>
                      <p className="text-xs mt-1">Suchen Sie Trading Pairs und fügen Sie sie hinzu</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {watchlist.map((tpId) => {
                        const pair = getTrendPrice(tpId);
                        return (
                          <div
                            key={tpId}
                            className="flex items-center justify-between p-3 hover-elevate"
                            data-testid={`watchlist-item-${pair?.name}`}
                          >
                            <div>
                              <p className="font-medium">{pair?.name}</p>
                              <p className="text-sm text-muted-foreground">{pair?.price} USDT</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeFromWatchlist(tpId)}
                              className="text-destructive hover:text-destructive"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Benachrichtigungen Liste */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Benachrichtigungen konfigurieren</h2>
          
          {watchlist.length === 0 ? (
            <Card className="p-8 text-center">
              <div className="flex flex-col items-center gap-4 text-muted-foreground">
                <Bell className="w-12 h-12 opacity-50" />
                <p>Keine Trendpreise in der Watchlist.</p>
                <p className="text-sm">Fügen Sie Trendpreise zur Watchlist hinzu, um Benachrichtigungen zu konfigurieren.</p>
              </div>
            </Card>
          ) : (
            watchlist.map((trendPriceId) => {
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
