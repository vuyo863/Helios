import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Bell, ChevronDown, ChevronUp, Search, X, Pencil, Save, Activity, Plus, Trash2, Check, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface TrendPrice {
  id: string;
  name: string;
  symbol: string; // For API calls (e.g., BTCUSDT)
  price?: string;
  priceChange24h?: string;
  priceChangePercent24h?: string;
  lastUpdate?: Date;
  marketType?: 'spot' | 'futures'; // Market type indicator
}

type AlarmLevel = 'harmlos' | 'achtung' | 'gefährlich' | 'sehr_gefährlich';

interface ThresholdConfig {
  id: string;
  threshold: string;
  notifyOnIncrease: boolean;
  notifyOnDecrease: boolean;
  increaseFrequency: 'einmalig' | 'wiederholend';
  decreaseFrequency: 'einmalig' | 'wiederholend';
  alarmLevel: AlarmLevel;
  note: string;
}

interface AlarmLevelConfig {
  level: AlarmLevel;
  channels: {
    push: boolean;
    email: boolean;
    sms: boolean;
    webhook: boolean;
  };
  requiresApproval: boolean;
  repeatCount: number | 'infinite'; // Anzahl Wiederholungen oder 'infinite'
  sequenceHours: number;
  sequenceMinutes: number;
  sequenceSeconds: number;
}

interface ActiveAlarm {
  id: string;
  trendPriceName: string;
  threshold: string;
  alarmLevel: AlarmLevel;
  triggeredAt: Date;
  message: string;
  note: string;
}

interface TrendPriceSettings {
  trendPriceId: string;
  thresholds: ThresholdConfig[];
}

