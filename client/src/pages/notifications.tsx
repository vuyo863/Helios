import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Bell, ChevronDown, ChevronUp, Search, X, Pencil, Save, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface TrendPrice {
  id: string;
  name: string;
  symbol: string; // For API calls (e.g., BTCUSDT)
  price?: string;
  priceChange24h?: string;
  priceChangePercent24h?: string;
  lastUpdate?: Date;
}

interface TrendPriceSettings {
  trendPriceId: string;
  threshold: string;
  notifyOnIncrease: boolean;
  notifyOnDecrease: boolean;
  increaseFrequency: 'einmalig' | 'wiederholend';
  decreaseFrequency: 'einmalig' | 'wiederholend';
  customMessage: string;
}

export default function Notifications() {
  // Verfügbare Trading Pairs für Suche - werden dynamisch von Binance geladen
  const [availableTradingPairs, setAvailableTradingPairs] = useState<TrendPrice[]>([]);
  const [allBinancePairs, setAllBinancePairs] = useState<TrendPrice[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    // Load watchlist from localStorage on mount
    const saved = localStorage.getItem('notifications-watchlist');
    return saved ? JSON.parse(saved) : [];
  });
  const [isLiveUpdating, setIsLiveUpdating] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null); // Changed to intervalRef for polling
  const priceUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null); // For polling

  // Funktion zum Laden aller verfügbaren Binance Trading Pairs
  const fetchAllBinancePairs = async () => {
    try {
      const response = await fetch('https://api.binance.com/api/v3/exchangeInfo');
      if (!response.ok) return;
      
      const data = await response.json();
      
      // Filter für USDT und USDC Pairs
      const pairs: TrendPrice[] = data.symbols
        .filter((s: any) => 
          s.status === 'TRADING' && 
          (s.symbol.endsWith('USDT') || s.symbol.endsWith('USDC'))
        )
        .map((s: any, index: number) => ({
          id: `binance-${index}`,
          name: s.symbol.replace('USDT', '/USDT').replace('USDC', '/USDC'),
          symbol: s.symbol,
          price: 'Loading...'
        }));
      
      setAllBinancePairs(pairs);
      
      // Initialize availableTradingPairs with popular pairs
      const popularSymbols = [
        'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT',
        'DOGEUSDT', 'MATICUSDT', 'ICPUSDT', 'DOTUSDT', 'AVAXUSDT', 'LINKUSDT',
        'BTCUSDC', 'ETHUSDC', 'SOLUSDC', 'BNBUSDC' // USDC pairs
      ];
      
      const popularPairs = pairs.filter(p => popularSymbols.includes(p.symbol));
      setAvailableTradingPairs(popularPairs);
      
    } catch (error) {
      console.error('Error fetching Binance pairs:', error);
    }
  };

  // Load all Binance pairs on mount
  useEffect(() => {
    fetchAllBinancePairs();
  }, []);

  // Funktion zum Abrufen der aktuellen Preise von Binance API
  const fetchPrices = async (symbols: string[]) => {
    if (symbols.length === 0) return;

    try {
      // Binance Public API - 24hr Ticker Price Change Statistics
      const symbolsParam = symbols.map(s => `"${s}"`).join(',');
      const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=[${symbolsParam}]`);

      if (!response.ok) {
        console.error('Failed to fetch prices from Binance API');
        return;
      }

      const data = await response.json();

      setAvailableTradingPairs(prev => {
        const updated = [...prev];
        data.forEach((ticker: any) => {
          const index = updated.findIndex(p => p.symbol === ticker.symbol);
          if (index !== -1) {
            updated[index] = {
              ...updated[index],
              price: parseFloat(ticker.lastPrice).toLocaleString('de-DE', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 8,
              }),
              priceChange24h: parseFloat(ticker.priceChange).toFixed(2),
              priceChangePercent24h: parseFloat(ticker.priceChangePercent).toFixed(2),
              lastUpdate: new Date(), // Update last update time
            };
          }
        });
        return updated;
      });
    } catch (error) {
      console.error('Error fetching prices:', error);
    }
  };

  // Save watchlist to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('notifications-watchlist', JSON.stringify(watchlist));
  }, [watchlist]);

  // Initial fetch und regelmäßige Updates für Watchlist Trading Pairs
  useEffect(() => {
    if (allBinancePairs.length === 0) return;
    
    // Get symbols from watchlist
    const watchlistSymbols = watchlist
      .map(id => allBinancePairs.find(p => p.id === id)?.symbol)
      .filter(Boolean) as string[];

    if (watchlistSymbols.length === 0) return;

    // Initial fetch
    fetchPrices(watchlistSymbols);

    // Update alle 2 Sekunden
    priceUpdateIntervalRef.current = setInterval(() => {
      fetchPrices(watchlistSymbols);
    }, 2000);

    return () => {
      if (priceUpdateIntervalRef.current) {
        clearInterval(priceUpdateIntervalRef.current);
      }
    };
  }, [watchlist, allBinancePairs]); // Update when watchlist or pairs change

  // Live Price Update System - Aktualisiert alle 2 Sekunden (This was the old polling, now replaced by the above useEffect)
  useEffect(() => {
    // This effect is now largely superseded by the priceUpdateIntervalRef logic above.
    // It's kept here for potential future use or if specific logic related to isLiveUpdating state is needed.
    // However, the core price fetching is handled by priceUpdateIntervalRef.
    if (!isLiveUpdating) return;

    // The interval logic is now in priceUpdateIntervalRef's useEffect.
    // This block can be simplified or removed if not strictly needed for other state changes.

    return () => {
      // Cleanup for the old intervalRef if it were to be used.
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isLiveUpdating, watchlist]); // Dependencies potentially relevant if this effect were active

  const [expandedDropdowns, setExpandedDropdowns] = useState<string[]>([]);
  const [trendPriceSettings, setTrendPriceSettings] = useState<Record<string, TrendPriceSettings>>({});
  const [editMode, setEditMode] = useState<Record<string, boolean>>({});

  // Gefilterte Vorschläge basierend auf Suchanfrage - durchsucht ALLE Binance Pairs
  const filteredSuggestions = allBinancePairs
    .filter(pair =>
      pair.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !watchlist.includes(pair.id)
    )
    .slice(0, 10); // Zeige maximal 10 Vorschläge

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
          increaseFrequency: 'einmalig',
          decreaseFrequency: 'einmalig',
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

  const getTrendPrice = (id: string) => {
    // Search in both available and all pairs
    return availableTradingPairs.find(tp => tp.id === id) || 
           allBinancePairs.find(tp => tp.id === id);
  };

  // Helper to get the name, falling back to ID if not found
  const getTrendPriceName = (id: string) => {
    return getTrendPrice(id)?.name || id;
  };


  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Bell className="w-8 h-8 text-primary" />
            <h1 className="text-2xl font-bold" data-testid="heading-notifications">Notifications</h1>
          </div>
          <div className="flex items-center gap-2">
            <Activity className={cn(
              "w-5 h-5",
              isLiveUpdating ? "text-green-500 animate-pulse" : "text-muted-foreground"
            )} />
            <span className="text-sm text-muted-foreground">
              {isLiveUpdating ? "Live Updates aktiv" : "Updates pausiert"}
            </span>
            <Button
              variant={isLiveUpdating ? "default" : "outline"}
              size="sm"
              onClick={() => setIsLiveUpdating(!isLiveUpdating)}
            >
              {isLiveUpdating ? "Pause" : "Start"}
            </Button>
          </div>
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
                            <div className="flex-1">
                              <p className="font-medium">{pair.name}</p>
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-muted-foreground">${pair.price}</span>
                                {pair.priceChangePercent24h && (
                                  <span className={cn(
                                    "text-xs font-medium",
                                    parseFloat(pair.priceChangePercent24h) >= 0 ? "text-green-500" : "text-red-500"
                                  )}>
                                    {parseFloat(pair.priceChangePercent24h) >= 0 ? "+" : ""}
                                    {pair.priceChangePercent24h}%
                                  </span>
                                )}
                              </div>
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
                            <div className="flex-1">
                              <p className="font-medium">{pair?.name}</p>
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-muted-foreground">${pair?.price}</span>
                                {pair?.priceChangePercent24h && (
                                  <span className={cn(
                                    "text-xs font-medium",
                                    parseFloat(pair.priceChangePercent24h) >= 0 ? "text-green-500" : "text-red-500"
                                  )}>
                                    {parseFloat(pair.priceChangePercent24h) >= 0 ? "+" : ""}
                                    {pair.priceChangePercent24h}% (24h)
                                  </span>
                                )}
                              </div>
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
                increaseFrequency: 'einmalig' as 'einmalig' | 'wiederholend',
                decreaseFrequency: 'einmalig' as 'einmalig' | 'wiederholend',
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
                          
                          {/* Preiserhöhung über Schwellenwert */}
                          <div className="space-y-2 p-3 rounded-lg border">
                            <div className="flex items-center space-x-2">
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
                                className={cn("cursor-pointer flex-1", !isEditing && "opacity-70")}
                              >
                                Preiserhöhung über Schwellenwert
                              </Label>
                            </div>
                            {settings.notifyOnIncrease && (
                              <div className="ml-6 flex items-center gap-2">
                                <Label className="text-sm text-muted-foreground">Häufigkeit:</Label>
                                <select
                                  className="text-sm border rounded px-2 py-1 bg-background"
                                  disabled={!isEditing}
                                  value={settings.increaseFrequency}
                                  onChange={(e) => updateSetting(trendPriceId, 'increaseFrequency', e.target.value as 'einmalig' | 'wiederholend')}
                                >
                                  <option value="einmalig">Einmalig</option>
                                  <option value="wiederholend">Wiederholend</option>
                                </select>
                              </div>
                            )}
                          </div>

                          {/* Preissenkung unter Schwellenwert */}
                          <div className="space-y-2 p-3 rounded-lg border">
                            <div className="flex items-center space-x-2">
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
                                className={cn("cursor-pointer flex-1", !isEditing && "opacity-70")}
                              >
                                Preissenkung unter Schwellenwert
                              </Label>
                            </div>
                            {settings.notifyOnDecrease && (
                              <div className="ml-6 flex items-center gap-2">
                                <Label className="text-sm text-muted-foreground">Häufigkeit:</Label>
                                <select
                                  className="text-sm border rounded px-2 py-1 bg-background"
                                  disabled={!isEditing}
                                  value={settings.decreaseFrequency}
                                  onChange={(e) => updateSetting(trendPriceId, 'decreaseFrequency', e.target.value as 'einmalig' | 'wiederholend')}
                                >
                                  <option value="einmalig">Einmalig</option>
                                  <option value="wiederholend">Wiederholend</option>
                                </select>
                              </div>
                            )}
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