import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Bell, ChevronDown, ChevronUp, Search, X, Pencil, Save, Activity, Plus, Trash2, Check, Eye, EyeOff, ArrowUp, ArrowDown, ArrowUpDown, Timer, RefreshCw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
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
  isActive: boolean;
}

interface AlarmLevelConfig {
  level: AlarmLevel;
  channels: {
    push: boolean;
    email: boolean;
    sms: boolean;
    webPush: boolean;
    nativePush: boolean;
  };
  requiresApproval: boolean;
  repeatCount: number | 'infinite'; // Anzahl Wiederholungen oder 'infinite'
  sequenceHours: number;
  sequenceMinutes: number;
  sequenceSeconds: number;
  restwartezeitHours: number;
  restwartezeitMinutes: number;
  restwartezeitSeconds: number;
}

interface ActiveAlarm {
  id: string;
  trendPriceName: string;
  threshold: string;
  alarmLevel: AlarmLevel;
  triggeredAt: Date;
  message: string;
  note: string;
  // Auto-dismiss tracking
  requiresApproval: boolean;
  repetitionsCompleted?: number;
  repetitionsTotal?: number;
  restwartezeitEndsAt?: Date;
  autoDismissAt?: Date;
  // Repetition tracking
  lastNotifiedAt?: Date;
  sequenceMs?: number;
  channels?: {
    push: boolean;
    email: boolean;
    sms: boolean;
    webPush: boolean;
    nativePush: boolean;
  };
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