export default function Notifications() {
  const { toast } = useToast();

  // Market Type Toggle State
  const [marketType, setMarketType] = useState<'spot' | 'futures'>('spot');

  // Verfügbare Trading Pairs für Suche - werden dynamisch von Binance geladen
  const [availableTradingPairs, setAvailableTradingPairs] = useState<TrendPrice[]>([]);
  const [allBinancePairs, setAllBinancePairs] = useState<TrendPrice[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  // Store watchlist with marketType information
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    // Load watchlist from localStorage on mount
    const saved = localStorage.getItem('notifications-watchlist');
    return saved ? JSON.parse(saved) : [];
  });

  // Store marketType for each pair
  const [pairMarketTypes, setPairMarketTypes] = useState<Record<string, 'spot' | 'futures'>>(() => {
    const saved = localStorage.getItem('notifications-pair-market-types');
    return saved ? JSON.parse(saved) : {};
  });
  const [isLiveUpdating, setIsLiveUpdating] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null); // Changed to intervalRef for polling
  const priceUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null); // For polling

  // State for Futures pairs
  const [allBinanceFuturesPairs, setAllBinanceFuturesPairs] = useState<TrendPrice[]>([]);

  // Funktion zum Laden aller verfügbaren Binance Spot Trading Pairs
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
          id: `binance-spot-${index}`,
          name: s.symbol.replace('USDT', '/USDT').replace('USDC', '/USDC'),
          symbol: s.symbol,
          price: 'Loading...',
          marketType: 'spot' as const
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

  // Funktion zum Laden aller verfügbaren Binance Futures Trading Pairs
  const fetchAllBinanceFuturesPairs = async () => {
    try {
      const response = await fetch('https://fapi.binance.com/fapi/v1/exchangeInfo');
      if (!response.ok) return;

      const data = await response.json();

      // Filter für USDT Perpetual Futures
      const futuresPairs: TrendPrice[] = data.symbols
        .filter((s: any) => 
          s.status === 'TRADING' && 
          s.contractType === 'PERPETUAL' &&
          s.symbol.endsWith('USDT')
        )
        .map((s: any, index: number) => ({
          id: `binance-futures-${index}`,
          name: s.symbol.replace('USDT', '/USDT'),
          symbol: s.symbol,
          price: 'Loading...',
          marketType: 'futures' as const
        }));

      setAllBinanceFuturesPairs(futuresPairs);

      // Initialize availableTradingPairs with popular futures pairs
      const popularFuturesSymbols = [
        'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT',
        'DOGEUSDT', 'MATICUSDT', 'DOTUSDT', 'AVAXUSDT', 'LINKUSDT'
      ];

      const popularFuturesPairs = futuresPairs.filter(p => popularFuturesSymbols.includes(p.symbol));
      
      // Add popular futures pairs to availableTradingPairs
      setAvailableTradingPairs(prev => {
        // Avoid duplicates
        const existingIds = new Set(prev.map(p => p.id));
        const newPairs = popularFuturesPairs.filter(p => !existingIds.has(p.id));
        return [...prev, ...newPairs];
      });

    } catch (error) {
      console.error('Error fetching Binance Futures pairs:', error);
    }
  };

  // Load all Binance pairs on mount
  useEffect(() => {
    fetchAllBinancePairs();
    fetchAllBinanceFuturesPairs();
  }, []);

  // Load watchlist pairs into availableTradingPairs when data is available
  useEffect(() => {
    if (allBinancePairs.length === 0 && allBinanceFuturesPairs.length === 0) return;
    if (watchlist.length === 0) return;

    watchlist.forEach(id => {
      // Check if already in availableTradingPairs
      const existingPair = availableTradingPairs.find(p => p.id === id);
      if (existingPair) return;

      // Get the stored marketType for this pair
      const storedMarketType = pairMarketTypes[id] || 'spot';

      // Try to find in the correct market based on stored type
      let pair;
      if (storedMarketType === 'futures') {
        pair = allBinanceFuturesPairs.find(p => p.id === id);
      } else {
        pair = allBinancePairs.find(p => p.id === id);
      }

      // Fallback: try the other market if not found
      if (!pair) {
        pair = allBinancePairs.find(p => p.id === id) || allBinanceFuturesPairs.find(p => p.id === id);
      }
      
      if (pair) {
        setAvailableTradingPairs(prev => {
          if (prev.find(p => p.id === id)) return prev;
          // WICHTIG: Ensure marketType is explicitly set from stored value
          const correctedPair: TrendPrice = {
            ...pair,
            marketType: storedMarketType as 'spot' | 'futures'
          };
          return [...prev, correctedPair];
        });
      }
    });
  }, [allBinancePairs, allBinanceFuturesPairs, watchlist, pairMarketTypes, availableTradingPairs]);

  // Funktion zum Abrufen der aktuellen Preise von Binance Spot API
  const fetchSpotPrices = async (symbols: string[]) => {
    if (symbols.length === 0) return;

    try {
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
              lastUpdate: new Date(),
            };
          }
        });
        return updated;
      });
    } catch (error) {
      console.error('Error fetching prices:', error);
    }
  };

  // Funktion zum Abrufen der aktuellen Preise von Binance Futures API
  const fetchFuturesPrices = async (symbols: string[]) => {
    if (symbols.length === 0) return;

    try {
      const symbolsParam = symbols.map(s => `"${s}"`).join(',');
      const response = await fetch(`https://fapi.binance.com/fapi/v1/ticker/24hr?symbols=[${symbolsParam}]`);

      if (!response.ok) {
        console.error('Failed to fetch futures prices from Binance API');
        return;
      }

      const data = await response.json();

      setAvailableTradingPairs(prev => {
        const updated = [...prev];
        data.forEach((ticker: any) => {
          // WICHTIG: Find by symbol AND check stored marketType from pairMarketTypes
          const index = updated.findIndex(p => {
            if (p.symbol !== ticker.symbol) return false;
            const storedMarketType = pairMarketTypes[p.id] || 'spot';
            return storedMarketType === 'futures';
          });
          
          if (index !== -1) {
            updated[index] = {
              ...updated[index],
              price: parseFloat(ticker.lastPrice).toLocaleString('de-DE', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 8,
              }),
              priceChange24h: parseFloat(ticker.priceChange).toFixed(2),
              priceChangePercent24h: parseFloat(ticker.priceChangePercent).toFixed(2),
              lastUpdate: new Date(),
              marketType: 'futures' as const // Ensure marketType is set
            };
          }
        });
        return updated;
      });
    } catch (error) {
      console.error('Error fetching futures prices:', error);
    }
  };

  

  // Initial fetch und regelmäßige Updates für Watchlist Trading Pairs
  useEffect(() => {
    if (availableTradingPairs.length === 0) return;

    // Separate Spot and Futures symbols based on STORED marketType from pairMarketTypes
    const spotSymbols: string[] = [];
    const futuresSymbols: string[] = [];

    availableTradingPairs.forEach(pair => {
      if (!watchlist.includes(pair.id)) return;
      
      // WICHTIG: Use stored marketType from pairMarketTypes, not pair.marketType directly
      const storedMarketType = pairMarketTypes[pair.id] || 'spot';
      
      if (storedMarketType === 'futures') {
        futuresSymbols.push(pair.symbol);
      } else {
        spotSymbols.push(pair.symbol);
      }
    });

    if (spotSymbols.length === 0 && futuresSymbols.length === 0) return;

    // Initial fetch
    if (spotSymbols.length > 0) fetchSpotPrices(spotSymbols);
    if (futuresSymbols.length > 0) fetchFuturesPrices(futuresSymbols);

    // Update alle 2 Sekunden
    priceUpdateIntervalRef.current = setInterval(() => {
      if (spotSymbols.length > 0) fetchSpotPrices(spotSymbols);
      if (futuresSymbols.length > 0) fetchFuturesPrices(futuresSymbols);
    }, 2000);

    return () => {
      if (priceUpdateIntervalRef.current) {
        clearInterval(priceUpdateIntervalRef.current);
      }
    };
  }, [watchlist, availableTradingPairs, pairMarketTypes]);

  const [trendPriceSettings, setTrendPriceSettings] = useState<Record<string, TrendPriceSettings>>(() => {
    // Load saved thresholds from localStorage on mount
    const saved = localStorage.getItem('notifications-threshold-settings');
    return saved ? JSON.parse(saved) : {};
  });

  const [triggeredThresholds, setTriggeredThresholds] = useState<Set<string>>(new Set());

  // Alarmierungsstufen Konfiguration - moved up before useEffect
  const [alarmLevelConfigs, setAlarmLevelConfigs] = useState<Record<AlarmLevel, AlarmLevelConfig>>({
    harmlos: {
      level: 'harmlos',
      channels: { push: true, email: false, sms: false, webhook: false },
      requiresApproval: false,
      repeatCount: 1,
      sequenceHours: 0,
      sequenceMinutes: 0,
      sequenceSeconds: 0
    },
    achtung: {
      level: 'achtung',
      channels: { push: true, email: true, sms: false, webhook: false },
      requiresApproval: false,
      repeatCount: 1,
      sequenceHours: 0,
      sequenceMinutes: 0,
      sequenceSeconds: 0
    },
    gefährlich: {
      level: 'gefährlich',
      channels: { push: true, email: true, sms: false, webhook: true },
      requiresApproval: true,
      repeatCount: 3,
      sequenceHours: 0,
      sequenceMinutes: 5,
      sequenceSeconds: 0
    },
    sehr_gefährlich: {
      level: 'sehr_gefährlich',
      channels: { push: true, email: true, sms: true, webhook: true },
      requiresApproval: true,
      repeatCount: 'infinite',
      sequenceHours: 0,
      sequenceMinutes: 1,
      sequenceSeconds: 0
    }
  });

  // Monitor price changes and trigger threshold notifications
  useEffect(() => {
    // Check all trading pairs with thresholds
    availableTradingPairs.forEach((pair) => {
      const settings = trendPriceSettings[pair.id];
      if (!settings || !settings.thresholds || settings.thresholds.length === 0) return;

      // Only check if we have a valid price
      if (!pair.price || pair.price === 'Loading...') return;

      const currentPrice = parseFloat(pair.price.replace(/\./g, '').replace(',', '.'));
      if (isNaN(currentPrice)) return;

      settings.thresholds.forEach((threshold) => {
        // Skip if threshold value is empty
        if (!threshold.threshold || threshold.threshold.trim() === '') return;

        const thresholdValue = parseFloat(threshold.threshold);
        if (isNaN(thresholdValue)) return;

        // Create unique key for this threshold trigger
        const triggerKey = `${pair.id}-${threshold.id}-${thresholdValue}`;

        // Check if this threshold was already triggered
        if (triggeredThresholds.has(triggerKey)) return;

        // Get alarm level config
        const alarmConfig = alarmLevelConfigs[threshold.alarmLevel];

        // Check for price increase above threshold
        if (threshold.notifyOnIncrease && currentPrice >= thresholdValue) {
          setTriggeredThresholds(prev => new Set(prev).add(triggerKey));

          const message = threshold.note 
            ? `${pair.name}: Schwellenwert ${thresholdValue} USDT erreicht (aktuell: ${currentPrice.toFixed(2)} USDT). Notiz: ${threshold.note}`
            : `${pair.name}: Schwellenwert ${thresholdValue} USDT erreicht (aktuell: ${currentPrice.toFixed(2)} USDT)`;

          // Create active alarm
          const newAlarm: ActiveAlarm = {
            id: crypto.randomUUID(),
            trendPriceName: pair.name,
            threshold: thresholdValue.toString(),
            alarmLevel: threshold.alarmLevel,
            triggeredAt: new Date(),
            message: `Preis über ${thresholdValue} USDT gestiegen`,
            note: threshold.note
          };

          setActiveAlarms(prev => [...prev, newAlarm]);

          // Show in-app notification (Push)
          if (alarmConfig.channels.push) {
            toast({
              title: `🔔 ${getAlarmLevelLabel(threshold.alarmLevel)} - Schwellenwert erreicht!`,
              description: message,
              duration: 10000,
            });
          }

          // Send email notification
          if (alarmConfig.channels.email) {
            fetch('/api/notifications/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                channels: { email: true, sms: false, webhook: false },
                recipient: 'hollvuyo@gmail.com',
                subject: `🚨 Pionex Alert - ${getAlarmLevelLabel(threshold.alarmLevel)}`,
                message: message,
                alarmLevel: threshold.alarmLevel
              })
            }).catch(err => console.error('Email notification error:', err));
          }

          // Handle repeating notifications
          if (threshold.increaseFrequency === 'wiederholend') {
            const sequenceMs = (alarmConfig.sequenceHours * 3600 + alarmConfig.sequenceMinutes * 60 + alarmConfig.sequenceSeconds) * 1000;
            const cooldown = sequenceMs > 0 ? sequenceMs : 60000; // Default 1 minute

            setTimeout(() => {
              setTriggeredThresholds(prev => {
                const newSet = new Set(prev);
                newSet.delete(triggerKey);
                return newSet;
              });
            }, cooldown);
          }
        }

        // Check for price decrease below threshold
        if (threshold.notifyOnDecrease && currentPrice <= thresholdValue) {
          setTriggeredThresholds(prev => new Set(prev).add(triggerKey));

          const message = threshold.note 
            ? `${pair.name}: Schwellenwert ${thresholdValue} USDT unterschritten (aktuell: ${currentPrice.toFixed(2)} USDT). Notiz: ${threshold.note}`
            : `${pair.name}: Schwellenwert ${thresholdValue} USDT unterschritten (aktuell: ${currentPrice.toFixed(2)} USDT)`;

          // Create active alarm
          const newAlarm: ActiveAlarm = {
            id: crypto.randomUUID(),
            trendPriceName: pair.name,
            threshold: thresholdValue.toString(),
            alarmLevel: threshold.alarmLevel,
            triggeredAt: new Date(),
            message: `Preis unter ${thresholdValue} USDT gefallen`,
            note: threshold.note
          };

          setActiveAlarms(prev => [...prev, newAlarm]);

          // Show in-app notification (Push)
          if (alarmConfig.channels.push) {
            toast({
              title: `🔔 ${getAlarmLevelLabel(threshold.alarmLevel)} - Schwellenwert unterschritten!`,
              description: message,
              duration: 10000,
            });
          }

          // Send email notification
          if (alarmConfig.channels.email) {
            fetch('/api/notifications/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                channels: { email: true, sms: false, webhook: false },
                recipient: 'hollvuyo@gmail.com',
                subject: `🚨 Pionex Alert - ${getAlarmLevelLabel(threshold.alarmLevel)}`,
                message: message,
                alarmLevel: threshold.alarmLevel
              })
            }).catch(err => console.error('Email notification error:', err));
          }

          // Handle repeating notifications
          if (threshold.decreaseFrequency === 'wiederholend') {
            const sequenceMs = (alarmConfig.sequenceHours * 3600 + alarmConfig.sequenceMinutes * 60 + alarmConfig.sequenceSeconds) * 1000;
            const cooldown = sequenceMs > 0 ? sequenceMs : 60000; // Default 1 minute

            setTimeout(() => {
              setTriggeredThresholds(prev => {
                const newSet = new Set(prev);
                newSet.delete(triggerKey);
                return newSet;
              });
            }, cooldown);
          }
        }
      });
    });
  }, [availableTradingPairs, trendPriceSettings, triggeredThresholds, alarmLevelConfigs, toast]);

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
  const [editMode, setEditMode] = useState<Record<string, boolean>>({});
  const [viewDialogOpen, setViewDialogOpen] = useState<Record<string, boolean>>({});
  const [editingThresholdId, setEditingThresholdId] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState<Record<string, boolean>>({});

  // Save watchlist to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('notifications-watchlist', JSON.stringify(watchlist));
  }, [watchlist]);

  // Save pair market types to localStorage
  useEffect(() => {
    localStorage.setItem('notifications-pair-market-types', JSON.stringify(pairMarketTypes));
  }, [pairMarketTypes]);

  // Save threshold settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('notifications-threshold-settings', JSON.stringify(trendPriceSettings));
  }, [trendPriceSettings]);

  const [alarmLevelEditMode, setAlarmLevelEditMode] = useState<Record<AlarmLevel, boolean>>({
    harmlos: false,
    achtung: false,
    gefährlich: false,
    sehr_gefährlich: false
  });

  // Aktive Alarmierungen - mit localStorage Synchronisation
  const [activeAlarms, setActiveAlarms] = useState<ActiveAlarm[]>(() => {
    const stored = localStorage.getItem('active-alarms');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return [];
      }
    }
    return [];
  });

  // Sync activeAlarms to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('active-alarms', JSON.stringify(activeAlarms));
  }, [activeAlarms]);

  // Gefilterte Vorschläge basierend auf Suchanfrage und Market Type
  const allPairsForCurrentMarket = marketType === 'spot' ? allBinancePairs : allBinanceFuturesPairs;
  const filteredSuggestions = allPairsForCurrentMarket
    .filter(pair =>
      pair.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !watchlist.includes(pair.id)
    )
    .slice(0, 10); // Zeige maximal 10 Vorschläge

  const addToWatchlist = (id: string) => {
    if (!watchlist.includes(id)) {
      setWatchlist(prev => [...prev, id]);
      
      // Use the CURRENT marketType toggle state
      const selectedMarketType = marketType;
      
      // Find pair from the correct market based on current toggle
      const pair = selectedMarketType === 'futures' 
        ? allBinanceFuturesPairs.find(p => p.id === id)
        : allBinancePairs.find(p => p.id === id);
      
      if (pair && !availableTradingPairs.find(p => p.id === id)) {
        // Add pair with the selected market type
        setAvailableTradingPairs(prev => [...prev, {
          ...pair,
          marketType: selectedMarketType
        }]);
      }
      
      // Store the market type for this pair
      setPairMarketTypes(prev => ({
        ...prev,
        [id]: selectedMarketType
      }));
      
      // Initialize settings only if not already existing
      setTrendPriceSettings(prev => {
        if (prev[id]) {
          return prev; // Keep existing settings
        }
        return {
          ...prev,
          [id]: {
            trendPriceId: id,
            thresholds: []
          }
        };
      });
      setSearchQuery('');
    }
  };

  const removeFromWatchlist = (id: string) => {
    setWatchlist(prev => prev.filter(tpId => tpId !== id));
    setExpandedDropdowns(prev => prev.filter(tpId => tpId !== id));
    setTrendPriceSettings(prev => {
      const updated = { ...prev };
      delete updated[id];
      return updated;
    });
  };

  const toggleDropdown = (id: string) => {
    setExpandedDropdowns(prev => {
      // Nur ein Dropdown offen zur selben Zeit
      if (prev.includes(id)) {
        return []; // Schließe das aktuelle
      } else {
        return [id]; // Öffne nur das neue
      }
    });
  };

  const addThreshold = (trendPriceId: string) => {
    setTrendPriceSettings(prev => ({
      ...prev,
      [trendPriceId]: {
        ...prev[trendPriceId],
        thresholds: [
          ...(prev[trendPriceId]?.thresholds || []),
          {
            id: crypto.randomUUID(),
            threshold: '',
            notifyOnIncrease: false,
            notifyOnDecrease: false,
            increaseFrequency: 'einmalig',
            decreaseFrequency: 'einmalig',
            alarmLevel: 'harmlos',
            note: ''
          }
        ]
      }
    }));
  };

  const removeThreshold = (trendPriceId: string, thresholdId: string) => {
    const currentSettings = trendPriceSettings[trendPriceId];

    if (!currentSettings) return;

    // Lösche den Schwellenwert
    const updatedThresholds = currentSettings.thresholds.filter(t => t.id !== thresholdId);

    setTrendPriceSettings(prev => ({
      ...prev,
      [trendPriceId]: {
        ...prev[trendPriceId],
        thresholds: updatedThresholds
      }
    }));

    toast({
      title: "Schwellenwert gelöscht",
      description: "Der Schwellenwert wurde erfolgreich entfernt.",
    });
  };

  const updateThreshold = (trendPriceId: string, thresholdId: string, field: keyof ThresholdConfig, value: any) => {
    setTrendPriceSettings(prev => ({
      ...prev,
      [trendPriceId]: {
        ...prev[trendPriceId],
        thresholds: prev[trendPriceId].thresholds.map(t =>
          t.id === thresholdId ? { ...t, [field]: value } : t
        )
      }
    }));
  };

  const getAlarmLevelColor = (level: AlarmLevel): string => {
    switch (level) {
      case 'harmlos': return '#3B82F6'; // Blau
      case 'achtung': return '#EAB308'; // Gelb
      case 'gefährlich': return '#F97316'; // Orange
      case 'sehr_gefährlich': return '#EF4444'; // Rot
      default: return '#3B82F6';
    }
  };

  const getAlarmLevelLabel = (level: AlarmLevel): string => {
    switch (level) {
      case 'harmlos': return 'Harmlos';
      case 'achtung': return 'Achtung';
      case 'gefährlich': return 'Gefährlich';
      case 'sehr_gefährlich': return 'Sehr Gefährlich';
      default: return 'Harmlos';
    }
  };

  const toggleEditMode = (trendPriceId: string) => {
    setEditMode(prev => ({
      ...prev,
      [trendPriceId]: !prev[trendPriceId]
    }));
  };

  const getTrendPrice = (id: string) => {
    // Search in available pairs first, then all pairs (both Spot and Futures)
    return availableTradingPairs.find(tp => tp.id === id) || 
           allBinancePairs.find(tp => tp.id === id) || 
           allBinanceFuturesPairs.find(tp => tp.id === id);
  };

  // Helper to get the name, falling back to ID if not found
  const getTrendPriceName = (id: string) => {
    return getTrendPrice(id)?.name || id;
  };

  const updateAlarmLevelConfig = (level: AlarmLevel, field: keyof AlarmLevelConfig['channels'] | 'requiresApproval' | 'repeatCount' | 'sequenceHours' | 'sequenceMinutes' | 'sequenceSeconds', value: boolean | number | 'infinite') => {
    setAlarmLevelConfigs(prev => ({
      ...prev,
      [level]: {
        ...prev[level],
        ...(field === 'requiresApproval' 
          ? { requiresApproval: value as boolean }
          : field === 'repeatCount' || field === 'sequenceHours' || field === 'sequenceMinutes' || field === 'sequenceSeconds'
          ? { [field]: value }
          : { channels: { ...prev[level].channels, [field]: value as boolean } }
        )
      }
    }));
  };

  const toggleAlarmLevelEdit = (level: AlarmLevel) => {
    setAlarmLevelEditMode(prev => ({
      ...prev,
      [level]: !prev[level]
    }));
  };

  const deleteAlarmLevel = (level: AlarmLevel) => {
    if (confirm(`Möchten Sie die Alarmierungsstufe "${getAlarmLevelLabel(level)}" wirklich löschen?`)) {
      // In production, this would remove the level from the config
      console.log(`Alarmierungsstufe ${level} gelöscht`);
    }
  };

  const approveAlarm = (alarmId: string) => {
    setActiveAlarms(prev => {
      const updated = prev.filter(alarm => alarm.id !== alarmId);
      // Update localStorage to reflect approved alarms
      localStorage.setItem('active-alarms', JSON.stringify(updated));
      return updated;
    });
  };

  // Test-Funktion: Mock-Alarm auslösen
  const triggerMockAlarm = async () => {
    // Mock-Alarm in activeAlarms hinzufügen
    const mockAlarm: ActiveAlarm = {
      id: crypto.randomUUID(),
      trendPriceName: 'BTC/USDT',
      threshold: '50000',
      alarmLevel: 'sehr_gefährlich',
      triggeredAt: new Date(),
      message: 'Preis über 50000 USDT gestiegen',
      note: 'TEST: Wichtiger Widerstandslevel durchbrochen!'
    };

    setActiveAlarms(prev => [...prev, mockAlarm]);

    // Toast-Benachrichtigung
    toast({
      title: "🔔 MOCK-ALARM AUSGELÖST!",
      description: `${mockAlarm.trendPriceName}: ${mockAlarm.message}`,
      duration: 10000,
    });

    // Email-Benachrichtigung senden
    try {
      const response = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          channels: {
            email: true,
            sms: false,
            webhook: false
          },
          recipient: 'hollvuyo@gmail.com',
          subject: '🚨 Pionex Trading Alert - Sehr Gefährlich',
          message: `${mockAlarm.trendPriceName}: ${mockAlarm.message}. ${mockAlarm.note}`,
          alarmLevel: mockAlarm.alarmLevel
        })
      });

      const result = await response.json();

      if (result.success && result.results.email?.success) {
        toast({
          title: "✅ Email gesendet!",
          description: `Benachrichtigung wurde an hollvuyo@gmail.com gesendet`,
          duration: 5000,
        });
      } else {
        toast({
          title: "⚠️ Email-Fehler",
          description: result.results.email?.error || "Email konnte nicht gesendet werden",
          variant: "destructive",
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('Email notification error:', error);
      toast({
        title: "❌ Email-Fehler",
        description: "Verbindung zum Server fehlgeschlagen",
        variant: "destructive",
        duration: 5000,
      });
    }
  };

  const getTimeAgo = (date: Date | string): string => {
    const now = new Date();
    const alarmDate = typeof date === 'string' ? new Date(date) : date;
    const diffMs = now.getTime() - alarmDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Gerade eben';
    if (diffMins < 60) return `vor ${diffMins} Min`;
    if (diffHours < 24) return `vor ${diffHours} Std`;
    return `vor ${diffDays} Tag${diffDays > 1 ? 'en' : ''}`;
  };


  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Bell className="w-8 h-8 text-primary" />
            <h1 className="text-2xl font-bold" data-testid="heading-notifications">Notifications</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="destructive"
              size="sm"
              onClick={triggerMockAlarm}
              className="bg-red-500 hover:bg-red-600"
            >
              🧪 TEST ALARM
            </Button>
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
        </div>

        {/* Aktive Alarmierungen - Immer sichtbar */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              Aktive Alarmierungen ({activeAlarms.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeAlarms.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm">
                Keine aktiven Alarmierungen
              </div>
            ) : (
              <div className={cn(
                "space-y-2",
                activeAlarms.length > 2 && "max-h-[200px] overflow-y-auto pr-2"
              )}>
                {activeAlarms.map((alarm) => (
                  <div
                    key={alarm.id}
                    className="flex items-start justify-between p-3 rounded-lg border gap-3"
                    style={{ 
                      borderColor: getAlarmLevelColor(alarm.alarmLevel),
                      backgroundColor: `${getAlarmLevelColor(alarm.alarmLevel)}08`
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <div 
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                          style={{ backgroundColor: getAlarmLevelColor(alarm.alarmLevel) }}
                        />
                        <h4 className="font-semibold text-sm">{alarm.trendPriceName}</h4>
                        <span 
                          className="text-xs px-1.5 py-0.5 rounded font-medium"
                          style={{ 
                            backgroundColor: getAlarmLevelColor(alarm.alarmLevel),
                            color: 'white'
                          }}
                        >
                          {getAlarmLevelLabel(alarm.alarmLevel)}
                        </span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {getTimeAgo(alarm.triggeredAt)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        ${alarm.threshold} | {alarm.message}
                      </p>
                      {alarm.note && (
                        <div 
                          className="text-xs mt-1.5 p-1.5 rounded border-l-2"
                          style={{ 
                            borderLeftColor: getAlarmLevelColor(alarm.alarmLevel),
                            backgroundColor: `${getAlarmLevelColor(alarm.alarmLevel)}10`
                          }}
                        >
                          {alarm.note}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => approveAlarm(alarm.id)}
                      className="flex-shrink-0 h-8"
                      style={{ borderColor: getAlarmLevelColor(alarm.alarmLevel) }}
                    >
                      <Check className="w-3.5 h-3.5 mr-1" />
                      Approve
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Trendpreis Suche & Watchlist Content Card */}
        <Card className="mb-8 ring-2 ring-cyan-600" style={{ overflow: 'visible' }}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Trendpreise & Watchlist</CardTitle>
              {/* Market Type Toggle */}
              <ToggleGroup type="single" value={marketType} onValueChange={(value) => value && setMarketType(value as 'spot' | 'futures')} className="gap-0">
                <ToggleGroupItem value="spot" aria-label="Spot Market" className="h-8 px-3 rounded-r-none data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                  Spot
                </ToggleGroupItem>
                <ToggleGroupItem value="futures" aria-label="Futures Market" className="h-8 px-3 rounded-l-none data-[state=on]:bg-blue-500 data-[state=on]:text-white">
                  Futures
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
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
                      placeholder={marketType === 'spot' ? "z.B. BTC/USDT, ETH/USDT..." : "z.B. BTC/USDT Futures..."}
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
                        const storedMarketType = pairMarketTypes[tpId] || 'spot'; // WICHTIG: Use stored marketType
                        
                        return (
                          <div
                            key={tpId}
                            className="flex items-center justify-between p-3 hover-elevate"
                            data-testid={`watchlist-item-${pair?.name}`}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-medium">{pair?.name}</p>
                                {storedMarketType === 'futures' && (
                                  <span className="text-xs px-2 py-0.5 rounded bg-blue-500 text-white font-medium">
                                    FUTURE
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-muted-foreground">${pair?.price || 'Loading...'}</span>
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

        {/* Benachrichtigungen konfigurieren Section */}
        <Card className="ring-2 ring-cyan-600 mb-8" style={{ overflow: 'visible' }}>
          <CardHeader>
            <CardTitle className="text-xl">Benachrichtigungen konfigurieren</CardTitle>
          </CardHeader>
          <CardContent>
            {watchlist.length === 0 ? (
              <div className="p-8 text-center">
                <div className="flex flex-col items-center gap-4 text-muted-foreground">
                  <Bell className="w-12 h-12 opacity-50" />
                  <p>Keine Trendpreise in der Watchlist.</p>
                  <p className="text-sm">Fügen Sie Trendpreise zur Watchlist hinzu, um Benachrichtigungen zu konfigurieren.</p>
                </div>
              </div>
            ) : (
            <>

            {/* Check if there are any saved thresholds across all watchlist items */}
            {(() => {
              const hasAnyThresholds = watchlist.some(trendPriceId => {
                const settings = trendPriceSettings[trendPriceId];
                const savedThresholds = settings?.thresholds.filter(t => 
                  t.threshold && 
                  t.threshold.trim() !== '' && 
                  (t.notifyOnIncrease || t.notifyOnDecrease)
                ) || [];
                return savedThresholds.length > 0;
              });

              if (!hasAnyThresholds) {
                return (
                  <div className="p-8 text-center">
                    <div className="flex flex-col items-center gap-4 text-muted-foreground">
                      <Bell className="w-12 h-12 opacity-50" />
                      <p>Keine Benachrichtigungen konfiguriert.</p>
                      <p className="text-sm">Klicken Sie auf den Button unten, um Benachrichtigungen hinzuzufügen.</p>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" className="flex items-center gap-2 mt-2">
                            <Plus className="w-4 h-4" />
                            Benachrichtigung hinzufügen
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[80vh]" onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
                          <DialogHeader>
                            <DialogTitle>Benachrichtigung hinzufügen</DialogTitle>
                          </DialogHeader>
                          <ScrollArea className="max-h-[60vh] pr-4 pl-2">
                            <div className="space-y-4">
                              {watchlist.map((trendPriceId) => {
                                const pair = getTrendPrice(trendPriceId);

                                return (
                                  <Card key={trendPriceId} className="p-4">
                                    <div className="flex items-center justify-between mb-3">
                                      <h3 className="text-lg font-semibold">{pair?.name || trendPriceId}</h3>
                                      <span className="text-sm text-muted-foreground">
                                        ${pair?.price || 'Loading...'}
                                      </span>
                                    </div>
                                    <Dialog
                                      open={editDialogOpen[`new-${trendPriceId}`]}
                                      onOpenChange={(open) => {
                                        setEditDialogOpen(prev => ({ ...prev, [`new-${trendPriceId}`]: open }));
                                      }}
                                    >
                                      <DialogTrigger asChild>
                                        <Button
                                          variant="outline"
                                          className="w-full flex items-center justify-center gap-2"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            
                                            // Initialize settings if they don't exist
                                            if (!trendPriceSettings[trendPriceId]) {
                                              setTrendPriceSettings(prev => ({
                                                ...prev,
                                                [trendPriceId]: {
                                                  trendPriceId,
                                                  thresholds: []
                                                }
                                              }));
                                            }

                                            // Create a new threshold
                                            const newThreshold: ThresholdConfig = {
                                              id: crypto.randomUUID(),
                                              threshold: '',
                                              notifyOnIncrease: false,
                                              notifyOnDecrease: false,
                                              increaseFrequency: 'einmalig',
                                              decreaseFrequency: 'einmalig',
                                              alarmLevel: 'harmlos',
                                              note: ''
                                            };

                                            setTrendPriceSettings(prev => ({
                                              ...prev,
                                              [trendPriceId]: {
                                                ...prev[trendPriceId],
                                                thresholds: [...(prev[trendPriceId]?.thresholds || []), newThreshold]
                                              }
                                            }));

                                            // Set editing threshold and open dialog
                                            setEditingThresholdId(newThreshold.id);
                                            setEditDialogOpen(prev => ({ ...prev, [`new-${trendPriceId}`]: true, [newThreshold.id]: true }));
                                          }}
                                        >
                                          <Plus className="w-4 h-4" />
                                          Schwellenwert hinzufügen
                                        </Button>
                                      </DialogTrigger>
                                      <DialogContent className="max-w-2xl" onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
                                        <DialogHeader>
                                          <DialogTitle>Neuen Schwellenwert konfigurieren</DialogTitle>
                                        </DialogHeader>
                                        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 pl-2">
                                          {editingThresholdId && trendPriceSettings[trendPriceId]?.thresholds.find(t => t.id === editingThresholdId) && (() => {
                                            const threshold = trendPriceSettings[trendPriceId].thresholds.find(t => t.id === editingThresholdId)!;
                                            return (
                                              <>
                                                <div>
                                                  <Label htmlFor={`new-threshold-${editingThresholdId}`}>Schwellenwert (USDT)</Label>
                                                  <Input
                                                    id={`new-threshold-${editingThresholdId}`}
                                                    type="number"
                                                    step="0.01"
                                                    placeholder="z.B. 50000"
                                                    value={threshold.threshold}
                                                    onChange={(e) => updateThreshold(trendPriceId, editingThresholdId, 'threshold', e.target.value)}
                                                  />
                                                </div>

                                                <div className="space-y-3">
                                                  <Label>Benachrichtigungen bei:</Label>

                                                  <div className="space-y-2 p-3 rounded-lg border">
                                                    <div className="flex items-center space-x-2">
                                                      <Checkbox
                                                        id={`new-increase-${editingThresholdId}`}
                                                        checked={threshold.notifyOnIncrease}
                                                        onCheckedChange={(checked) =>
                                                          updateThreshold(trendPriceId, editingThresholdId, 'notifyOnIncrease', checked)
                                                        }
                                                      />
                                                      <Label htmlFor={`new-increase-${editingThresholdId}`} className="cursor-pointer flex-1">
                                                        Preiserhöhung über Schwellenwert
                                                      </Label>
                                                    </div>
                                                    {threshold.notifyOnIncrease && (
                                                      <div className="ml-6 flex items-center gap-2">
                                                        <Label className="text-sm text-muted-foreground">Häufigkeit:</Label>
                                                        <select
                                                          className="text-sm border rounded px-2 py-1 bg-background"
                                                          value={threshold.increaseFrequency}
                                                          onChange={(e) => updateThreshold(trendPriceId, editingThresholdId, 'increaseFrequency', e.target.value as 'einmalig' | 'wiederholend')}
                                                        >
                                                          <option value="einmalig">Einmalig</option>
                                                          <option value="wiederholend">Wiederholend</option>
                                                        </select>
                                                      </div>
                                                    )}
                                                  </div>

                                                  <div className="space-y-2 p-3 rounded-lg border">
                                                    <div className="flex items-center space-x-2">
                                                      <Checkbox
                                                        id={`new-decrease-${editingThresholdId}`}
                                                        checked={threshold.notifyOnDecrease}
                                                        onCheckedChange={(checked) =>
                                                          updateThreshold(trendPriceId, editingThresholdId, 'notifyOnDecrease', checked)
                                                        }
                                                      />
                                                      <Label htmlFor={`new-decrease-${editingThresholdId}`} className="cursor-pointer flex-1">
                                                        Preissenkung unter Schwellenwert
                                                      </Label>
                                                    </div>
                                                    {threshold.notifyOnDecrease && (
                                                      <div className="ml-6 flex items-center gap-2">
                                                        <Label className="text-sm text-muted-foreground">Häufigkeit:</Label>
                                                        <select
                                                          className="text-sm border rounded px-2 py-1 bg-background"
                                                          value={threshold.decreaseFrequency}
                                                          onChange={(e) => updateThreshold(trendPriceId, editingThresholdId, 'decreaseFrequency', e.target.value as 'einmalig' | 'wiederholend')}
                                                        >
                                                          <option value="einmalig">Einmalig</option>
                                                          <option value="wiederholend">Wiederholend</option>
                                                        </select>
                                                      </div>
                                                    )}
                                                  </div>
                                                </div>

                                                <div>
                                                  <Label htmlFor={`new-alarm-${editingThresholdId}`}>Alarmierungsstufe</Label>
                                                  <select
                                                    id={`new-alarm-${editingThresholdId}`}
                                                    className="w-full text-sm border rounded px-3 py-2 bg-background"
                                                    value={threshold.alarmLevel}
                                                    onChange={(e) => updateThreshold(trendPriceId, editingThresholdId, 'alarmLevel', e.target.value as AlarmLevel)}
                                                    style={{
                                                      borderColor: getAlarmLevelColor(threshold.alarmLevel),
                                                      color: getAlarmLevelColor(threshold.alarmLevel)
                                                    }}
                                                  >
                                                    <option value="harmlos">Harmlos</option>
                                                    <option value="achtung">Achtung</option>
                                                    <option value="gefährlich">Gefährlich</option>
                                                    <option value="sehr_gefährlich">Sehr Gefährlich</option>
                                                  </select>
                                                </div>

                                                <div>
                                                  <Label htmlFor={`new-note-${editingThresholdId}`}>Notiz (optional)</Label>
                                                  <Input
                                                    id={`new-note-${editingThresholdId}`}
                                                    type="text"
                                                    placeholder="z.B. Wichtiger Widerstandslevel"
                                                    value={threshold.note}
                                                    onChange={(e) => updateThreshold(trendPriceId, editingThresholdId, 'note', e.target.value)}
                                                    style={{
                                                      borderColor: getAlarmLevelColor(threshold.alarmLevel)
                                                    }}
                                                  />
                                                </div>

                                                <div className="flex justify-end gap-2 pt-4 border-t">
                                                  <Button
                                                    variant="outline"
                                                    onClick={() => {
                                                      // Remove the threshold if cancelled
                                                      setTrendPriceSettings(prev => ({
                                                        ...prev,
                                                        [trendPriceId]: {
                                                          ...prev[trendPriceId],
                                                          thresholds: prev[trendPriceId].thresholds.filter(t => t.id !== editingThresholdId)
                                                        }
                                                      }));
                                                      setEditDialogOpen(prev => ({ ...prev, [`new-${trendPriceId}`]: false }));
                                                      setEditingThresholdId(null);
                                                    }}
                                                  >
                                                    Abbrechen
                                                  </Button>
                                                  <Button
                                                    onClick={() => {
                                                      // Validate threshold
                                                      if (!threshold.threshold || threshold.threshold.trim() === '') {
                                                        toast({
                                                          title: "Fehler",
                                                          description: "Bitte geben Sie einen Schwellenwert ein.",
                                                          variant: "destructive"
                                                        });
                                                        return;
                                                      }

                                                      if (!threshold.notifyOnIncrease && !threshold.notifyOnDecrease) {
                                                        toast({
                                                          title: "Fehler",
                                                          description: "Bitte wählen Sie mindestens eine Benachrichtigungsoption.",
                                                          variant: "destructive"
                                                        });
                                                        return;
                                                      }

                                                      setEditDialogOpen(prev => ({ ...prev, [`new-${trendPriceId}`]: false }));
                                                      setEditingThresholdId(null);
                                                      toast({
                                                        title: "Gespeichert",
                                                        description: "Schwellenwert wurde erfolgreich gespeichert.",
                                                      });
                                                    }}
                                                  >
                                                    Speichern
                                                  </Button>
                                                </div>
                                              </>
                                            );
                                          })()}
                                        </div>
                                      </DialogContent>
                                    </Dialog>
                                  </Card>
                                );
                              })}
                            </div>
                          </ScrollArea>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                );
              }

              return (
                <ScrollArea className={cn(
                  "w-full",
                  watchlist.length > 3 ? "h-[600px]" : ""
                )}>
                  <div className="space-y-4 pr-4 pl-2">
                  {watchlist.map((trendPriceId) => {
                    const settings = trendPriceSettings[trendPriceId];

                    // Only show if there are saved thresholds that are active
                    const savedThresholds = settings?.thresholds.filter(t => 
                      t.threshold && 
                      t.threshold.trim() !== '' && 
                      (t.notifyOnIncrease || t.notifyOnDecrease)
                    ) || [];

                    // If no active saved thresholds, don't render this card
                    if (savedThresholds.length === 0) {
                      return null;
                    }

                    return (
                  <Card key={trendPriceId} className="ring-2 ring-cyan-600" style={{ overflow: 'visible' }}>
                    <CardHeader className="flex flex-row items-center justify-between pb-3 px-4 pt-4">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">{getTrendPriceName(trendPriceId)}</CardTitle>
                        <span className="text-xs text-muted-foreground">
                          {savedThresholds.length} Schwellenwert{savedThresholds.length !== 1 ? 'e' : ''}
                        </span>
                      </div>
                      {/* View Dialog - Eye Icon */}
                      <Dialog 
                        open={viewDialogOpen[trendPriceId]} 
                        onOpenChange={(open) => setViewDialogOpen(prev => ({ ...prev, [trendPriceId]: open }))}
                      >
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl" onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
                            <DialogHeader>
                              <DialogTitle>Schwellenwerte für {getTrendPriceName(trendPriceId)}</DialogTitle>
                            </DialogHeader>
                            <ScrollArea className={cn(
                              "w-full",
                              savedThresholds.length > 3 ? "h-[500px]" : ""
                            )}>
                              <div className="space-y-3 pr-4 pl-2">
                                {savedThresholds.map((threshold, index) => (
                                  <Card key={threshold.id} className="p-4">
                                    <div className="flex items-start justify-between mb-3">
                                      <h4 className="font-semibold">Schwellenwert {index + 1}</h4>
                                      <div className="flex items-center gap-2">
                                        <Dialog
                                          open={editDialogOpen[threshold.id]}
                                          onOpenChange={(open) => {
                                            setEditDialogOpen(prev => ({ ...prev, [threshold.id]: open }));
                                            if (open) {
                                              setEditingThresholdId(threshold.id);
                                            } else {
                                              setEditingThresholdId(null);
                                            }
                                          }}
                                        >
                                          <DialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                              <Pencil className="w-4 h-4" />
                                            </Button>
                                          </DialogTrigger>
                                          <DialogContent className="max-w-2xl" onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
                                            <DialogHeader>
                                              <DialogTitle>Schwellenwert {index + 1} bearbeiten</DialogTitle>
                                            </DialogHeader>
                                            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 pl-2">
                                              <div>
                                                <Label htmlFor={`edit-threshold-${threshold.id}`}>Schwellenwert (USDT)</Label>
                                                <Input
                                                  id={`edit-threshold-${threshold.id}`}
                                                  type="number"
                                                  step="0.01"
                                                  placeholder="z.B. 50000"
                                                  value={threshold.threshold}
                                                  onChange={(e) => updateThreshold(trendPriceId, threshold.id, 'threshold', e.target.value)}
                                                />
                                              </div>

                                              <div className="space-y-3">
                                                <Label>Benachrichtigungen bei:</Label>

                                                <div className="space-y-2 p-3 rounded-lg border">
                                                  <div className="flex items-center space-x-2">
                                                    <Checkbox
                                                      id={`edit-increase-${threshold.id}`}
                                                      checked={threshold.notifyOnIncrease}
                                                      onCheckedChange={(checked) =>
                                                        updateThreshold(trendPriceId, threshold.id, 'notifyOnIncrease', checked)
                                                      }
                                                    />
                                                    <Label htmlFor={`edit-increase-${threshold.id}`} className="cursor-pointer flex-1">
                                                      Preiserhöhung über Schwellenwert
                                                    </Label>
                                                  </div>
                                                  {threshold.notifyOnIncrease && (
                                                    <div className="ml-6 flex items-center gap-2">
                                                      <Label className="text-sm text-muted-foreground">Häufigkeit:</Label>
                                                      <select
                                                        className="text-sm border rounded px-2 py-1 bg-background"
                                                        value={threshold.increaseFrequency}
                                                        onChange={(e) => updateThreshold(trendPriceId, threshold.id, 'increaseFrequency', e.target.value as 'einmalig' | 'wiederholend')}
                                                      >
                                                        <option value="einmalig">Einmalig</option>
                                                        <option value="wiederholend">Wiederholend</option>
                                                      </select>
                                                    </div>
                                                  )}
                                                </div>

                                                <div className="space-y-2 p-3 rounded-lg border">
                                                  <div className="flex items-center space-x-2">
                                                    <Checkbox
                                                      id={`edit-decrease-${threshold.id}`}
                                                      checked={threshold.notifyOnDecrease}
                                                      onCheckedChange={(checked) =>
                                                        updateThreshold(trendPriceId, threshold.id, 'notifyOnDecrease', checked)
                                                      }
                                                    />
                                                    <Label htmlFor={`edit-decrease-${threshold.id}`} className="cursor-pointer flex-1">
                                                      Preissenkung unter Schwellenwert
                                                    </Label>
                                                  </div>
                                                  {threshold.notifyOnDecrease && (
                                                    <div className="ml-6 flex items-center gap-2">
                                                      <Label className="text-sm text-muted-foreground">Häufigkeit:</Label>
                                                      <select
                                                        className="text-sm border rounded px-2 py-1 bg-background"
                                                        value={threshold.decreaseFrequency}
                                                        onChange={(e) => updateThreshold(trendPriceId, threshold.id, 'decreaseFrequency', e.target.value as 'einmalig' | 'wiederholend')}
                                                      >
                                                        <option value="einmalig">Einmalig</option>
                                                        <option value="wiederholend">Wiederholend</option>
                                                      </select>
                                                    </div>
                                                  )}
                                                </div>
                                              </div>

                                              <div>
                                                <Label htmlFor={`edit-alarm-${threshold.id}`}>Alarmierungsstufe</Label>
                                                <select
                                                  id={`edit-alarm-${threshold.id}`}
                                                  className="w-full text-sm border rounded px-3 py-2 bg-background"
                                                  value={threshold.alarmLevel}
                                                  onChange={(e) => updateThreshold(trendPriceId, threshold.id, 'alarmLevel', e.target.value as AlarmLevel)}
                                                  style={{
                                                    borderColor: getAlarmLevelColor(threshold.alarmLevel),
                                                    color: getAlarmLevelColor(threshold.alarmLevel)
                                                  }}
                                                >
                                                  <option value="harmlos">Harmlos</option>
                                                  <option value="achtung">Achtung</option>
                                                  <option value="gefährlich">Gefährlich</option>
                                                  <option value="sehr_gefährlich">Sehr Gefährlich</option>
                                                </select>
                                              </div>

                                              <div>
                                                <Label htmlFor={`edit-note-${threshold.id}`}>Notiz (optional)</Label>
                                                <Input
                                                  id={`edit-note-${threshold.id}`}
                                                  type="text"
                                                  placeholder="z.B. Wichtiger Widerstandslevel"
                                                  value={threshold.note}
                                                  onChange={(e) => updateThreshold(trendPriceId, threshold.id, 'note', e.target.value)}
                                                  style={{
                                                    borderColor: getAlarmLevelColor(threshold.alarmLevel)
                                                  }}
                                                />
                                              </div>

                                              <div className="flex justify-end gap-2 pt-4 border-t">
                                                <Button
                                                  variant="outline"
                                                  onClick={() => setEditDialogOpen(prev => ({ ...prev, [threshold.id]: false }))}
                                                >
                                                  Abbrechen
                                                </Button>
                                                <Button
                                                  onClick={() => {
                                                    // Validate threshold
                                                    if (!threshold.threshold || threshold.threshold.trim() === '') {
                                                      toast({
                                                        title: "Fehler",
                                                        description: "Bitte geben Sie einen Schwellenwert ein.",
                                                        variant: "destructive"
                                                      });
                                                      return;
                                                    }

                                                    if (!threshold.notifyOnIncrease && !threshold.notifyOnDecrease) {
                                                      toast({
                                                        title: "Fehler",
                                                        description: "Bitte wählen Sie mindestens eine Benachrichtigungsoption.",
                                                        variant: "destructive"
                                                      });
                                                      return;
                                                    }

                                                    setEditDialogOpen(prev => ({ ...prev, [threshold.id]: false }));
                                                    toast({
                                                      title: "Gespeichert",
                                                      description: "Schwellenwert wurde erfolgreich gespeichert.",
                                                    });
                                                  }}
                                                >
                                                  Speichern
                                                </Button>
                                              </div>
                                            </div>
                                          </DialogContent>
                                        </Dialog>
                                        <Button 
                                          variant="ghost" 
                                          size="icon"
                                          className="h-8 w-8 text-destructive hover:text-destructive"
                                          onClick={() => removeThreshold(trendPriceId, threshold.id)}
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      </div>
                                    </div>

                                    <div className="space-y-2 text-sm">
                                      <div>
                                        <span className="font-medium">Schwellenwert: </span>
                                        <span className="text-muted-foreground">${threshold.threshold || 'Nicht gesetzt'}</span>
                                      </div>
                                      <div>
                                        <span className="font-medium">Benachrichtigung: </span>
                                        <span className="text-muted-foreground">
                                          {threshold.notifyOnIncrease && `Erhöhung (${threshold.increaseFrequency})`}
                                          {threshold.notifyOnIncrease && threshold.notifyOnDecrease && ', '}
                                          {threshold.notifyOnDecrease && `Senkung (${threshold.decreaseFrequency})`}
                                          {!threshold.notifyOnIncrease && !threshold.notifyOnDecrease && 'Keine'}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="font-medium">Alarmierungsstufe: </span>
                                        <span 
                                          className="text-xs px-2 py-1 rounded font-medium"
                                          style={{ 
                                            backgroundColor: getAlarmLevelColor(threshold.alarmLevel),
                                            color: 'white'
                                          }}
                                        >
                                          {getAlarmLevelLabel(threshold.alarmLevel)}
                                        </span>
                                      </div>
                                      {threshold.note && (
                                        <div>
                                          <span className="font-medium">Notiz: </span>
                                          <span className="text-muted-foreground">{threshold.note}</span>
                                        </div>
                                      )}
                                    </div>
                                  </Card>
                                ))}
                              </div>
                            </ScrollArea>
                          </DialogContent>
                        </Dialog>
                    </CardHeader>

                    {false && (
                      <CardContent className="space-y-6 pt-0">
                        <div className="flex items-center justify-between pb-4 border-b">
                          <h3 className="font-semibold">Schwellenwerte</h3>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => toggleEditMode(trendPriceId)}
                            >
                              {isEditing ? <Save className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-4">
                          {settings.thresholds.map((threshold, index) => (
                            <div key={threshold.id} className="p-4 border rounded-lg space-y-4">
                              <div className="flex items-center justify-between">
                                <h4 className="font-medium">Schwellenwert {index + 1}</h4>
                                {settings.thresholds.length > 1 && isEditing && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeThreshold(trendPriceId, threshold.id)}
                                    className="text-destructive hover:text-destructive"
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>

                              <div>
                                <Label htmlFor={`threshold-${threshold.id}`}>Schwellenwert (USDT)</Label>
                                <Input
                                  id={`threshold-${threshold.id}`}
                                  type="number"
                                  step="0.01"
                                  placeholder="z.B. 50000"
                                  value={threshold.threshold}
                                  onChange={(e) => updateThreshold(trendPriceId, threshold.id, 'threshold', e.target.value)}
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
                                      id={`increase-${threshold.id}`}
                                      checked={threshold.notifyOnIncrease}
                                      onCheckedChange={(checked) =>
                                        updateThreshold(trendPriceId, threshold.id, 'notifyOnIncrease', checked)
                                      }
                                      disabled={!isEditing}
                                    />
                                    <Label
                                      htmlFor={`increase-${threshold.id}`}
                                      className={cn("cursor-pointer flex-1", !isEditing && "opacity-70")}
                                    >
                                      Preiserhöhung über Schwellenwert
                                    </Label>
                                  </div>
                                  {threshold.notifyOnIncrease && (
                                    <div className="ml-6 flex items-center gap-2">
                                      <Label className="text-sm text-muted-foreground">Häufigkeit:</Label>
                                      <select
                                        className="text-sm border rounded px-2 py-1 bg-background"
                                        disabled={!isEditing}
                                        value={threshold.increaseFrequency}
                                        onChange={(e) => updateThreshold(trendPriceId, threshold.id, 'increaseFrequency', e.target.value as 'einmalig' | 'wiederholend')}
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
                                      id={`decrease-${threshold.id}`}
                                      checked={threshold.notifyOnDecrease}
                                      onCheckedChange={(checked) =>
                                        updateThreshold(trendPriceId, threshold.id, 'notifyOnDecrease', checked)
                                      }
                                      disabled={!isEditing}
                                    />
                                    <Label
                                      htmlFor={`decrease-${threshold.id}`}
                                      className={cn("cursor-pointer flex-1", !isEditing && "opacity-70")}
                                    >
                                      Preissenkung unter Schwellenwert
                                    </Label>
                                  </div>
                                  {threshold.notifyOnDecrease && (
                                    <div className="ml-6 flex items-center gap-2">
                                      <Label className="text-sm text-muted-foreground">Häufigkeit:</Label>
                                      <select
                                        className="text-sm border rounded px-2 py-1 bg-background"
                                        disabled={!isEditing}
                                        value={threshold.decreaseFrequency}
                                        onChange={(e) => updateThreshold(trendPriceId, threshold.id, 'decreaseFrequency', e.target.value as 'einmalig' | 'wiederholend')}
                                      >
                                        <option value="einmalig">Einmalig</option>
                                        <option value="wiederholend">Wiederholend</option>
                                      </select>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div>
                                <Label htmlFor={`alarm-${threshold.id}`}>Alarmierungsstufe</Label>
                                <select
                                  id={`alarm-${threshold.id}`}
                                  className="w-full text-sm border rounded px-3 py-2 bg-background"
                                  disabled={!isEditing}
                                  value={threshold.alarmLevel}
                                  onChange={(e) => updateThreshold(trendPriceId, threshold.id, 'alarmLevel', e.target.value as AlarmLevel)}
                                  style={{
                                    borderColor: getAlarmLevelColor(threshold.alarmLevel),
                                    color: getAlarmLevelColor(threshold.alarmLevel)
                                  }}
                                >
                                  <option value="harmlos">Harmlos</option>
                                  <option value="achtung">Achtung</option>
                                  <option value="gefährlich">Gefährlich</option>
                                  <option value="sehr_gefährlich">Sehr Gefährlich</option>
                                </select>
                              </div>

                              <div>
                                <Label htmlFor={`note-${threshold.id}`}>Notiz (optional)</Label>
                                <Input
                                  id={`note-${threshold.id}`}
                                  type="text"
                                  placeholder="z.B. Wichtiger Widerstandslevel"
                                  value={threshold.note}
                                  onChange={(e) => updateThreshold(trendPriceId, threshold.id, 'note', e.target.value)}
                                  disabled={!isEditing}
                                  className={cn(!isEditing && "opacity-70")}
                                  style={{
                                    borderColor: getAlarmLevelColor(threshold.alarmLevel)
                                  }}
                                />
                              </div>
                            </div>
                          ))}

                          {isEditing && (
                            <Button
                              variant="outline"
                              className="w-full"
                              onClick={() => addThreshold(trendPriceId)}
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Weiteren Schwellenwert hinzufügen
                            </Button>
                          )}
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
              })}
                  </div>
                </ScrollArea>
              );
            })()}
            </>
            )}
          </CardContent>
        </Card>

        {/* Alarmierungsstufen konfigurieren Section */}
        <Card className="ring-2 ring-cyan-600" style={{ overflow: 'visible' }}>
          <CardHeader>
            <CardTitle className="text-xl">Alarmierungsstufen konfigurieren</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(Object.keys(alarmLevelConfigs) as AlarmLevel[]).map((level) => {
                const config = alarmLevelConfigs[level];
                const isEditing = alarmLevelEditMode[level];
                const color = getAlarmLevelColor(level);

                return (
                  <div key={level} className="p-4 border rounded-lg" style={{ borderColor: color }}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded" style={{ backgroundColor: color }}></div>
                        <h4 className="font-semibold">{getAlarmLevelLabel(level)}</h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleAlarmLevelEdit(level)}
                          className="h-8 w-8"
                        >
                          {isEditing ? <Save className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteAlarmLevel(level)}
                          className="h-8 w-8 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {isEditing ? (
                      <div className="space-y-3">
                        <div>
                          <Label className="text-sm font-medium mb-2 block">Benachrichtigungskanäle</Label>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label htmlFor={`${level}-push`} className="text-sm cursor-pointer">Push-Benachrichtigung</Label>
                              <Switch
                                id={`${level}-push`}
                                checked={config.channels.push}
                                onCheckedChange={(checked) => updateAlarmLevelConfig(level, 'push', checked)}
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <Label htmlFor={`${level}-email`} className="text-sm cursor-pointer">E-Mail</Label>
                              <Switch
                                id={`${level}-email`}
                                checked={config.channels.email}
                                onCheckedChange={(checked) => updateAlarmLevelConfig(level, 'email', checked)}
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <Label htmlFor={`${level}-sms`} className="text-sm cursor-pointer">SMS</Label>
                              <Switch
                                id={`${level}-sms`}
                                checked={config.channels.sms}
                                onCheckedChange={(checked) => updateAlarmLevelConfig(level, 'sms', checked)}
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <Label htmlFor={`${level}-webhook`} className="text-sm cursor-pointer">Webhook</Label>
                              <Switch
                                id={`${level}-webhook`}
                                checked={config.channels.webhook}
                                onCheckedChange={(checked) => updateAlarmLevelConfig(level, 'webhook', checked)}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="pt-2 border-t">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <Label htmlFor={`${level}-approval`} className="text-sm font-medium cursor-pointer">
                                Approval erforderlich
                              </Label>
                              <p className="text-xs text-muted-foreground">
                                Alarm muss manuell bestätigt werden
                              </p>
                            </div>
                            <Switch
                              id={`${level}-approval`}
                              checked={config.requiresApproval}
                              onCheckedChange={(checked) => updateAlarmLevelConfig(level, 'requiresApproval', checked)}
                            />
                          </div>

                          {/* Wiederholung */}
                          <div className="space-y-2 mb-3">
                            <Label className="text-sm font-medium">Wiederholung</Label>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min="1"
                                value={config.repeatCount === 'infinite' ? '' : config.repeatCount}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value);
                                  if (!isNaN(val) && val > 0) {
                                    updateAlarmLevelConfig(level, 'repeatCount', val);
                                  }
                                }}
                                placeholder="Anzahl"
                                className="w-24"
                                disabled={config.repeatCount === 'infinite'}
                              />
                              <Button
                                variant={config.repeatCount === 'infinite' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => {
                                  if (config.repeatCount === 'infinite') {
                                    updateAlarmLevelConfig(level, 'repeatCount', 1);
                                  } else {
                                    updateAlarmLevelConfig(level, 'repeatCount', 'infinite');
                                    // Automatisch Approval erforderlich aktivieren bei Unendlich
                                    if (!config.requiresApproval) {
                                      updateAlarmLevelConfig(level, 'requiresApproval', true);
                                    }
                                  }
                                }}
                              >
                                ∞ Unendlich
                              </Button>
                              <span className="text-xs text-muted-foreground">
                                {config.repeatCount === 'infinite' ? 'Bis Approval' : `${config.repeatCount}x`}
                              </span>
                            </div>
                          </div>

                          {/* Sequenz (Pause zwischen Wiederholungen) */}
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Sequenz (Pause zwischen Wiederholungen)</Label>
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <Label htmlFor={`${level}-hours`} className="text-xs text-muted-foreground">Stunden</Label>
                                <Input
                                  id={`${level}-hours`}
                                  type="number"
                                  min="0"
                                  value={config.sequenceHours}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    if (!isNaN(val) && val >= 0) {
                                      updateAlarmLevelConfig(level, 'sequenceHours', val);
                                    }
                                  }}
                                  className="text-sm"
                                />
                              </div>
                              <div>
                                <Label htmlFor={`${level}-minutes`} className="text-xs text-muted-foreground">Minuten</Label>
                                <Input
                                  id={`${level}-minutes`}
                                  type="number"
                                  min="0"
                                  max="59"
                                  value={config.sequenceMinutes}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    if (!isNaN(val) && val >= 0 && val <= 59) {
                                      updateAlarmLevelConfig(level, 'sequenceMinutes', val);
                                    }
                                  }}
                                  className="text-sm"
                                />
                              </div>
                              <div>
                                <Label htmlFor={`${level}-seconds`} className="text-xs text-muted-foreground">Sekunden</Label>
                                <Input
                                  id={`${level}-seconds`}
                                  type="number"
                                  min="0"
                                  max="59"
                                  value={config.sequenceSeconds}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    if (!isNaN(val) && val >= 0 && val <= 59) {
                                      updateAlarmLevelConfig(level, 'sequenceSeconds', val);
                                    }
                                  }}
                                  className="text-sm"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="text-sm">
                          <span className="font-medium">Aktive Kanäle: </span>
                          <span className="text-muted-foreground">
                            {Object.entries(config.channels)
                              .filter(([_, active]) => active)
                              .map(([channel]) => {
                                const channelNames: Record<string, string> = {
                                  push: 'Push',
                                  email: 'E-Mail',
                                  sms: 'SMS',
                                  webhook: 'Webhook'
                                };
                                return channelNames[channel];
                              })
                              .join(', ') || 'Keine'}
                          </span>
                        </div>
                        <div className="text-sm">
                          <span className="font-medium">Approval: </span>
                          <span className="text-muted-foreground">
                            {config.requiresApproval ? 'Erforderlich' : 'Nicht erforderlich'}
                          </span>
                        </div>
                        {config.requiresApproval && (
                          <>
                            <div className="text-sm">
                              <span className="font-medium">Wiederholung: </span>
                              <span className="text-muted-foreground">
                                {config.repeatCount === 'infinite' ? '∞ (Bis Approval)' : `${config.repeatCount}x`}
                              </span>
                            </div>
                            <div className="text-sm">
                              <span className="font-medium">Sequenz: </span>
                              <span className="text-muted-foreground">
                                {config.sequenceHours}h {config.sequenceMinutes}m {config.sequenceSeconds}s
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}