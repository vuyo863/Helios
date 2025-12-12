import { useState, useMemo, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload as UploadIcon, X, Send, Image as ImageIcon, Pencil, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useUpdateNotification } from "@/lib/update-notification-context";
import BotTypeManager from "@/components/BotTypeManager";
import { BotEntry, BotType, BotTypeUpdate } from "@shared/schema";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLocation } from "wouter";

export default function Upload() {
  const [location] = useLocation();
  const { toast } = useToast();
  const { notifyUpdate } = useUpdateNotification();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedBotTypeId, setSelectedBotTypeId] = useState<string | null>(null);
  const [closedSelectedBotTypeId, setClosedSelectedBotTypeId] = useState<string | null>(null);
  const [selectedBotTypeColor, setSelectedBotTypeColor] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'ai', content: string }>>([]);
  const [chatInput, setChatInput] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  
  const [screenshotsSent, setScreenshotsSent] = useState(false);
  const [botTypeSent, setBotTypeSent] = useState(false);
  const phaseOneComplete = screenshotsSent && botTypeSent;
  const [editMode, setEditMode] = useState(false);
  const [waitingForConfirmation, setWaitingForConfirmation] = useState(false);
  const [phaseTwoVerified, setPhaseTwoVerified] = useState(false);
  const [phaseTwoStep2Complete, setPhaseTwoStep2Complete] = useState(false);
  const [isStartMetric, setIsStartMetric] = useState(false);
  const [closedIsStartMetric, setClosedIsStartMetric] = useState(false);
  const [infoSectionMode, setInfoSectionMode] = useState<'Normal' | 'Startmetrik'>('Normal');
  const [calculationMode, setCalculationMode] = useState<'Normal' | 'Startmetrik'>('Normal');
  const [closedCalculationMode, setClosedCalculationMode] = useState<'Normal' | 'Startmetrik'>('Normal');
  const [screenshotsBeforeEdit, setScreenshotsBeforeEdit] = useState(false);
  const [phaseThreeSettingsSent, setPhaseThreeSettingsSent] = useState(false);
  const [waitingForPhaseThreeConfirmation, setWaitingForPhaseThreeConfirmation] = useState(false);
  const [extractedScreenshotData, setExtractedScreenshotData] = useState<any>(null);
  
  // Ref für Auto-Scroll im Chat (nur innerhalb des Chat-Containers)
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  // Auto-Scroll wenn neue Nachrichten hinzugefügt werden oder AI lädt
  // Scrollt nur den Chat-Container, nicht die ganze Seite
  useEffect(() => {
    if (chatContainerRef.current) {
      const container = chatContainerRef.current;
      const targetScroll = container.scrollHeight;
      const currentScroll = container.scrollTop;
      const distance = targetScroll - currentScroll;
      
      // Langsamer, sanfter Scroll über 800ms
      const duration = 800;
      const startTime = performance.now();
      
      const animateScroll = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing-Funktion für sanfteres Scrolling
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        
        container.scrollTop = currentScroll + (distance * easeProgress);
        
        if (progress < 1) {
          requestAnimationFrame(animateScroll);
        }
      };
      
      requestAnimationFrame(animateScroll);
    }
  }, [chatMessages, isAiLoading]);
  
  const { data: botTypes = [] } = useQuery<BotType[]>({
    queryKey: ['/api/bot-types'],
  });
  
  // State für updateHistory
  const [updateHistory, setUpdateHistory] = useState<Record<string, any[]>>({});
  // Trigger to force refresh updates after save
  const [updateHistoryTrigger, setUpdateHistoryTrigger] = useState(0);
  
  // Lade Updates für alle Bot Types wenn sie sich ändern
  useEffect(() => {
    if (botTypes.length === 0) return;
    
    const fetchAllUpdates = async () => {
      const history: Record<string, any[]> = {};
      
      for (const bt of botTypes) {
        try {
          // Add cache-busting to prevent 304 responses
          const response = await fetch(`/api/bot-types/${bt.id}/updates`, {
            headers: {
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          });
          if (response.ok) {
            const updates: BotTypeUpdate[] = await response.json();
            // WICHTIG: Sortiere nach createdAt (neueste zuerst) um korrektes "letztes Update" zu finden
            const sortedUpdates = [...updates].sort((a, b) => {
              const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
              const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
              return dateB - dateA;
            });
            history[bt.name] = sortedUpdates.map(u => ({
              updateName: `${u.status} #${u.version}`,
              updateDate: u.createdAt ? new Date(u.createdAt).toLocaleDateString('de-DE') : '',
              updateTime: u.createdAt ? new Date(u.createdAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '',
              status: u.status, // WICHTIG: Status speichern für Filterung nach Modus
            }));
          } else {
            history[bt.name] = [];
          }
        } catch (error) {
          console.error(`Error fetching updates for ${bt.name}:`, error);
          history[bt.name] = [];
        }
      }
      
      setUpdateHistory(history);
    };
    
    fetchAllUpdates();
  }, [botTypes, updateHistoryTrigger]);
  
  const [formData, setFormData] = useState({
    date: '',
    botName: '',
    botType: '',
    version: '',
    botDirection: '',
    investment: '',
    extraMargin: '',
    totalInvestment: '',
    profit: '',
    profitPercent: '',
    periodType: 'Tag',
    longestRuntime: '',
    avgRuntime: '',
    uploadRuntime: '',
    lastUpload: '',
    thisUpload: '',
    avgGridProfitHour: '',
    avgGridProfitDay: '',
    avgGridProfitWeek: '',
    lastAvgGridProfitHour: '',
    lastAvgGridProfitDay: '',
    lastAvgGridProfitWeek: '',
    lastHighestGridProfit: '',
    // Change-Werte für alle 6 Kombinationen (3 Zeiträume × 2 Einheiten)
    changeHourDollar: '',
    changeHourPercent: '',
    changeDayDollar: '',
    changeDayPercent: '',
    changeWeekDollar: '',
    changeWeekPercent: '',
    overallTrendPnlUsdt: '',
    overallTrendPnlPercent: '',
    highestGridProfit: '',
    highestGridProfitPercent: '',
    overallGridProfitUsdt: '',
    overallGridProfitPercent: '',
    avgGridProfitUsdt: '',  // Durchschnitt = Gesamter Grid Profit / Anzahl Screenshots
    avgGridProfitPercent: '',
    avgGridProfitChange: '',
    avgGridProfitChangeDollar: '',
    avgGridProfitChangePercent: '',
    leverage: '',
    botCount: '', // Anzahl der Bots/Screenshots
    notes: '', // Notizen (wird NICHT an AI gesendet)
  });
  
  // Notizen-Section State
  const [notesEditMode, setNotesEditMode] = useState(true); // Startet im Edit-Modus
  const [savedNotes, setSavedNotes] = useState(''); // Gespeicherte Notizen für Cancel

  // Hilfsfunktion: Ermittelt das Vorzeichen eines Wertes für die visuelle Anzeige
  const getSignPrefix = (value: string): string => {
    if (!value || value === '' || value === '0' || value === '0.00') return '';
    const num = parseFloat(value);
    if (isNaN(num) || num === 0) return '';
    return num > 0 ? '+' : '';  // "-" ist bereits im Wert enthalten
  };

  // Hilfsfunktion: Deutsches Dezimalformat (Komma statt Punkt)
  const formatGermanDecimal = (value: string): string => {
    if (!value || value === '') return '';
    return value.replace('.', ',');
  };

  const [investmentTimeRange, setInvestmentTimeRange] = useState("Neu");
  const [profitTimeRange, setProfitTimeRange] = useState("Neu");
  const [trendTimeRange, setTrendTimeRange] = useState("Neu");
  const [gridTimeRange, setGridTimeRange] = useState("Neu");
  const [outputMode, setOutputMode] = useState<'update-metrics' | 'closed-bots'>('update-metrics');
  
  const [profitPercentBase, setProfitPercentBase] = useState<'gesamtinvestment' | 'investitionsmenge'>('gesamtinvestment');
  const [trendPercentBase, setTrendPercentBase] = useState<'gesamtinvestment' | 'investitionsmenge'>('gesamtinvestment');
  const [gridProfitPercentBase, setGridProfitPercentBase] = useState<'gesamtinvestment' | 'investitionsmenge'>('gesamtinvestment');
  const [highestGridProfitPercentBase, setHighestGridProfitPercentBase] = useState<'gesamtinvestment' | 'investitionsmenge'>('gesamtinvestment');
  const [avgGridProfitPercentBase, setAvgGridProfitPercentBase] = useState<'gesamtinvestment' | 'investitionsmenge' | 'vergleich'>('gesamtinvestment');
  const [avgGridProfitChangeUnit, setAvgGridProfitChangeUnit] = useState<'%' | '$'>('%');
  const [chainedUnit, setChainedUnit] = useState<'%' | '$'>('%');
  const [selectedChangeTimeframe, setSelectedChangeTimeframe] = useState<'hour' | 'day' | 'week'>('hour');

  // AI-berechnete Prozentwerte speichern (für Umschaltung zwischen Gesamtinvestment/Investitionsmenge)
  const [calculatedPercents, setCalculatedPercents] = useState({
    profitPercent_gesamtinvestment: '',
    profitPercent_investitionsmenge: '',
    overallTrendPnlPercent_gesamtinvestment: '',
    overallTrendPnlPercent_investitionsmenge: '',
    overallGridProfitPercent_gesamtinvestment: '',
    overallGridProfitPercent_investitionsmenge: '',
    highestGridProfitPercent_gesamtinvestment: '',
    highestGridProfitPercent_investitionsmenge: '',
    avgGridProfitPercent_gesamtinvestment: '',
    avgGridProfitPercent_investitionsmenge: '',
  });

  // ========== CLOSED BOTS - PARALLELE STATE-CONTAINER ==========
  // Separate States für Closed Bots Modus (identisch zu Update Metrics, aber unabhängig)
  
  const [closedScreenshotsSent, setClosedScreenshotsSent] = useState(false);
  const [closedBotTypeSent, setClosedBotTypeSent] = useState(false);
  const closedPhaseOneComplete = closedScreenshotsSent && closedBotTypeSent;
  const [closedPhaseTwoVerified, setClosedPhaseTwoVerified] = useState(false);
  const [closedPhaseTwoStep2Complete, setClosedPhaseTwoStep2Complete] = useState(false);
  const [closedInfoSectionMode, setClosedInfoSectionMode] = useState<'Normal' | 'Startmetrik'>('Normal');
  const [closedPhaseThreeSettingsSent, setClosedPhaseThreeSettingsSent] = useState(false);
  const [closedWaitingForPhaseThreeConfirmation, setClosedWaitingForPhaseThreeConfirmation] = useState(false);
  const [closedExtractedScreenshotData, setClosedExtractedScreenshotData] = useState<any>(null);
  
  const [closedFormData, setClosedFormData] = useState({
    date: '',
    botName: '',
    botType: '',
    version: '',
    botDirection: '',
    investment: '',
    extraMargin: '',
    totalInvestment: '',
    profit: '',
    profitPercent: '',
    periodType: 'Tag',
    longestRuntime: '',
    avgRuntime: '',
    uploadRuntime: '',
    lastUpload: '',
    thisUpload: '',
    avgGridProfitHour: '',
    avgGridProfitDay: '',
    avgGridProfitWeek: '',
    lastAvgGridProfitHour: '',
    lastAvgGridProfitDay: '',
    lastAvgGridProfitWeek: '',
    lastHighestGridProfit: '',
    changeHourDollar: '',
    changeHourPercent: '',
    changeDayDollar: '',
    changeDayPercent: '',
    changeWeekDollar: '',
    changeWeekPercent: '',
    overallTrendPnlUsdt: '',
    overallTrendPnlPercent: '',
    highestGridProfit: '',
    highestGridProfitPercent: '',
    overallGridProfitUsdt: '',
    overallGridProfitPercent: '',
    avgGridProfitUsdt: '',
    avgGridProfitPercent: '',
    avgGridProfitChange: '',
    avgGridProfitChangeDollar: '',
    avgGridProfitChangePercent: '',
    leverage: '',
    botCount: '',
    notes: '',
  });
  
  const [closedInvestmentTimeRange, setClosedInvestmentTimeRange] = useState("Neu");
  const [closedProfitTimeRange, setClosedProfitTimeRange] = useState("Neu");
  const [closedTrendTimeRange, setClosedTrendTimeRange] = useState("Neu");
  const [closedGridTimeRange, setClosedGridTimeRange] = useState("Neu");
  
  const [closedProfitPercentBase, setClosedProfitPercentBase] = useState<'gesamtinvestment' | 'investitionsmenge'>('gesamtinvestment');
  const [closedTrendPercentBase, setClosedTrendPercentBase] = useState<'gesamtinvestment' | 'investitionsmenge'>('gesamtinvestment');
  const [closedGridProfitPercentBase, setClosedGridProfitPercentBase] = useState<'gesamtinvestment' | 'investitionsmenge'>('gesamtinvestment');
  const [closedHighestGridProfitPercentBase, setClosedHighestGridProfitPercentBase] = useState<'gesamtinvestment' | 'investitionsmenge'>('gesamtinvestment');
  const [closedAvgGridProfitPercentBase, setClosedAvgGridProfitPercentBase] = useState<'gesamtinvestment' | 'investitionsmenge'>('gesamtinvestment');
  const [closedChainedUnit, setClosedChainedUnit] = useState<'%' | '$'>('%');
  const [closedSelectedChangeTimeframe, setClosedSelectedChangeTimeframe] = useState<'hour' | 'day' | 'week'>('hour');
  const [closedAvgGridProfitChangeUnit, setClosedAvgGridProfitChangeUnit] = useState<'%' | '$'>('%');
  
  const [closedCalculatedPercents, setClosedCalculatedPercents] = useState({
    profitPercent_gesamtinvestment: '',
    profitPercent_investitionsmenge: '',
    overallTrendPnlPercent_gesamtinvestment: '',
    overallTrendPnlPercent_investitionsmenge: '',
    overallGridProfitPercent_gesamtinvestment: '',
    overallGridProfitPercent_investitionsmenge: '',
    highestGridProfitPercent_gesamtinvestment: '',
    highestGridProfitPercent_investitionsmenge: '',
    avgGridProfitPercent_gesamtinvestment: '',
    avgGridProfitPercent_investitionsmenge: '',
  });
  
  // Manuelle Überschreibungen für Closed Bots
  const closedManualOverridesRef = useRef<{
    overallGridProfitUsdt?: string;
    lastUpload?: string;
    investment?: string;
    extraMargin?: string;
    avgRuntime?: string;
    uploadRuntime?: string;
  }>({});
  const [closedManualOverridesVersion, setClosedManualOverridesVersion] = useState(0);
  const closedManualOverrides = closedManualOverridesRef.current;
  const setClosedManualOverrides = (newValue: typeof closedManualOverrides | ((prev: typeof closedManualOverrides) => typeof closedManualOverrides)) => {
    if (typeof newValue === 'function') {
      closedManualOverridesRef.current = newValue(closedManualOverridesRef.current);
    } else {
      closedManualOverridesRef.current = newValue;
    }
    setClosedManualOverridesVersion(v => v + 1);
  };
  
  const [closedPhase2Completed, setClosedPhase2Completed] = useState(false);
  
  // ========== HELPER: Aktive States basierend auf outputMode ==========
  // Diese Getter geben die richtigen States für den aktuellen Modus zurück
  const getActiveFormData = () => outputMode === 'update-metrics' ? formData : closedFormData;
  const getActiveSetFormData = () => outputMode === 'update-metrics' ? setFormData : setClosedFormData;
  const getActiveScreenshotsSent = () => outputMode === 'update-metrics' ? screenshotsSent : closedScreenshotsSent;
  const getActiveBotTypeSent = () => outputMode === 'update-metrics' ? botTypeSent : closedBotTypeSent;
  const getActivePhaseOneComplete = () => outputMode === 'update-metrics' ? phaseOneComplete : closedPhaseOneComplete;
  const getActivePhaseTwoVerified = () => outputMode === 'update-metrics' ? phaseTwoVerified : closedPhaseTwoVerified;
  const getActiveExtractedData = () => outputMode === 'update-metrics' ? extractedScreenshotData : closedExtractedScreenshotData;
  const getActiveInfoSectionMode = () => outputMode === 'update-metrics' ? infoSectionMode : closedInfoSectionMode;
  const getActiveIsStartMetric = () => outputMode === 'update-metrics' ? isStartMetric : closedIsStartMetric;
  const getActiveSelectedBotTypeId = () => outputMode === 'update-metrics' ? selectedBotTypeId : closedSelectedBotTypeId;
  const getActiveManualOverridesRef = () => outputMode === 'update-metrics' ? manualOverridesRef : closedManualOverridesRef;
  const getActivePhaseTwoStep2Complete = () => outputMode === 'update-metrics' ? phaseTwoStep2Complete : closedPhaseTwoStep2Complete;
  const getActiveWaitingForPhaseThreeConfirmation = () => outputMode === 'update-metrics' ? waitingForPhaseThreeConfirmation : closedWaitingForPhaseThreeConfirmation;
  
  // Mode-aware Handler für Bot-Typ-Auswahl
  const handleSelectBotType = (botTypeId: string | null) => {
    if (outputMode === 'update-metrics') {
      setSelectedBotTypeId(botTypeId);
    } else {
      setClosedSelectedBotTypeId(botTypeId);
    }
  };
  
  // ========== END CLOSED BOTS STATES ==========

  // Manuelle Überschreibungswerte (nur bei 1 Screenshot)
  // Überschreibbare Felder: overallGridProfitUsdt, lastUpload, investment, extraMargin, avgRuntime, uploadRuntime
  // WICHTIG: Verwende useRef statt useState um zu verhindern, dass Re-Renders die Werte löschen
  const manualOverridesRef = useRef<{
    overallGridProfitUsdt?: string;
    lastUpload?: string;
    investment?: string;
    extraMargin?: string;
    avgRuntime?: string;
    uploadRuntime?: string;
  }>({});
  // State nur für UI-Updates (Re-Render bei Änderungen)
  const [manualOverridesVersion, setManualOverridesVersion] = useState(0);
  // Getter für aktuelle Werte
  const manualOverrides = manualOverridesRef.current;
  // Setter der auch Re-Render triggert
  const setManualOverrides = (newValue: typeof manualOverrides | ((prev: typeof manualOverrides) => typeof manualOverrides)) => {
    if (typeof newValue === 'function') {
      manualOverridesRef.current = newValue(manualOverridesRef.current);
    } else {
      manualOverridesRef.current = newValue;
    }
    setManualOverridesVersion(v => v + 1);
  };
  
  // Flag um zu tracken ob Phase 2 schon Werte extrahiert hat
  const [phase2Completed, setPhase2Completed] = useState(false);
  // Referenz auf die Anzahl der ausgewählten Dateien um NEUE Uploads zu erkennen
  const lastSelectedFilesCountRef = useRef<number>(0);
  // Flag ob manuelle Overrides erlaubt sind (wird nur bei neuem Datei-Upload zurückgesetzt)
  const overridesLockedRef = useRef<boolean>(false);
  
  // Reset manualOverrides NUR wenn NEUE Dateien ausgewählt werden (nicht bei Daten-Updates)
  useEffect(() => {
    const currentFileCount = selectedFiles.length;
    
    // Nur zurücksetzen wenn sich die Anzahl der ausgewählten Dateien GEÄNDERT hat (neuer Upload)
    if (currentFileCount !== lastSelectedFilesCountRef.current) {
      console.log('Neue Dateien ausgewählt, reset manualOverrides:', currentFileCount, 'Dateien');
      manualOverridesRef.current = {};
      lastSelectedFilesCountRef.current = currentFileCount;
      overridesLockedRef.current = false;
      setManualOverridesVersion(v => v + 1);
    }
  }, [selectedFiles.length]);
  
  // Phase2Completed setzen wenn Daten vorhanden sind
  useEffect(() => {
    if (extractedScreenshotData) {
      setPhase2Completed(true);
    } else {
      setPhase2Completed(false);
    }
  }, [extractedScreenshotData]);
  
  // Helper: Setze manuellen Override wenn Benutzer nach Phase 2 einen Wert ändert
  const handleManualOverride = (field: 'overallGridProfitUsdt' | 'lastUpload' | 'investment' | 'extraMargin' | 'avgRuntime' | 'uploadRuntime', value: string) => {
    // Nur tracken wenn Phase 2 abgeschlossen ist UND nur 1 Screenshot
    // WICHTIG: Verwende phaseTwoVerified (steuert UI-Aktivierung) UND phase2Completed (Screenshot-Daten vorhanden)
    const screenshotCount = extractedScreenshotData?.screenshots?.length || 0;
    const canOverride = (phaseTwoVerified || phase2Completed) && screenshotCount === 1;
    
    console.log('handleManualOverride called:', { 
      field, 
      value, 
      phaseTwoVerified, 
      phase2Completed, 
      screenshotCount, 
      canOverride 
    });
    
    if (canOverride) {
      if (value.trim() !== '') {
        console.log('Setting manual override:', field, '=', value);
        manualOverridesRef.current = { ...manualOverridesRef.current, [field]: value };
        setManualOverridesVersion(v => v + 1);
      } else {
        // Entferne das Override wenn der Wert leer ist
        const newOverrides = { ...manualOverridesRef.current };
        delete newOverrides[field];
        manualOverridesRef.current = newOverrides;
        setManualOverridesVersion(v => v + 1);
      }
    }
  };

  // Profit Prozent: Nutze gespeicherte AI-Werte beim Umschalten
  useEffect(() => {
    console.log('Profit useEffect triggered:', { 
      profitPercentBase, 
      gesamtinvestment: calculatedPercents.profitPercent_gesamtinvestment,
      investitionsmenge: calculatedPercents.profitPercent_investitionsmenge 
    });
    
    if (profitPercentBase === 'gesamtinvestment') {
      const newValue = calculatedPercents.profitPercent_gesamtinvestment || '';
      console.log('Setting profitPercent to gesamtinvestment value:', newValue);
      setFormData(prev => ({ ...prev, profitPercent: newValue }));
    } else if (profitPercentBase === 'investitionsmenge') {
      const newValue = calculatedPercents.profitPercent_investitionsmenge || '';
      console.log('Setting profitPercent to investitionsmenge value:', newValue);
      setFormData(prev => ({ ...prev, profitPercent: newValue }));
    }
  }, [profitPercentBase, calculatedPercents.profitPercent_gesamtinvestment, calculatedPercents.profitPercent_investitionsmenge]);

  // Trend P&L Prozent: Nutze gespeicherte AI-Werte beim Umschalten
  useEffect(() => {
    if (trendPercentBase === 'gesamtinvestment') {
      const newValue = calculatedPercents.overallTrendPnlPercent_gesamtinvestment || '';
      setFormData(prev => ({ ...prev, overallTrendPnlPercent: newValue }));
    } else if (trendPercentBase === 'investitionsmenge') {
      const newValue = calculatedPercents.overallTrendPnlPercent_investitionsmenge || '';
      setFormData(prev => ({ ...prev, overallTrendPnlPercent: newValue }));
    }
  }, [trendPercentBase, calculatedPercents.overallTrendPnlPercent_gesamtinvestment, calculatedPercents.overallTrendPnlPercent_investitionsmenge]);

  // Grid Profit Prozent: Direkt aus overallGridProfitUsdt berechnen (wie avgGridProfitPercent)
  // Formel: (overallGridProfitUsdt / Investment-Basis) × 100
  useEffect(() => {
    const gridProfitUsdtValue = parseFloat(formData.overallGridProfitUsdt || '0');
    const totalInvestmentValue = parseFloat(formData.totalInvestment || '0');
    const investmentValue = parseFloat(formData.investment || '0');
    
    let newPercent = '';
    if (gridProfitUsdtValue !== 0) {
      if (gridProfitPercentBase === 'gesamtinvestment' && totalInvestmentValue > 0) {
        newPercent = ((gridProfitUsdtValue / totalInvestmentValue) * 100).toFixed(2);
      } else if (gridProfitPercentBase === 'investitionsmenge' && investmentValue > 0) {
        newPercent = ((gridProfitUsdtValue / investmentValue) * 100).toFixed(2);
      }
    }
    setFormData(prev => ({ ...prev, overallGridProfitPercent: newPercent }));
  }, [formData.overallGridProfitUsdt, formData.totalInvestment, formData.investment, gridProfitPercentBase]);

  // Highest Grid Profit Prozent: Nutze gespeicherte AI-Werte beim Umschalten
  useEffect(() => {
    if (highestGridProfitPercentBase === 'gesamtinvestment') {
      const newValue = calculatedPercents.highestGridProfitPercent_gesamtinvestment || '';
      setFormData(prev => ({ ...prev, highestGridProfitPercent: newValue }));
    } else if (highestGridProfitPercentBase === 'investitionsmenge') {
      const newValue = calculatedPercents.highestGridProfitPercent_investitionsmenge || '';
      setFormData(prev => ({ ...prev, highestGridProfitPercent: newValue }));
    }
  }, [highestGridProfitPercentBase, calculatedPercents.highestGridProfitPercent_gesamtinvestment, calculatedPercents.highestGridProfitPercent_investitionsmenge]);

  // Ø Grid Profit Prozent: Direkt aus avgGridProfitUsdt berechnen
  // Formel: (avgGridProfitUsdt / Investment-Basis) × 100
  useEffect(() => {
    const avgGridProfitUsdtValue = parseFloat(formData.avgGridProfitUsdt || '0');
    const totalInvestmentValue = parseFloat(formData.totalInvestment || '0');
    const investmentValue = parseFloat(formData.investment || '0');
    
    let newPercent = '';
    if (avgGridProfitUsdtValue !== 0) {
      if (avgGridProfitPercentBase === 'gesamtinvestment' && totalInvestmentValue > 0) {
        newPercent = ((avgGridProfitUsdtValue / totalInvestmentValue) * 100).toFixed(2);
      } else if (avgGridProfitPercentBase === 'investitionsmenge' && investmentValue > 0) {
        newPercent = ((avgGridProfitUsdtValue / investmentValue) * 100).toFixed(2);
      }
    }
    setFormData(prev => ({ ...prev, avgGridProfitPercent: newPercent }));
  }, [formData.avgGridProfitUsdt, formData.totalInvestment, formData.investment, avgGridProfitPercentBase]);

  // ========== CLOSED BOTS: Parallele Prozent-Umschaltung ==========
  // Diese useEffects reagieren auf die Closed Bots Dropdown-Änderungen
  
  // Closed Bots: Profit Prozent Umschaltung
  useEffect(() => {
    if (closedProfitPercentBase === 'gesamtinvestment') {
      const newValue = closedCalculatedPercents.profitPercent_gesamtinvestment || '';
      setClosedFormData(prev => ({ ...prev, profitPercent: newValue }));
    } else if (closedProfitPercentBase === 'investitionsmenge') {
      const newValue = closedCalculatedPercents.profitPercent_investitionsmenge || '';
      setClosedFormData(prev => ({ ...prev, profitPercent: newValue }));
    }
  }, [closedProfitPercentBase, closedCalculatedPercents.profitPercent_gesamtinvestment, closedCalculatedPercents.profitPercent_investitionsmenge]);

  // Closed Bots: Trend P&L Prozent Umschaltung
  useEffect(() => {
    if (closedTrendPercentBase === 'gesamtinvestment') {
      const newValue = closedCalculatedPercents.overallTrendPnlPercent_gesamtinvestment || '';
      setClosedFormData(prev => ({ ...prev, overallTrendPnlPercent: newValue }));
    } else if (closedTrendPercentBase === 'investitionsmenge') {
      const newValue = closedCalculatedPercents.overallTrendPnlPercent_investitionsmenge || '';
      setClosedFormData(prev => ({ ...prev, overallTrendPnlPercent: newValue }));
    }
  }, [closedTrendPercentBase, closedCalculatedPercents.overallTrendPnlPercent_gesamtinvestment, closedCalculatedPercents.overallTrendPnlPercent_investitionsmenge]);

  // Closed Bots: Grid Profit Prozent (direkte Berechnung aus USDT-Werten)
  useEffect(() => {
    const gridProfitUsdtValue = parseFloat(closedFormData.overallGridProfitUsdt || '0');
    const totalInvestmentValue = parseFloat(closedFormData.totalInvestment || '0');
    const investmentValue = parseFloat(closedFormData.investment || '0');
    
    let newPercent = '';
    if (gridProfitUsdtValue !== 0) {
      if (closedGridProfitPercentBase === 'gesamtinvestment' && totalInvestmentValue > 0) {
        newPercent = ((gridProfitUsdtValue / totalInvestmentValue) * 100).toFixed(2);
      } else if (closedGridProfitPercentBase === 'investitionsmenge' && investmentValue > 0) {
        newPercent = ((gridProfitUsdtValue / investmentValue) * 100).toFixed(2);
      }
    }
    setClosedFormData(prev => ({ ...prev, overallGridProfitPercent: newPercent }));
  }, [closedFormData.overallGridProfitUsdt, closedFormData.totalInvestment, closedFormData.investment, closedGridProfitPercentBase]);

  // Closed Bots: Highest Grid Profit Prozent Umschaltung
  useEffect(() => {
    if (closedHighestGridProfitPercentBase === 'gesamtinvestment') {
      const newValue = closedCalculatedPercents.highestGridProfitPercent_gesamtinvestment || '';
      setClosedFormData(prev => ({ ...prev, highestGridProfitPercent: newValue }));
    } else if (closedHighestGridProfitPercentBase === 'investitionsmenge') {
      const newValue = closedCalculatedPercents.highestGridProfitPercent_investitionsmenge || '';
      setClosedFormData(prev => ({ ...prev, highestGridProfitPercent: newValue }));
    }
  }, [closedHighestGridProfitPercentBase, closedCalculatedPercents.highestGridProfitPercent_gesamtinvestment, closedCalculatedPercents.highestGridProfitPercent_investitionsmenge]);

  // Closed Bots: Ø Grid Profit Prozent (direkte Berechnung)
  useEffect(() => {
    const avgGridProfitUsdtValue = parseFloat(closedFormData.avgGridProfitUsdt || '0');
    const totalInvestmentValue = parseFloat(closedFormData.totalInvestment || '0');
    const investmentValue = parseFloat(closedFormData.investment || '0');
    
    let newPercent = '';
    if (avgGridProfitUsdtValue !== 0) {
      if (closedAvgGridProfitPercentBase === 'gesamtinvestment' && totalInvestmentValue > 0) {
        newPercent = ((avgGridProfitUsdtValue / totalInvestmentValue) * 100).toFixed(2);
      } else if (closedAvgGridProfitPercentBase === 'investitionsmenge' && investmentValue > 0) {
        newPercent = ((avgGridProfitUsdtValue / investmentValue) * 100).toFixed(2);
      }
    }
    setClosedFormData(prev => ({ ...prev, avgGridProfitPercent: newPercent }));
  }, [closedFormData.avgGridProfitUsdt, closedFormData.totalInvestment, closedFormData.investment, closedAvgGridProfitPercentBase]);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      // MODUSABHÄNGIG: Verwende den korrekten State-Container basierend auf outputMode
      const isClosedBotsMode = outputMode === 'closed-bots';
      const activeFormData = isClosedBotsMode ? closedFormData : formData;
      const activeCalculatedPercents = isClosedBotsMode ? closedCalculatedPercents : calculatedPercents;
      const activeBotTypeId = isClosedBotsMode ? closedSelectedBotTypeId : selectedBotTypeId;
      const activeCalculationMode = isClosedBotsMode ? closedCalculationMode : calculationMode;
      
      if (!activeBotTypeId) {
        throw new Error('Kein Bot-Typ ausgewählt');
      }

      // Berechne beide Prozentbasen für alle Felder
      const investmentValue = parseFloat(activeFormData.investment || '0');
      const totalInvestmentValue = parseFloat(activeFormData.totalInvestment || '0');
      const profitValue = parseFloat(activeFormData.profit || '0');
      const trendValue = parseFloat(activeFormData.overallTrendPnlUsdt || '0');
      const gridValue = parseFloat(activeFormData.overallGridProfitUsdt || '0');
      const highestValue = parseFloat(activeFormData.highestGridProfit || '0');

      // Profit Prozent - beide Basen
      let profitPercent_gesamtinvestment: string | null = null;
      let profitPercent_investitionsmenge: string | null = null;
      if (profitTimeRange === 'Neu') {
        if (totalInvestmentValue > 0) {
          profitPercent_gesamtinvestment = ((profitValue / totalInvestmentValue) * 100).toFixed(2);
        }
        if (investmentValue > 0) {
          profitPercent_investitionsmenge = ((profitValue / investmentValue) * 100).toFixed(2);
        }
      } else if (profitTimeRange === 'Vergleich') {
        // Bei Vergleich: Nutze AI-berechnete Differenz-Werte
        profitPercent_gesamtinvestment = activeCalculatedPercents.profitPercent_gesamtinvestment || null;
        profitPercent_investitionsmenge = activeCalculatedPercents.profitPercent_investitionsmenge || null;
      }

      // Trend P&L Prozent - beide Basen
      let trendPercent_gesamtinvestment: string | null = null;
      let trendPercent_investitionsmenge: string | null = null;
      if (trendTimeRange === 'Neu') {
        if (totalInvestmentValue > 0) {
          trendPercent_gesamtinvestment = ((trendValue / totalInvestmentValue) * 100).toFixed(2);
        }
        if (investmentValue > 0) {
          trendPercent_investitionsmenge = ((trendValue / investmentValue) * 100).toFixed(2);
        }
      } else if (trendTimeRange === 'Vergleich') {
        // Bei Vergleich: Nutze AI-berechnete Differenz-Werte
        trendPercent_gesamtinvestment = activeCalculatedPercents.overallTrendPnlPercent_gesamtinvestment || null;
        trendPercent_investitionsmenge = activeCalculatedPercents.overallTrendPnlPercent_investitionsmenge || null;
      }

      // Overall Grid Profit Prozent - beide Basen
      // IMMER aus dem angezeigten USDT-Wert berechnen (egal ob Neu oder Vergleich)
      let gridPercent_gesamtinvestment: string | null = null;
      let gridPercent_investitionsmenge: string | null = null;
      if (totalInvestmentValue > 0) {
        gridPercent_gesamtinvestment = ((gridValue / totalInvestmentValue) * 100).toFixed(2);
      }
      if (investmentValue > 0) {
        gridPercent_investitionsmenge = ((gridValue / investmentValue) * 100).toFixed(2);
      }

      // Highest Grid Profit Prozent - beide Basen
      let highestPercent_gesamtinvestment: string | null = null;
      let highestPercent_investitionsmenge: string | null = null;
      if (gridTimeRange === 'Neu') {
        if (totalInvestmentValue > 0) {
          highestPercent_gesamtinvestment = ((highestValue / totalInvestmentValue) * 100).toFixed(2);
        }
        if (investmentValue > 0) {
          highestPercent_investitionsmenge = ((highestValue / investmentValue) * 100).toFixed(2);
        }
      } else if (gridTimeRange === 'Vergleich') {
        // Bei Vergleich: Nutze AI-berechnete Differenz-Werte
        highestPercent_gesamtinvestment = activeCalculatedPercents.highestGridProfitPercent_gesamtinvestment || null;
        highestPercent_investitionsmenge = activeCalculatedPercents.highestGridProfitPercent_investitionsmenge || null;
      }

      // Erstelle Update-Daten (MODUSABHÄNGIG)
      const updateData = {
        botTypeId: activeBotTypeId,
        version: parseInt(activeFormData.version) || 1,
        status: outputMode === 'update-metrics' ? 'Update Metrics' : 'Closed Bots',
        
        // Info Section (keine Modi)
        date: activeFormData.date || null,
        botDirection: activeFormData.botDirection || null,
        leverage: activeFormData.leverage || null,
        longestRuntime: activeFormData.longestRuntime || null,
        avgRuntime: activeFormData.avgRuntime || null,
        uploadRuntime: activeFormData.uploadRuntime || null,
        lastUpload: activeFormData.lastUpload || null,
        thisUpload: activeFormData.thisUpload || null,
        
        // Investment Section
        investment: activeFormData.investment || null,
        extraMargin: activeFormData.extraMargin || null,
        totalInvestment: activeFormData.totalInvestment || null,
        
        // Profit Section
        profit: activeFormData.profit || null,
        profitPercent_gesamtinvestment,
        profitPercent_investitionsmenge,
        
        // Trend P&L Section
        overallTrendPnlUsdt: activeFormData.overallTrendPnlUsdt || null,
        overallTrendPnlPercent_gesamtinvestment: trendPercent_gesamtinvestment,
        overallTrendPnlPercent_investitionsmenge: trendPercent_investitionsmenge,
        
        // Grid Trading Section
        overallGridProfitUsdt: activeFormData.overallGridProfitUsdt || null,
        overallGridProfitPercent_gesamtinvestment: gridPercent_gesamtinvestment,
        overallGridProfitPercent_investitionsmenge: gridPercent_investitionsmenge,
        highestGridProfit: activeFormData.highestGridProfit || null,
        highestGridProfitPercent_gesamtinvestment: highestPercent_gesamtinvestment,
        highestGridProfitPercent_investitionsmenge: highestPercent_investitionsmenge,
        avgGridProfitUsdt: activeFormData.avgGridProfitUsdt || null,
        avgGridProfitHour: activeFormData.avgGridProfitHour || null,
        avgGridProfitDay: activeFormData.avgGridProfitDay || null,
        avgGridProfitWeek: activeFormData.avgGridProfitWeek || null,
        
        // Last Grid Profit Durchschnitt (vom vorherigen Upload)
        lastAvgGridProfitHour: activeFormData.lastAvgGridProfitHour || null,
        lastAvgGridProfitDay: activeFormData.lastAvgGridProfitDay || null,
        lastAvgGridProfitWeek: activeFormData.lastAvgGridProfitWeek || null,
        
        // Change-Werte (6 Kombinationen: 3 Zeiträume x 2 Einheiten)
        changeHourDollar: activeFormData.changeHourDollar || null,
        changeHourPercent: activeFormData.changeHourPercent || null,
        changeDayDollar: activeFormData.changeDayDollar || null,
        changeDayPercent: activeFormData.changeDayPercent || null,
        changeWeekDollar: activeFormData.changeWeekDollar || null,
        changeWeekPercent: activeFormData.changeWeekPercent || null,
        
        // Screenshot-Anzahl
        screenshotCount: activeFormData.botCount || null,
        
        // Berechnungsmodus (Normal oder Startmetrik)
        calculationMode: activeCalculationMode,
        
        // Notizen Section (keine Modi, wird NICHT an AI gesendet)
        notes: activeFormData.notes || null,
      };

      return await apiRequest('POST', `/api/bot-types/${activeBotTypeId}/updates`, updateData);
    },
    onSuccess: () => {
      // MODUSABHÄNGIG: Verwende den korrekten State-Container basierend auf outputMode
      const isClosedBotsMode = outputMode === 'closed-bots';
      const activeBotTypeIdForSuccess = isClosedBotsMode ? closedSelectedBotTypeId : selectedBotTypeId;
      
      // Notify Bot Types page about the update (will show confirmation dialog if modal is open)
      notifyUpdate();
      
      // Also invalidate queries for this page's own data
      if (activeBotTypeIdForSuccess) {
        queryClient.invalidateQueries({ queryKey: ['/api/bot-types', activeBotTypeIdForSuccess, 'updates'] });
      }
      // Invalidate all bot-type-updates query to refresh data on Bot Types page
      queryClient.invalidateQueries({ queryKey: ['/api/bot-type-updates'] });
      
      // Force refresh of update history to get the latest data (for isStartMetric check)
      setUpdateHistoryTrigger(prev => prev + 1);
      
      const modeText = isClosedBotsMode ? 'Closed Bots' : 'Update Metrics';
      toast({
        title: "Erfolgreich gespeichert",
        description: `Das ${modeText} Update wurde erfolgreich gespeichert.`,
      });
      
      // Reset based on mode
      if (isClosedBotsMode) {
        // Reset Closed Bots state
        setClosedFormData(prev => ({
          ...prev,
          version: '',
          date: '',
          botName: '',
          investment: '',
          extraMargin: '',
          totalInvestment: '',
          profit: '',
          profitPercent: '',
          periodType: 'Tag',
          longestRuntime: '',
          avgRuntime: '',
          uploadRuntime: '',
          lastUpload: '',
          thisUpload: '',
          avgGridProfitHour: '',
          avgGridProfitDay: '',
          avgGridProfitWeek: '',
          lastAvgGridProfitHour: '',
          lastAvgGridProfitDay: '',
          lastAvgGridProfitWeek: '',
          changeHourDollar: '',
          changeHourPercent: '',
          changeDayDollar: '',
          changeDayPercent: '',
          changeWeekDollar: '',
          changeWeekPercent: '',
          overallTrendPnlUsdt: '',
          overallTrendPnlPercent: '',
          highestGridProfit: '',
          highestGridProfitPercent: '',
          overallGridProfitUsdt: '',
          overallGridProfitPercent: '',
          avgGridProfitUsdt: '',
          avgGridProfitPercent: '',
          avgGridProfitChange: '',
          avgGridProfitChangeDollar: '',
          avgGridProfitChangePercent: '',
          leverage: '',
          botCount: '',
          notes: '',
        }));
        // Reset Closed Bots AI state
        setClosedPhase2Completed(false);
        setClosedPhaseTwoStep2Complete(false);
        setClosedIsStartMetric(false);
        setClosedCalculationMode('Normal');
        setClosedCalculatedPercents({
          profitPercent_gesamtinvestment: '',
          profitPercent_investitionsmenge: '',
          overallTrendPnlPercent_gesamtinvestment: '',
          overallTrendPnlPercent_investitionsmenge: '',
          overallGridProfitPercent_gesamtinvestment: '',
          overallGridProfitPercent_investitionsmenge: '',
          highestGridProfitPercent_gesamtinvestment: '',
          highestGridProfitPercent_investitionsmenge: '',
          avgGridProfitPercent_gesamtinvestment: '',
          avgGridProfitPercent_investitionsmenge: '',
        });
        setClosedExtractedScreenshotData(null);
        setClosedInfoSectionMode('Normal');
        // Reset Closed Bots percent bases
        setClosedProfitPercentBase('gesamtinvestment');
        setClosedTrendPercentBase('gesamtinvestment');
        setClosedGridProfitPercentBase('gesamtinvestment');
        setClosedHighestGridProfitPercentBase('gesamtinvestment');
        setClosedAvgGridProfitPercentBase('gesamtinvestment');
      } else {
        // Reset Update Metrics state (original behavior)
        setSelectedFiles([]);
        setFormData(prev => ({
          ...prev,
          version: '',
          date: '',
          botName: '',
          investment: '',
          extraMargin: '',
          totalInvestment: '',
          profit: '',
          profitPercent: '',
          periodType: 'Tag',
          longestRuntime: '',
          avgRuntime: '',
          uploadRuntime: '',
          lastUpload: '',
          thisUpload: '',
          avgGridProfitHour: '',
          avgGridProfitDay: '',
          avgGridProfitWeek: '',
          lastAvgGridProfitHour: '',
          lastAvgGridProfitDay: '',
          lastAvgGridProfitWeek: '',
          changeHourDollar: '',
          changeHourPercent: '',
          changeDayDollar: '',
          changeDayPercent: '',
          changeWeekDollar: '',
          changeWeekPercent: '',
          overallTrendPnlUsdt: '',
          overallTrendPnlPercent: '',
          highestGridProfit: '',
          highestGridProfitPercent: '',
          overallGridProfitUsdt: '',
          overallGridProfitPercent: '',
          avgGridProfitUsdt: '',
          avgGridProfitPercent: '',
          avgGridProfitChange: '',
          avgGridProfitChangeDollar: '',
          avgGridProfitChangePercent: '',
          leverage: '',
          botCount: '',
          notes: '',
        }));
        // Reset Notizen-State
        setNotesEditMode(true);
        setSavedNotes('');
        
        // Reset Modi und Prozentbasen
        setInvestmentTimeRange("Neu");
        setProfitTimeRange("Neu");
        setTrendTimeRange("Neu");
        setGridTimeRange("Neu");
        setProfitPercentBase('gesamtinvestment');
        setTrendPercentBase('gesamtinvestment');
        setGridProfitPercentBase('gesamtinvestment');
        setHighestGridProfitPercentBase('gesamtinvestment');
        
        // Reset AI Chat
        setChatMessages([]);
        setScreenshotsSent(false);
        setBotTypeSent(false);
        setPhaseTwoVerified(false);
        setPhaseTwoStep2Complete(false);
        setPhaseThreeSettingsSent(false);
        setWaitingForPhaseThreeConfirmation(false);
        setIsStartMetric(false);
        setExtractedScreenshotData(null);
        setInfoSectionMode('Normal');
        setCalculationMode('Normal');
      }
      
      // Reset mode to Update Metrics after save
      setOutputMode('update-metrics');
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: error.message || "Das Update konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const convertFilesToBase64 = async (files: File[]): Promise<string[]> => {
    const promises = files.map(file => {
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    });
    return Promise.all(promises);
  };

  const handleSendToAI = async () => {
    if (selectedFiles.length === 0) {
      toast({
        title: "Keine Dateien",
        description: "Bitte laden Sie mindestens einen Screenshot hoch.",
        variant: "destructive",
      });
      return;
    }

    const fileCount = selectedFiles.length;
    const fileText = fileCount === 1 ? 'Bild wurde' : 'Bilder wurden';
    
    setChatMessages(prev => [...prev, { role: 'user', content: `${fileCount} ${fileText} zur Analyse hochgeladen` }]);
    
    setScreenshotsSent(true);
    
    if (editMode && botTypeSent) {
      setEditMode(false);
      setScreenshotsBeforeEdit(false);
      
      setTimeout(() => {
        setChatMessages(prev => [...prev, {
          role: 'ai',
          content: 'Perfekt! Ich habe beide Informationen erhalten. Soll ich fortfahren und diese beiden Sachen überprüfen?'
        }]);
        setWaitingForConfirmation(true);
      }, 500);
    } else {
      setTimeout(() => {
        sendPhaseOneAiResponse('screenshots');
      }, 500);
    }
    
    toast({
      title: "Screenshots gesendet",
      description: `${fileCount} ${fileText} zur Analyse hochgeladen.`,
    });
  };

  const sendPhaseOneAiResponse = (source: 'screenshots' | 'botType') => {
    let aiMessage = '';
    const fileCount = selectedFiles.length;
    const fileText = fileCount === 1 ? 'Bild' : 'Bilder';
    
    if (source === 'screenshots' && !botTypeSent) {
      aiMessage = `Ich habe gesehen, dass ${fileCount === 1 ? 'ein' : fileCount} ${fileText} zur Analyse hochgeladen wurde${fileCount === 1 ? '' : 'n'}. Möchten Sie noch Informationen ändern oder hinzufügen?\n\nBitte schicken Sie noch die Bot Type Informationen (Bot Type, ID, Version), damit wir Phase 1 abschließen können.`;
    } else if (source === 'botType' && !screenshotsSent) {
      aiMessage = 'Ich habe die Bot Type Informationen erhalten. Möchten Sie noch Informationen ändern oder hinzufügen?\n\nBitte schicken Sie noch die Screenshots, damit wir Phase 1 abschließen können.';
    } else if ((source === 'screenshots' && botTypeSent) || (source === 'botType' && screenshotsSent)) {
      aiMessage = 'Perfekt! Ich habe beide Informationen erhalten. Soll ich fortfahren und diese beiden Sachen überprüfen?';
      setWaitingForConfirmation(true);
    }
    
    if (aiMessage) {
      setChatMessages(prev => [...prev, { role: 'ai', content: aiMessage }]);
    }
  };

  const handleEditClick = () => {
    setScreenshotsBeforeEdit(screenshotsSent);
    setEditMode(true);
    setWaitingForConfirmation(false);
    setPhaseTwoVerified(false);
    setPhaseTwoStep2Complete(false);
    setIsStartMetric(false);
    setChatMessages(prev => [...prev, { 
      role: 'ai', 
      content: 'Ok, ich sehe Sie wollen noch etwas bearbeiten. Sie können nun Screenshots erneut hochladen oder die Bot Type Informationen ändern. Schicken Sie gerne die aktualisierten Informationen.'
    }]);
  };

  const handleConfirmClick = async () => {
    setWaitingForConfirmation(false);
    setEditMode(false);
    setIsAiLoading(true);
    
    const botTypeName = formData.botType;
    const selectedBotType = botTypes?.find(bt => bt.name === botTypeName);
    
    if (!selectedBotType) {
      toast({
        title: "Fehler",
        description: "Bot Type nicht gefunden.",
        variant: "destructive",
      });
      setIsAiLoading(false);
      return;
    }
    
    const botTypeColor = selectedBotType.color || 'keine Farbe';
    
    try {
      const userMessage = `Ich möchte mit Phase 2, Schritt 1 beginnen. Bitte überprüfe die bestehenden Metriken für Bot Type "${botTypeName}" (ID: ${botTypeColor}).`;
      
      // Filter updateHistory nach dem aktuellen Modus (Update Metrics oder Closed Bots)
      const statusFilter = outputMode === 'closed-bots' ? 'Closed Bots' : 'Update Metrics';
      const filteredUpdateHistory: Record<string, any[]> = {};
      
      if (updateHistory) {
        Object.keys(updateHistory).forEach((botName) => {
          const allUpdates = updateHistory[botName] || [];
          // Nur Updates mit dem passenden Status behalten
          const filteredUpdates = allUpdates.filter((update: any) => update.status === statusFilter);
          filteredUpdateHistory[botName] = filteredUpdates;
        });
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...chatMessages, { role: 'user', content: userMessage }],
          botTypes: botTypes,
          updateHistory: filteredUpdateHistory,
          phase: 'phase2_step1',
          selectedBotTypeId: selectedBotType.id,
          selectedBotTypeName: botTypeName,
          selectedBotTypeColor: botTypeColor,
          outputMode: outputMode,
        }),
      });

      if (!response.ok) {
        throw new Error('AI-Kommunikation fehlgeschlagen');
      }

      const data = await response.json();
      setChatMessages(prev => [...prev, { role: 'ai', content: data.response }]);
      
      // Je nach Modus die richtige State-Variable setzen
      if (outputMode === 'closed-bots') {
        setClosedIsStartMetric(data.isStartMetric || false);
        setClosedPhaseTwoVerified(true);
      } else {
        setIsStartMetric(data.isStartMetric || false);
        setPhaseTwoVerified(true);
      }
    } catch (error) {
      console.error('Phase 2 Step 1 error:', error);
      toast({
        title: "Fehler",
        description: "Phase 2 konnte nicht gestartet werden.",
        variant: "destructive",
      });
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleStep2Click = async () => {
    if (selectedFiles.length === 0) {
      toast({
        title: "Keine Screenshots",
        description: "Bitte laden Sie mindestens einen Screenshot hoch.",
        variant: "destructive",
      });
      return;
    }

    setIsAiLoading(true);

    try {
      const base64Images = await convertFilesToBase64(selectedFiles);
      const userMessage = `Ich möchte mit Phase 2, Schritt 2 beginnen. Bitte teste ob du die Screenshots analysieren kannst.`;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...chatMessages, { role: 'user', content: userMessage }],
          images: base64Images,
          phase: 'phase2_step2',
        }),
      });

      if (!response.ok) {
        throw new Error('AI-Kommunikation fehlgeschlagen');
      }

      const data = await response.json();
      setChatMessages(prev => [...prev, { role: 'ai', content: data.response }]);
      
      // Je nach Modus die richtige State-Variable setzen
      if (outputMode === 'closed-bots') {
        setClosedPhaseTwoStep2Complete(true);
      } else {
        setPhaseTwoStep2Complete(true);
      }
      
      setTimeout(async () => {
        const testSuccessMessage = { 
          role: 'ai' as const, 
          content: 'Test erfolgreich! Starte jetzt vollständige Datenextraktion aller Screenshots...'
        };
        
        setChatMessages(prev => [...prev, testSuccessMessage]);
        
        try {
          const userExtractionMessage = { role: 'user' as const, content: 'Bitte extrahiere jetzt alle Daten aus allen Screenshots.' };
          const updatedMessages = [...chatMessages, { role: 'ai' as const, content: data.response }, testSuccessMessage, userExtractionMessage];
          
          const extractionResponse = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: updatedMessages,
              images: base64Images,
              phase: 'phase2_data_extraction',
              outputMode: outputMode, // KRITISCH: Sende outputMode für Closed Bots Prompt
            }),
          });

          if (!extractionResponse.ok) {
            throw new Error('Datenextraktion fehlgeschlagen');
          }

          const extractionData = await extractionResponse.json();
          
          try {
            const parsedData = JSON.parse(extractionData.response);
            
            // WICHTIG: Speichere in den korrekten State-Container basierend auf outputMode
            if (outputMode === 'closed-bots') {
              setClosedExtractedScreenshotData(parsedData);
            } else {
              setExtractedScreenshotData(parsedData);
            }
            
            // Für Closed Bots: Zeige closedDate/closedTime separat an
            const formattedData = parsedData.screenshots.map((s: any, idx: number) => {
              let dateInfo = `• Datum: ${s.date}\n• Uhrzeit: ${s.time}`;
              
              // Bei Closed Bots: Zeige AUCH das Closed Date/Time explizit an
              if (outputMode === 'closed-bots' && (s.closedDate || s.closedTime)) {
                dateInfo = `• Closed Date: ${s.closedDate || s.date}\n• Closed Time: ${s.closedTime || s.time}`;
              }
              
              return `Screenshot ${idx + 1}:\n${dateInfo}\n• Actual Investment: ${s.actualInvestment} USDT\n• Extra Margin: ${s.extraMargin || 'Nicht verfügbar'}\n• Total Profit: ${s.totalProfitUsdt >= 0 ? '+' : ''}${s.totalProfitUsdt} USDT (${s.totalProfitPercent >= 0 ? '+' : ''}${s.totalProfitPercent}%)\n• Grid Profit: ${s.gridProfitUsdt !== null ? (s.gridProfitUsdt >= 0 ? '+' : '') + s.gridProfitUsdt + ' USDT (' + (s.gridProfitPercent >= 0 ? '+' : '') + s.gridProfitPercent + '%)' : 'Nicht verfügbar'}\n• Trend P&L: ${s.trendPnlUsdt !== null ? (s.trendPnlUsdt >= 0 ? '+' : '') + s.trendPnlUsdt + ' USDT (' + (s.trendPnlPercent >= 0 ? '+' : '') + s.trendPnlPercent + '%)' : 'Nicht verfügbar'}\n• Hebel: ${s.leverage}\n• Laufzeit: ${s.runtime}\n• Richtung: ${s.direction}`;
            }).join('\n\n');
            
            setChatMessages(prev => [...prev, { 
              role: 'ai', 
              content: `Datenextraktion abgeschlossen! Hier sind die extrahierten Daten:\n\n${formattedData}`
            }]);
          } catch (parseError) {
            console.error('JSON Parse error:', parseError);
            setChatMessages(prev => [...prev, { 
              role: 'ai', 
              content: 'Fehler beim Parsen der JSON-Daten. Rohdaten: ' + extractionData.response
            }]);
          }
          
          setTimeout(() => {
            setChatMessages(prev => [...prev, { 
              role: 'ai', 
              content: 'Ausgezeichnet! Phase 2 ist erfolgreich abgeschlossen. Wir gehen jetzt zu Phase 3 über. Bitte füllen Sie unten die gewünschten Metriken und Modi aus und senden Sie diese mit dem Button "Einstellungen an AI senden".'
            }]);
          }, 1000);
        } catch (extractionError) {
          console.error('Extraction error:', extractionError);
          setChatMessages(prev => [...prev, { 
            role: 'ai', 
            content: 'Fehler bei der Datenextraktion. Bitte versuchen Sie es erneut.'
          }]);
        }
      }, 1200);
    } catch (error) {
      console.error('Phase 2 Step 2 error:', error);
      toast({
        title: "Fehler",
        description: "Phase 2 Schritt 2 konnte nicht durchgeführt werden.",
        variant: "destructive",
      });
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleChatSend = async () => {
    if (!chatInput.trim()) return;
    
    const userMessage = chatInput;
    setChatInput("");
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsAiLoading(true);
    
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...chatMessages, { role: 'user', content: userMessage }],
          botTypes: botTypes,
          updateHistory: updateHistory,
        }),
      });

      if (!response.ok) {
        throw new Error('AI-Chat fehlgeschlagen');
      }

      const data = await response.json();
      setChatMessages(prev => [...prev, { role: 'ai', content: data.response }]);
    } catch (error) {
      console.error('AI chat error:', error);
      toast({
        title: "Fehler",
        description: "Der AI-Chat ist fehlgeschlagen. Bitte versuchen Sie es erneut.",
        variant: "destructive",
      });
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleEditBotType = (botType: BotType) => {
    setFormData({
      date: '',
      botName: botType.name,
      botType: '',
      version: '',
      botDirection: '',
      investment: '',
      extraMargin: '',
      totalInvestment: '',
      profit: '',
      profitPercent: '',
      periodType: 'Tag',
      longestRuntime: '',
      avgRuntime: '',
      uploadRuntime: '',
      lastUpload: '',
      thisUpload: '',
      avgGridProfitHour: '',
      avgGridProfitDay: '',
      avgGridProfitWeek: '',
      lastAvgGridProfitHour: '',
      lastAvgGridProfitDay: '',
      lastAvgGridProfitWeek: '',
      lastHighestGridProfit: '',
      changeHourDollar: '',
      changeHourPercent: '',
      changeDayDollar: '',
      changeDayPercent: '',
      changeWeekDollar: '',
      changeWeekPercent: '',
      overallTrendPnlUsdt: '',
      overallTrendPnlPercent: '',
      highestGridProfit: '',
      highestGridProfitPercent: '',
      overallGridProfitUsdt: '',
      overallGridProfitPercent: '',
      avgGridProfitUsdt: '',
      avgGridProfitPercent: '',
      avgGridProfitChange: '',
      avgGridProfitChangeDollar: '',
      avgGridProfitChangePercent: '',
      leverage: '',
      botCount: '',
      notes: '',
    });
    toast({
      title: "Bot-Typ geladen",
      description: `Die Informationen für "${botType.name}" wurden in die Ausgabe-Felder geladen.`,
    });
  };

  const handleUpdateBotType = (botType: BotType) => {
    setFormData(prev => ({
      ...prev,
      botType: botType.name,
    }));
    setSelectedBotTypeId(botType.id);
    setSelectedBotTypeColor(botType.color || '');
  };

  const handleSendFieldsToAI = async () => {
    // Prüfe auf manuelle Überschreibungen (nur bei 1 Screenshot erlaubt)
    // WICHTIG: Verwende die korrekte Overrides-Referenz basierend auf outputMode
    const currentOverrides = outputMode === 'closed-bots' 
      ? closedManualOverridesRef.current 
      : manualOverridesRef.current;
    const hasOverrides = Object.keys(currentOverrides).length > 0;
    const manualFields: { label: string; value: string }[] = [];
    
    console.log('handleSendFieldsToAI - currentOverrides:', currentOverrides, 'outputMode:', outputMode);
    
    // Baue Liste der überschriebenen Felder
    if (currentOverrides.overallGridProfitUsdt) {
      manualFields.push({ label: 'Gesamter Grid Profit', value: currentOverrides.overallGridProfitUsdt });
    }
    if (currentOverrides.lastUpload) {
      manualFields.push({ label: 'Last Upload', value: currentOverrides.lastUpload });
    }
    if (currentOverrides.investment) {
      manualFields.push({ label: 'Investitionsmenge', value: currentOverrides.investment });
    }
    if (currentOverrides.extraMargin) {
      manualFields.push({ label: 'Extra Margin', value: currentOverrides.extraMargin });
    }
    if (currentOverrides.avgRuntime) {
      manualFields.push({ label: 'Durchschn. Laufzeit', value: currentOverrides.avgRuntime });
    }
    if (currentOverrides.uploadRuntime) {
      manualFields.push({ label: 'Upload Laufzeit', value: currentOverrides.uploadRuntime });
    }
    
    // Prüfe Anzahl der Screenshots (aus dem korrekten State-Container)
    // FALLBACK-LOGIK: Wenn im Closed Bots Modus aber closedExtractedScreenshotData leer ist,
    // verwende extractedScreenshotData (falls Screenshots im Update Metrics Modus hochgeladen wurden)
    let activeExtractedData = outputMode === 'closed-bots' ? closedExtractedScreenshotData : extractedScreenshotData;
    if (outputMode === 'closed-bots' && (!activeExtractedData?.screenshots?.length)) {
      console.log('FALLBACK: closedExtractedScreenshotData leer, verwende extractedScreenshotData');
      activeExtractedData = extractedScreenshotData;
    }
    const screenshotCount = activeExtractedData?.screenshots?.length || 0;
    
    // Wenn manuelle Überschreibungen UND mehr als 1 Screenshot → Fehler
    if (hasOverrides && screenshotCount > 1) {
      toast({
        title: "Manuelle Werte nicht erlaubt",
        description: "Sie haben mehr als einen Screenshot hochgeladen. Manuelle Wertüberschreibungen sind nur bei einem einzelnen Screenshot möglich.",
        variant: "destructive",
      });
      return;
    }
    
    setIsAiLoading(true);
    
    setChatMessages(prev => [...prev, { 
      role: 'user', 
      content: 'Einstellungen wurden an AI gesendet' 
    }]);
    
    setTimeout(() => {
      // WICHTIG: Zeige den Output-Modus in der Nachricht an (Closed Bots vs Update Metrics)
      const modeLabel = outputMode === 'closed-bots' ? 'Closed Bots (geschlossene Positionen)' : 'Update Metrics (aktive Bots)';
      
      // Erstelle Nachricht mit Überschreibungshinweis wenn nötig
      let aiMessage = `Perfekt! Ich habe Ihre Einstellungen verstanden.\n\nModus: ${modeLabel}\nDie Modi (Neu/Vergleich) und alle Felder sind klar.`;
      
      if (manualFields.length > 0) {
        aiMessage = `Verstanden! Ich sehe, Sie möchten folgende Werte manuell überschreiben:\n\n${manualFields.map(f => `- ${f.label}: ${f.value}`).join('\n')}\n\nModus: ${modeLabel}\nDiese Werte werden anstelle der Screenshot-Werte für die Berechnung verwendet. Die Modi (Neu/Vergleich) und alle anderen Felder sind klar.`;
      }
      
      aiMessage += ' Sollen wir mit Phase 4 - der vollständigen Auswertung - fortfahren?';
      
      setChatMessages(prev => [...prev, {
        role: 'ai',
        content: aiMessage
      }]);
      setPhaseThreeSettingsSent(true);
      
      // Je nach Modus die richtige State-Variable setzen
      if (outputMode === 'closed-bots') {
        setClosedWaitingForPhaseThreeConfirmation(true);
      } else {
        setWaitingForPhaseThreeConfirmation(true);
      }
      setIsAiLoading(false);
    }, 800);
    
    toast({
      title: "Einstellungen gesendet",
      description: manualFields.length > 0 
        ? `${manualFields.length} manuelle Überschreibung(en) erkannt und an die AI übermittelt.`
        : "Die Feld-Einstellungen wurden erfolgreich an die AI übermittelt.",
    });
  };

  const handleConfirmPhaseThree = async () => {
    // DEBUG: Sofort am Anfang loggen, um zu sehen ob die Funktion aufgerufen wird
    console.log('=== handleConfirmPhaseThree STARTED ===', {
      outputMode,
      isClosedBotsMode: outputMode === 'closed-bots',
      closedExtractedScreenshotData: closedExtractedScreenshotData,
      extractedScreenshotData: extractedScreenshotData,
      closedIsStartMetric,
      isStartMetric,
      closedSelectedBotTypeId,
      selectedBotTypeId
    });
    
    setChatMessages(prev => [...prev, { 
      role: 'user', 
      content: 'Ja, bitte mit Phase 4 fortfahren' 
    }]);
    
    setIsAiLoading(true);
    
    // Je nach Modus die richtige State-Variable zurücksetzen
    if (outputMode === 'closed-bots') {
      setClosedWaitingForPhaseThreeConfirmation(false);
    } else {
      setWaitingForPhaseThreeConfirmation(false);
    }
    
    // Bedingte Setter und Getter basierend auf outputMode (Update Metrics vs Closed Bots)
    // Dies ermöglicht, dass beide Modi ihre eigenen unabhängigen Daten haben
    const isClosedBots = outputMode === 'closed-bots';
    const useSetFormData = isClosedBots ? setClosedFormData : setFormData;
    const useSetCalculationMode = isClosedBots ? setClosedCalculationMode : setCalculationMode;
    const useSetCalculatedPercents = isClosedBots ? setClosedCalculatedPercents : setCalculatedPercents;
    
    // Bedingte Container für Daten (liest aus dem korrekten State-Container)
    // FALLBACK-LOGIK: Wenn Closed Bots Modus aktiv ist, aber closedExtractedScreenshotData leer ist,
    // verwende extractedScreenshotData als Fallback (für den Fall, dass Phase 2 im falschen Modus lief)
    let activeExtractedData = isClosedBots ? closedExtractedScreenshotData : extractedScreenshotData;
    
    // ROBUSTE FALLBACK-LOGIK für Closed Bots
    if (isClosedBots && (!activeExtractedData || !activeExtractedData.screenshots || activeExtractedData.screenshots.length === 0)) {
      // Closed Bots Modus ist aktiv, aber closedExtractedScreenshotData ist leer
      // Verwende extractedScreenshotData als Fallback
      if (extractedScreenshotData && extractedScreenshotData.screenshots && extractedScreenshotData.screenshots.length > 0) {
        console.log('=== FALLBACK: Closed Bots verwendet extractedScreenshotData (Phase 2 lief im falschen Modus) ===');
        activeExtractedData = extractedScreenshotData;
        // Kopiere auch die Daten in den richtigen Container für zukünftige Verwendung
        setClosedExtractedScreenshotData(extractedScreenshotData);
      }
    }
    
    const activeIsStartMetric = isClosedBots ? closedIsStartMetric : isStartMetric;
    const activeSelectedBotTypeId = isClosedBots ? closedSelectedBotTypeId : selectedBotTypeId;
    const activeManualOverridesRef = isClosedBots ? closedManualOverridesRef : manualOverridesRef;
    const activeInfoSectionMode = isClosedBots ? closedInfoSectionMode : infoSectionMode;
    
    // DEBUG: Logge die ausgewählten Daten
    console.log('=== handleConfirmPhaseThree ACTIVE DATA ===', {
      isClosedBots,
      activeExtractedData,
      activeExtractedDataScreenshots: activeExtractedData?.screenshots,
      activeIsStartMetric,
      activeSelectedBotTypeId
    });
    
    const sectionsWithModes = [
      { name: 'Investment', mode: investmentTimeRange },
      { name: 'Gesamter Profit / P&L', mode: profitTimeRange },
      { name: 'Trend P&L', mode: trendTimeRange },
      { name: 'Grid Trading', mode: gridTimeRange }
    ];

    const metricsCount = sectionsWithModes.length;
    const hasLastUpload = !activeIsStartMetric;
    
    // WICHTIG: Zeige den Output-Modus in der Phase 4 Nachricht an
    const modeLabel = outputMode === 'closed-bots' ? 'Closed Bots (geschlossene Positionen)' : 'Update Metrics (aktive Bots)';
    
    let message = `Phase 4 - Analyse und Berechnung\n\n`;
    message += `Output-Modus: ${modeLabel}\n\n`;
    message += `Für den aktuellen Upload wurden ${metricsCount} Sektionen mit Modi konfiguriert:\n`;
    message += sectionsWithModes.map(s => `• ${s.name} (Modus: ${s.mode})`).join('\n');
    
    if (hasLastUpload) {
      message += `\n\nEs wurde ein vorheriger Upload erkannt. Ich werde Vergleichswerte berechnen.`;
    } else {
      message += `\n\nDies ist der erste Upload (Modus "Neu" für alle Berechnungen).`;
    }
    
    message += `\n\nStarte jetzt die KI-gestützte Analyse und Berechnung...`;

    setChatMessages(prev => [...prev, {
      role: 'ai',
      content: message
    }]);

    toast({
      title: "Phase 4 gestartet",
      description: "KI analysiert Screenshots und berechnet Werte...",
    });

    try {
      if (!activeExtractedData) {
        throw new Error('Keine Screenshot-Daten verfügbar. Bitte führen Sie zuerst Phase 2 durch.');
      }

      let previousUploadData = null;
      let lastUploadDate = '';
      let lastUploadDateTime: Date | null = null; // Für Upload Laufzeit Berechnung
      // Speichere die Last Grid Profit Durchschnitt Werte für die Anzeige
      let lastAvgGridProfitHourValue = '';
      let lastAvgGridProfitDayValue = '';
      let lastAvgGridProfitWeekValue = '';
      let lastHighestGridProfitValue = '';
      
      if (!activeIsStartMetric && activeSelectedBotTypeId) {
        try {
          // WICHTIG: Closed Bots und Update Metrics vergleichen nur mit ihrem EIGENEN Modus!
          // Closed Bots -> nur mit vorherigen Closed Bots Uploads vergleichen
          // Update Metrics -> nur mit vorherigen Update Metrics Uploads vergleichen
          const isClosedBotsMode = outputMode === 'closed-bots';
          const statusFilter = isClosedBotsMode ? 'Closed Bots' : 'Update Metrics';
          
          // Hole den letzten Upload mit dem passenden Status
          const latestResponse = await fetch(
            `/api/bot-types/${activeSelectedBotTypeId}/updates/latest?status=${encodeURIComponent(statusFilter)}`,
            {
              headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
              }
            }
          );
          
          if (latestResponse.ok) {
            const lastUpdate = await latestResponse.json();
            
            if (lastUpdate) {
              console.log(`Vorheriger ${statusFilter} Upload gefunden:`, lastUpdate);
              
              // Speichere das Datum des letzten Uploads für das "Last Upload" Feld
              // Priorität: thisUpload > createdAt (thisUpload enthält den tatsächlichen Upload-Zeitpunkt)
              if (lastUpdate.thisUpload) {
                // thisUpload ist bereits im Format "TT.MM.JJJJ HH:MM"
                lastUploadDate = lastUpdate.thisUpload;
                // Parse für Upload Laufzeit Berechnung
                const parts = lastUpdate.thisUpload.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2})/);
                if (parts) {
                  const [, day, month, year, hour, minute] = parts;
                  lastUploadDateTime = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
                }
              } else if (lastUpdate.createdAt) {
                const d = new Date(lastUpdate.createdAt);
                lastUploadDateTime = d;
                lastUploadDate = d.toLocaleDateString('de-DE') + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
              }
              // Last Grid Profit Durchschnitt Werte speichern
              lastAvgGridProfitHourValue = lastUpdate.avgGridProfitHour?.toString() || '';
              lastAvgGridProfitDayValue = lastUpdate.avgGridProfitDay?.toString() || '';
              lastAvgGridProfitWeekValue = lastUpdate.avgGridProfitWeek?.toString() || '';
              // Last Ø Grid Profit USDT (vorheriger avgGridProfitUsdt Wert)
              lastHighestGridProfitValue = lastUpdate.avgGridProfitUsdt?.toString() || '';
              
              previousUploadData = JSON.stringify({
                investment: lastUpdate.investment,
                extraMargin: lastUpdate.extraMargin,
                totalInvestment: lastUpdate.totalInvestment,
                profit: lastUpdate.profit,
                overallTrendPnlUsdt: lastUpdate.overallTrendPnlUsdt,
                overallGridProfitUsdt: lastUpdate.overallGridProfitUsdt,
                highestGridProfit: lastUpdate.highestGridProfit,
                avgGridProfitHour: lastUpdate.avgGridProfitHour,
                avgGridProfitDay: lastUpdate.avgGridProfitDay,
                avgGridProfitWeek: lastUpdate.avgGridProfitWeek
              });
            } else {
              console.log(`Kein vorheriger ${statusFilter} Upload gefunden - behandle als Startmetrik`);
            }
          }
        } catch (e) {
          console.warn('Konnte vorherige Upload-Daten nicht laden:', e);
        }
      }

      // DEBUG: Log manualOverrides vor dem Senden
      // WICHTIG: Verwende activeManualOverridesRef.current direkt (bedingt basierend auf outputMode)!
      const currentOverrides = activeManualOverridesRef.current;
      console.log('=== Phase 4 Request Debug ===');
      console.log('activeManualOverridesRef.current:', currentOverrides);
      console.log('manualOverrides keys:', Object.keys(currentOverrides));
      console.log('manualOverrides.avgRuntime:', currentOverrides.avgRuntime);
      console.log('manualOverrides.uploadRuntime:', currentOverrides.uploadRuntime);
      console.log('manualOverrides.lastUpload:', currentOverrides.lastUpload);
      console.log('phase2Completed:', phase2Completed);
      console.log('screenshotCount:', activeExtractedData?.screenshots?.length);
      console.log('outputMode:', outputMode);
      console.log('=== End Debug ===');
      
      const response = await fetch('/api/phase4', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screenshotData: JSON.stringify(activeExtractedData),
          modes: {
            investment: investmentTimeRange,
            profit: profitTimeRange,
            trend: trendTimeRange,
            grid: gridTimeRange
          },
          isStartMetric: activeIsStartMetric,
          previousUploadData,
          // Manueller Startmetrik-Modus (auch bei normalen Uploads wie Startmetrik berechnen)
          manualStartmetrikMode: activeInfoSectionMode === 'Startmetrik',
          // Manuelle Überschreibungen (nur bei 1 Screenshot) - VERWENDE REF.CURRENT DIREKT!
          manualOverrides: Object.keys(currentOverrides).length > 0 ? currentOverrides : undefined,
          // Output Modus: update-metrics (aktive Bots) oder closed-bots (geschlossene Bots)
          outputMode: outputMode
        }),
      });

      if (!response.ok) {
        throw new Error('Phase 4 API fehlgeschlagen');
      }

      const data = await response.json();
      const calculatedValues = data.values;
      
      // Speichere den Berechnungsmodus aus der API-Response (verwendet bedingten Setter)
      useSetCalculationMode(data.calculationMode || 'Normal');
      
      // DEBUG: Log die empfangenen Werte
      console.log('Phase 4 API Response:', data);
      console.log('Calculated Values:', calculatedValues);
      console.log('Investment value:', calculatedValues?.investment);
      console.log('Profit value:', calculatedValues?.profit);
      console.log('Calculation Mode:', data.calculationMode);
      
      const jsonOutput = JSON.stringify(calculatedValues, null, 2);
      
      setChatMessages(prev => [...prev, {
        role: 'ai',
        content: `Phase 4 - Berechnung abgeschlossen\n\nAlle Werte wurden erfolgreich berechnet:\n\n\`\`\`json\n${jsonOutput}\n\`\`\``
      }]);
      
      setTimeout(() => {
        console.log('setTimeout callback STARTED');
        console.log('calculatedValues inside setTimeout:', calculatedValues);
        
        // Bot-Richtung: Direkt von AI übernehmen (Long, Short, Neutral oder Kombinationen)
        const botDirection = calculatedValues.botDirection || '';
        
        // Hilfsfunktion: Konvertiere Wert zu String (behandelt null, undefined, numbers)
        const toStr = (val: any): string => {
          if (val === null || val === undefined) return '';
          return String(val);
        };
        
        // Formatierung für USDT-Werte: bis zu 4 Nachkommastellen, keine nachgestellten Nullen, min 2
        const formatUsdt = (val: any): string => {
          if (val === null || val === undefined || val === '') return '';
          const num = typeof val === 'string' ? parseFloat(val) : val;
          if (isNaN(num)) return '';
          // Formatiere mit 4 Dezimalstellen
          let formatted = num.toFixed(4);
          // Entferne nachgestellte Nullen
          formatted = formatted.replace(/\.?0+$/, '');
          // Stelle sicher, dass mindestens 2 Dezimalstellen vorhanden
          if (!formatted.includes('.')) {
            formatted += '.00';
          } else {
            const decPart = formatted.split('.')[1] || '';
            if (decPart.length === 1) formatted += '0';
          }
          return formatted;
        };
        
        // Formatierung für Werte mit genau 2 Nachkommastellen (z.B. Gesamtprofit)
        const formatDecimal2 = (val: any): string => {
          if (val === null || val === undefined || val === '') return '';
          const num = typeof val === 'string' ? parseFloat(val) : val;
          if (isNaN(num)) return '';
          return num.toFixed(2);
        };
        
        // SPEICHERE alle berechneten Prozentwerte für späteren Umschalt-Zugriff
        // WICHTIG: Formularfelder (type="number") akzeptieren kein "+" Zeichen!
        // Daher nur den numerischen Wert speichern, das "+" wird bei der Anzeige hinzugefügt
        // Berechne Ø Grid Profit (%) aus avgGridProfitUsdt für beide Basen
        const avgGridProfitUsdtVal = parseFloat(toStr(calculatedValues.avgGridProfitUsdt)) || 0;
        const totalInvestmentVal = parseFloat(toStr(calculatedValues.totalInvestment)) || 0;
        const investmentVal = parseFloat(toStr(calculatedValues.investment)) || 0;
        
        let avgGridProfitPct_gesamt = '';
        let avgGridProfitPct_invest = '';
        if (avgGridProfitUsdtVal !== 0) {
          if (totalInvestmentVal > 0) {
            avgGridProfitPct_gesamt = ((avgGridProfitUsdtVal / totalInvestmentVal) * 100).toFixed(2);
          }
          if (investmentVal > 0) {
            avgGridProfitPct_invest = ((avgGridProfitUsdtVal / investmentVal) * 100).toFixed(2);
          }
        }
        
        useSetCalculatedPercents({
          profitPercent_gesamtinvestment: toStr(calculatedValues.profitPercent_gesamtinvestment),
          profitPercent_investitionsmenge: toStr(calculatedValues.profitPercent_investitionsmenge),
          overallTrendPnlPercent_gesamtinvestment: toStr(calculatedValues.overallTrendPnlPercent_gesamtinvestment),
          overallTrendPnlPercent_investitionsmenge: toStr(calculatedValues.overallTrendPnlPercent_investitionsmenge),
          overallGridProfitPercent_gesamtinvestment: toStr(calculatedValues.overallGridProfitPercent_gesamtinvestment),
          overallGridProfitPercent_investitionsmenge: toStr(calculatedValues.overallGridProfitPercent_investitionsmenge),
          highestGridProfitPercent_gesamtinvestment: toStr(calculatedValues.highestGridProfitPercent_gesamtinvestment),
          highestGridProfitPercent_investitionsmenge: toStr(calculatedValues.highestGridProfitPercent_investitionsmenge),
          avgGridProfitPercent_gesamtinvestment: avgGridProfitPct_gesamt,
          avgGridProfitPercent_investitionsmenge: avgGridProfitPct_invest,
        });
        
        // DEBUG: Log vor dem Setzen
        console.log('Setting form data with values:', {
          investment: toStr(calculatedValues.investment),
          profit: toStr(calculatedValues.profit),
          profitPercent: toStr(calculatedValues.profitPercent_gesamtinvestment || calculatedValues.profitPercent),
          overallTrendPnlUsdt: toStr(calculatedValues.overallTrendPnlUsdt),
          overallGridProfitUsdt: toStr(calculatedValues.overallGridProfitUsdt),
        });
        
        // Setze Formularwerte - OHNE "+" Vorzeichen (type="number" akzeptiert es nicht)
        // Das "+" Vorzeichen wird nur bei der Anzeige in Reports hinzugefügt
        
        // Datum-Logik:
        // - Startmetrik: "Datum und Uhrzeit" = AKTUELLES Upload-Datum (NICHT AI-Datum!)
        // - Normale Uploads: Aktuelles Echtzeit-Datum des Uploads
        // - thisUpload: Immer aktuelles Echtzeit-Datum
        // - uploadRuntime: Zeitdifferenz zwischen Last Upload und This Upload
        // - Startmetrik lastUpload: ÄLTESTES createdAt aus allen Screenshots
        const now = new Date();
        // Lokale Zeit statt UTC verwenden (toISOString gibt UTC zurück)
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const currentDateTime = `${year}-${month}-${day}T${hours}:${minutes}`; // Format: YYYY-MM-DDTHH:MM für datetime-local
        const currentDateTimeDisplay = now.toLocaleDateString('de-DE') + ' ' + now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        
        // WICHTIG: Bei Startmetrik "Datum und Uhrzeit" = aktuelles Upload-Datum (NICHT AI-Datum!)
        const dateValue = currentDateTime;
        
        // === STARTMETRIK: LAST UPLOAD = ÄLTESTES CREATED-DATUM ===
        // Bei natürlicher Startmetrik: Finde das älteste "createdAt" Datum aus allen Screenshots
        // Dieses Datum wird als "Last Upload" angezeigt (= Bot-Startdatum)
        if (activeIsStartMetric && activeExtractedData?.screenshots?.length > 0) {
          let oldestDate: Date | null = null;
          let oldestDateStr = '';
          
          for (const screenshot of activeExtractedData.screenshots) {
            if (screenshot.createdAt) {
              // Parse createdAt: Format "YYYY-MM-DD HH:MM:SS" oder "YYYY-MM-DD"
              const createdDate = new Date(screenshot.createdAt);
              
              if (!isNaN(createdDate.getTime())) {
                if (!oldestDate || createdDate < oldestDate) {
                  oldestDate = createdDate;
                  // Format für Anzeige: TT.MM.JJJJ HH:MM
                  oldestDateStr = createdDate.toLocaleDateString('de-DE') + ' ' + 
                    createdDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                }
              }
            }
          }
          
          if (oldestDateStr) {
            lastUploadDate = oldestDateStr;
            console.log('Startmetrik: Ältestes createdAt gefunden:', oldestDateStr);
          }
        }
        
        // Upload Laufzeit berechnen:
        // - Bei Startmetrik: LEER (kein vorheriger Upload zum Vergleichen)
        // - Bei normalem Upload: This Upload - Last Upload
        let uploadRuntimeValue = '';
        
        // Funktion zur Berechnung der Laufzeit-Differenz
        const calculateRuntimeDiff = (startDate: Date) => {
          const diffMs = now.getTime() - startDate.getTime();
          const diffMinutes = Math.floor(diffMs / (1000 * 60));
          const diffHours = Math.floor(diffMinutes / 60);
          const diffDays = Math.floor(diffHours / 24);
          const diffWeeks = Math.floor(diffDays / 7);
          
          const weeks = diffWeeks;
          const days = diffDays % 7;
          const hours = diffHours % 24;
          const minutes = diffMinutes % 60;
          
          const parts = [];
          if (weeks > 0) parts.push(`${weeks}w`);
          if (days > 0) parts.push(`${days}d`);
          if (hours > 0) parts.push(`${hours}h`);
          if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
          
          return parts.join(' ');
        };
        
        // Variable für Grid Profit Durchschnitt Berechnung (in Stunden)
        // - Bei Startmetrik: Längste Laufzeit aus Screenshots verwenden
        // - Bei normalem Upload: Upload Laufzeit (This Upload - Last Upload) verwenden
        let runtimeHoursForGridProfit = 0;
        
        // Parse die längste Laufzeit aus dem AI-Ergebnis für Startmetrik
        const parseLongestRuntime = (runtime: string): number => {
          if (!runtime) return 0;
          
          // Normalisiere den String: Entferne alle Leerzeichen zwischen Zahlen und Einheiten
          // Unterstützt: "12h 31m 22s", "12 h 31 m 22 s", "1d 2h 30m", "1 d 2 h 30 m"
          const normalized = runtime.replace(/\s+/g, '').toLowerCase();
          
          let totalHours = 0;
          const dayMatch = normalized.match(/(\d+)d/);
          const hourMatch = normalized.match(/(\d+)h/);
          const minMatch = normalized.match(/(\d+)m/);
          const secMatch = normalized.match(/(\d+)s/);
          
          if (dayMatch) totalHours += parseInt(dayMatch[1]) * 24;
          if (hourMatch) totalHours += parseInt(hourMatch[1]);
          if (minMatch) totalHours += parseInt(minMatch[1]) / 60;
          if (secMatch) totalHours += parseInt(secMatch[1]) / 3600;
          
          console.log('parseLongestRuntime:', { original: runtime, normalized, totalHours });
          
          return totalHours;
        };
        
        // === SPEZIELLE CLOSED BOTS DATUMSLOGIK ===
        // Für Closed Bots:
        // - thisUpload = Schließdatum aus Screenshot (End Date)
        // - lastUpload = Startdatum (End Date - Laufzeit) -> wird als "Start Date" gespeichert
        // - uploadRuntime = Laufzeit aus Screenshot (Bot-Laufzeit)
        // - date = aktuelles Speicherdatum (wann der User es hochgeladen hat)
        let closedBotsThisUpload = '';
        let closedBotsLastUpload = ''; // Eigentlich das berechnete Startdatum
        let closedBotsUploadRuntime = '';
        
        // Helper-Funktion zum Parsen eines Datums aus verschiedenen Formaten
        const parseDateFromScreenshot = (dateStr: string | null | undefined, timeStr: string | null | undefined): Date | null => {
          if (!dateStr || !timeStr) return null;
          
          // WICHTIG: Entferne trailing text wie "closed", "geschlossen", etc. aus der Zeit
          // Die AI gibt manchmal "16:42:12 closed" zurück statt nur "16:42:12"
          const cleanTimeStr = timeStr.replace(/\s*(closed|geschlossen|open|offen|running|laufend).*$/i, '').trim();
          
          console.log('parseDateFromScreenshot DEBUG:', { 
            originalDate: dateStr, 
            originalTime: timeStr, 
            cleanedTime: cleanTimeStr 
          });
          
          // Versuche verschiedene Datumsformate zu parsen
          // Format 1: "MM/DD/YYYY" (US-Format wie im Screenshot)
          const usDateMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
          // Format 2: "TT.MM.JJJJ" (deutsches Format)
          const deDateMatch = dateStr.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
          // Format 3: "YYYY-MM-DD" (ISO Format)
          const isoDateMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
          
          const timeMatch = cleanTimeStr.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
          if (!timeMatch) return null;
          
          let result: Date | null = null;
          
          if (usDateMatch) {
            const [, usMonth, usDay, usYear] = usDateMatch;
            const [, hr, min, sec] = timeMatch;
            result = new Date(
              parseInt(usYear),
              parseInt(usMonth) - 1,
              parseInt(usDay),
              parseInt(hr),
              parseInt(min),
              sec ? parseInt(sec) : 0
            );
          } else if (deDateMatch) {
            const [, deDay, deMonth, deYear] = deDateMatch;
            const [, hr, min, sec] = timeMatch;
            result = new Date(
              parseInt(deYear),
              parseInt(deMonth) - 1,
              parseInt(deDay),
              parseInt(hr),
              parseInt(min),
              sec ? parseInt(sec) : 0
            );
          } else if (isoDateMatch) {
            const [, isoYear, isoMonth, isoDay] = isoDateMatch;
            const [, hr, min, sec] = timeMatch;
            result = new Date(
              parseInt(isoYear),
              parseInt(isoMonth) - 1,
              parseInt(isoDay),
              parseInt(hr),
              parseInt(min),
              sec ? parseInt(sec) : 0
            );
          }
          
          return result && !isNaN(result.getTime()) ? result : null;
        };
        
        // DEBUG: Prüfe ob Closed Bots Datumslogik ausgeführt wird
        console.log('=== CLOSED BOTS DATE LOGIC DEBUG ===', {
          isClosedBots,
          outputMode,
          hasActiveExtractedData: !!activeExtractedData,
          screenshotCount: activeExtractedData?.screenshots?.length || 0,
          screenshots: activeExtractedData?.screenshots?.map((s: any) => ({
            closedDate: s.closedDate,
            closedTime: s.closedTime,
            date: s.date,
            time: s.time,
            runtime: s.runtime
          }))
        });
        
        if (isClosedBots && activeExtractedData?.screenshots?.length > 0) {
          // KRITISCHE REGEL: Runtime und Datum MÜSSEN vom selben Screenshot kommen!
          // Dies stellt sicher, dass Start Date = End Date - Runtime für denselben Bot gilt.
          
          // Finde den besten Screenshot: Muss SOWOHL gültiges Datum ALS AUCH gültige Runtime haben
          let bestScreenshot: any = null;
          let bestRuntimeHours = 0;
          
          for (const screenshot of activeExtractedData.screenshots) {
            const screenshotRuntimeHours = parseLongestRuntime(screenshot.runtime || '');
            // PRIORITÄT: Verwende closedDate/closedTime wenn verfügbar, sonst date/time
            const dateToUse = screenshot.closedDate || screenshot.date;
            const timeToUse = screenshot.closedTime || screenshot.time;
            const parsedDate = parseDateFromScreenshot(dateToUse, timeToUse);
            
            // Screenshot ist nur gültig wenn BEIDE vorhanden sind: Datum UND Runtime
            if (parsedDate && screenshotRuntimeHours > 0) {
              if (screenshotRuntimeHours > bestRuntimeHours) {
                bestRuntimeHours = screenshotRuntimeHours;
                bestScreenshot = screenshot;
              }
            }
          }
          
          // Nur fortfahren wenn wir einen Screenshot mit BEIDEN gültigen Werten haben
          if (bestScreenshot && bestRuntimeHours > 0) {
            // Verwende Runtime und Datum vom SELBEN Screenshot
            closedBotsUploadRuntime = bestScreenshot.runtime;
            
            // WICHTIG: Das Datum aus dem Screenshot ist das SCHLIESSUNGS-Datum (END Date)!
            // PRIORITÄT: Verwende closedDate/closedTime wenn verfügbar (direkter AI-Output ohne Berechnung)
            const dateToUse = bestScreenshot.closedDate || bestScreenshot.date;
            const timeToUse = bestScreenshot.closedTime || bestScreenshot.time;
            const endDateTime = parseDateFromScreenshot(dateToUse, timeToUse)!;
            
            console.log('Closed Bots: Verwende Datum/Zeit', { 
              closedDate: bestScreenshot.closedDate, 
              closedTime: bestScreenshot.closedTime,
              date: bestScreenshot.date,
              time: bestScreenshot.time,
              using: { dateToUse, timeToUse }
            });
            
            // Runtime in Millisekunden umrechnen
            const runtimeMs = bestRuntimeHours * 60 * 60 * 1000;
            
            // Start Date = End Date MINUS Laufzeit (der Bot STARTETE vor der Schließung)
            // Explizite Subtraktion: End - Runtime = Start
            const endTimeMs = endDateTime.getTime();
            const startTimeMs = endTimeMs - runtimeMs;
            const startDateTime = new Date(startTimeMs);
            
            // Formatierung für deutsche Anzeige (mit Sekunden für maximale Genauigkeit)
            const formatDateDE = (date: Date) => {
              return date.toLocaleDateString('de-DE') + ' ' + date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            };
            
            const startDateFormatted = formatDateDE(startDateTime);
            const endDateFormatted = formatDateDE(endDateTime);
            
            // KORREKTE ZUWEISUNG nach UI-Binding-Analyse:
            // UI-Bindings (JSX Zeilen 3270-3287):
            // - "Start Date" Feld → value={closedFormData.lastUpload}
            // - "End Date" Feld → value={closedFormData.thisUpload}
            // 
            // Datenflusskette:
            // closedBotsLastUpload → finalLastUpload → formData.lastUpload → closedFormData.lastUpload → "Start Date" Feld
            // closedBotsThisUpload → finalThisUpload → formData.thisUpload → closedFormData.thisUpload → "End Date" Feld
            // 
            // BEISPIEL: Screenshot "11/24/2025 16:42:12 closed", Laufzeit: 12h 31m 22s
            //           endDateFormatted = 24.11.2025 16:42:12 (Schließungszeitpunkt)
            //           startDateFormatted = 24.11.2025 04:10:50 (berechneter Startzeitpunkt)
            // 
            // KORREKTE Zuweisung für KORREKTE UI-Anzeige:
            closedBotsLastUpload = startDateFormatted; // → lastUpload → "Start Date" Feld zeigt Startzeitpunkt
            closedBotsThisUpload = endDateFormatted;   // → thisUpload → "End Date" Feld zeigt Schließungszeitpunkt
            
            console.log('Closed Bots Datumslogik KORRIGIERT:', {
              screenshotDate: bestScreenshot.date,
              screenshotTime: bestScreenshot.time,
              runtime: bestScreenshot.runtime,
              runtimeHours: bestRuntimeHours,
              runtimeMs: runtimeMs,
              endTimeMs: endTimeMs,
              startTimeMs: startTimeMs,
              calculation: `${endTimeMs} - ${runtimeMs} = ${startTimeMs}`,
              endDateTime: endDateTime.toISOString(),
              startDateTime: startDateTime.toISOString(),
              UI_EndDate: closedBotsThisUpload,
              UI_StartDate: closedBotsLastUpload
            });
          } else {
            // KEIN Screenshot hat sowohl gültiges Datum als auch gültige Runtime
            // In diesem Fall: KEINE Closed Bots Datumslogik anwenden
            // Die normalen Update Metrics Werte werden verwendet (currentDateTimeDisplay für thisUpload)
            console.warn('Closed Bots: Kein Screenshot mit gültigem Datum UND Runtime gefunden. Verwende Standard-Datumswerte.', {
              screenshotsChecked: activeExtractedData.screenshots.length,
              screenshots: activeExtractedData.screenshots.map((s: any) => ({
                date: s.date,
                time: s.time,
                runtime: s.runtime,
                dateValid: parseDateFromScreenshot(s.date, s.time) !== null,
                runtimeHours: parseLongestRuntime(s.runtime || '')
              }))
            });
            // closedBotsThisUpload, closedBotsLastUpload, closedBotsUploadRuntime bleiben leer
            // -> Die finalen Werte verwenden die Standard-Logik (currentDateTimeDisplay, etc.)
          }
        }
        
        // PRIORITÄT: Manuelle Overrides für uploadRuntime haben Vorrang!
        if (activeManualOverridesRef.current.uploadRuntime) {
          // Benutzer hat manuell einen Wert für Upload Laufzeit eingegeben
          uploadRuntimeValue = activeManualOverridesRef.current.uploadRuntime;
          runtimeHoursForGridProfit = parseLongestRuntime(uploadRuntimeValue);
          console.log('Upload Laufzeit: Manueller Override verwendet:', uploadRuntimeValue);
        } else if (isClosedBots && closedBotsUploadRuntime) {
          // CLOSED BOTS: Verwende die Bot-Laufzeit aus dem Screenshot (z.B. "12h 31m 22s")
          // Dies ist die Gesamtlaufzeit des geschlossenen Bots
          uploadRuntimeValue = closedBotsUploadRuntime;
          runtimeHoursForGridProfit = parseLongestRuntime(closedBotsUploadRuntime);
          console.log('Closed Bots Upload Laufzeit verwendet:', closedBotsUploadRuntime, '-> Stunden:', runtimeHoursForGridProfit);
        } else if (activeIsStartMetric) {
          // Bei Startmetrik: Upload Laufzeit = DURCHSCHNITTLICHE Laufzeit (avgRuntime)
          // NICHT die längste Laufzeit! Upload-Laufzeit soll avgRuntime replizieren.
          const avgRuntimeStr = toStr(calculatedValues.avgRuntime);
          uploadRuntimeValue = avgRuntimeStr; // Durchschnittliche Laufzeit als Upload Laufzeit
          runtimeHoursForGridProfit = parseLongestRuntime(avgRuntimeStr);
        } else if (lastUploadDateTime) {
          // Bei normalem Upload: Upload Laufzeit = This Upload - Last Upload
          uploadRuntimeValue = calculateRuntimeDiff(lastUploadDateTime);
          runtimeHoursForGridProfit = (now.getTime() - lastUploadDateTime.getTime()) / (1000 * 60 * 60);
        }
        
        // Grid Profit Durchschnitt berechnen (Frontend-Berechnung, NICHT von Modi beeinflusst)
        // Formel: Gesamter Grid Profit (USDT) / Upload-Laufzeit (Stunden)
        let avgGridProfitHourCalc = '';
        let avgGridProfitDayCalc = '';
        let avgGridProfitWeekCalc = '';
        
        const overallGridProfitValue = parseFloat(toStr(calculatedValues.overallGridProfitUsdt)) || 0;
        
        // Durchschnitt Grid Profit USDT berechnen: Gesamter Grid Profit / Anzahl Screenshots
        // Bis zu 4 Nachkommastellen erlaubt, unnötige Nullen werden entfernt
        const screenshotCount = activeExtractedData?.screenshots?.length || 1;
        const avgGridProfitUsdtRaw = screenshotCount > 0 
          ? (overallGridProfitValue / screenshotCount)
          : 0;
        const avgGridProfitUsdtCalc = avgGridProfitUsdtRaw !== 0
          ? parseFloat(avgGridProfitUsdtRaw.toFixed(4)).toString()
          : '0';
        
        if (runtimeHoursForGridProfit > 0 && overallGridProfitValue !== 0) {
          const perHour = overallGridProfitValue / runtimeHoursForGridProfit;
          const perDay = perHour * 24;
          const perWeek = perHour * 168; // 24 * 7
          
          // 2 Nachkommastellen für Grid Profit Durchschnitt
          avgGridProfitHourCalc = perHour.toFixed(2);
          avgGridProfitDayCalc = perDay.toFixed(2);
          avgGridProfitWeekCalc = perWeek.toFixed(2);
        }
        
        // Change-Werte berechnen (alle 6 Kombinationen: 3 Zeiträume × 2 Einheiten)
        // Formel: Change $ = Aktueller Wert - Letzter Wert
        // Formel: Change % = ((Aktueller Wert - Letzter Wert) / |Letzter Wert|) × 100
        let changeHourDollarCalc = '';
        let changeHourPercentCalc = '';
        let changeDayDollarCalc = '';
        let changeDayPercentCalc = '';
        let changeWeekDollarCalc = '';
        let changeWeekPercentCalc = '';
        
        // Change für Ø Grid Profit (avgGridProfitUsdt aktuell vs lastHighestGridProfit)
        // Formel: Change $ = aktueller Ø Grid Profit USDT - letzter Ø Grid Profit USDT
        // Formel: Change % = ((Differenz) / |letzter Wert|) × 100
        let avgGridProfitChangeDollarCalc = '';
        let avgGridProfitChangePercentCalc = '';
        
        const currentAvgGridProfitUsdt = parseFloat(avgGridProfitUsdtCalc) || 0;
        const lastAvgGridProfitUsdtNum = parseFloat(lastHighestGridProfitValue) || 0;
        
        if (!activeIsStartMetric && lastAvgGridProfitUsdtNum !== 0) {
          const diffAvgGridProfit = currentAvgGridProfitUsdt - lastAvgGridProfitUsdtNum;
          avgGridProfitChangeDollarCalc = diffAvgGridProfit.toFixed(2);
          avgGridProfitChangePercentCalc = ((diffAvgGridProfit / Math.abs(lastAvgGridProfitUsdtNum)) * 100).toFixed(2);
        }
        
        const currentHour = parseFloat(avgGridProfitHourCalc) || 0;
        const currentDay = parseFloat(avgGridProfitDayCalc) || 0;
        const currentWeek = parseFloat(avgGridProfitWeekCalc) || 0;
        const lastHour = parseFloat(lastAvgGridProfitHourValue) || 0;
        const lastDay = parseFloat(lastAvgGridProfitDayValue) || 0;
        const lastWeek = parseFloat(lastAvgGridProfitWeekValue) || 0;
        
        // Nur berechnen wenn es vorherige Werte gibt (nicht bei Startmetrik)
        if (!activeIsStartMetric && (lastHour !== 0 || lastDay !== 0 || lastWeek !== 0)) {
          // Stunde
          const diffHour = currentHour - lastHour;
          changeHourDollarCalc = diffHour.toFixed(2);
          if (lastHour !== 0) {
            changeHourPercentCalc = ((diffHour / Math.abs(lastHour)) * 100).toFixed(2);
          }
          
          // Tag
          const diffDay = currentDay - lastDay;
          changeDayDollarCalc = diffDay.toFixed(2);
          if (lastDay !== 0) {
            changeDayPercentCalc = ((diffDay / Math.abs(lastDay)) * 100).toFixed(2);
          }
          
          // Woche
          const diffWeek = currentWeek - lastWeek;
          changeWeekDollarCalc = diffWeek.toFixed(2);
          if (lastWeek !== 0) {
            changeWeekPercentCalc = ((diffWeek / Math.abs(lastWeek)) * 100).toFixed(2);
          }
        }
        
        // === FINALE WERTE FÜR UPLOAD-ZEITFELDER ===
        // Für Closed Bots: Spezielle Datumslogik (thisUpload=EndDate, lastUpload=StartDate, uploadRuntime=Laufzeit)
        // Für Update Metrics: Standard-Logik (thisUpload=jetzt, lastUpload=letzter Upload, uploadRuntime=Differenz)
        const finalThisUpload = isClosedBots && closedBotsThisUpload ? closedBotsThisUpload : currentDateTimeDisplay;
        const finalLastUpload = isClosedBots && closedBotsLastUpload ? closedBotsLastUpload : lastUploadDate;
        const finalUploadRuntime = isClosedBots && closedBotsUploadRuntime ? closedBotsUploadRuntime : uploadRuntimeValue;
        
        // Für Closed Bots: date = aktuelles Speicherdatum (wann der User es hochgeladen hat)
        // Für Update Metrics: date bleibt wie gehabt (AI-Datum bei Startmetrik, sonst aktuelles Datum)
        const finalDateValue = isClosedBots ? currentDateTime : dateValue;
        
        useSetFormData(prev => ({
          ...prev,
          date: finalDateValue,
          botDirection: botDirection,
          leverage: toStr(calculatedValues.leverage),
          longestRuntime: toStr(calculatedValues.longestRuntime),
          avgRuntime: toStr(calculatedValues.avgRuntime),
          uploadRuntime: finalUploadRuntime, // Closed Bots: Bot-Laufzeit, Update Metrics: This-Last Differenz
          thisUpload: finalThisUpload, // Closed Bots: End Date, Update Metrics: aktuelles Datum
          lastUpload: finalLastUpload, // Closed Bots: Start Date (berechnet), Update Metrics: letzter Upload
          investment: toStr(calculatedValues.investment),
          extraMargin: toStr(calculatedValues.extraMargin),
          totalInvestment: toStr(calculatedValues.totalInvestment),
          profit: formatDecimal2(calculatedValues.profit), // Gesamtprofit: immer 2 Nachkommastellen
          profitPercent: toStr(calculatedValues.profitPercent_gesamtinvestment || calculatedValues.profitPercent),
          overallTrendPnlUsdt: formatUsdt(calculatedValues.overallTrendPnlUsdt), // USDT: bis zu 4 Dezimalstellen
          overallTrendPnlPercent: toStr(calculatedValues.overallTrendPnlPercent_gesamtinvestment || calculatedValues.overallTrendPnlPercent),
          overallGridProfitUsdt: formatUsdt(calculatedValues.overallGridProfitUsdt), // USDT: bis zu 4 Dezimalstellen
          overallGridProfitPercent: toStr(calculatedValues.overallGridProfitPercent_gesamtinvestment || calculatedValues.overallGridProfitPercent),
          highestGridProfit: formatUsdt(calculatedValues.highestGridProfit), // USDT: bis zu 4 Dezimalstellen
          highestGridProfitPercent: toStr(calculatedValues.highestGridProfitPercent_gesamtinvestment || calculatedValues.highestGridProfitPercent),
          avgGridProfitUsdt: avgGridProfitUsdtCalc, // Frontend-berechnet: Gesamter Grid Profit / Anzahl Screenshots
          avgGridProfitHour: avgGridProfitHourCalc, // Frontend-berechnet: Gesamter Grid Profit / Upload-Laufzeit
          avgGridProfitDay: avgGridProfitDayCalc,   // = Stunde × 24
          avgGridProfitWeek: avgGridProfitWeekCalc, // = Stunde × 168
          // Last Grid Profit Durchschnitt (vom vorherigen Upload)
          lastAvgGridProfitHour: lastAvgGridProfitHourValue,
          lastAvgGridProfitDay: lastAvgGridProfitDayValue,
          lastAvgGridProfitWeek: lastAvgGridProfitWeekValue,
          // Last Ø Grid Profit (vorheriger highestGridProfit Wert)
          lastHighestGridProfit: lastHighestGridProfitValue,
          // Change für Ø Grid Profit (aktueller highestGridProfit vs vorheriger)
          avgGridProfitChangeDollar: avgGridProfitChangeDollarCalc,
          avgGridProfitChangePercent: avgGridProfitChangePercentCalc,
          // Change-Werte (alle 6 Kombinationen)
          changeHourDollar: changeHourDollarCalc,
          changeHourPercent: changeHourPercentCalc,
          changeDayDollar: changeDayDollarCalc,
          changeDayPercent: changeDayPercentCalc,
          changeWeekDollar: changeWeekDollarCalc,
          changeWeekPercent: changeWeekPercentCalc,
          botCount: toStr(calculatedValues.screenshotCount) || String(activeExtractedData?.screenshots?.length || selectedFiles.length || 0)
        }));
        
        console.log('Form data UPDATED successfully');
        
        setChatMessages(prev => [...prev, {
          role: 'ai',
          content: 'Ausgabe abgeschlossen. Alle Werte wurden in die Formularfelder eingetragen.'
        }]);
        
        toast({
          title: "Auto-Fill abgeschlossen",
          description: "Alle berechneten Werte wurden in die Formularfelder eingetragen.",
        });
        
        setIsAiLoading(false);
        console.log('setTimeout callback COMPLETED');
      }, 1000);
    } catch (error) {
      console.error('Phase 4 error:', error);
      setChatMessages(prev => [...prev, {
        role: 'ai',
        content: 'Fehler bei der Berechnung. Bitte versuchen Sie es erneut.'
      }]);
      toast({
        title: "Fehler",
        description: "Phase 4 konnte nicht abgeschlossen werden.",
        variant: "destructive",
      });
      setIsAiLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.botType || !formData.version) {
      toast({
        title: "Fehler",
        description: "Bitte wählen Sie einen Bot-Typ aus und geben Sie eine Version ein.",
        variant: "destructive",
      });
      return;
    }
    
    uploadMutation.mutate({
      ...formData,
      botTypeId: selectedBotTypeId,
      botType: formData.botType || null,
      version: formData.version || null,
      date: formData.date || null,
      botName: formData.botName || formData.botType,
      extraMargin: formData.extraMargin || null,
      longestRuntime: formData.longestRuntime || null,
      avgRuntime: formData.avgRuntime || null,
      avgGridProfitHour: formData.avgGridProfitHour || null,
      avgGridProfitDay: formData.avgGridProfitDay || null,
      avgGridProfitWeek: formData.avgGridProfitWeek || null,
      overallTrendPnlUsdt: formData.overallTrendPnlUsdt || null,
      overallTrendPnlPercent: formData.overallTrendPnlPercent || null,
      highestGridProfit: formData.highestGridProfit || null,
      highestGridProfitPercent: formData.highestGridProfitPercent || null,
      overallGridProfitUsdt: formData.overallGridProfitUsdt || null,
      overallGridProfitPercent: formData.overallGridProfitPercent || null,
      leverage: formData.leverage || null,
      // Last Ø Grid Profit und Change Felder
      lastAvgGridProfitUsdt: formData.lastHighestGridProfit || null,
      avgGridProfitChangeDollar: formData.avgGridProfitChangeDollar || null,
      avgGridProfitChangePercent: formData.avgGridProfitChangePercent || null,
      // Ø Grid Profit (%) - beide Basen
      avgGridProfitPercent_gesamtinvestment: calculatedPercents.avgGridProfitPercent_gesamtinvestment || null,
      avgGridProfitPercent_investitionsmenge: calculatedPercents.avgGridProfitPercent_investitionsmenge || null,
    } as any);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold mb-2" data-testid="heading-upload">AI Analyse</h1>
        <p className="text-muted-foreground mb-8">
          Nutzen Sie die AI-Analyse für Ihre Pionex-Bot-Ergebnisse und geben Sie die Details ein.
        </p>

        <div className="space-y-6">
          <BotTypeManager
            selectedBotTypeId={outputMode === 'update-metrics' ? selectedBotTypeId : closedSelectedBotTypeId}
            onSelectBotType={handleSelectBotType}
            onEditBotType={handleEditBotType}
            onUpdateBotType={handleUpdateBotType}
          />

          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">AI Chat Interface</h2>
              
              <div 
                ref={chatContainerRef}
                className="h-64 mb-4 border rounded-lg p-4 overflow-y-auto"
              >
                {chatMessages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-center">
                    <p className="text-sm text-muted-foreground">
                      Laden Sie Screenshots hoch und senden Sie diese an die AI für automatische Analyse.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {chatMessages.map((msg, index) => (
                      <div
                        key={index}
                        className={cn(
                          "p-3 rounded-lg",
                          msg.role === 'user' 
                            ? "bg-primary text-primary-foreground ml-8" 
                            : "bg-muted mr-8"
                        )}
                        data-testid={`chat-message-${index}`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    ))}
                    {isAiLoading && (
                      <div className="bg-muted p-3 rounded-lg mr-8">
                        <p className="text-sm text-muted-foreground">AI antwortet...</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-2 items-center">
                <Input
                  className="flex-1"
                  placeholder="Nachricht an AI..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleChatSend();
                    }
                  }}
                  disabled={isAiLoading}
                  data-testid="input-chat"
                />
                
                {waitingForConfirmation && (
                  <>
                    <Button 
                      size="icon"
                      variant="outline"
                      onClick={handleEditClick}
                      data-testid="button-edit"
                      title="Bearbeiten"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="icon"
                      onClick={handleConfirmClick}
                      data-testid="button-confirm"
                      title="Phase 2 Schritt 1 starten"
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                  </>
                )}
                
                {getActivePhaseTwoVerified() && !getActivePhaseTwoStep2Complete() && (
                  <Button 
                    size="icon"
                    onClick={handleStep2Click}
                    disabled={isAiLoading}
                    data-testid="button-confirm-step2"
                    title="Phase 2 Schritt 2 starten"
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                )}
                
                {getActiveWaitingForPhaseThreeConfirmation() && (
                  <Button 
                    size="icon"
                    onClick={handleConfirmPhaseThree}
                    disabled={isAiLoading}
                    data-testid="button-confirm-phase3"
                    title="Phase 4 starten"
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                )}
                
                {!waitingForConfirmation && !getActivePhaseTwoVerified() && !getActiveWaitingForPhaseThreeConfirmation() && (
                  <Button 
                    onClick={handleChatSend}
                    size="icon"
                    disabled={isAiLoading || !chatInput.trim()}
                    data-testid="button-send-chat"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Screenshot hochladen</h2>
              
              <div className="border-2 border-dashed rounded-lg p-6 text-center bg-muted/30 hover-elevate mb-4">
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileChange}
                  multiple
                  data-testid="input-file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <UploadIcon className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-1">
                    Klicken Sie hier oder ziehen Sie eine Datei hierher
                  </p>
                  <p className="text-xs text-muted-foreground">PNG, JPG bis zu 10MB</p>
                </label>
              </div>

              {selectedFiles.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium" data-testid="text-file-count">
                      {selectedFiles.length} {selectedFiles.length === 1 ? 'Datei' : 'Dateien'} ausgewählt
                    </span>
                  </div>
                  <ScrollArea className="max-h-32">
                    <div className="space-y-2">
                      {selectedFiles.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between gap-2 p-2 bg-muted/50 rounded-md"
                          data-testid={`file-item-${index}`}
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <ImageIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                            <span className="text-sm truncate">{file.name}</span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveFile(index)}
                            data-testid={`button-remove-file-${index}`}
                            className="h-8 w-8 shrink-0"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              <Button 
                onClick={handleSendToAI}
                className="w-full"
                disabled={selectedFiles.length === 0 || isAiLoading}
                data-testid="button-send-to-ai"
              >
                <Send className="w-4 h-4 mr-2" />
                {isAiLoading ? 'Analysiere...' : 'An AI senden'}
              </Button>
            </Card>
          </div>

          <Card className="p-8">
            <div className="flex items-center gap-2 mb-6">
              <Button
                type="button"
                variant={outputMode === 'update-metrics' ? 'default' : 'outline'}
                onClick={() => {
                  // Synchronisiere Bot-Typ-Auswahl beim Mode-Wechsel
                  if (closedSelectedBotTypeId && !selectedBotTypeId) {
                    setSelectedBotTypeId(closedSelectedBotTypeId);
                  }
                  setOutputMode('update-metrics');
                }}
                data-testid="button-update-metrics"
                className="flex-1"
              >
                Update Metrics
              </Button>
              <Button
                type="button"
                variant={outputMode === 'closed-bots' ? 'default' : 'outline'}
                onClick={() => {
                  // Synchronisiere Bot-Typ-Auswahl beim Mode-Wechsel
                  if (selectedBotTypeId && !closedSelectedBotTypeId) {
                    setClosedSelectedBotTypeId(selectedBotTypeId);
                  }
                  setOutputMode('closed-bots');
                }}
                data-testid="button-closed-bots"
                className="flex-1"
              >
                Closed Bots
              </Button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="space-y-8">
                <div className="border border-cyan-500 rounded-lg p-4 bg-white space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-base font-semibold text-foreground">Bot Type</h3>
                    <Button 
                      type="button"
                      size="sm"
                      data-testid="button-save"
                      onClick={() => {
                        if (!formData.botType || !formData.version) {
                          toast({
                            title: "Fehler",
                            description: "Bitte wählen Sie einen Bot-Typ aus und geben Sie eine Version ein.",
                            variant: "destructive",
                          });
                          return;
                        }
                        
                        const modeText = outputMode === 'update-metrics' ? 'Update Metrics' : 'Closed Bots';
                        setChatMessages(prev => [...prev, {
                          role: 'user',
                          content: `${modeText}\n\nBot Type: ${formData.botType}\nID: ${selectedBotTypeColor}\nVersion: ${formData.version}`
                        }]);
                        
                        setBotTypeSent(true);
                        
                        if (editMode && screenshotsBeforeEdit) {
                          setScreenshotsSent(true);
                          setEditMode(false);
                          setScreenshotsBeforeEdit(false);
                          
                          setTimeout(() => {
                            setChatMessages(prev => [...prev, {
                              role: 'ai',
                              content: 'Perfekt! Ich habe beide Informationen erhalten. Soll ich fortfahren und diese beiden Sachen überprüfen?'
                            }]);
                            setWaitingForConfirmation(true);
                          }, 500);
                        } else {
                          setTimeout(() => {
                            sendPhaseOneAiResponse('botType');
                          }, 500);
                        }
                        
                        toast({
                          title: "Bot Type gesendet",
                          description: "Die Bot Type Informationen wurden an die AI gesendet.",
                        });
                      }}
                    >
                      Save
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="botType">Bot Type</Label>
                      <Input
                        id="botType"
                        type="text"
                        placeholder="z.B. Grid Bot"
                        value={formData.botType}
                        readOnly
                        className="bg-muted/50"
                        data-testid="input-bot-type"
                      />
                    </div>
                    <div>
                      <Label htmlFor="botTypeId">ID</Label>
                      <Input
                        id="botTypeId"
                        type="text"
                        placeholder="Bot Type ID"
                        value={selectedBotTypeColor || ''}
                        readOnly
                        className="bg-muted/50"
                        data-testid="input-bot-type-id"
                      />
                    </div>
                    <div>
                      <Label htmlFor="version">Version</Label>
                      <Input
                        id="version"
                        type="text"
                        placeholder="z.B. v1.0"
                        value={formData.version}
                        onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                        readOnly={botTypeSent && !editMode}
                        className={botTypeSent && !editMode ? 'bg-muted/50' : ''}
                        data-testid="input-version"
                      />
                    </div>
                  </div>
                </div>

                {outputMode === 'update-metrics' && (
                  <>
                    {!phaseTwoVerified && (
                      <div className="border border-yellow-500 bg-yellow-50 rounded-lg p-4">
                        <p className="text-sm text-yellow-800 font-medium">
                          {!phaseOneComplete ? (
                            <>⚠️ Phase 1: Bitte zuerst {!screenshotsSent && 'Screenshots hochladen & an AI senden'}{!screenshotsSent && !botTypeSent && ' + '}{!botTypeSent && 'Bot Type speichern'}</>
                          ) : (
                            <>⚠️ Phase 2: Bitte bestätigen Sie die Bot Type Informationen mit dem Haken-Icon im AI Chat</>
                          )}
                        </p>
                        <p className="text-xs text-yellow-700 mt-1">
                          Die Analyse-Einstellungen können erst ausgefüllt werden, wenn Phase 1 und Phase 2 abgeschlossen sind.
                        </p>
                      </div>
                    )}
                    <div className="border border-cyan-500 rounded-lg p-4 bg-white space-y-4">
                      <div className="flex items-center justify-between gap-4">
                        <h3 className="text-base font-semibold text-foreground">Info</h3>
                        <div className="flex items-center gap-2">
                          <Label className="text-sm text-muted-foreground whitespace-nowrap">Modus:</Label>
                          <Select
                            value={isStartMetric ? 'Startmetrik' : infoSectionMode}
                            onValueChange={(value: 'Normal' | 'Startmetrik') => setInfoSectionMode(value)}
                            disabled={isStartMetric}
                          >
                            <SelectTrigger className={`w-32 h-8 ${isStartMetric ? 'opacity-50 cursor-not-allowed' : ''}`} data-testid="select-info-mode">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Normal">Normal</SelectItem>
                              <SelectItem value="Startmetrik">Startmetrik</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="date" className={!phaseTwoVerified ? 'text-muted-foreground' : ''}>Datum und Uhrzeit</Label>
                      <Input
                        id="date"
                        type="datetime-local"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        disabled={!phaseTwoVerified}
                        data-testid="input-date"
                      />
                    </div>

                    <div>
                      <Label htmlFor="botDirection" className={!phaseTwoVerified ? 'text-muted-foreground' : ''}>Bot-Richtung</Label>
                      <Input
                        id="botDirection"
                        type="text"
                        placeholder="Long, Short, Neutral, Long+Short"
                        value={formData.botDirection}
                        readOnly
                        className="bg-muted"
                        data-testid="input-bot-direction"
                      />
                    </div>

                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="leverage" className={!phaseTwoVerified ? 'text-muted-foreground' : ''}>Hebel</Label>
                      <Input
                        id="leverage"
                        type="text"
                        placeholder="z.B. 1x, 5x, 10x"
                        value={formData.leverage}
                        onChange={(e) => setFormData({ ...formData, leverage: e.target.value })}
                        disabled={!phaseTwoVerified}
                        data-testid="input-leverage"
                      />
                    </div>

                    <div>
                      <Label htmlFor="botCount" className={!phaseTwoVerified ? 'text-muted-foreground' : ''}>Anzahl</Label>
                      <Input
                        id="botCount"
                        type="text"
                        placeholder="z.B. 1, 2, 3"
                        value={formData.botCount}
                        readOnly
                        className="bg-muted"
                        data-testid="input-bot-count"
                      />
                    </div>

                    <div>
                      <Label htmlFor="longestRuntime" className={!phaseTwoVerified ? 'text-muted-foreground' : ''}>Längste Laufzeit</Label>
                      <Input
                        id="longestRuntime"
                        type="text"
                        placeholder="z.B. 2d 5h 30s"
                        value={formData.longestRuntime}
                        onChange={(e) => setFormData({ ...formData, longestRuntime: e.target.value })}
                        disabled={!phaseTwoVerified}
                        data-testid="input-longest-runtime"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <Label htmlFor="avgRuntime" className={!phaseTwoVerified ? 'text-muted-foreground' : ''}>Durchschn. Laufzeit</Label>
                      <Input
                        id="avgRuntime"
                        type="text"
                        placeholder="z.B. 1d 3h 15s"
                        value={formData.avgRuntime}
                        onChange={(e) => {
                          setFormData({ ...formData, avgRuntime: e.target.value });
                          handleManualOverride('avgRuntime', e.target.value);
                        }}
                        disabled={!phaseTwoVerified}
                        data-testid="input-avg-runtime"
                      />
                    </div>

                    <div>
                      <Label htmlFor="uploadRuntime" className={!phaseTwoVerified ? 'text-muted-foreground' : ''}>Upload Laufzeit</Label>
                      <Input
                        id="uploadRuntime"
                        type="text"
                        placeholder="z.B. 1d 3h 15s"
                        value={formData.uploadRuntime}
                        onChange={(e) => {
                          setFormData({ ...formData, uploadRuntime: e.target.value });
                          handleManualOverride('uploadRuntime', e.target.value);
                        }}
                        disabled={!phaseTwoVerified}
                        data-testid="input-upload-runtime"
                      />
                    </div>

                    <div>
                      <Label htmlFor="lastUpload" className={!phaseTwoVerified ? 'text-muted-foreground' : ''}>Last Upload</Label>
                      <Input
                        id="lastUpload"
                        type="text"
                        placeholder="TT.MM.JJJJ HH:MM"
                        value={formData.lastUpload}
                        onChange={(e) => {
                          setFormData({ ...formData, lastUpload: e.target.value });
                          handleManualOverride('lastUpload', e.target.value);
                        }}
                        disabled={!phaseTwoVerified}
                        data-testid="input-last-upload"
                      />
                    </div>

                    <div>
                      <Label htmlFor="thisUpload" className={!phaseTwoVerified ? 'text-muted-foreground' : ''}>This Upload</Label>
                      <Input
                        id="thisUpload"
                        type="text"
                        placeholder="TT.MM.JJJJ HH:MM"
                        value={formData.thisUpload}
                        onChange={(e) => setFormData({ ...formData, thisUpload: e.target.value })}
                        disabled={!phaseTwoVerified}
                        data-testid="input-this-upload"
                      />
                    </div>
                  </div>
                </div>

                <div className="border border-cyan-500 rounded-lg p-4 bg-white space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-base font-semibold text-foreground">Investment</h3>
                    <Select value={investmentTimeRange} onValueChange={setInvestmentTimeRange} disabled>
                      <SelectTrigger className="w-40 h-8 text-xs" data-testid="select-investment-timerange">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Vergleich">Vergleich</SelectItem>
                        <SelectItem value="Neu">Neu</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="investment">Investitionsmenge (USDT)</Label>
                      <Input
                        id="investment"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={formData.investment}
                        onChange={(e) => {
                          setFormData({ ...formData, investment: e.target.value });
                          handleManualOverride('investment', e.target.value);
                        }}
                        required
                        data-testid="input-investment"
                      />
                    </div>

                    <div>
                      <Label htmlFor="extraMargin">Extra Margin</Label>
                      <Input
                        id="extraMargin"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={formData.extraMargin}
                        onChange={(e) => {
                          setFormData({ ...formData, extraMargin: e.target.value });
                          handleManualOverride('extraMargin', e.target.value);
                        }}
                        data-testid="input-extra-margin"
                      />
                    </div>

                    <div>
                      <Label htmlFor="totalInvestment">Gesamtinvestment</Label>
                      <Input
                        id="totalInvestment"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={formData.totalInvestment}
                        onChange={(e) => setFormData({ ...formData, totalInvestment: e.target.value })}
                        data-testid="input-total-investment"
                      />
                    </div>
                  </div>
                </div>

                <div className="border border-cyan-500 rounded-lg p-4 bg-white space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-base font-semibold text-foreground">Gesamter Profit / P&L</h3>
                    <Select value={profitTimeRange} onValueChange={setProfitTimeRange}>
                      <SelectTrigger className="w-40 h-8 text-xs" data-testid="select-profit-timerange">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Vergleich">Vergleich</SelectItem>
                        <SelectItem value="Neu">Neu</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative">
                      <Label htmlFor="profit">Gesamtprofit (USDT)</Label>
                      <span className="absolute left-3 bottom-2.5 text-sm text-muted-foreground font-medium">{getSignPrefix(formData.profit)}</span>
                      <Input
                        id="profit"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        className={getSignPrefix(formData.profit) ? "pl-6" : ""}
                        value={formData.profit}
                        onChange={(e) => setFormData({ ...formData, profit: e.target.value })}
                        required
                        data-testid="input-profit"
                      />
                    </div>

                    <div>
                      <Label htmlFor="profitPercent">Gesamtprofit (%)</Label>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-2.5 text-sm text-muted-foreground font-medium">{getSignPrefix(formData.profitPercent)}</span>
                          <Input
                            id="profitPercent"
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            className={getSignPrefix(formData.profitPercent) ? "pl-6" : ""}
                            value={formData.profitPercent}
                            onChange={(e) => setFormData({ ...formData, profitPercent: e.target.value })}
                            data-testid="input-profit-percent"
                          />
                        </div>
                        <Select value={profitPercentBase} onValueChange={(val) => setProfitPercentBase(val as 'gesamtinvestment' | 'investitionsmenge')}>
                          <SelectTrigger className="w-44 h-10 text-xs" data-testid="select-profit-percent-base">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="gesamtinvestment">Gesamtinvestment</SelectItem>
                            <SelectItem value="investitionsmenge">Investitionsmenge</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border border-cyan-500 rounded-lg p-4 bg-white space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-base font-semibold text-foreground">Trend P&L</h3>
                    <Select value={trendTimeRange} onValueChange={setTrendTimeRange}>
                      <SelectTrigger className="w-40 h-8 text-xs" data-testid="select-trend-timerange">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Vergleich">Vergleich</SelectItem>
                        <SelectItem value="Neu">Neu</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative">
                      <Label htmlFor="overallTrendPnlUsdt">Trend P&L (USDT)</Label>
                      <span className="absolute left-3 bottom-2.5 text-sm text-muted-foreground font-medium">{getSignPrefix(formData.overallTrendPnlUsdt)}</span>
                      <Input
                        id="overallTrendPnlUsdt"
                        type="number"
                        step="0.0001"
                        placeholder="0.0000"
                        className={getSignPrefix(formData.overallTrendPnlUsdt) ? "pl-6" : ""}
                        value={formData.overallTrendPnlUsdt}
                        onChange={(e) => setFormData({ ...formData, overallTrendPnlUsdt: e.target.value })}
                        data-testid="input-overall-trend-pnl-usdt"
                      />
                    </div>
                    <div>
                      <Label htmlFor="overallTrendPnlPercent">Trend P&L (%)</Label>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-2.5 text-sm text-muted-foreground font-medium">{getSignPrefix(formData.overallTrendPnlPercent)}</span>
                          <Input
                            id="overallTrendPnlPercent"
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            className={getSignPrefix(formData.overallTrendPnlPercent) ? "pl-6" : ""}
                            value={formData.overallTrendPnlPercent}
                            onChange={(e) => setFormData({ ...formData, overallTrendPnlPercent: e.target.value })}
                            data-testid="input-overall-trend-pnl-percent"
                          />
                        </div>
                        <Select value={trendPercentBase} onValueChange={(val) => setTrendPercentBase(val as 'gesamtinvestment' | 'investitionsmenge')}>
                          <SelectTrigger className="w-44 h-10 text-xs" data-testid="select-trend-percent-base">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="gesamtinvestment">Gesamtinvestment</SelectItem>
                            <SelectItem value="investitionsmenge">Investitionsmenge</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border border-cyan-500 rounded-lg p-4 bg-white space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-base font-semibold text-foreground">Grid Trading</h3>
                    <Select value={gridTimeRange} onValueChange={setGridTimeRange}>
                      <SelectTrigger className="w-40 h-8 text-xs" data-testid="select-grid-timerange">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Vergleich">Vergleich</SelectItem>
                        <SelectItem value="Neu">Neu</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <Label>Grid Profit Durchschnitt</Label>
                      <div className="grid grid-cols-3 gap-3 mt-2">
                        <div className="relative">
                          <Label htmlFor="avgGridProfitHour" className="text-xs text-muted-foreground">Stunde</Label>
                          <span className="absolute left-3 bottom-2.5 text-sm text-muted-foreground font-medium">{getSignPrefix(formData.avgGridProfitHour)}</span>
                          <Input
                            id="avgGridProfitHour"
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            className={getSignPrefix(formData.avgGridProfitHour) ? "pl-6" : ""}
                            value={formData.avgGridProfitHour}
                            onChange={(e) => setFormData({ ...formData, avgGridProfitHour: e.target.value })}
                            data-testid="input-avg-grid-profit-hour"
                          />
                        </div>
                        <div className="relative">
                          <Label htmlFor="avgGridProfitDay" className="text-xs text-muted-foreground">Tag</Label>
                          <span className="absolute left-3 bottom-2.5 text-sm text-muted-foreground font-medium">{getSignPrefix(formData.avgGridProfitDay)}</span>
                          <Input
                            id="avgGridProfitDay"
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            className={getSignPrefix(formData.avgGridProfitDay) ? "pl-6" : ""}
                            value={formData.avgGridProfitDay}
                            onChange={(e) => setFormData({ ...formData, avgGridProfitDay: e.target.value })}
                            data-testid="input-avg-grid-profit-day"
                          />
                        </div>
                        <div className="relative">
                          <Label htmlFor="avgGridProfitWeek" className="text-xs text-muted-foreground">Woche</Label>
                          <span className="absolute left-3 bottom-2.5 text-sm text-muted-foreground font-medium">{getSignPrefix(formData.avgGridProfitWeek)}</span>
                          <Input
                            id="avgGridProfitWeek"
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            className={getSignPrefix(formData.avgGridProfitWeek) ? "pl-6" : ""}
                            value={formData.avgGridProfitWeek}
                            onChange={(e) => setFormData({ ...formData, avgGridProfitWeek: e.target.value })}
                            data-testid="input-avg-grid-profit-week"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label>Last Grid Profit Durchschnitt (Zeit)</Label>
                      <div className="grid grid-cols-4 gap-2 mt-2">
                        <div 
                          className="relative cursor-pointer"
                          onClick={() => setSelectedChangeTimeframe('hour')}
                        >
                          <Label htmlFor="lastAvgGridProfitHour" className="text-xs text-muted-foreground">Stunde</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-2.5 text-sm text-muted-foreground font-medium">{getSignPrefix(formData.lastAvgGridProfitHour)}</span>
                            <Input
                              id="lastAvgGridProfitHour"
                              type="text"
                              placeholder="0,00"
                              className={`bg-muted/50 cursor-pointer ${selectedChangeTimeframe === 'hour' ? 'ring-2 ring-primary' : ''} ${getSignPrefix(formData.lastAvgGridProfitHour) ? "pl-6" : ""}`}
                              value={formatGermanDecimal(formData.lastAvgGridProfitHour)}
                              readOnly
                              data-testid="input-last-avg-grid-profit-hour"
                            />
                          </div>
                        </div>
                        <div 
                          className="relative cursor-pointer"
                          onClick={() => setSelectedChangeTimeframe('day')}
                        >
                          <Label htmlFor="lastAvgGridProfitDay" className="text-xs text-muted-foreground">Tag</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-2.5 text-sm text-muted-foreground font-medium">{getSignPrefix(formData.lastAvgGridProfitDay)}</span>
                            <Input
                              id="lastAvgGridProfitDay"
                              type="text"
                              placeholder="0,00"
                              className={`bg-muted/50 cursor-pointer ${selectedChangeTimeframe === 'day' ? 'ring-2 ring-primary' : ''} ${getSignPrefix(formData.lastAvgGridProfitDay) ? "pl-6" : ""}`}
                              value={formatGermanDecimal(formData.lastAvgGridProfitDay)}
                              readOnly
                              data-testid="input-last-avg-grid-profit-day"
                            />
                          </div>
                        </div>
                        <div 
                          className="relative cursor-pointer"
                          onClick={() => setSelectedChangeTimeframe('week')}
                        >
                          <Label htmlFor="lastAvgGridProfitWeek" className="text-xs text-muted-foreground">Woche</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-2.5 text-sm text-muted-foreground font-medium">{getSignPrefix(formData.lastAvgGridProfitWeek)}</span>
                            <Input
                              id="lastAvgGridProfitWeek"
                              type="text"
                              placeholder="0,00"
                              className={`bg-muted/50 cursor-pointer ${selectedChangeTimeframe === 'week' ? 'ring-2 ring-primary' : ''} ${getSignPrefix(formData.lastAvgGridProfitWeek) ? "pl-6" : ""}`}
                              value={formatGermanDecimal(formData.lastAvgGridProfitWeek)}
                              readOnly
                              data-testid="input-last-avg-grid-profit-week"
                            />
                          </div>
                        </div>
                        <div className="relative">
                          <Label htmlFor="changeDisplay" className="text-xs text-muted-foreground">Change</Label>
                          <div className="flex gap-1">
                            <div className="relative flex-1">
                              <span className="absolute left-3 top-2.5 text-sm text-muted-foreground font-medium">
                                {getSignPrefix(
                                  chainedUnit === '$' 
                                    ? (selectedChangeTimeframe === 'hour' ? formData.changeHourDollar : selectedChangeTimeframe === 'day' ? formData.changeDayDollar : formData.changeWeekDollar)
                                    : (selectedChangeTimeframe === 'hour' ? formData.changeHourPercent : selectedChangeTimeframe === 'day' ? formData.changeDayPercent : formData.changeWeekPercent)
                                )}
                              </span>
                              <Input
                                id="changeDisplay"
                                type="text"
                                placeholder="0,00"
                                className={`bg-muted/50 ring-2 ring-primary ${
                                  getSignPrefix(
                                    chainedUnit === '$' 
                                      ? (selectedChangeTimeframe === 'hour' ? formData.changeHourDollar : selectedChangeTimeframe === 'day' ? formData.changeDayDollar : formData.changeWeekDollar)
                                      : (selectedChangeTimeframe === 'hour' ? formData.changeHourPercent : selectedChangeTimeframe === 'day' ? formData.changeDayPercent : formData.changeWeekPercent)
                                  ) ? "pl-6" : ""
                                }`}
                                value={
                                  chainedUnit === '$' 
                                    ? formatGermanDecimal(selectedChangeTimeframe === 'hour' ? formData.changeHourDollar : selectedChangeTimeframe === 'day' ? formData.changeDayDollar : formData.changeWeekDollar)
                                    : (selectedChangeTimeframe === 'hour' ? formData.changeHourPercent : selectedChangeTimeframe === 'day' ? formData.changeDayPercent : formData.changeWeekPercent)
                                }
                                readOnly
                                data-testid="input-change-display"
                              />
                            </div>
                            <div className="flex border rounded-md overflow-hidden">
                              <button
                                type="button"
                                onClick={() => setChainedUnit('%')}
                                className={`px-2 py-1 text-xs font-medium transition-colors ${chainedUnit === '%' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                                data-testid="toggle-chained-percent"
                              >
                                %
                              </button>
                              <button
                                type="button"
                                onClick={() => setChainedUnit('$')}
                                className={`px-2 py-1 text-xs font-medium transition-colors ${chainedUnit === '$' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                                data-testid="toggle-chained-dollar"
                              >
                                $
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="relative">
                        <Label htmlFor="overallGridProfitUsdt">Gesamter Grid Profit (USDT)</Label>
                        <span className="absolute left-3 bottom-2.5 text-sm text-muted-foreground font-medium">{getSignPrefix(formData.overallGridProfitUsdt)}</span>
                        <Input
                          id="overallGridProfitUsdt"
                          type="number"
                          step="0.0001"
                          placeholder="0.0000"
                          className={getSignPrefix(formData.overallGridProfitUsdt) ? "pl-6" : ""}
                          value={formData.overallGridProfitUsdt}
                          onChange={(e) => {
                            setFormData({ ...formData, overallGridProfitUsdt: e.target.value });
                            handleManualOverride('overallGridProfitUsdt', e.target.value);
                          }}
                          data-testid="input-overall-grid-profit-usdt"
                        />
                      </div>
                      <div>
                        <Label htmlFor="overallGridProfitPercent">Gesamter Grid Profit (%)</Label>
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <span className="absolute left-3 top-2.5 text-sm text-muted-foreground font-medium">{getSignPrefix(formData.overallGridProfitPercent)}</span>
                            <Input
                              id="overallGridProfitPercent"
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              className={getSignPrefix(formData.overallGridProfitPercent) ? "pl-6" : ""}
                              value={formData.overallGridProfitPercent}
                              onChange={(e) => setFormData({ ...formData, overallGridProfitPercent: e.target.value })}
                              data-testid="input-overall-grid-profit-percent"
                            />
                          </div>
                          <Select value={gridProfitPercentBase} onValueChange={(val) => setGridProfitPercentBase(val as 'gesamtinvestment' | 'investitionsmenge')}>
                            <SelectTrigger className="w-44 h-10 text-xs" data-testid="select-grid-profit-percent-base">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="gesamtinvestment">Gesamtinvestment</SelectItem>
                              <SelectItem value="investitionsmenge">Investitionsmenge</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="relative">
                        <Label htmlFor="avgGridProfitUsdt">Ø Grid Profit (USDT)</Label>
                        <span className="absolute left-3 bottom-2.5 text-sm text-muted-foreground font-medium">{getSignPrefix(formData.avgGridProfitUsdt)}</span>
                        <Input
                          id="avgGridProfitUsdt"
                          type="number"
                          step="0.0001"
                          placeholder="0.0000"
                          className={`bg-muted/50 ${getSignPrefix(formData.avgGridProfitUsdt) ? "pl-6" : ""}`}
                          value={formData.avgGridProfitUsdt}
                          readOnly
                          data-testid="input-avg-grid-profit-usdt"
                        />
                      </div>

                      <div>
                        <Label htmlFor="avgGridProfitPercent">Ø Grid Profit (%)</Label>
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <span className="absolute left-3 top-2.5 text-sm text-muted-foreground font-medium">{getSignPrefix(formData.avgGridProfitPercent)}</span>
                            <Input
                              id="avgGridProfitPercent"
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              className={`bg-muted/50 ${getSignPrefix(formData.avgGridProfitPercent) ? "pl-6" : ""}`}
                              value={formData.avgGridProfitPercent || ''}
                              readOnly
                              data-testid="input-avg-grid-profit-percent"
                            />
                          </div>
                          <Select value={highestGridProfitPercentBase} onValueChange={(val) => setHighestGridProfitPercentBase(val as 'gesamtinvestment' | 'investitionsmenge')}>
                            <SelectTrigger className="w-44 h-10 text-xs" data-testid="select-avg-grid-profit-percent-base">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="gesamtinvestment">Gesamtinvestment</SelectItem>
                              <SelectItem value="investitionsmenge">Investitionsmenge</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="relative">
                        <Label htmlFor="lastUploadAvgGridProfit">Last Upload (Ø Grid Profit)</Label>
                        <span className="absolute left-3 bottom-2.5 text-sm text-muted-foreground font-medium">{getSignPrefix(formData.lastHighestGridProfit)}</span>
                        <Input
                          id="lastUploadAvgGridProfit"
                          type="text"
                          placeholder="-"
                          className={`bg-muted/50 ${getSignPrefix(formData.lastHighestGridProfit) ? "pl-6" : ""}`}
                          value={formData.lastHighestGridProfit || '-'}
                          readOnly
                          data-testid="input-last-upload-avg-grid-profit"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="avgGridProfitChange">Change</Label>
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <span className="absolute left-3 top-2.5 text-sm text-muted-foreground font-medium">{getSignPrefix(avgGridProfitChangeUnit === '$' ? formData.avgGridProfitChangeDollar : formData.avgGridProfitChangePercent)}</span>
                            <Input
                              id="avgGridProfitChange"
                              type="text"
                              placeholder="0.00"
                              className={`bg-muted/50 ${getSignPrefix(avgGridProfitChangeUnit === '$' ? formData.avgGridProfitChangeDollar : formData.avgGridProfitChangePercent) ? "pl-6" : ""}`}
                              value={(avgGridProfitChangeUnit === '$' ? formData.avgGridProfitChangeDollar : formData.avgGridProfitChangePercent) || '-'}
                              readOnly
                              data-testid="input-avg-grid-profit-change"
                            />
                          </div>
                          <div className="flex border rounded-md overflow-hidden">
                            <button
                              type="button"
                              className={`px-3 py-2 text-sm font-medium transition-colors ${avgGridProfitChangeUnit === '%' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}
                              onClick={() => setAvgGridProfitChangeUnit('%')}
                              data-testid="button-change-unit-percent"
                            >
                              %
                            </button>
                            <button
                              type="button"
                              className={`px-3 py-2 text-sm font-medium transition-colors ${avgGridProfitChangeUnit === '$' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}
                              onClick={() => setAvgGridProfitChangeUnit('$')}
                              data-testid="button-change-unit-dollar"
                            >
                              $
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                  </>
                )}

                {/* CLOSED BOTS MODUS - Funktional mit eigenen States */}
                {outputMode === 'closed-bots' && (
                  <>
                    {/* Phase-Hinweis für Closed Bots */}
                    {!closedPhaseTwoVerified && (
                      <div className="border border-yellow-500 bg-yellow-50 rounded-lg p-4">
                        <p className="text-sm text-yellow-800 font-medium">
                          {!closedPhaseOneComplete ? (
                            <>Phase 1: Bitte zuerst {!closedScreenshotsSent && 'Screenshots hochladen & an AI senden'}{!closedScreenshotsSent && !closedBotTypeSent && ' + '}{!closedBotTypeSent && 'Bot Type speichern'}</>
                          ) : (
                            <>Phase 2: Bitte bestätigen Sie die Bot Type Informationen mit dem Haken-Icon im AI Chat</>
                          )}
                        </p>
                        <p className="text-xs text-yellow-700 mt-1">
                          Die Analyse-Einstellungen können erst ausgefüllt werden, wenn Phase 1 und Phase 2 abgeschlossen sind.
                        </p>
                      </div>
                    )}
                    {/* Info Section - Closed Bots (funktional) */}
                    <div className="border border-cyan-500 rounded-lg p-4 bg-white space-y-4">
                      <div className="flex items-center justify-between gap-4">
                        <h3 className="text-base font-semibold text-foreground">Info</h3>
                        <div className="flex items-center gap-2">
                          <Label className="text-sm text-muted-foreground whitespace-nowrap">Modus:</Label>
                          <Select
                            value={closedIsStartMetric ? 'Startmetrik' : closedInfoSectionMode}
                            onValueChange={(value: 'Normal' | 'Startmetrik') => setClosedInfoSectionMode(value)}
                            disabled={closedIsStartMetric}
                          >
                            <SelectTrigger className={`w-32 h-8 ${closedIsStartMetric ? 'opacity-50 cursor-not-allowed' : ''}`} data-testid="closed-select-info-mode">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Normal">Normal</SelectItem>
                              <SelectItem value="Startmetrik">Startmetrik</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="closed-date" className={!closedPhaseTwoVerified ? 'text-muted-foreground' : ''}>Datum und Uhrzeit</Label>
                          <Input
                            id="closed-date"
                            type="datetime-local"
                            value={closedFormData.date}
                            onChange={(e) => setClosedFormData({ ...closedFormData, date: e.target.value })}
                            disabled={!closedPhaseTwoVerified}
                            data-testid="closed-input-date"
                          />
                        </div>
                        <div>
                          <Label htmlFor="closed-botDirection" className={!closedPhaseTwoVerified ? 'text-muted-foreground' : ''}>Bot-Richtung</Label>
                          <Input
                            id="closed-botDirection"
                            type="text"
                            placeholder="Long, Short, Neutral, Long+Short"
                            value={closedFormData.botDirection}
                            readOnly
                            className="bg-muted"
                            data-testid="closed-input-bot-direction"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="closed-leverage" className={!closedPhaseTwoVerified ? 'text-muted-foreground' : ''}>Hebel</Label>
                          <Input
                            id="closed-leverage"
                            type="text"
                            placeholder="z.B. 1x, 5x, 10x"
                            value={closedFormData.leverage}
                            onChange={(e) => setClosedFormData({ ...closedFormData, leverage: e.target.value })}
                            disabled={!closedPhaseTwoVerified}
                            data-testid="closed-input-leverage"
                          />
                        </div>
                        <div>
                          <Label htmlFor="closed-botCount" className={!closedPhaseTwoVerified ? 'text-muted-foreground' : ''}>Anzahl</Label>
                          <Input
                            id="closed-botCount"
                            type="text"
                            placeholder="z.B. 1, 2, 3"
                            value={closedFormData.botCount}
                            readOnly
                            className="bg-muted"
                            data-testid="closed-input-bot-count"
                          />
                        </div>
                        <div>
                          <Label htmlFor="closed-longestRuntime" className={!closedPhaseTwoVerified ? 'text-muted-foreground' : ''}>Längste Laufzeit</Label>
                          <Input
                            id="closed-longestRuntime"
                            type="text"
                            placeholder="z.B. 2d 5h 30s"
                            value={closedFormData.longestRuntime}
                            onChange={(e) => setClosedFormData({ ...closedFormData, longestRuntime: e.target.value })}
                            disabled={!closedPhaseTwoVerified}
                            data-testid="closed-input-longest-runtime"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                          <Label htmlFor="closed-avgRuntime" className={!closedPhaseTwoVerified ? 'text-muted-foreground' : ''}>Durchschn. Laufzeit</Label>
                          <Input
                            id="closed-avgRuntime"
                            type="text"
                            placeholder="z.B. 1d 3h 15s"
                            value={closedFormData.avgRuntime}
                            onChange={(e) => setClosedFormData({ ...closedFormData, avgRuntime: e.target.value })}
                            disabled={!closedPhaseTwoVerified}
                            data-testid="closed-input-avg-runtime"
                          />
                        </div>
                        <div>
                          <Label htmlFor="closed-uploadRuntime" className={!closedPhaseTwoVerified ? 'text-muted-foreground' : ''}>Laufzeit</Label>
                          <Input
                            id="closed-uploadRuntime"
                            type="text"
                            placeholder="z.B. 12h 31m 22s"
                            value={closedFormData.uploadRuntime}
                            onChange={(e) => setClosedFormData({ ...closedFormData, uploadRuntime: e.target.value })}
                            disabled={!closedPhaseTwoVerified}
                            data-testid="closed-input-upload-runtime"
                          />
                        </div>
                        <div>
                          <Label htmlFor="closed-lastUpload" className={!closedPhaseTwoVerified ? 'text-muted-foreground' : ''}>Start Date</Label>
                          <Input
                            id="closed-lastUpload"
                            type="text"
                            placeholder="TT.MM.JJJJ HH:MM"
                            value={closedFormData.lastUpload}
                            onChange={(e) => setClosedFormData({ ...closedFormData, lastUpload: e.target.value })}
                            disabled={!closedPhaseTwoVerified}
                            data-testid="closed-input-last-upload"
                          />
                        </div>
                        <div>
                          <Label htmlFor="closed-thisUpload" className={!closedPhaseTwoVerified ? 'text-muted-foreground' : ''}>End Date</Label>
                          <Input
                            id="closed-thisUpload"
                            type="text"
                            placeholder="TT.MM.JJJJ HH:MM"
                            value={closedFormData.thisUpload}
                            onChange={(e) => setClosedFormData({ ...closedFormData, thisUpload: e.target.value })}
                            disabled={!closedPhaseTwoVerified}
                            data-testid="closed-input-this-upload"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Investment Section - Closed Bots (funktional) */}
                    <div className="border border-cyan-500 rounded-lg p-4 bg-white space-y-4">
                      <div className="flex items-center justify-between gap-4">
                        <h3 className="text-base font-semibold text-foreground">Investment</h3>
                        <Select value={closedInvestmentTimeRange} onValueChange={setClosedInvestmentTimeRange} disabled>
                          <SelectTrigger className="w-40 h-8 text-xs" data-testid="closed-select-investment-timerange">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Vergleich">Vergleich</SelectItem>
                            <SelectItem value="Neu">Neu</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="closed-investment">Investitionsmenge (USDT)</Label>
                          <Input
                            id="closed-investment"
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={closedFormData.investment}
                            onChange={(e) => setClosedFormData({ ...closedFormData, investment: e.target.value })}
                            data-testid="closed-input-investment"
                          />
                        </div>
                        <div>
                          <Label htmlFor="closed-extraMargin">Extra Margin</Label>
                          <Input
                            id="closed-extraMargin"
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={closedFormData.extraMargin}
                            onChange={(e) => setClosedFormData({ ...closedFormData, extraMargin: e.target.value })}
                            data-testid="closed-input-extra-margin"
                          />
                        </div>
                        <div>
                          <Label htmlFor="closed-totalInvestment">Gesamtinvestment</Label>
                          <Input
                            id="closed-totalInvestment"
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={closedFormData.totalInvestment}
                            onChange={(e) => setClosedFormData({ ...closedFormData, totalInvestment: e.target.value })}
                            data-testid="closed-input-total-investment"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Gesamter Profit / P&L Section - Closed Bots (funktional) */}
                    <div className="border border-cyan-500 rounded-lg p-4 bg-white space-y-4">
                      <div className="flex items-center justify-between gap-4">
                        <h3 className="text-base font-semibold text-foreground">Gesamter Profit / P&L</h3>
                        <Select value={closedProfitTimeRange} onValueChange={setClosedProfitTimeRange}>
                          <SelectTrigger className="w-40 h-8 text-xs" data-testid="closed-select-profit-timerange">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Vergleich">Vergleich</SelectItem>
                            <SelectItem value="Neu">Neu</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="relative">
                          <Label htmlFor="closed-profit">Gesamtprofit (USDT)</Label>
                          <span className="absolute left-3 bottom-2.5 text-sm text-muted-foreground font-medium">{getSignPrefix(closedFormData.profit)}</span>
                          <Input
                            id="closed-profit"
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            className={getSignPrefix(closedFormData.profit) ? "pl-6" : ""}
                            value={closedFormData.profit}
                            onChange={(e) => setClosedFormData({ ...closedFormData, profit: e.target.value })}
                            data-testid="closed-input-profit"
                          />
                        </div>
                        <div>
                          <Label htmlFor="closed-profitPercent">Gesamtprofit (%)</Label>
                          <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                              <span className="absolute left-3 top-2.5 text-sm text-muted-foreground font-medium">{getSignPrefix(closedFormData.profitPercent)}</span>
                              <Input
                                id="closed-profitPercent"
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                className={getSignPrefix(closedFormData.profitPercent) ? "pl-6" : ""}
                                value={closedFormData.profitPercent}
                                onChange={(e) => setClosedFormData({ ...closedFormData, profitPercent: e.target.value })}
                                data-testid="closed-input-profit-percent"
                              />
                            </div>
                            <Select value={closedProfitPercentBase} onValueChange={(val) => setClosedProfitPercentBase(val as 'gesamtinvestment' | 'investitionsmenge')}>
                              <SelectTrigger className="w-44 h-10 text-xs" data-testid="closed-select-profit-percent-base">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="gesamtinvestment">Gesamtinvestment</SelectItem>
                                <SelectItem value="investitionsmenge">Investitionsmenge</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Trend P&L Section - Closed Bots (funktional) */}
                    <div className="border border-cyan-500 rounded-lg p-4 bg-white space-y-4">
                      <div className="flex items-center justify-between gap-4">
                        <h3 className="text-base font-semibold text-foreground">Trend P&L</h3>
                        <Select value={closedTrendTimeRange} onValueChange={setClosedTrendTimeRange}>
                          <SelectTrigger className="w-40 h-8 text-xs" data-testid="closed-select-trend-timerange">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Vergleich">Vergleich</SelectItem>
                            <SelectItem value="Neu">Neu</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="relative">
                          <Label htmlFor="closed-overallTrendPnlUsdt">Trend P&L (USDT)</Label>
                          <span className="absolute left-3 bottom-2.5 text-sm text-muted-foreground font-medium">{getSignPrefix(closedFormData.overallTrendPnlUsdt)}</span>
                          <Input
                            id="closed-overallTrendPnlUsdt"
                            type="number"
                            step="0.0001"
                            placeholder="0.0000"
                            className={getSignPrefix(closedFormData.overallTrendPnlUsdt) ? "pl-6" : ""}
                            value={closedFormData.overallTrendPnlUsdt}
                            onChange={(e) => setClosedFormData({ ...closedFormData, overallTrendPnlUsdt: e.target.value })}
                            data-testid="closed-input-overall-trend-pnl-usdt"
                          />
                        </div>
                        <div>
                          <Label htmlFor="closed-overallTrendPnlPercent">Trend P&L (%)</Label>
                          <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                              <span className="absolute left-3 top-2.5 text-sm text-muted-foreground font-medium">{getSignPrefix(closedFormData.overallTrendPnlPercent)}</span>
                              <Input
                                id="closed-overallTrendPnlPercent"
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                className={getSignPrefix(closedFormData.overallTrendPnlPercent) ? "pl-6" : ""}
                                value={closedFormData.overallTrendPnlPercent}
                                onChange={(e) => setClosedFormData({ ...closedFormData, overallTrendPnlPercent: e.target.value })}
                                data-testid="closed-input-overall-trend-pnl-percent"
                              />
                            </div>
                            <Select value={closedTrendPercentBase} onValueChange={(val) => setClosedTrendPercentBase(val as 'gesamtinvestment' | 'investitionsmenge')}>
                              <SelectTrigger className="w-44 h-10 text-xs" data-testid="closed-select-trend-percent-base">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="gesamtinvestment">Gesamtinvestment</SelectItem>
                                <SelectItem value="investitionsmenge">Investitionsmenge</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Grid Trading Section - Closed Bots (funktional) */}
                    <div className="border border-cyan-500 rounded-lg p-4 bg-white space-y-4">
                      <div className="flex items-center justify-between gap-4">
                        <h3 className="text-base font-semibold text-foreground">Grid Trading</h3>
                        <Select value={closedGridTimeRange} onValueChange={setClosedGridTimeRange}>
                          <SelectTrigger className="w-40 h-8 text-xs" data-testid="closed-select-grid-timerange">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Vergleich">Vergleich</SelectItem>
                            <SelectItem value="Neu">Neu</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-4">
                        {/* Grid Profit Durchschnitt */}
                        <div>
                          <Label>Grid Profit Durchschnitt</Label>
                          <div className="grid grid-cols-3 gap-3 mt-2">
                            <div className="relative">
                              <Label htmlFor="closed-avgGridProfitHour" className="text-xs text-muted-foreground">Stunde</Label>
                              <span className="absolute left-3 bottom-2.5 text-sm text-muted-foreground font-medium">{getSignPrefix(closedFormData.avgGridProfitHour)}</span>
                              <Input
                                id="closed-avgGridProfitHour"
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                className={getSignPrefix(closedFormData.avgGridProfitHour) ? "pl-6" : ""}
                                value={closedFormData.avgGridProfitHour}
                                onChange={(e) => setClosedFormData({ ...closedFormData, avgGridProfitHour: e.target.value })}
                                data-testid="closed-input-avg-grid-profit-hour"
                              />
                            </div>
                            <div className="relative">
                              <Label htmlFor="closed-avgGridProfitDay" className="text-xs text-muted-foreground">Tag</Label>
                              <span className="absolute left-3 bottom-2.5 text-sm text-muted-foreground font-medium">{getSignPrefix(closedFormData.avgGridProfitDay)}</span>
                              <Input
                                id="closed-avgGridProfitDay"
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                className={getSignPrefix(closedFormData.avgGridProfitDay) ? "pl-6" : ""}
                                value={closedFormData.avgGridProfitDay}
                                onChange={(e) => setClosedFormData({ ...closedFormData, avgGridProfitDay: e.target.value })}
                                data-testid="closed-input-avg-grid-profit-day"
                              />
                            </div>
                            <div className="relative">
                              <Label htmlFor="closed-avgGridProfitWeek" className="text-xs text-muted-foreground">Woche</Label>
                              <span className="absolute left-3 bottom-2.5 text-sm text-muted-foreground font-medium">{getSignPrefix(closedFormData.avgGridProfitWeek)}</span>
                              <Input
                                id="closed-avgGridProfitWeek"
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                className={getSignPrefix(closedFormData.avgGridProfitWeek) ? "pl-6" : ""}
                                value={closedFormData.avgGridProfitWeek}
                                onChange={(e) => setClosedFormData({ ...closedFormData, avgGridProfitWeek: e.target.value })}
                                data-testid="closed-input-avg-grid-profit-week"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Last Grid Profit Durchschnitt */}
                        <div>
                          <Label>Last Grid Profit Durchschnitt (Zeit)</Label>
                          <div className="grid grid-cols-4 gap-2 mt-2">
                            <div 
                              className="relative cursor-pointer"
                              onClick={() => setClosedSelectedChangeTimeframe('hour')}
                            >
                              <Label htmlFor="closed-lastAvgGridProfitHour" className="text-xs text-muted-foreground">Stunde</Label>
                              <div className="relative">
                                <span className="absolute left-3 top-2.5 text-sm text-muted-foreground font-medium">{getSignPrefix(closedFormData.lastAvgGridProfitHour)}</span>
                                <Input
                                  id="closed-lastAvgGridProfitHour"
                                  type="text"
                                  placeholder="0,00"
                                  className={`bg-muted/50 cursor-pointer ${closedSelectedChangeTimeframe === 'hour' ? 'ring-2 ring-primary' : ''} ${getSignPrefix(closedFormData.lastAvgGridProfitHour) ? "pl-6" : ""}`}
                                  value={formatGermanDecimal(closedFormData.lastAvgGridProfitHour)}
                                  readOnly
                                  data-testid="closed-input-last-avg-grid-profit-hour"
                                />
                              </div>
                            </div>
                            <div 
                              className="relative cursor-pointer"
                              onClick={() => setClosedSelectedChangeTimeframe('day')}
                            >
                              <Label htmlFor="closed-lastAvgGridProfitDay" className="text-xs text-muted-foreground">Tag</Label>
                              <div className="relative">
                                <span className="absolute left-3 top-2.5 text-sm text-muted-foreground font-medium">{getSignPrefix(closedFormData.lastAvgGridProfitDay)}</span>
                                <Input
                                  id="closed-lastAvgGridProfitDay"
                                  type="text"
                                  placeholder="0,00"
                                  className={`bg-muted/50 cursor-pointer ${closedSelectedChangeTimeframe === 'day' ? 'ring-2 ring-primary' : ''} ${getSignPrefix(closedFormData.lastAvgGridProfitDay) ? "pl-6" : ""}`}
                                  value={formatGermanDecimal(closedFormData.lastAvgGridProfitDay)}
                                  readOnly
                                  data-testid="closed-input-last-avg-grid-profit-day"
                                />
                              </div>
                            </div>
                            <div 
                              className="relative cursor-pointer"
                              onClick={() => setClosedSelectedChangeTimeframe('week')}
                            >
                              <Label htmlFor="closed-lastAvgGridProfitWeek" className="text-xs text-muted-foreground">Woche</Label>
                              <div className="relative">
                                <span className="absolute left-3 top-2.5 text-sm text-muted-foreground font-medium">{getSignPrefix(closedFormData.lastAvgGridProfitWeek)}</span>
                                <Input
                                  id="closed-lastAvgGridProfitWeek"
                                  type="text"
                                  placeholder="0,00"
                                  className={`bg-muted/50 cursor-pointer ${closedSelectedChangeTimeframe === 'week' ? 'ring-2 ring-primary' : ''} ${getSignPrefix(closedFormData.lastAvgGridProfitWeek) ? "pl-6" : ""}`}
                                  value={formatGermanDecimal(closedFormData.lastAvgGridProfitWeek)}
                                  readOnly
                                  data-testid="closed-input-last-avg-grid-profit-week"
                                />
                              </div>
                            </div>
                            <div className="relative">
                              <Label htmlFor="closed-changeDisplay" className="text-xs text-muted-foreground">Change</Label>
                              <div className="flex gap-1">
                                <div className="relative flex-1">
                                  <span className="absolute left-3 top-2.5 text-sm text-muted-foreground font-medium">
                                    {getSignPrefix(
                                      closedChainedUnit === '$' 
                                        ? (closedSelectedChangeTimeframe === 'hour' ? closedFormData.changeHourDollar : closedSelectedChangeTimeframe === 'day' ? closedFormData.changeDayDollar : closedFormData.changeWeekDollar)
                                        : (closedSelectedChangeTimeframe === 'hour' ? closedFormData.changeHourPercent : closedSelectedChangeTimeframe === 'day' ? closedFormData.changeDayPercent : closedFormData.changeWeekPercent)
                                    )}
                                  </span>
                                  <Input
                                    id="closed-changeDisplay"
                                    type="text"
                                    placeholder="0,00"
                                    className={`bg-muted/50 ring-2 ring-primary ${
                                      getSignPrefix(
                                        closedChainedUnit === '$' 
                                          ? (closedSelectedChangeTimeframe === 'hour' ? closedFormData.changeHourDollar : closedSelectedChangeTimeframe === 'day' ? closedFormData.changeDayDollar : closedFormData.changeWeekDollar)
                                          : (closedSelectedChangeTimeframe === 'hour' ? closedFormData.changeHourPercent : closedSelectedChangeTimeframe === 'day' ? closedFormData.changeDayPercent : closedFormData.changeWeekPercent)
                                      ) ? "pl-6" : ""
                                    }`}
                                    value={
                                      closedChainedUnit === '$' 
                                        ? formatGermanDecimal(closedSelectedChangeTimeframe === 'hour' ? closedFormData.changeHourDollar : closedSelectedChangeTimeframe === 'day' ? closedFormData.changeDayDollar : closedFormData.changeWeekDollar)
                                        : (closedSelectedChangeTimeframe === 'hour' ? closedFormData.changeHourPercent : closedSelectedChangeTimeframe === 'day' ? closedFormData.changeDayPercent : closedFormData.changeWeekPercent)
                                    }
                                    readOnly
                                    data-testid="closed-input-change-display"
                                  />
                                </div>
                                <div className="flex border rounded-md overflow-hidden">
                                  <button
                                    type="button"
                                    onClick={() => setClosedChainedUnit('%')}
                                    className={`px-2 py-1 text-xs font-medium transition-colors ${closedChainedUnit === '%' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                                    data-testid="closed-toggle-chained-percent"
                                  >
                                    %
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setClosedChainedUnit('$')}
                                    className={`px-2 py-1 text-xs font-medium transition-colors ${closedChainedUnit === '$' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                                    data-testid="closed-toggle-chained-dollar"
                                  >
                                    $
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Gesamter Grid Profit */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="relative">
                            <Label htmlFor="closed-overallGridProfitUsdt">Gesamter Grid Profit (USDT)</Label>
                            <span className="absolute left-3 bottom-2.5 text-sm text-muted-foreground font-medium">{getSignPrefix(closedFormData.overallGridProfitUsdt)}</span>
                            <Input
                              id="closed-overallGridProfitUsdt"
                              type="number"
                              step="0.0001"
                              placeholder="0.0000"
                              className={getSignPrefix(closedFormData.overallGridProfitUsdt) ? "pl-6" : ""}
                              value={closedFormData.overallGridProfitUsdt}
                              onChange={(e) => setClosedFormData({ ...closedFormData, overallGridProfitUsdt: e.target.value })}
                              data-testid="closed-input-overall-grid-profit-usdt"
                            />
                          </div>
                          <div>
                            <Label htmlFor="closed-overallGridProfitPercent">Gesamter Grid Profit (%)</Label>
                            <div className="flex items-center gap-2">
                              <div className="relative flex-1">
                                <span className="absolute left-3 top-2.5 text-sm text-muted-foreground font-medium">{getSignPrefix(closedFormData.overallGridProfitPercent)}</span>
                                <Input
                                  id="closed-overallGridProfitPercent"
                                  type="number"
                                  step="0.01"
                                  placeholder="0.00"
                                  className={getSignPrefix(closedFormData.overallGridProfitPercent) ? "pl-6" : ""}
                                  value={closedFormData.overallGridProfitPercent}
                                  onChange={(e) => setClosedFormData({ ...closedFormData, overallGridProfitPercent: e.target.value })}
                                  data-testid="closed-input-overall-grid-profit-percent"
                                />
                              </div>
                              <Select value={closedGridProfitPercentBase} onValueChange={(val) => setClosedGridProfitPercentBase(val as 'gesamtinvestment' | 'investitionsmenge')}>
                                <SelectTrigger className="w-44 h-10 text-xs" data-testid="closed-select-grid-profit-percent-base">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="gesamtinvestment">Gesamtinvestment</SelectItem>
                                  <SelectItem value="investitionsmenge">Investitionsmenge</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>

                        {/* Ø Grid Profit */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="relative">
                            <Label htmlFor="closed-avgGridProfitUsdt">Ø Grid Profit (USDT)</Label>
                            <span className="absolute left-3 bottom-2.5 text-sm text-muted-foreground font-medium">{getSignPrefix(closedFormData.avgGridProfitUsdt)}</span>
                            <Input
                              id="closed-avgGridProfitUsdt"
                              type="number"
                              step="0.0001"
                              placeholder="0.0000"
                              className={`bg-muted/50 ${getSignPrefix(closedFormData.avgGridProfitUsdt) ? "pl-6" : ""}`}
                              value={closedFormData.avgGridProfitUsdt}
                              readOnly
                              data-testid="closed-input-avg-grid-profit-usdt"
                            />
                          </div>
                          <div>
                            <Label htmlFor="closed-avgGridProfitPercent">Ø Grid Profit (%)</Label>
                            <div className="flex items-center gap-2">
                              <div className="relative flex-1">
                                <span className="absolute left-3 top-2.5 text-sm text-muted-foreground font-medium">{getSignPrefix(closedFormData.avgGridProfitPercent)}</span>
                                <Input
                                  id="closed-avgGridProfitPercent"
                                  type="number"
                                  step="0.01"
                                  placeholder="0.00"
                                  className={`bg-muted/50 ${getSignPrefix(closedFormData.avgGridProfitPercent) ? "pl-6" : ""}`}
                                  value={closedFormData.avgGridProfitPercent || ''}
                                  readOnly
                                  data-testid="closed-input-avg-grid-profit-percent"
                                />
                              </div>
                              <Select value={closedHighestGridProfitPercentBase} onValueChange={(val) => setClosedHighestGridProfitPercentBase(val as 'gesamtinvestment' | 'investitionsmenge')}>
                                <SelectTrigger className="w-44 h-10 text-xs" data-testid="closed-select-avg-grid-profit-percent-base">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="gesamtinvestment">Gesamtinvestment</SelectItem>
                                  <SelectItem value="investitionsmenge">Investitionsmenge</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>

                        {/* Last Upload & Change */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="relative">
                            <Label htmlFor="closed-lastUploadAvgGridProfit">Last Upload (Ø Grid Profit)</Label>
                            <span className="absolute left-3 bottom-2.5 text-sm text-muted-foreground font-medium">{getSignPrefix(closedFormData.lastHighestGridProfit)}</span>
                            <Input
                              id="closed-lastUploadAvgGridProfit"
                              type="text"
                              placeholder="-"
                              className={`bg-muted/50 ${getSignPrefix(closedFormData.lastHighestGridProfit) ? "pl-6" : ""}`}
                              value={closedFormData.lastHighestGridProfit || '-'}
                              readOnly
                              data-testid="closed-input-last-upload-avg-grid-profit"
                            />
                          </div>
                          <div>
                            <Label htmlFor="closed-avgGridProfitChange">Change</Label>
                            <div className="flex items-center gap-2">
                              <div className="relative flex-1">
                                <span className="absolute left-3 top-2.5 text-sm text-muted-foreground font-medium">{getSignPrefix(closedAvgGridProfitChangeUnit === '$' ? closedFormData.avgGridProfitChangeDollar : closedFormData.avgGridProfitChangePercent)}</span>
                                <Input
                                  id="closed-avgGridProfitChange"
                                  type="text"
                                  placeholder="0.00"
                                  className={`bg-muted/50 ${getSignPrefix(closedAvgGridProfitChangeUnit === '$' ? closedFormData.avgGridProfitChangeDollar : closedFormData.avgGridProfitChangePercent) ? "pl-6" : ""}`}
                                  value={(closedAvgGridProfitChangeUnit === '$' ? closedFormData.avgGridProfitChangeDollar : closedFormData.avgGridProfitChangePercent) || '-'}
                                  readOnly
                                  data-testid="closed-input-avg-grid-profit-change"
                                />
                              </div>
                              <div className="flex border rounded-md overflow-hidden">
                                <button
                                  type="button"
                                  className={`px-3 py-2 text-sm font-medium transition-colors ${closedAvgGridProfitChangeUnit === '%' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}
                                  onClick={() => setClosedAvgGridProfitChangeUnit('%')}
                                  data-testid="closed-button-change-unit-percent"
                                >
                                  %
                                </button>
                                <button
                                  type="button"
                                  className={`px-3 py-2 text-sm font-medium transition-colors ${closedAvgGridProfitChangeUnit === '$' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}
                                  onClick={() => setClosedAvgGridProfitChangeUnit('$')}
                                  data-testid="closed-button-change-unit-dollar"
                                >
                                  $
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Notizen Section - keine Modi, wird NICHT an AI gesendet */}
                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-sm">Notizen</h3>
                    <div className="flex gap-2">
                      {notesEditMode ? (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setFormData(prev => ({ ...prev, notes: savedNotes }));
                              setNotesEditMode(false);
                            }}
                            disabled={savedNotes === ''}
                            data-testid="button-notes-cancel"
                          >
                            Abbrechen
                          </Button>
                          <Button
                            type="button"
                            variant="default"
                            size="sm"
                            onClick={() => {
                              setSavedNotes(formData.notes);
                              setNotesEditMode(false);
                            }}
                            data-testid="button-notes-save"
                          >
                            Speichern
                          </Button>
                        </>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setNotesEditMode(true)}
                          data-testid="button-notes-edit"
                        >
                          Bearbeiten
                        </Button>
                      )}
                    </div>
                  </div>
                  {notesEditMode ? (
                    <Textarea
                      id="notes"
                      placeholder="Notizen zum Update hinzufuegen..."
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="min-h-[100px] resize-y"
                      data-testid="input-notes"
                    />
                  ) : (
                    <div className="text-sm text-foreground whitespace-pre-wrap min-h-[50px] p-2 rounded bg-background">
                      {formData.notes || <span className="text-muted-foreground italic">Keine Notizen vorhanden</span>}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    Notizen werden mit dem Update gespeichert, aber nicht an die AI gesendet.
                  </p>
                </div>

                <div className="flex gap-4">
                  <Button 
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={handleSendFieldsToAI}
                    disabled={!getActivePhaseTwoVerified() || isAiLoading}
                    data-testid="button-send-fields-to-ai"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {isAiLoading ? 'Sende...' : 'Einstellungen an AI senden'}
                  </Button>
                  
                  <Button 
                    type="submit" 
                    className="flex-1" 
                    disabled={uploadMutation.isPending}
                    data-testid="button-submit"
                  >
                    {uploadMutation.isPending ? 'Wird gespeichert...' : 'Eintrag speichern'}
                  </Button>
                </div>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