  // Store marketType AND symbol for each pair (symbol needed for stable lookup after page reload)
  const [pairMarketTypes, setPairMarketTypes] = useState<Record<string, { marketType: 'spot' | 'futures', symbol: string }>>(() => {
    const saved = localStorage.getItem('notifications-pair-market-types');
    if (!saved) return {};
    // Migration: Handle old format (just marketType string) and new format (object with marketType and symbol)
    const parsed = JSON.parse(saved);
    const migrated: Record<string, { marketType: 'spot' | 'futures', symbol: string }> = {};
    for (const key in parsed) {
      if (typeof parsed[key] === 'string') {
        // Old format: just the marketType string - we'll need to find the symbol later
        migrated[key] = { marketType: parsed[key] as 'spot' | 'futures', symbol: '' };
      } else {
        migrated[key] = parsed[key];
      }
    }
    return migrated;
  });
  const [isLiveUpdating, setIsLiveUpdating] = useState(true);
  const [showTestButton, setShowTestButton] = useState(false);
  const [smsPhoneNumber, setSmsPhoneNumber] = useState<string>(() => {
    const saved = localStorage.getItem('notifications-sms-phone-number');
    return saved || '';
  });
  const intervalRef = useRef<NodeJS.Timeout | null>(null); // Changed to intervalRef for polling
  const priceUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null); // For polling

  // State for Futures pairs
  const [allBinanceFuturesPairs, setAllBinanceFuturesPairs] = useState<TrendPrice[]>([]);
  const [isFuturesLoading, setIsFuturesLoading] = useState(true);
  const [isSpotLoading, setIsSpotLoading] = useState(true);
  
  // Track if Futures API is geo-blocked (418 error) to prevent constant polling
  const [isFuturesBlocked, setIsFuturesBlocked] = useState(false);

  // Funktion zum Laden aller verfügbaren Binance Spot Trading Pairs
  const fetchAllBinancePairs = async () => {
    setIsSpotLoading(true);
    try {
      const response = await fetch('https://api.binance.com/api/v3/exchangeInfo');
      if (!response.ok) {
        setIsSpotLoading(false);
        return;
      }

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
    } finally {
      setIsSpotLoading(false);
    }
  };

  // Funktion zum Laden aller verfügbaren Binance Futures Trading Pairs
  const fetchAllBinanceFuturesPairs = async () => {
    setIsFuturesLoading(true);
    try {
      // Try Binance Futures API (may be geo-blocked in some regions)
      const response = await fetch('https://fapi.binance.com/fapi/v1/exchangeInfo');
      
      // Check for geo-block (418 "I'm a teapot" or 451 "Unavailable for Legal Reasons")
      const isGeoBlocked = response.status === 418 || response.status === 451;
      if (isGeoBlocked) {
        console.warn('Binance Futures API is geo-blocked (418/451). Using fallback pairs with no live prices.');
        setIsFuturesBlocked(true);
      }
      
      if (!response.ok) {
        console.warn('Binance Futures API returned non-OK status, trying fallback...');
        // Try to use popular pairs as fallback
        const fallbackSymbols = [
          'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT',
          'DOGEUSDT', 'MATICUSDT', 'DOTUSDT', 'AVAXUSDT', 'LINKUSDT',
          'LTCUSDT', 'TRXUSDT', 'ATOMUSDT', 'NEARUSDT', 'APTUSDT',
          'ARBUSDT', 'OPUSDT', 'PEPEUSDT', 'WIFUSDT', 'ORDIUSDT',
          'SUIUSDT', 'SEIUSDT', 'TIAUSDT', 'INJUSDT', 'FETUSDT',
          'AAVEUSDT', 'UNIUSDT', 'MKRUSDT', 'SUSHIUSDT', 'COMPUSDT',
          'RNDRUSDT', 'GRTUSDT', 'FILUSDT', 'RUNEUSDT', 'SANDUSDT',
          'MANAUSDT', 'AXSUSDT', 'GALAUSDT', 'APEUSDT', 'IMXUSDT',
          'ICPUSDT', 'VETUSDT', 'XLMUSDT', 'ALGOUSDT', 'EOSUSDT',
          'XTZUSDT', 'THETAUSDT', 'HBARUSDT', 'EGLDUSDT', 'FLOWUSDT',
          'CHZUSDT', 'ENJUSDT', 'ZILUSDT', 'BATUSDT', 'ZRXUSDT',
          'SNXUSDT', 'CRVUSDT', 'YFIUSDT', 'LRCUSDT', 'KSMUSDT',
          'WAVESUSDT', 'DASHUSDT', 'ZECUSDT', 'ETCUSDT', 'NEOUSDT',
          'IOSTUSDT', 'ONTUSDT', 'QTUMUSDT', 'IOTAUSDT', 'CELOUSDT',
          'STXUSDT', 'KAVAUSDT', 'ONEUSDT', 'HOTUSDT', 'RVNUSDT',
          'ZENUSDT', 'BCHUSDT', 'XMRUSDT', 'STORJUSDT', 'ANKRUSDT'
        ];
        // Use isGeoBlocked directly (sync) instead of state (async)
        const fallbackPairs: TrendPrice[] = fallbackSymbols.map((symbol, index) => ({
          id: `binance-futures-${index}`,
          name: symbol.replace('USDT', '/USDT'),
          symbol: symbol,
          price: isGeoBlocked ? 'N/A (Geo-Blocked)' : 'Loading...',
          marketType: 'futures' as const
        }));
        setAllBinanceFuturesPairs(fallbackPairs);
        setIsFuturesLoading(false);
        return;
      }

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
      // Network error (likely geo-blocking) - use fallback
      const fallbackSymbols = [
        'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT',
        'DOGEUSDT', 'MATICUSDT', 'DOTUSDT', 'AVAXUSDT', 'LINKUSDT',
        'LTCUSDT', 'TRXUSDT', 'ATOMUSDT', 'NEARUSDT', 'APTUSDT',
        'ARBUSDT', 'OPUSDT', 'PEPEUSDT', 'WIFUSDT', 'ORDIUSDT',
        'SUIUSDT', 'SEIUSDT', 'TIAUSDT', 'INJUSDT', 'FETUSDT',
        'AAVEUSDT', 'UNIUSDT', 'MKRUSDT', 'SUSHIUSDT', 'COMPUSDT',
        'RNDRUSDT', 'GRTUSDT', 'FILUSDT', 'RUNEUSDT', 'SANDUSDT',
        'MANAUSDT', 'AXSUSDT', 'GALAUSDT', 'APEUSDT', 'IMXUSDT',
        'ICPUSDT', 'VETUSDT', 'XLMUSDT', 'ALGOUSDT', 'EOSUSDT',
        'XTZUSDT', 'THETAUSDT', 'HBARUSDT', 'EGLDUSDT', 'FLOWUSDT',
        'CHZUSDT', 'ENJUSDT', 'ZILUSDT', 'BATUSDT', 'ZRXUSDT',
        'SNXUSDT', 'CRVUSDT', 'YFIUSDT', 'LRCUSDT', 'KSMUSDT',
        'WAVESUSDT', 'DASHUSDT', 'ZECUSDT', 'ETCUSDT', 'NEOUSDT',
        'IOSTUSDT', 'ONTUSDT', 'QTUMUSDT', 'IOTAUSDT', 'CELOUSDT',
        'STXUSDT', 'KAVAUSDT', 'ONEUSDT', 'HOTUSDT', 'RVNUSDT',
        'ZENUSDT', 'BCHUSDT', 'XMRUSDT', 'STORJUSDT', 'ANKRUSDT'
      ];
      const fallbackPairs: TrendPrice[] = fallbackSymbols.map((symbol, index) => ({
        id: `binance-futures-${index}`,
        name: symbol.replace('USDT', '/USDT'),
        symbol: symbol,
        price: 'Loading...',
        marketType: 'futures' as const
      }));
      setAllBinanceFuturesPairs(fallbackPairs);
    } finally {
      setIsFuturesLoading(false);
    }
  };

  // Load all Binance pairs on mount
  useEffect(() => {
    fetchAllBinancePairs();
    fetchAllBinanceFuturesPairs();
  }, []);

  // Migration: Update pairMarketTypes with symbols for old entries that don't have them
  useEffect(() => {
    if (allBinancePairs.length === 0 && allBinanceFuturesPairs.length === 0) return;
    
    let hasUpdates = false;
    const updates: Record<string, { marketType: 'spot' | 'futures', symbol: string }> = {};
    
    for (const id of watchlist) {
      const data = pairMarketTypes[id];
      if (data && !data.symbol) {
        // Find the symbol from the loaded pairs
        let foundPair;
        if (data.marketType === 'futures') {
          foundPair = allBinanceFuturesPairs.find(p => p.id === id);
        } else {
          foundPair = allBinancePairs.find(p => p.id === id);
        }
        
        if (foundPair) {
          updates[id] = { marketType: data.marketType, symbol: foundPair.symbol };
          hasUpdates = true;
        }
      }
    }
    
    if (hasUpdates) {
      setPairMarketTypes(prev => ({ ...prev, ...updates }));
    }
  }, [allBinancePairs, allBinanceFuturesPairs, watchlist]);

  // Load watchlist pairs into availableTradingPairs when data is available
  useEffect(() => {
    if (allBinancePairs.length === 0 && allBinanceFuturesPairs.length === 0) return;
    if (watchlist.length === 0) return;

    // WICHTIG: Batch update to avoid multiple re-renders
    const newPairs: TrendPrice[] = [];

    watchlist.forEach(id => {
      // Check if already in availableTradingPairs
      const existingPair = availableTradingPairs.find(p => p.id === id);
      if (existingPair) return;

      // Get the stored marketType and symbol for this pair
      const storedData = pairMarketTypes[id];
      const storedMarketType = storedData?.marketType || 'spot';
      const storedSymbol = storedData?.symbol || '';

      // Try to find in the correct market based on stored type
      let pair;
      if (storedMarketType === 'futures') {
        // First try by ID
        pair = allBinanceFuturesPairs.find(p => p.id === id);
        // FALLBACK: Find by stored symbol (stable across page reloads)
        if (!pair && storedSymbol) {
          pair = allBinanceFuturesPairs.find(p => p.symbol === storedSymbol);
        }
      } else {
        // First try by ID
        pair = allBinancePairs.find(p => p.id === id);
        // FALLBACK: Find by stored symbol (stable across page reloads)
        if (!pair && storedSymbol) {
          pair = allBinancePairs.find(p => p.symbol === storedSymbol);
        }
      }

      // Final fallback: try the other market if not found
      if (!pair) {
        pair = allBinancePairs.find(p => p.id === id) || allBinanceFuturesPairs.find(p => p.id === id);
      }
      
      if (pair) {
        // WICHTIG: Use the ORIGINAL watchlist ID to maintain consistency
        const correctedPair: TrendPrice = {
          ...pair,
          id: id, // Keep original watchlist ID for consistency
          price: 'Loading...',
          marketType: storedMarketType as 'spot' | 'futures'
        };
        newPairs.push(correctedPair);
      }
    });

    // Single batch update
    if (newPairs.length > 0) {
      setAvailableTradingPairs(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        const uniqueNewPairs = newPairs.filter(p => !existingIds.has(p.id));
        return [...prev, ...uniqueNewPairs];
      });
    }
  }, [allBinancePairs, allBinanceFuturesPairs, watchlist, pairMarketTypes]);

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
          // WICHTIG: Find by symbol AND check pair.marketType is spot (or undefined for backwards compatibility)
          const index = updated.findIndex(p => {
            if (p.symbol !== ticker.symbol) return false;
            return p.marketType === 'spot' || p.marketType === undefined;
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
              marketType: 'spot' as const
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
    
    // Skip if Futures API is geo-blocked
    if (isFuturesBlocked) return;

    try {
      const symbolsParam = symbols.map(s => `"${s}"`).join(',');
      const response = await fetch(`https://fapi.binance.com/fapi/v1/ticker/24hr?symbols=[${symbolsParam}]`);

      if (response.status === 418 || response.status === 451) {
        // Geo-blocked - stop polling to prevent console spam
        console.warn('Binance Futures API geo-blocked (418/451). Stopping futures price polling.');
        setIsFuturesBlocked(true);
        return;
      }

      if (!response.ok) {
        console.error('Failed to fetch futures prices from Binance API');
        return;
      }

      const data = await response.json();

      setAvailableTradingPairs(prev => {
        const updated = [...prev];
        data.forEach((ticker: any) => {
          // WICHTIG: Find by symbol AND check pair.marketType directly (set when adding to watchlist)
          const index = updated.findIndex(p => {
            if (p.symbol !== ticker.symbol) return false;
            return p.marketType === 'futures';
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
              marketType: 'futures' as const
            };
          }
        });
        return updated;
      });
    } catch (error) {
      console.error('Error fetching futures prices:', error);
    }
  };

  // Funktion zum Abrufen der Preise für Spot-Vorschläge (Suchergebnisse)
  const fetchSuggestionSpotPrices = async (symbols: string[]) => {
    if (symbols.length === 0) return;

    try {
      const symbolsParam = symbols.map(s => `"${s}"`).join(',');
      const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=[${symbolsParam}]`);

      if (!response.ok) {
        console.error('Failed to fetch suggestion prices from Binance Spot API');
        return;
      }

      const data = await response.json();

      setAllBinancePairs(prev => {
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
              priceChangePercent24h: parseFloat(ticker.priceChangePercent).toFixed(2),
            };
          }
        });
        return updated;
      });
    } catch (error) {
      console.error('Error fetching suggestion spot prices:', error);
    }
  };

  // Funktion zum Abrufen der Preise für Futures-Vorschläge (Suchergebnisse)
  const fetchSuggestionFuturesPrices = async (symbols: string[]) => {
    if (symbols.length === 0) return;
    
    // Skip if Futures API is geo-blocked
    if (isFuturesBlocked) return;

    try {
      const symbolsParam = symbols.map(s => `"${s}"`).join(',');
      const response = await fetch(`https://fapi.binance.com/fapi/v1/ticker/24hr?symbols=[${symbolsParam}]`);

      if (response.status === 418 || response.status === 451) {
        // Geo-blocked - stop polling to prevent console spam
        console.warn('Binance Futures API geo-blocked (418/451). Stopping suggestion price polling.');
        setIsFuturesBlocked(true);
        return;
      }

      if (!response.ok) {
        console.error('Failed to fetch suggestion prices from Binance Futures API');
        return;
      }

      const data = await response.json();

      setAllBinanceFuturesPairs(prev => {
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
              priceChangePercent24h: parseFloat(ticker.priceChangePercent).toFixed(2),
            };
          }
        });
        return updated;
      });
    } catch (error) {
      console.error('Error fetching suggestion futures prices:', error);
    }
  };

  // Ref for suggestion price fetch timeout (moved before useEffect usage)
  const suggestionPriceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initial fetch und regelmäßige Updates für Watchlist Trading Pairs
  useEffect(() => {
    if (availableTradingPairs.length === 0) return;
    if (watchlist.length === 0) return;

    // Separate Spot and Futures symbols based on STORED marketType from pairMarketTypes
    const spotSymbols: string[] = [];
    const futuresSymbols: string[] = [];

    availableTradingPairs.forEach(pair => {
      if (!watchlist.includes(pair.id)) return;
      
      // WICHTIG: Use stored marketType from pairMarketTypes, not pair.marketType directly
      const storedMarketType = pairMarketTypes[pair.id]?.marketType || 'spot';
      
      if (storedMarketType === 'futures') {
        futuresSymbols.push(pair.symbol);
      } else {
        spotSymbols.push(pair.symbol);
      }
    });

    if (spotSymbols.length === 0 && futuresSymbols.length === 0) return;

    // Clear existing interval
    if (priceUpdateIntervalRef.current) {
      clearInterval(priceUpdateIntervalRef.current);
    }

    // Initial fetch IMMEDIATELY
    const performFetch = () => {
      if (spotSymbols.length > 0) fetchSpotPrices(spotSymbols);
      if (futuresSymbols.length > 0) fetchFuturesPrices(futuresSymbols);
    };

    performFetch(); // First immediate fetch

    // Update alle 2 Sekunden
    priceUpdateIntervalRef.current = setInterval(performFetch, 2000);

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
  const [alarmLevelConfigs, setAlarmLevelConfigs] = useState<Record<AlarmLevel, AlarmLevelConfig>>(() => {
    // Default configuration
    const defaults: Record<AlarmLevel, AlarmLevelConfig> = {
      harmlos: {
        level: 'harmlos',
        channels: { push: true, email: false, sms: false, webPush: false, nativePush: false },
        requiresApproval: false,
        repeatCount: 1,
        sequenceHours: 0,
        sequenceMinutes: 0,
        sequenceSeconds: 0,
        restwartezeitHours: 0,
        restwartezeitMinutes: 1,
        restwartezeitSeconds: 0
      },
      achtung: {
        level: 'achtung',
        channels: { push: true, email: true, sms: false, webPush: false, nativePush: false },
        requiresApproval: false,
        repeatCount: 1,
        sequenceHours: 0,
        sequenceMinutes: 0,
        sequenceSeconds: 0,
        restwartezeitHours: 0,
        restwartezeitMinutes: 2,
        restwartezeitSeconds: 0
      },
      gefährlich: {
        level: 'gefährlich',
        channels: { push: true, email: true, sms: false, webPush: true, nativePush: false },
        requiresApproval: true,
        repeatCount: 3,
        sequenceHours: 0,
        sequenceMinutes: 5,
        sequenceSeconds: 0,
        restwartezeitHours: 0,
        restwartezeitMinutes: 5,
        restwartezeitSeconds: 0
      },
      sehr_gefährlich: {
        level: 'sehr_gefährlich',
        channels: { push: true, email: true, sms: true, webPush: true, nativePush: false },
        requiresApproval: true,
        repeatCount: 'infinite',
        sequenceHours: 0,
        sequenceMinutes: 1,
        sequenceSeconds: 0,
        restwartezeitHours: 0,
        restwartezeitMinutes: 10,
        restwartezeitSeconds: 0
      }
    };

    // Try to load from localStorage
    try {
      const stored = localStorage.getItem('alarm-level-configs');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge stored values with defaults (to handle new fields like nativePush)
        const merged: Record<AlarmLevel, AlarmLevelConfig> = { ...defaults };
        for (const level of Object.keys(defaults) as AlarmLevel[]) {
          if (parsed[level]) {
            merged[level] = {
              ...defaults[level],
              ...parsed[level],
              channels: {
                ...defaults[level].channels,
                ...parsed[level].channels
              }
            };
          }
        }
        return merged;
      }
    } catch (err) {
      console.error('Error loading alarm-level-configs from localStorage:', err);
    }
    return defaults;
  });

  // Track which threshold is currently being edited (for excluding from alerts)
  const [editingThresholdId, setEditingThresholdId] = useState<string | null>(null);

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
        // Skip if this threshold is currently being edited (not yet saved)
        if (threshold.id === editingThresholdId) return;
        
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

          // Calculate sequence in ms for repetitions (minimum 1 second if 0)
          const rawSequenceMs = (alarmConfig.sequenceHours * 3600 + alarmConfig.sequenceMinutes * 60 + alarmConfig.sequenceSeconds) * 1000;
          const alarmSequenceMs = rawSequenceMs > 0 ? rawSequenceMs : 1000; // Minimum 1 second between repetitions
          
          // Calculate auto-dismiss time if approval not required
          let autoDismissAt: Date | undefined;
          if (!alarmConfig.requiresApproval && alarmConfig.repeatCount !== 'infinite') {
            const repeatCount = typeof alarmConfig.repeatCount === 'number' ? alarmConfig.repeatCount : 1;
            const restwartezeitMs = (alarmConfig.restwartezeitHours * 3600 + alarmConfig.restwartezeitMinutes * 60 + alarmConfig.restwartezeitSeconds) * 1000;
            // Total time = (repeatCount-1) * sequence + restwartezeit
            // First notification is immediate, then (repeatCount-1) more with sequence delay, then restwartezeit
            const totalMs = Math.max(0, repeatCount - 1) * alarmSequenceMs + restwartezeitMs;
            autoDismissAt = new Date(Date.now() + totalMs);
            console.log(`[AUTO-DISMISS] Calculated: ${repeatCount} reps x ${alarmSequenceMs}ms seq + ${restwartezeitMs}ms rest = ${totalMs}ms total, dismiss at ${autoDismissAt.toISOString()}`);
          }

          // Create active alarm
          const newAlarm: ActiveAlarm = {
            id: crypto.randomUUID(),
            trendPriceName: pair.name,
            threshold: thresholdValue.toString(),
            alarmLevel: threshold.alarmLevel,
            triggeredAt: new Date(),
            message: `Preis über ${thresholdValue} USDT gestiegen`,
            note: threshold.note,
            requiresApproval: alarmConfig.requiresApproval,
            repetitionsCompleted: 1,
            repetitionsTotal: alarmConfig.repeatCount === 'infinite' ? undefined : alarmConfig.repeatCount,
            autoDismissAt: autoDismissAt,
            lastNotifiedAt: new Date(),
            sequenceMs: alarmSequenceMs,
            channels: { ...alarmConfig.channels }
          };

          setActiveAlarms(prev => [...prev, newAlarm]);
          
          // POST to backend for cross-device sync
          fetch('/api/active-alarms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newAlarm)
          }).then(res => {
            if (res.ok) console.log(`[ACTIVE-ALARMS] Created alarm ${newAlarm.id} in backend`);
          }).catch(err => console.error('[ACTIVE-ALARMS] Backend POST error:', err));

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
                channels: { email: true, sms: false, webPush: false },
                recipient: 'hollvuyo@gmail.com',
                subject: `🚨 Pionex Alert - ${getAlarmLevelLabel(threshold.alarmLevel)}`,
                message: message,
                alarmLevel: threshold.alarmLevel
              })
            }).catch(err => console.error('Email notification error:', err));
          }

          // Send Push notification via OneSignal Enhanced Route (better iOS delivery)
          // Uses retry logic, iOS-specific settings, and high priority for reliable delivery
          const shouldSendPushNotification = alarmConfig.channels.webPush || alarmConfig.channels.nativePush;
          if (shouldSendPushNotification) {
            fetch('/api/notifications/push-enhanced', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: `🔔 ${getAlarmLevelLabel(threshold.alarmLevel)} - Schwellenwert erreicht!`,
                message: message,
                alarmLevel: threshold.alarmLevel
              })
            }).catch(err => console.error('Push notification error:', err));
          }

          // Send SMS notification if enabled for this alarm level
          if (alarmConfig.channels.sms && smsPhoneNumber) {
            const smsMessage = `[${threshold.alarmLevel.toUpperCase()}] ${pair.name}: Preis über ${thresholdValue} USDT${threshold.note ? ` - ${threshold.note}` : ''}`;
            fetch('/api/send-sms', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                to: smsPhoneNumber,
                message: smsMessage,
                alarmLevel: threshold.alarmLevel
              })
            }).catch(err => console.error('SMS notification error:', err));
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

          // Calculate sequence in ms for repetitions (minimum 1 second if 0)
          const rawSequenceMsDecrease = (alarmConfig.sequenceHours * 3600 + alarmConfig.sequenceMinutes * 60 + alarmConfig.sequenceSeconds) * 1000;
          const alarmSequenceMsDecrease = rawSequenceMsDecrease > 0 ? rawSequenceMsDecrease : 1000; // Minimum 1 second
          
          // Calculate auto-dismiss time if approval not required
          let autoDismissAtDecrease: Date | undefined;
          if (!alarmConfig.requiresApproval && alarmConfig.repeatCount !== 'infinite') {
            const repeatCount = typeof alarmConfig.repeatCount === 'number' ? alarmConfig.repeatCount : 1;
            const restwartezeitMs = (alarmConfig.restwartezeitHours * 3600 + alarmConfig.restwartezeitMinutes * 60 + alarmConfig.restwartezeitSeconds) * 1000;
            // Total time = (repeatCount-1) * sequence + restwartezeit
            // First notification immediate, then remaining with sequence delay, then restwartezeit countdown
            const totalMs = Math.max(0, repeatCount - 1) * alarmSequenceMsDecrease + restwartezeitMs;
            autoDismissAtDecrease = new Date(Date.now() + totalMs);
            console.log(`[AUTO-DISMISS] Decrease: ${repeatCount} reps x ${alarmSequenceMsDecrease}ms seq + ${restwartezeitMs}ms rest = ${totalMs}ms total`);
          }

          // Create active alarm
          const newAlarm: ActiveAlarm = {
            id: crypto.randomUUID(),
            trendPriceName: pair.name,
            threshold: thresholdValue.toString(),
            alarmLevel: threshold.alarmLevel,
            triggeredAt: new Date(),
            message: `Preis unter ${thresholdValue} USDT gefallen`,
            note: threshold.note,
            requiresApproval: alarmConfig.requiresApproval,
            repetitionsCompleted: 1,
            repetitionsTotal: alarmConfig.repeatCount === 'infinite' ? undefined : alarmConfig.repeatCount,
            autoDismissAt: autoDismissAtDecrease,
            lastNotifiedAt: new Date(),
            sequenceMs: alarmSequenceMsDecrease,
            channels: { ...alarmConfig.channels }
          };

          setActiveAlarms(prev => [...prev, newAlarm]);
          
          // POST to backend for cross-device sync
          fetch('/api/active-alarms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newAlarm)
          }).then(res => {
            if (res.ok) console.log(`[ACTIVE-ALARMS] Created alarm ${newAlarm.id} in backend`);
          }).catch(err => console.error('[ACTIVE-ALARMS] Backend POST error:', err));

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
                channels: { email: true, sms: false, webPush: false },
                recipient: 'hollvuyo@gmail.com',
                subject: `🚨 Pionex Alert - ${getAlarmLevelLabel(threshold.alarmLevel)}`,
                message: message,
                alarmLevel: threshold.alarmLevel
              })
            }).catch(err => console.error('Email notification error:', err));
          }

          // Send Push notification via OneSignal Enhanced Route (better iOS delivery)
          // Uses retry logic, iOS-specific settings, and high priority for reliable delivery
          const shouldSendPushNotificationDecrease = alarmConfig.channels.webPush || alarmConfig.channels.nativePush;
          if (shouldSendPushNotificationDecrease) {
            fetch('/api/notifications/push-enhanced', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: `🔔 ${getAlarmLevelLabel(threshold.alarmLevel)} - Schwellenwert unterschritten!`,
                message: message,
                alarmLevel: threshold.alarmLevel
              })
            }).catch(err => console.error('Push notification error:', err));
          }

          // Send SMS notification if enabled for this alarm level (decrease)
          if (alarmConfig.channels.sms && smsPhoneNumber) {
            const smsMessage = `[${threshold.alarmLevel.toUpperCase()}] ${pair.name}: Preis unter ${thresholdValue} USDT${threshold.note ? ` - ${threshold.note}` : ''}`;
            fetch('/api/send-sms', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                to: smsPhoneNumber,
                message: smsMessage,
                alarmLevel: threshold.alarmLevel
              })
            }).catch(err => console.error('SMS notification error:', err));
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
  }, [availableTradingPairs, trendPriceSettings, triggeredThresholds, alarmLevelConfigs, toast, editingThresholdId]);

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
  const [notificationSortOrder, setNotificationSortOrder] = useState<'asc' | 'desc'>('asc');
  const [editDialogOpen, setEditDialogOpen] = useState<Record<string, boolean>>({});
  
  // Ref to track if save button was clicked (to distinguish from X/ESC close)
  const isSavingThresholdRef = useRef(false);

  // Save watchlist to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('notifications-watchlist', JSON.stringify(watchlist));
  }, [watchlist]);

  // Save pair market types to localStorage
  useEffect(() => {
    localStorage.setItem('notifications-pair-market-types', JSON.stringify(pairMarketTypes));
  }, [pairMarketTypes]);

  // REMOVED: Automatic save on every change - now only saves on explicit "Speichern" click
  // Save function to be called explicitly when user clicks "Speichern"
  const saveSettingsToStorage = () => {
    localStorage.setItem('notifications-threshold-settings', JSON.stringify(trendPriceSettings));
  };

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
  
  // Load active alarms from backend on mount (for cross-device sync)
  useEffect(() => {
    const fetchBackendAlarms = async () => {
      try {
        const response = await fetch('/api/active-alarms');
        if (response.ok) {
          const backendAlarms: ActiveAlarm[] = await response.json();
          console.log(`[ACTIVE-ALARMS] Fetched ${backendAlarms.length} alarms from backend`);
          
          if (backendAlarms.length > 0) {
            // Merge backend alarms with local (backend takes priority for IDs that exist in both)
            setActiveAlarms(prev => {
              const backendIds = new Set(backendAlarms.map(a => a.id));
              const localOnlyAlarms = prev.filter(a => !backendIds.has(a.id));
              const merged = [...backendAlarms, ...localOnlyAlarms];
              console.log(`[ACTIVE-ALARMS] Merged: ${backendAlarms.length} from backend + ${localOnlyAlarms.length} local-only = ${merged.length} total`);
              return merged;
            });
          }
        }
      } catch (err) {
        console.error('[ACTIVE-ALARMS] Failed to fetch from backend:', err);
      }
    };
    
    fetchBackendAlarms();
  }, []);

  // Countdown tick - forces re-render every second for countdown display
  const [countdownTick, setCountdownTick] = useState(0);

  // Dedicated timer for countdown display updates (independent of alarms)
  useEffect(() => {
    const tickInterval = setInterval(() => {
      setCountdownTick(prev => prev + 1);
    }, 1000);
    return () => clearInterval(tickInterval);
  }, []); // Empty deps - runs once on mount

  // Auto-dismiss alarms when their autoDismissAt time is reached
  useEffect(() => {
    const checkAutoDismiss = () => {
      const now = new Date();
      setActiveAlarms(prev => {
        const remaining = prev.filter(alarm => {
          if (!alarm.autoDismissAt) return true;
          const dismissTime = new Date(alarm.autoDismissAt);
          return now < dismissTime;
        });
        return remaining.length !== prev.length ? remaining : prev;
      });
    };

    // Check every second for auto-dismiss
    const interval = setInterval(checkAutoDismiss, 1000);
    checkAutoDismiss(); // Check immediately

    return () => clearInterval(interval);
  }, []); // Empty deps - single interval for checking

  // Repetition logic - send notifications based on sequence timing
  useEffect(() => {
    const checkRepetitions = () => {
      const now = new Date();
      
      setActiveAlarms(prev => {
        let hasChanges = false;
        const updated = prev.map(alarm => {
          // Skip if no sequence configured (use minimum 1 second as fallback)
          const effectiveSequenceMs = alarm.sequenceMs && alarm.sequenceMs > 0 ? alarm.sequenceMs : 1000;
          if (!alarm.lastNotifiedAt) return alarm;
          
          // If infinite or still has repetitions left
          const isInfinite = alarm.repetitionsTotal === undefined;
          const hasRepsLeft = alarm.repetitionsTotal !== undefined && 
            (alarm.repetitionsCompleted || 1) < alarm.repetitionsTotal;
          
          if (!isInfinite && !hasRepsLeft) return alarm;
          
          // Check if sequence time has passed since last notification
          const lastNotified = new Date(alarm.lastNotifiedAt);
          const timeSinceLastNotify = now.getTime() - lastNotified.getTime();
          
          if (timeSinceLastNotify >= effectiveSequenceMs) {
            console.log(`[REPETITION] Triggering rep ${(alarm.repetitionsCompleted || 1) + 1}/${alarm.repetitionsTotal || '∞'} for ${alarm.trendPriceName} (waited ${Math.round(timeSinceLastNotify/1000)}s >= ${Math.round(effectiveSequenceMs/1000)}s)`);
            hasChanges = true;
            const newRepCount = (alarm.repetitionsCompleted || 1) + 1;
            
            // Recalculate autoDismissAt dynamically based on remaining repetitions
            // This prevents the auto-dismiss from firing prematurely due to timing drift
            let newAutoDismissAt = alarm.autoDismissAt;
            if (alarm.autoDismissAt && alarm.repetitionsTotal !== undefined) {
              const remainingReps = alarm.repetitionsTotal - newRepCount;
              if (remainingReps > 0) {
                // Get restwartezeit from localStorage (use default if not found)
                const alarmConfigs = JSON.parse(localStorage.getItem('alarm-level-configs') || '{}');
                const config = alarmConfigs[alarm.alarmLevel];
                const restwartezeitMs = config ? 
                  (config.restwartezeitHours * 3600 + config.restwartezeitMinutes * 60 + config.restwartezeitSeconds) * 1000 
                  : 10000;
                // Extend dismiss time: remaining reps * sequence + restwartezeit
                const newTotalMs = remainingReps * effectiveSequenceMs + restwartezeitMs;
                newAutoDismissAt = new Date(now.getTime() + newTotalMs);
                console.log(`[AUTO-DISMISS] Extended: ${remainingReps} reps left x ${effectiveSequenceMs}ms + ${restwartezeitMs}ms rest = ${newTotalMs}ms, new dismiss at ${newAutoDismissAt.toISOString()}`);
              } else {
                // Last repetition completed - set dismiss to now + restwartezeit
                const alarmConfigs = JSON.parse(localStorage.getItem('alarm-level-configs') || '{}');
                const config = alarmConfigs[alarm.alarmLevel];
                const restwartezeitMs = config ? 
                  (config.restwartezeitHours * 3600 + config.restwartezeitMinutes * 60 + config.restwartezeitSeconds) * 1000 
                  : 10000;
                newAutoDismissAt = new Date(now.getTime() + restwartezeitMs);
                console.log(`[AUTO-DISMISS] Final rep done, dismiss in ${restwartezeitMs}ms at ${newAutoDismissAt.toISOString()}`);
              }
            }
            
            // Send notifications for this alarm
            const alarmMessage = `[Wiederholung ${newRepCount}${alarm.repetitionsTotal ? `/${alarm.repetitionsTotal}` : ''}] ${alarm.trendPriceName}: ${alarm.message}`;
            
            // Send via configured channels
            if (alarm.channels?.push) {
              // In-app toast
              console.log(`[REPETITION] Toast: ${alarmMessage}`);
            }
            
            if (alarm.channels?.email) {
              fetch('/api/notifications/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  channels: { email: true, sms: false, webPush: false },
                  recipient: 'hollvuyo@gmail.com',
                  subject: `🔁 Pionex Alert Wiederholung ${newRepCount}`,
                  message: alarmMessage,
                  alarmLevel: alarm.alarmLevel
                })
              }).catch(err => console.error('Repetition email error:', err));
              console.log(`[REPETITION] Email sent: ${alarmMessage}`);
            }
            
            if (alarm.channels?.webPush || alarm.channels?.nativePush) {
              fetch('/api/notifications/push-enhanced', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  title: `🔁 Wiederholung ${newRepCount}${alarm.repetitionsTotal ? `/${alarm.repetitionsTotal}` : ''}`,
                  message: `${alarm.trendPriceName}: ${alarm.message}`,
                  alarmLevel: alarm.alarmLevel
                })
              }).catch(err => console.error('Repetition push error:', err));
              console.log(`[REPETITION] Push sent: ${alarmMessage}`);
            }
            
            if (alarm.channels?.sms) {
              const smsPhoneNumber = localStorage.getItem('sms-phone-number');
              if (smsPhoneNumber) {
                fetch('/api/send-sms', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    to: smsPhoneNumber,
                    message: alarmMessage,
                    alarmLevel: alarm.alarmLevel
                  })
                }).catch(err => console.error('Repetition SMS error:', err));
                console.log(`[REPETITION] SMS sent: ${alarmMessage}`);
              }
            }
            
            return {
              ...alarm,
              repetitionsCompleted: newRepCount,
              lastNotifiedAt: now,
              autoDismissAt: newAutoDismissAt
            };
          }
          
          return alarm;
        });
        
        return hasChanges ? updated : prev;
      });
    };

    // Check every second for pending repetitions
    const interval = setInterval(checkRepetitions, 1000);
    
    return () => clearInterval(interval);
  }, []); // Empty deps - single interval

  // Sortierung für aktive Alarmierungen
  type AlarmSortOption = 'neueste' | 'älteste' | 'dringlichkeit';
  const [alarmSortOption, setAlarmSortOption] = useState<AlarmSortOption>('dringlichkeit');

  // Sortierte Alarme basierend auf ausgewählter Option
  const sortedActiveAlarms = [...activeAlarms].sort((a, b) => {
    switch (alarmSortOption) {
      case 'neueste':
        return new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime();
      case 'älteste':
        return new Date(a.triggeredAt).getTime() - new Date(b.triggeredAt).getTime();
      case 'dringlichkeit':
        const priorityOrder: AlarmLevel[] = ['sehr_gefährlich', 'gefährlich', 'achtung', 'harmlos'];
        return priorityOrder.indexOf(a.alarmLevel) - priorityOrder.indexOf(b.alarmLevel);
      default:
        return 0;
    }
  });

  // Gefilterte Vorschläge basierend auf Suchanfrage und Market Type
  const allPairsForCurrentMarket = marketType === 'spot' ? allBinancePairs : allBinanceFuturesPairs;
  const filteredSuggestions = searchQuery.trim() === '' 
    ? [] 
    : allPairsForCurrentMarket
        .filter(pair =>
          pair.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !watchlist.includes(pair.id)
        )
        .slice(0, 10); // Zeige maximal 10 Vorschläge

  // Fetch prices for current search suggestions (debounced)
  useEffect(() => {
    // Clear previous timeout
    if (suggestionPriceTimeoutRef.current) {
      clearTimeout(suggestionPriceTimeoutRef.current);
    }

    // Only fetch if we have suggestions
    if (filteredSuggestions.length === 0) return;

    // Get symbols for current suggestions
    const symbols = filteredSuggestions.map(p => p.symbol);

    // Debounce the fetch to avoid too many API calls while typing
    suggestionPriceTimeoutRef.current = setTimeout(() => {
      if (marketType === 'spot') {
        fetchSuggestionSpotPrices(symbols);
      } else {
        fetchSuggestionFuturesPrices(symbols);
      }
    }, 300); // Wait 300ms after user stops typing

    return () => {
      if (suggestionPriceTimeoutRef.current) {
        clearTimeout(suggestionPriceTimeoutRef.current);
      }
    };
  }, [searchQuery, marketType]);

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
      
      // Store the market type AND symbol for this pair (symbol needed for stable lookup after page reload)
      setPairMarketTypes(prev => ({
        ...prev,
        [id]: { marketType: selectedMarketType, symbol: pair?.symbol || '' }
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
            note: '',
            isActive: true
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

    // Berechne neuen State und speichere direkt im localStorage
    const newSettings = {
      ...trendPriceSettings,
      [trendPriceId]: {
        ...trendPriceSettings[trendPriceId],
        thresholds: updatedThresholds
      }
    };

    setTrendPriceSettings(newSettings);
    localStorage.setItem('notifications-threshold-settings', JSON.stringify(newSettings));

    toast({
      title: "Schwellenwert gelöscht",
      description: "Der Schwellenwert wurde erfolgreich entfernt.",
    });
  };

  const deleteAllThresholdsForPair = (trendPriceId: string) => {
    const currentSettings = trendPriceSettings[trendPriceId];
    if (!currentSettings) return;

    const thresholdCount = currentSettings.thresholds.filter(t => 
      t.threshold && 
      t.threshold.trim() !== '' && 
      (t.notifyOnIncrease || t.notifyOnDecrease)
    ).length;

    // Berechne neuen State und speichere direkt im localStorage
    const newSettings = {
      ...trendPriceSettings,
      [trendPriceId]: {
        ...trendPriceSettings[trendPriceId],
        thresholds: []
      }
    };

    setTrendPriceSettings(newSettings);
    localStorage.setItem('notifications-threshold-settings', JSON.stringify(newSettings));

    toast({
      title: "Alle Schwellenwerte gelöscht",
      description: `${thresholdCount} Schwellenwert${thresholdCount !== 1 ? 'e' : ''} für ${getTrendPriceName(trendPriceId)} wurden entfernt.`,
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

  // Ermittle höchste Gefahrstufe der aktiven Alarme für die Section-Umrandung
  const getHighestAlarmLevel = (): AlarmLevel | null => {
    if (activeAlarms.length === 0) return null;
    
    const priority: AlarmLevel[] = ['sehr_gefährlich', 'gefährlich', 'achtung', 'harmlos'];
    for (const level of priority) {
      if (activeAlarms.some(alarm => alarm.alarmLevel === level)) {
        return level;
      }
    }
    return 'harmlos';
  };

  // Farbe für die "Aktive Alarmierungen" Section-Umrandung
  const getActiveAlarmsSectionColor = (): string => {
    const highestLevel = getHighestAlarmLevel();
    if (!highestLevel) return '#0891B2'; // Cyan/Neonblau wenn keine Alarme
    return getAlarmLevelColor(highestLevel);
  };

  // Prüft ob die Section blinken soll (nur bei "Sehr Gefährlich")
  const shouldBlinkActiveAlarmsSection = (): boolean => {
    return getHighestAlarmLevel() === 'sehr_gefährlich';
  };

  const toggleEditMode = (trendPriceId: string) => {
    setEditMode(prev => ({
      ...prev,
      [trendPriceId]: !prev[trendPriceId]
    }));
  };

  // Helper: Remove unsaved threshold when dialog is closed without clicking "Speichern"
  // WICHTIG: This ALWAYS removes the threshold - it's only called when user closes via X/ESC, not via Save
  const cleanupUnsavedThreshold = (trendPriceId: string, thresholdId: string | null) => {
    if (!thresholdId) return;
    
    const settings = trendPriceSettings[trendPriceId];
    if (!settings) return;
    
    // Remove the threshold since user did not click "Speichern"
    setTrendPriceSettings(prev => ({
      ...prev,
      [trendPriceId]: {
        ...prev[trendPriceId],
        thresholds: prev[trendPriceId].thresholds.filter(t => t.id !== thresholdId)
      }
    }));
  };

  const getTrendPrice = (id: string) => {
    // Search in available pairs first, then all pairs (both Spot and Futures)
    return availableTradingPairs.find(tp => tp.id === id) || 
           allBinancePairs.find(tp => tp.id === id) || 
           allBinanceFuturesPairs.find(tp => tp.id === id);
  };

  // Get ONLY live price from availableTradingPairs (updated every 2 seconds)
  const getLivePrice = (id: string): string => {
    const pair = availableTradingPairs.find(tp => tp.id === id);
    const storedData = pairMarketTypes[id];
    // If Futures are geo-blocked and this is a futures pair, show N/A
    if (isFuturesBlocked && storedData?.marketType === 'futures') {
      return 'N/A (Geo-Blocked)';
    }
    return pair?.price || 'Loading...';
  };

  // Parse threshold input: accept comma as decimal separator (German format)
  const parseThresholdInput = (value: string): string => {
    // Replace comma with dot for internal storage
    return value.replace(',', '.');
  };

  // Format threshold for display: German format (dot as thousands separator, comma as decimal)
  const formatThresholdDisplay = (value: string): string => {
    if (!value || value.trim() === '') return '';
    const num = parseFloat(value.replace(',', '.'));
    if (isNaN(num)) return value;
    // Format with German locale: 3.107,50
    return num.toLocaleString('de-DE', { 
      minimumFractionDigits: 0,
      maximumFractionDigits: 8 // Support crypto decimals
    });
  };

  // Helper to get the name, falling back to ID if not found
  const getTrendPriceName = (id: string) => {
    return getTrendPrice(id)?.name || id;
  };

  const updateAlarmLevelConfig = (level: AlarmLevel, field: keyof AlarmLevelConfig['channels'] | 'requiresApproval' | 'repeatCount' | 'sequenceHours' | 'sequenceMinutes' | 'sequenceSeconds' | 'restwartezeitHours' | 'restwartezeitMinutes' | 'restwartezeitSeconds', value: boolean | number | 'infinite') => {
    setAlarmLevelConfigs(prev => {
      const currentConfig = prev[level];
      let updates: Partial<AlarmLevelConfig> = {};
      
      if (field === 'requiresApproval') {
        updates = { requiresApproval: value as boolean };
      } else if (field === 'repeatCount') {
        updates = { repeatCount: value as number | 'infinite' };
        // WICHTIG: Bei "infinite" Wiederholungen muss Approval erforderlich sein
        if (value === 'infinite') {
          updates.requiresApproval = true;
        }
      } else if (field === 'sequenceHours' || field === 'sequenceMinutes' || field === 'sequenceSeconds' || 
                 field === 'restwartezeitHours' || field === 'restwartezeitMinutes' || field === 'restwartezeitSeconds') {
        updates = { [field]: value as number };
      } else {
        updates = { channels: { ...currentConfig.channels, [field]: value as boolean } };
      }
      
      return {
        ...prev,
        [level]: {
          ...currentConfig,
          ...updates
        }
      };
    });
  };

  const toggleAlarmLevelEdit = (level: AlarmLevel) => {
    setAlarmLevelEditMode(prev => ({
      ...prev,
      [level]: !prev[level]
    }));
  };

  const approveAlarm = async (alarmId: string) => {
    // Delete from backend first for cross-device sync
    try {
      const response = await fetch(`/api/active-alarms/${alarmId}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        console.log(`[ACTIVE-ALARMS] Deleted alarm ${alarmId} from backend`);
      } else {
        console.warn(`[ACTIVE-ALARMS] Backend delete failed for ${alarmId}:`, response.status);
      }
    } catch (err) {
      console.error('[ACTIVE-ALARMS] Backend delete error:', err);
    }
    
    // Also remove from local state and localStorage
    setActiveAlarms(prev => {
      const updated = prev.filter(alarm => alarm.id !== alarmId);
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
      note: 'TEST: Wichtiger Widerstandslevel durchbrochen!',
      requiresApproval: true
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
            webPush: false
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

    // Web Push Benachrichtigung senden via OneSignal (broadcasts to all subscribers)
    try {
      const webPushResponse = await fetch('/api/notifications/web-push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: `🔔 Sehr Gefährlich - ${mockAlarm.trendPriceName}`,
          message: `${mockAlarm.message}. ${mockAlarm.note}`,
          alarmLevel: mockAlarm.alarmLevel
        })
      });

      const webPushResult = await webPushResponse.json();

      if (webPushResult.success) {
        // recipients: -1 means "unknown" (API doesn't return count), show success
        const isSuccess = webPushResult.recipients === -1 || webPushResult.recipients > 0;
        toast({
          title: isSuccess ? "✅ Web Push gesendet!" : "⚠️ Keine Abonnenten",
          description: webPushResult.message || `Browser-Benachrichtigung erfolgreich gesendet`,
          duration: 5000,
          variant: isSuccess ? "default" : "destructive",
        });
      } else {
        console.error('Web Push error:', webPushResult.error);
        toast({
          title: "⚠️ Web Push-Fehler",
          description: webPushResult.error || "Web Push konnte nicht gesendet werden",
          variant: "destructive",
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('Web Push notification error:', error);
      toast({
        title: "❌ Web Push-Fehler",
        description: "Verbindung zum Server fehlgeschlagen",
        variant: "destructive",
        duration: 5000,
      });
    }
  };

  // ============================================================================
  // NATIVE PUSH TEST SECTION - Komplett separater Bereich für iOS/Android Push
  // ============================================================================

  const triggerNativePushAlarm = async () => {
    // Alarm erstellen
    const nativePushAlarm: ActiveAlarm = {
      id: crypto.randomUUID(),
      trendPriceName: 'ETH/USDT',
      threshold: '3500',
      alarmLevel: 'gefährlich',
      triggeredAt: new Date(),
      message: 'Native Push Test - Preis über 3500 USDT',
      note: 'NATIVE PUSH TEST: iOS/Android Benachrichtigung',
      requiresApproval: true
    };

    // Optimistic UI Update - Alarm sofort hinzufügen
    setActiveAlarms(prev => [...prev, nativePushAlarm]);

    toast({
      title: "Native Push wird gesendet...",
      description: `${nativePushAlarm.trendPriceName}: ${nativePushAlarm.message}`,
      duration: 3000,
    });

    // Native Push via Backend an OneSignal senden
    try {
      const response = await fetch('/api/test-native-push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: `Gefährlich - ${nativePushAlarm.trendPriceName}`,
          message: `${nativePushAlarm.message}. ${nativePushAlarm.note}`,
          alarmLevel: nativePushAlarm.alarmLevel
        })
      });

      // Handle non-2xx responses
      if (!response.ok) {
        console.error('[NATIVE PUSH] HTTP Error:', response.status);
        // Rollback: Remove the alarm on failure
        setActiveAlarms(prev => prev.filter(a => a.id !== nativePushAlarm.id));
        toast({
          title: "Native Push Fehler",
          description: `HTTP ${response.status}: Server-Fehler`,
          variant: "destructive",
          duration: 5000,
        });
        return;
      }

      const result = await response.json();
      console.log('[NATIVE PUSH] Backend Response:', result);

      if (result.success) {
        toast({
          title: "Native Push gesendet!",
          description: `ID: ${result.notificationId}, Empfänger: ${result.recipients}`,
          duration: 5000,
        });
      } else {
        // Rollback: Remove the alarm on failure
        setActiveAlarms(prev => prev.filter(a => a.id !== nativePushAlarm.id));
        toast({
          title: "Native Push Fehler",
          description: result.error || "Push konnte nicht gesendet werden",
          variant: "destructive",
          duration: 5000,
        });
      }
    } catch (error: any) {
      console.error('[NATIVE PUSH] Error:', error);
      // Rollback: Remove the alarm on error
      setActiveAlarms(prev => prev.filter(a => a.id !== nativePushAlarm.id));
      toast({
        title: "Verbindungsfehler",
        description: "Backend nicht erreichbar",
        variant: "destructive",
        duration: 5000,
      });
    }

    // SMS senden wenn Toggle aktiv und Telefonnummer vorhanden
    // Prüfe beide gefährlichen Level - sende SMS wenn einer von beiden SMS aktiviert hat
    const currentAlarmLevel = nativePushAlarm.alarmLevel as AlarmLevel;
    const smsConfig = alarmLevelConfigs[currentAlarmLevel] || alarmLevelConfigs['gefährlich'];
    const anySmsEnabled = alarmLevelConfigs['gefährlich'].channels.sms || alarmLevelConfigs['sehr_gefährlich'].channels.sms;
    
    if (anySmsEnabled && smsPhoneNumber) {
      console.log('[SMS TEST] SMS Toggle aktiv, sende SMS...');
      try {
        const smsResponse = await fetch('/api/send-sms', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            to: smsPhoneNumber,
            message: `[${nativePushAlarm.alarmLevel.toUpperCase()}] ${nativePushAlarm.trendPriceName}: ${nativePushAlarm.message}`,
            alarmLevel: nativePushAlarm.alarmLevel
          })
        });

        const smsResult = await smsResponse.json();
        
        if (smsResult.success) {
          toast({
            title: "SMS gesendet!",
            description: `An ${smsPhoneNumber.slice(0, 4)}***`,
            duration: 5000,
          });
        } else {
          console.error('[SMS] Error:', smsResult.error);
          toast({
            title: "SMS Fehler",
            description: smsResult.error || "SMS konnte nicht gesendet werden",
            variant: "destructive",
            duration: 5000,
          });
        }
      } catch (smsError: any) {
        console.error('[SMS] Error:', smsError);
        toast({
          title: "SMS Fehler",
          description: "Verbindung fehlgeschlagen",
          variant: "destructive",
          duration: 5000,
        });
      }
    } else if (anySmsEnabled && !smsPhoneNumber) {
      toast({
        title: "SMS nicht gesendet",
        description: "Keine Telefonnummer hinterlegt",
        variant: "destructive",
        duration: 5000,
      });
    }
  };

  // ============================================================================
  // END NATIVE PUSH TEST SECTION
  // ============================================================================

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
            {showTestButton && (
              <Button
                variant="default"
                size="sm"
                onClick={triggerNativePushAlarm}
                className="bg-blue-600 hover:bg-blue-700"
                data-testid="button-push-test"
              >
                Push Test
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowTestButton(!showTestButton)}
              data-testid="button-toggle-test-visibility"
            >
              {showTestButton ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
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

        {/* Aktive Alarmierungen - Immer sichtbar, Umrandung passt sich höchster Gefahrstufe an */}
        <Card 
          className={cn("ring-2 mb-6", shouldBlinkActiveAlarmsSection() && "animate-pulse-ring")}
          style={{ '--tw-ring-color': getActiveAlarmsSectionColor(), '--ring-color': getActiveAlarmsSectionColor() } as React.CSSProperties}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <CardTitle className="flex items-center gap-2 text-lg">
                Aktive Alarmierungen ({activeAlarms.length})
              </CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Sortieren:</span>
                <Select value={alarmSortOption} onValueChange={(value) => setAlarmSortOption(value as AlarmSortOption)}>
                  <SelectTrigger className="w-[140px] h-8" data-testid="select-alarm-sort">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="neueste" data-testid="sort-option-neueste">Neueste</SelectItem>
                    <SelectItem value="älteste" data-testid="sort-option-älteste">Älteste</SelectItem>
                    <SelectItem value="dringlichkeit" data-testid="sort-option-dringlichkeit">Dringlichkeit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[220px]">
              {sortedActiveAlarms.length === 0 ? (
                <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
                  Keine aktiven Alarmierungen
                </div>
              ) : (
                <div className="space-y-2 pr-4">
                  {sortedActiveAlarms.map((alarm) => (
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
                          ${formatThresholdDisplay(alarm.threshold)} | {alarm.message}
                        </p>
                        {alarm.note && (
                          <p className="text-xs text-muted-foreground mt-1 italic border-l-2 border-cyan-500 pl-2">
                            📝 {alarm.note}
                          </p>
                        )}
                        {/* Show repetition count + auto-dismiss countdown when approval NOT required */}
                        {!alarm.requiresApproval && (
                          <div className="text-xs text-orange-500 dark:text-orange-400 mt-1 flex items-center gap-2 flex-wrap" data-tick={countdownTick}>
                            {/* Wiederholungsanzeige */}
                            {alarm.repetitionsTotal && (
                              <span className="flex items-center gap-1">
                                <RefreshCw className="w-3 h-3" />
                                {alarm.repetitionsCompleted} von {alarm.repetitionsTotal} Wiederholungen
                              </span>
                            )}
                            {/* Auto-dismiss countdown */}
                            {alarm.autoDismissAt && (
                              <span className="flex items-center gap-1">
                                <Timer className="w-3 h-3" />
                                Restzeit: {(() => {
                                  const now = new Date();
                                  const dismissTime = new Date(alarm.autoDismissAt);
                                  const diffMs = dismissTime.getTime() - now.getTime();
                                  if (diffMs <= 0) return "Gleich...";
                                  const diffSec = Math.floor(diffMs / 1000);
                                  const hours = Math.floor(diffSec / 3600);
                                  const minutes = Math.floor((diffSec % 3600) / 60);
                                  const seconds = diffSec % 60;
                                  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
                                  if (minutes > 0) return `${minutes}m ${seconds}s`;
                                  return `${seconds}s`;
                                })()}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      {/* Approve/Stop button - always visible to allow manual dismissal */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => approveAlarm(alarm.id)}
                        className="flex-shrink-0 h-8"
                        style={{ borderColor: getAlarmLevelColor(alarm.alarmLevel) }}
                        data-testid={`button-approve-alarm-${alarm.id}`}
                      >
                        <Check className="w-3.5 h-3.5 mr-1" />
                        {alarm.requiresApproval ? 'Approve' : 'Stoppen'}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
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
                      <p className="text-sm font-medium">
                        Vorschläge
                      </p>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {(marketType === 'spot' && isSpotLoading) || (marketType === 'futures' && isFuturesLoading) ? (
                        <div className="p-4 text-center text-muted-foreground text-sm">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                            Lade {marketType === 'spot' ? 'Spot' : 'Futures'} Pairs...
                          </div>
                        </div>
                      ) : filteredSuggestions.length > 0 ? (
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
                          Keine Ergebnisse gefunden für "{searchQuery}"
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
                    <ScrollArea className={cn(
                      watchlist.length > 3 ? "h-[220px] max-h-[220px]" : ""
                    )}>
                      <div className="divide-y">
                        {watchlist.map((tpId) => {
                          const pair = getTrendPrice(tpId);
                          const storedMarketType = pairMarketTypes[tpId]?.marketType || 'spot'; // WICHTIG: Use stored marketType
                          
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
                                  <span className="text-muted-foreground">
                                    ${isFuturesBlocked && storedMarketType === 'futures' ? 'N/A (Geo-Blocked)' : (pair?.price || 'Loading...')}
                                  </span>
                                  {pair?.priceChangePercent24h && !(isFuturesBlocked && storedMarketType === 'futures') && (
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
                    </ScrollArea>
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
            {/* WICHTIG: Exclude currently editing threshold from this check to prevent dialog from closing */}
            {(() => {
              const hasAnyThresholds = watchlist.some(trendPriceId => {
                const settings = trendPriceSettings[trendPriceId];
                const savedThresholds = settings?.thresholds.filter(t => 
                  t.id !== editingThresholdId && // Exclude threshold being edited
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

                                const storedMarketType = pairMarketTypes[trendPriceId]?.marketType || 'spot';
                                return (
                                  <Card key={trendPriceId} className="p-4">
                                    <div className="flex items-center justify-between mb-3">
                                      <div className="flex items-center gap-2">
                                        <h3 className="text-lg font-semibold">{pair?.name || trendPriceId}</h3>
                                        {storedMarketType === 'futures' && (
                                          <span className="text-xs px-2 py-0.5 rounded bg-blue-500 text-white font-medium">
                                            FUTURE
                                          </span>
                                        )}
                                      </div>
                                      <span className="text-sm text-muted-foreground">
                                        ${getLivePrice(trendPriceId)}
                                      </span>
                                    </div>
                                    <Dialog
                                      open={editDialogOpen[`new-${trendPriceId}`]}
                                      onOpenChange={(open) => {
                                        if (!open) {
                                          // Dialog is closing - check if it was via Save or via X/ESC
                                          if (!isSavingThresholdRef.current) {
                                            // User closed via X/ESC - remove unsaved threshold
                                            cleanupUnsavedThreshold(trendPriceId, editingThresholdId);
                                          }
                                          isSavingThresholdRef.current = false;
                                          setEditingThresholdId(null);
                                        }
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
                                              note: '',
                                              isActive: true
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
                                                    type="text"
                                                    inputMode="decimal"
                                                    placeholder="z.B. 50000 oder 3,50"
                                                    value={threshold.threshold}
                                                    onChange={(e) => updateThreshold(trendPriceId, editingThresholdId, 'threshold', parseThresholdInput(e.target.value))}
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

                                                <div className="flex items-center justify-between pt-4 border-t">
                                                  <div className="flex items-center gap-2">
                                                    <Switch
                                                      checked={threshold.isActive !== false}
                                                      onCheckedChange={(checked) => updateThreshold(trendPriceId, editingThresholdId, 'isActive', checked)}
                                                      className={cn(
                                                        "data-[state=checked]:bg-blue-500 data-[state=unchecked]:bg-gray-400"
                                                      )}
                                                    />
                                                    <span className={cn(
                                                      "text-sm font-medium",
                                                      threshold.isActive !== false ? "text-blue-500" : "text-gray-500"
                                                    )}>
                                                      {threshold.isActive !== false ? "Aktiv" : "Pause"}
                                                    </span>
                                                  </div>
                                                  <div className="flex gap-2">
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

                                                        // WICHTIG: Set ref BEFORE closing dialog so onOpenChange knows not to cleanup
                                                        isSavingThresholdRef.current = true;
                                                        saveSettingsToStorage();
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

              // Count how many items have active thresholds (will be rendered)
              const activeItemCount = watchlist.filter(trendPriceId => {
                const settings = trendPriceSettings[trendPriceId];
                const savedThresholds = settings?.thresholds.filter(t => 
                  t.threshold && 
                  t.threshold.trim() !== '' && 
                  (t.notifyOnIncrease || t.notifyOnDecrease)
                ) || [];
                return savedThresholds.length > 0;
              }).length;

              // Sort watchlist alphabetically based on notificationSortOrder
              const sortedWatchlist = [...watchlist].sort((a, b) => {
                const nameA = getTrendPriceName(a).toLowerCase();
                const nameB = getTrendPriceName(b).toLowerCase();
                if (notificationSortOrder === 'asc') {
                  return nameA.localeCompare(nameB);
                } else {
                  return nameB.localeCompare(nameA);
                }
              });

              return (
                <>
                {/* Schwellenwert hinzufügen Button und Sortierung - OBEN */}
                <div className="flex items-center justify-between mb-4 pb-4 border-b">
                  <div className="flex items-center gap-3">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="flex items-center gap-2" data-testid="button-add-threshold">
                          <Plus className="w-4 h-4" />
                          Schwellenwert hinzufügen
                        </Button>
                      </DialogTrigger>
                    <DialogContent className="max-w-2xl" onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
                      <DialogHeader>
                        <DialogTitle>Schwellenwert hinzufügen</DialogTitle>
                      </DialogHeader>
                      <ScrollArea className={cn(
                        "pr-4 pl-2",
                        watchlist.length > 3 ? "h-[400px]" : ""
                      )}>
                        <div className="space-y-4">
                          {watchlist.map((trendPriceId) => {
                            const pair = getTrendPrice(trendPriceId);

                            const storedMarketType = pairMarketTypes[trendPriceId]?.marketType || 'spot';
                            return (
                              <Card key={trendPriceId} className="p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <h3 className="text-lg font-semibold">{pair?.name || trendPriceId}</h3>
                                    {storedMarketType === 'futures' && (
                                      <span className="text-xs px-2 py-0.5 rounded bg-blue-500 text-white font-medium">
                                        FUTURE
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-sm text-muted-foreground">
                                    ${getLivePrice(trendPriceId)}
                                  </span>
                                </div>
                                <Dialog
                                  open={editDialogOpen[`add-${trendPriceId}`]}
                                  onOpenChange={(open) => {
                                    if (!open) {
                                      // Dialog is closing - check if it was via Save or via X/ESC
                                      if (!isSavingThresholdRef.current) {
                                        // User closed via X/ESC - remove unsaved threshold
                                        cleanupUnsavedThreshold(trendPriceId, editingThresholdId);
                                      }
                                      isSavingThresholdRef.current = false;
                                      setEditingThresholdId(null);
                                    }
                                    setEditDialogOpen(prev => ({ ...prev, [`add-${trendPriceId}`]: open }));
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
                                          note: '',
                                          isActive: true
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
                                        setEditDialogOpen(prev => ({ ...prev, [`add-${trendPriceId}`]: true, [newThreshold.id]: true }));
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
                                              <Label htmlFor={`add-threshold-${editingThresholdId}`}>Schwellenwert (USDT)</Label>
                                              <Input
                                                id={`add-threshold-${editingThresholdId}`}
                                                type="text"
                                                inputMode="decimal"
                                                placeholder="z.B. 50000 oder 3,50"
                                                value={threshold.threshold}
                                                onChange={(e) => updateThreshold(trendPriceId, editingThresholdId, 'threshold', parseThresholdInput(e.target.value))}
                                              />
                                            </div>

                                            <div className="space-y-3">
                                              <Label>Benachrichtigungen bei:</Label>

                                              <div className="space-y-2 p-3 rounded-lg border">
                                                <div className="flex items-center space-x-2">
                                                  <Checkbox
                                                    id={`add-increase-${editingThresholdId}`}
                                                    checked={threshold.notifyOnIncrease}
                                                    onCheckedChange={(checked) =>
                                                      updateThreshold(trendPriceId, editingThresholdId, 'notifyOnIncrease', checked)
                                                    }
                                                  />
                                                  <Label htmlFor={`add-increase-${editingThresholdId}`} className="cursor-pointer flex-1">
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
                                                    id={`add-decrease-${editingThresholdId}`}
                                                    checked={threshold.notifyOnDecrease}
                                                    onCheckedChange={(checked) =>
                                                      updateThreshold(trendPriceId, editingThresholdId, 'notifyOnDecrease', checked)
                                                    }
                                                  />
                                                  <Label htmlFor={`add-decrease-${editingThresholdId}`} className="cursor-pointer flex-1">
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
                                              <Label htmlFor={`add-alarm-${editingThresholdId}`}>Alarmierungsstufe</Label>
                                              <select
                                                id={`add-alarm-${editingThresholdId}`}
                                                className="w-full text-sm border rounded px-3 py-2 bg-background"
                                                value={threshold.alarmLevel}
                                                onChange={(e) => updateThreshold(trendPriceId, editingThresholdId, 'alarmLevel', e.target.value as AlarmLevel)}
                                              >
                                                <option value="harmlos">Harmlos (Info)</option>
                                                <option value="achtung">Achtung (Warnung)</option>
                                                <option value="gefährlich">Gefährlich (Alert)</option>
                                                <option value="sehr_gefährlich">Sehr Gefährlich (Kritisch)</option>
                                              </select>
                                            </div>

                                            <div>
                                              <Label htmlFor={`add-note-${editingThresholdId}`}>Notiz (optional)</Label>
                                              <Input
                                                id={`add-note-${editingThresholdId}`}
                                                type="text"
                                                placeholder="z.B. Wichtiger Widerstandslevel"
                                                value={threshold.note}
                                                onChange={(e) => updateThreshold(trendPriceId, editingThresholdId, 'note', e.target.value)}
                                              />
                                            </div>

                                            <div className="flex items-center justify-between pt-4 border-t">
                                              <div className="flex items-center gap-2">
                                                <Switch
                                                  checked={threshold.isActive !== false}
                                                  onCheckedChange={(checked) => updateThreshold(trendPriceId, editingThresholdId, 'isActive', checked)}
                                                  className={cn(
                                                    "data-[state=checked]:bg-blue-500 data-[state=unchecked]:bg-gray-400"
                                                  )}
                                                />
                                                <span className={cn(
                                                  "text-sm font-medium",
                                                  threshold.isActive !== false ? "text-blue-500" : "text-gray-500"
                                                )}>
                                                  {threshold.isActive !== false ? "Aktiv" : "Pause"}
                                                </span>
                                              </div>
                                              <Button
                                                onClick={() => {
                                                  // WICHTIG: Set ref BEFORE closing dialog so onOpenChange knows not to cleanup
                                                  isSavingThresholdRef.current = true;
                                                  saveSettingsToStorage();
                                                  setEditDialogOpen(prev => ({ ...prev, [`add-${trendPriceId}`]: false, [editingThresholdId]: false }));
                                                  setEditingThresholdId(null);
                                                  toast({
                                                    title: "Gespeichert",
                                                    description: "Schwellenwert wurde erfolgreich hinzugefügt.",
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
                    <span className="text-sm text-muted-foreground">
                      {activeItemCount} Trading Pair{activeItemCount !== 1 ? 's' : ''} aktiv
                    </span>
                  </div>

                  {/* Sortier-Toggle */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setNotificationSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    className="flex items-center gap-2"
                    data-testid="button-sort-notifications"
                  >
                    {notificationSortOrder === 'asc' ? (
                      <>
                        <ArrowUp className="w-4 h-4" />
                        A-Z
                      </>
                    ) : (
                      <>
                        <ArrowDown className="w-4 h-4" />
                        Z-A
                      </>
                    )}
                  </Button>
                </div>

                <ScrollArea className={cn(
                  "w-full",
                  activeItemCount > 3 ? "h-[240px] max-h-[240px]" : ""
                )}>
                  <div className="space-y-4 p-3">
                  {sortedWatchlist.map((trendPriceId) => {
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
                        {(pairMarketTypes[trendPriceId]?.marketType || 'spot') === 'futures' && (
                          <span className="text-xs px-2 py-0.5 rounded bg-blue-500 text-white font-medium">
                            FUTURE
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {savedThresholds.length} Schwellenwert{savedThresholds.length !== 1 ? 'e' : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {/* View Dialog - Eye Icon */}
                        <Dialog 
                          open={viewDialogOpen[trendPriceId]} 
                          onOpenChange={(open) => setViewDialogOpen(prev => ({ ...prev, [trendPriceId]: open }))}
                        >
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7" data-testid={`button-view-thresholds-${trendPriceId}`}>
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl" onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
                              <DialogHeader>
                                <DialogTitle>Schwellenwerte für {getTrendPriceName(trendPriceId)}</DialogTitle>
                              </DialogHeader>
                            <ScrollArea className={cn(
                              "w-full",
                              savedThresholds.length > 2 ? "h-[400px]" : ""
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
                                                  type="text"
                                                  inputMode="decimal"
                                                  placeholder="z.B. 50000 oder 3,50"
                                                  value={threshold.threshold}
                                                  onChange={(e) => updateThreshold(trendPriceId, threshold.id, 'threshold', parseThresholdInput(e.target.value))}
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

                                              <div className="flex items-center justify-between pt-4 border-t">
                                                <div className="flex items-center gap-2">
                                                  <Switch
                                                    checked={threshold.isActive !== false}
                                                    onCheckedChange={(checked) => updateThreshold(trendPriceId, threshold.id, 'isActive', checked)}
                                                    className={cn(
                                                      "data-[state=checked]:bg-blue-500 data-[state=unchecked]:bg-gray-400"
                                                    )}
                                                  />
                                                  <span className={cn(
                                                    "text-sm font-medium",
                                                    threshold.isActive !== false ? "text-blue-500" : "text-gray-500"
                                                  )}>
                                                    {threshold.isActive !== false ? "Aktiv" : "Pause"}
                                                  </span>
                                                </div>
                                                <div className="flex gap-2">
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

                                                      // WICHTIG: Only save to localStorage when user explicitly clicks Speichern
                                                      saveSettingsToStorage();
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
                                        <span className="text-muted-foreground">${formatThresholdDisplay(threshold.threshold) || 'Nicht gesetzt'}</span>
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
                        {/* Delete All Thresholds - Trash Icon */}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" data-testid={`button-delete-all-thresholds-${trendPriceId}`}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Alle Schwellenwerte löschen?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Möchten Sie wirklich alle {savedThresholds.length} Schwellenwert{savedThresholds.length !== 1 ? 'e' : ''} für {getTrendPriceName(trendPriceId)} löschen? Das Trading Pair bleibt in der Watchlist.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => deleteAllThresholdsForPair(trendPriceId)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Alle löschen
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </CardHeader>

                  </Card>
                );
              })}
                  </div>
                </ScrollArea>
                </>
              );
            })()}
            </>
            )}
          </CardContent>
        </Card>

        {/* Alarmierungsstufen konfigurieren Section */}
        <Card className="ring-2 ring-cyan-600">
          <CardHeader>
            <CardTitle className="text-xl">Alarmierungsstufen konfigurieren</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(Object.keys(alarmLevelConfigs) as AlarmLevel[]).map((level) => {
                const config = alarmLevelConfigs[level];
                const color = getAlarmLevelColor(level);

                return (
                  <div key={level} className="p-4 border rounded-lg" style={{ borderColor: color }}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded" style={{ backgroundColor: color }}></div>
                        <h4 className="font-semibold">{getAlarmLevelLabel(level)}</h4>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Edit Button - Opens Dialog */}
                        <Dialog open={alarmLevelEditMode[level]} onOpenChange={(open) => {
                          if (!open) {
                            // Beim Schließen ohne Speichern: Config zurücksetzen auf localStorage
                            const stored = localStorage.getItem('alarm-level-configs');
                            if (stored) {
                              try {
                                const parsed = JSON.parse(stored);
                                if (parsed[level]) {
                                  setAlarmLevelConfigs(prev => ({
                                    ...prev,
                                    [level]: parsed[level]
                                  }));
                                }
                              } catch {}
                            }
                          }
                          setAlarmLevelEditMode(prev => ({ ...prev, [level]: open }));
                        }}>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              data-testid={`button-edit-alarm-level-${level}`}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-md">
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded" style={{ backgroundColor: color }}></div>
                                {getAlarmLevelLabel(level)} bearbeiten
                              </DialogTitle>
                            </DialogHeader>
                            <div className="max-h-[60vh] overflow-y-auto pr-2">
                              <div className="space-y-4 py-4">
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
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <Label htmlFor={`${level}-sms`} className="text-sm cursor-pointer">SMS</Label>
                                      <Switch
                                        id={`${level}-sms`}
                                        checked={config.channels.sms}
                                        onCheckedChange={(checked) => updateAlarmLevelConfig(level, 'sms', checked)}
                                      />
                                    </div>
                                    {config.channels.sms && (
                                      <div className="pl-4">
                                        <Label htmlFor={`${level}-sms-phone`} className="text-xs text-muted-foreground mb-1 block">
                                          Telefonnummer (mit Ländervorwahl, z.B. +49...)
                                        </Label>
                                        <Input
                                          id={`${level}-sms-phone`}
                                          type="tel"
                                          placeholder="+49123456789"
                                          value={smsPhoneNumber}
                                          onChange={(e) => {
                                            setSmsPhoneNumber(e.target.value);
                                            localStorage.setItem('notifications-sms-phone-number', e.target.value);
                                          }}
                                          className="h-8 text-sm"
                                          data-testid={`input-sms-phone-${level}`}
                                        />
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <Label htmlFor={`${level}-pushNotifications`} className="text-sm cursor-pointer">Push Benachrichtigungen (iOS, Android, Browser)</Label>
                                    <Switch
                                      id={`${level}-pushNotifications`}
                                      checked={config.channels.webPush || config.channels.nativePush}
                                      onCheckedChange={(checked) => {
                                        updateAlarmLevelConfig(level, 'webPush', checked);
                                        updateAlarmLevelConfig(level, 'nativePush', checked);
                                      }}
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
                                      type="text"
                                      inputMode="numeric"
                                      pattern="[0-9]*"
                                      value={config.repeatCount === 'infinite' ? '' : config.repeatCount}
                                      onChange={(e) => {
                                        const val = parseInt(e.target.value);
                                        if (!isNaN(val) && val > 0) {
                                          updateAlarmLevelConfig(level, 'repeatCount', val);
                                        } else if (e.target.value === '') {
                                          updateAlarmLevelConfig(level, 'repeatCount', 1);
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

                                {/* Sequenz */}
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

                                {/* Restwartezeit - nur wenn Approval AUS und nicht unendlich */}
                                {!config.requiresApproval && config.repeatCount !== 'infinite' && (
                                  <div className="space-y-2">
                                    <Label className="text-sm font-medium">Restwartezeit (Auto-Dismiss nach Wiederholungen)</Label>
                                    <p className="text-xs text-muted-foreground">Nach Ablauf aller Wiederholungen läuft dieser Countdown, dann verschwindet der Alarm automatisch.</p>
                                    <div className="grid grid-cols-3 gap-2">
                                      <div>
                                        <Label htmlFor={`${level}-restwartezeit-hours`} className="text-xs text-muted-foreground">Stunden</Label>
                                        <Input
                                          id={`${level}-restwartezeit-hours`}
                                          type="number"
                                          min="0"
                                          value={config.restwartezeitHours}
                                          onChange={(e) => {
                                            const val = parseInt(e.target.value);
                                            if (!isNaN(val) && val >= 0) {
                                              updateAlarmLevelConfig(level, 'restwartezeitHours', val);
                                            }
                                          }}
                                          className="text-sm"
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor={`${level}-restwartezeit-minutes`} className="text-xs text-muted-foreground">Minuten</Label>
                                        <Input
                                          id={`${level}-restwartezeit-minutes`}
                                          type="number"
                                          min="0"
                                          max="59"
                                          value={config.restwartezeitMinutes}
                                          onChange={(e) => {
                                            const val = parseInt(e.target.value);
                                            if (!isNaN(val) && val >= 0 && val <= 59) {
                                              updateAlarmLevelConfig(level, 'restwartezeitMinutes', val);
                                            }
                                          }}
                                          className="text-sm"
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor={`${level}-restwartezeit-seconds`} className="text-xs text-muted-foreground">Sekunden</Label>
                                        <Input
                                          id={`${level}-restwartezeit-seconds`}
                                          type="number"
                                          min="0"
                                          max="59"
                                          value={config.restwartezeitSeconds}
                                          onChange={(e) => {
                                            const val = parseInt(e.target.value);
                                            if (!isNaN(val) && val >= 0 && val <= 59) {
                                              updateAlarmLevelConfig(level, 'restwartezeitSeconds', val);
                                            }
                                          }}
                                          className="text-sm"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-4 border-t mt-2">
                              <Button 
                                variant="outline" 
                                onClick={() => {
                                  // Cancel: Restore from localStorage
                                  const stored = localStorage.getItem('alarm-level-configs');
                                  if (stored) {
                                    try {
                                      const parsed = JSON.parse(stored);
                                      if (parsed[level]) {
                                        setAlarmLevelConfigs(prev => ({
                                          ...prev,
                                          [level]: parsed[level]
                                        }));
                                      }
                                    } catch {}
                                  }
                                  setAlarmLevelEditMode(prev => ({ ...prev, [level]: false }));
                                }}
                                data-testid={`button-cancel-alarm-level-${level}`}
                              >
                                Abbrechen
                              </Button>
                              <Button 
                                onClick={() => {
                                  // Save to localStorage
                                  localStorage.setItem('alarm-level-configs', JSON.stringify(alarmLevelConfigs));
                                  setAlarmLevelEditMode(prev => ({ ...prev, [level]: false }));
                                  toast({
                                    title: "Gespeichert",
                                    description: `Einstellungen für "${getAlarmLevelLabel(level)}" wurden gespeichert.`,
                                  });
                                }}
                                data-testid={`button-save-alarm-level-${level}`}
                              >
                                Speichern
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>

                    {/* Zusammenfassung - immer 4 Zeilen für konstante Höhe */}
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
                                webPush: 'Push Benachrichtigungen',
                                nativePush: ''
                              };
                              return channelNames[channel];
                            })
                            .filter(name => name !== '')
                            .join(', ') || 'Keine'}
                        </span>
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">Approval: </span>
                        <span className="text-muted-foreground">
                          {config.requiresApproval ? 'Erforderlich' : 'Nicht erforderlich'}
                        </span>
                      </div>
                      {/* Wiederholung - immer zeigen */}
                      <div className="text-sm">
                        <span className="font-medium">Wiederholung: </span>
                        <span className="text-muted-foreground">
                          {config.repeatCount === 'infinite' ? '∞ (Bis Approval)' : `${config.repeatCount}x`}
                        </span>
                      </div>
                      {/* Sequenz - immer zeigen */}
                      <div className="text-sm">
                        <span className="font-medium">Sequenz: </span>
                        <span className="text-muted-foreground">
                          {config.sequenceHours}h {config.sequenceMinutes}m {config.sequenceSeconds}s
                        </span>
                      </div>
                      {/* Restwartezeit - nur wenn Approval aus */}
                      {!config.requiresApproval && config.repeatCount !== 'infinite' && (
                        <div className="text-sm">
                          <span className="font-medium">Restwartezeit: </span>
                          <span className="text-muted-foreground">
                            {config.restwartezeitHours}h {config.restwartezeitMinutes}m {config.restwartezeitSeconds}s (Auto-Dismiss)
                          </span>
                        </div>
                      )}
                    </div>
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