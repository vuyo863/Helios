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
import BotTypeManager from "@/components/BotTypeManager";
import { BotEntry, BotType, BotTypeUpdate } from "@shared/schema";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLocation } from "wouter";

export default function Upload() {
  const [location] = useLocation();
  const { toast } = useToast();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedBotTypeId, setSelectedBotTypeId] = useState<string | null>(null);
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
  
  // Lade Updates für alle Bot Types wenn sie sich ändern
  useEffect(() => {
    if (botTypes.length === 0) return;
    
    const fetchAllUpdates = async () => {
      const history: Record<string, any[]> = {};
      
      for (const bt of botTypes) {
        try {
          const response = await fetch(`/api/bot-types/${bt.id}/updates`);
          if (response.ok) {
            const updates: BotTypeUpdate[] = await response.json();
            history[bt.name] = updates.map(u => ({
              updateName: `${u.status} #${u.version}`,
              updateDate: u.createdAt ? new Date(u.createdAt).toLocaleDateString('de-DE') : '',
              updateTime: u.createdAt ? new Date(u.createdAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '',
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
  }, [botTypes]);
  
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
    avgGridProfitHour: '',
    avgGridProfitDay: '',
    avgGridProfitWeek: '',
    lastAvgGridProfitHour: '',
    lastAvgGridProfitDay: '',
    lastAvgGridProfitWeek: '',
    lastAvgGridProfitChained: '',
    overallTrendPnlUsdt: '',
    overallTrendPnlPercent: '',
    highestGridProfit: '',
    highestGridProfitPercent: '',
    overallGridProfitUsdt: '',
    overallGridProfitPercent: '',
    leverage: '',
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

  const [investmentTimeRange, setInvestmentTimeRange] = useState("Neu");
  const [profitTimeRange, setProfitTimeRange] = useState("Neu");
  const [trendTimeRange, setTrendTimeRange] = useState("Neu");
  const [gridTimeRange, setGridTimeRange] = useState("Neu");
  const [outputMode, setOutputMode] = useState<'update-metrics' | 'closed-bots'>('update-metrics');
  
  const [profitPercentBase, setProfitPercentBase] = useState<'gesamtinvestment' | 'investitionsmenge'>('gesamtinvestment');
  const [trendPercentBase, setTrendPercentBase] = useState<'gesamtinvestment' | 'investitionsmenge'>('gesamtinvestment');
  const [gridProfitPercentBase, setGridProfitPercentBase] = useState<'gesamtinvestment' | 'investitionsmenge'>('gesamtinvestment');
  const [highestGridProfitPercentBase, setHighestGridProfitPercentBase] = useState<'gesamtinvestment' | 'investitionsmenge'>('gesamtinvestment');
  const [chainedUnit, setChainedUnit] = useState<'%' | '$'>('%');

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
  });

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

  // Grid Profit Prozent: Nutze gespeicherte AI-Werte beim Umschalten
  useEffect(() => {
    if (gridProfitPercentBase === 'gesamtinvestment') {
      const newValue = calculatedPercents.overallGridProfitPercent_gesamtinvestment || '';
      setFormData(prev => ({ ...prev, overallGridProfitPercent: newValue }));
    } else if (gridProfitPercentBase === 'investitionsmenge') {
      const newValue = calculatedPercents.overallGridProfitPercent_investitionsmenge || '';
      setFormData(prev => ({ ...prev, overallGridProfitPercent: newValue }));
    }
  }, [gridProfitPercentBase, calculatedPercents.overallGridProfitPercent_gesamtinvestment, calculatedPercents.overallGridProfitPercent_investitionsmenge]);

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

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBotTypeId) {
        throw new Error('Kein Bot-Typ ausgewählt');
      }

      // Berechne beide Prozentbasen für alle Felder
      const investmentValue = parseFloat(formData.investment || '0');
      const totalInvestmentValue = parseFloat(formData.totalInvestment || '0');
      const profitValue = parseFloat(formData.profit || '0');
      const trendValue = parseFloat(formData.overallTrendPnlUsdt || '0');
      const gridValue = parseFloat(formData.overallGridProfitUsdt || '0');
      const highestValue = parseFloat(formData.highestGridProfit || '0');

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
        profitPercent_gesamtinvestment = calculatedPercents.profitPercent_gesamtinvestment || null;
        profitPercent_investitionsmenge = calculatedPercents.profitPercent_investitionsmenge || null;
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
        trendPercent_gesamtinvestment = calculatedPercents.overallTrendPnlPercent_gesamtinvestment || null;
        trendPercent_investitionsmenge = calculatedPercents.overallTrendPnlPercent_investitionsmenge || null;
      }

      // Overall Grid Profit Prozent - beide Basen
      let gridPercent_gesamtinvestment: string | null = null;
      let gridPercent_investitionsmenge: string | null = null;
      if (gridTimeRange === 'Neu') {
        if (totalInvestmentValue > 0) {
          gridPercent_gesamtinvestment = ((gridValue / totalInvestmentValue) * 100).toFixed(2);
        }
        if (investmentValue > 0) {
          gridPercent_investitionsmenge = ((gridValue / investmentValue) * 100).toFixed(2);
        }
      } else if (gridTimeRange === 'Vergleich') {
        // Bei Vergleich: Nutze AI-berechnete Differenz-Werte
        gridPercent_gesamtinvestment = calculatedPercents.overallGridProfitPercent_gesamtinvestment || null;
        gridPercent_investitionsmenge = calculatedPercents.overallGridProfitPercent_investitionsmenge || null;
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
        highestPercent_gesamtinvestment = calculatedPercents.highestGridProfitPercent_gesamtinvestment || null;
        highestPercent_investitionsmenge = calculatedPercents.highestGridProfitPercent_investitionsmenge || null;
      }

      // Erstelle Update-Daten
      const updateData = {
        botTypeId: selectedBotTypeId,
        version: parseInt(formData.version) || 1,
        status: outputMode === 'update-metrics' ? 'Update Metrics' : 'Closed Bots',
        
        // Info Section (keine Modi)
        date: formData.date || null,
        botDirection: formData.botDirection || null,
        leverage: formData.leverage || null,
        longestRuntime: formData.longestRuntime || null,
        avgRuntime: formData.avgRuntime || null,
        
        // Investment Section
        investment: formData.investment || null,
        extraMargin: formData.extraMargin || null,
        totalInvestment: formData.totalInvestment || null,
        
        // Profit Section
        profit: formData.profit || null,
        profitPercent_gesamtinvestment,
        profitPercent_investitionsmenge,
        
        // Trend P&L Section
        overallTrendPnlUsdt: formData.overallTrendPnlUsdt || null,
        overallTrendPnlPercent_gesamtinvestment: trendPercent_gesamtinvestment,
        overallTrendPnlPercent_investitionsmenge: trendPercent_investitionsmenge,
        
        // Grid Trading Section
        overallGridProfitUsdt: formData.overallGridProfitUsdt || null,
        overallGridProfitPercent_gesamtinvestment: gridPercent_gesamtinvestment,
        overallGridProfitPercent_investitionsmenge: gridPercent_investitionsmenge,
        highestGridProfit: formData.highestGridProfit || null,
        highestGridProfitPercent_gesamtinvestment: highestPercent_gesamtinvestment,
        highestGridProfitPercent_investitionsmenge: highestPercent_investitionsmenge,
        avgGridProfitHour: formData.avgGridProfitHour || null,
        avgGridProfitDay: formData.avgGridProfitDay || null,
        avgGridProfitWeek: formData.avgGridProfitWeek || null,
        
        // Notizen Section (keine Modi, wird NICHT an AI gesendet)
        notes: formData.notes || null,
      };

      return await apiRequest('POST', `/api/bot-types/${selectedBotTypeId}/updates`, updateData);
    },
    onSuccess: () => {
      if (selectedBotTypeId) {
        queryClient.invalidateQueries({ queryKey: ['/api/bot-types', selectedBotTypeId, 'updates'] });
      }
      toast({
        title: "Erfolgreich gespeichert",
        description: "Das Update wurde erfolgreich gespeichert.",
      });
      
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
        avgGridProfitHour: '',
        avgGridProfitDay: '',
        avgGridProfitWeek: '',
        overallTrendPnlUsdt: '',
        overallTrendPnlPercent: '',
        highestGridProfit: '',
        highestGridProfitPercent: '',
        overallGridProfitUsdt: '',
        overallGridProfitPercent: '',
        leverage: '',
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
      setOutputMode('update-metrics');
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
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...chatMessages, { role: 'user', content: userMessage }],
          botTypes: botTypes,
          updateHistory: updateHistory,
          phase: 'phase2_step1',
          selectedBotTypeId: selectedBotType.id,
          selectedBotTypeName: botTypeName,
          selectedBotTypeColor: botTypeColor,
        }),
      });

      if (!response.ok) {
        throw new Error('AI-Kommunikation fehlgeschlagen');
      }

      const data = await response.json();
      setChatMessages(prev => [...prev, { role: 'ai', content: data.response }]);
      
      setIsStartMetric(data.isStartMetric || false);
      setPhaseTwoVerified(true);
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
      setPhaseTwoStep2Complete(true);
      
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
            }),
          });

          if (!extractionResponse.ok) {
            throw new Error('Datenextraktion fehlgeschlagen');
          }

          const extractionData = await extractionResponse.json();
          
          try {
            const parsedData = JSON.parse(extractionData.response);
            
            setExtractedScreenshotData(parsedData);
            
            const formattedData = parsedData.screenshots.map((s: any, idx: number) => 
              `Screenshot ${idx + 1}:\n• Datum: ${s.date}\n• Uhrzeit: ${s.time}\n• Actual Investment: ${s.actualInvestment} USDT\n• Extra Margin: ${s.extraMargin || 'Nicht verfügbar'}\n• Total Profit: ${s.totalProfitUsdt >= 0 ? '+' : ''}${s.totalProfitUsdt} USDT (${s.totalProfitPercent >= 0 ? '+' : ''}${s.totalProfitPercent}%)\n• Grid Profit: ${s.gridProfitUsdt !== null ? (s.gridProfitUsdt >= 0 ? '+' : '') + s.gridProfitUsdt + ' USDT (' + (s.gridProfitPercent >= 0 ? '+' : '') + s.gridProfitPercent + '%)' : 'Nicht verfügbar'}\n• Trend P&L: ${s.trendPnlUsdt !== null ? (s.trendPnlUsdt >= 0 ? '+' : '') + s.trendPnlUsdt + ' USDT (' + (s.trendPnlPercent >= 0 ? '+' : '') + s.trendPnlPercent + '%)' : 'Nicht verfügbar'}\n• Hebel: ${s.leverage}\n• Laufzeit: ${s.runtime}\n• Richtung: ${s.direction}`
            ).join('\n\n');
            
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
      avgGridProfitHour: '',
      avgGridProfitDay: '',
      avgGridProfitWeek: '',
      lastAvgGridProfitHour: '',
      lastAvgGridProfitDay: '',
      lastAvgGridProfitWeek: '',
      lastAvgGridProfitChained: '',
      overallTrendPnlUsdt: '',
      overallTrendPnlPercent: '',
      highestGridProfit: '',
      highestGridProfitPercent: '',
      overallGridProfitUsdt: '',
      overallGridProfitPercent: '',
      leverage: '',
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
    setIsAiLoading(true);
    
    setChatMessages(prev => [...prev, { 
      role: 'user', 
      content: 'Einstellungen wurden an AI gesendet' 
    }]);
    
    setTimeout(() => {
      setChatMessages(prev => [...prev, {
        role: 'ai',
        content: 'Perfekt! Ich habe Ihre Einstellungen verstanden. Die Modi (Neu/Vergleich) und alle Felder sind klar. Sollen wir mit Phase 4 - der vollständigen Auswertung - fortfahren?'
      }]);
      setPhaseThreeSettingsSent(true);
      setWaitingForPhaseThreeConfirmation(true);
      setIsAiLoading(false);
    }, 800);
    
    toast({
      title: "Einstellungen gesendet",
      description: "Die Feld-Einstellungen wurden erfolgreich an die AI übermittelt.",
    });
  };

  const handleConfirmPhaseThree = async () => {
    setChatMessages(prev => [...prev, { 
      role: 'user', 
      content: 'Ja, bitte mit Phase 4 fortfahren' 
    }]);
    
    setIsAiLoading(true);
    setWaitingForPhaseThreeConfirmation(false);
    
    const sectionsWithModes = [
      { name: 'Investment', mode: investmentTimeRange },
      { name: 'Gesamter Profit / P&L', mode: profitTimeRange },
      { name: 'Trend P&L', mode: trendTimeRange },
      { name: 'Grid Trading', mode: gridTimeRange }
    ];

    const metricsCount = sectionsWithModes.length;
    const hasLastUpload = !isStartMetric;
    
    let message = `Phase 4 - Analyse und Berechnung\n\n`;
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
      if (!extractedScreenshotData) {
        throw new Error('Keine Screenshot-Daten verfügbar. Bitte führen Sie zuerst Phase 2 durch.');
      }

      let previousUploadData = null;
      
      if (!isStartMetric && selectedBotTypeId) {
        try {
          const updatesResponse = await fetch(`/api/bot-types/${selectedBotTypeId}/updates`);
          if (updatesResponse.ok) {
            const updates = await updatesResponse.json();
            if (updates && updates.length > 0) {
              const lastUpdate = updates[0];
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
            }
          }
        } catch (e) {
          console.warn('Konnte vorherige Upload-Daten nicht laden:', e);
        }
      }

      const response = await fetch('/api/phase4', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screenshotData: JSON.stringify(extractedScreenshotData),
          modes: {
            investment: investmentTimeRange,
            profit: profitTimeRange,
            trend: trendTimeRange,
            grid: gridTimeRange
          },
          isStartMetric,
          previousUploadData
        }),
      });

      if (!response.ok) {
        throw new Error('Phase 4 API fehlgeschlagen');
      }

      const data = await response.json();
      const calculatedValues = data.values;
      
      // DEBUG: Log die empfangenen Werte
      console.log('Phase 4 API Response:', data);
      console.log('Calculated Values:', calculatedValues);
      console.log('Investment value:', calculatedValues?.investment);
      console.log('Profit value:', calculatedValues?.profit);
      
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
        
        // SPEICHERE alle berechneten Prozentwerte für späteren Umschalt-Zugriff
        // WICHTIG: Formularfelder (type="number") akzeptieren kein "+" Zeichen!
        // Daher nur den numerischen Wert speichern, das "+" wird bei der Anzeige hinzugefügt
        setCalculatedPercents({
          profitPercent_gesamtinvestment: toStr(calculatedValues.profitPercent_gesamtinvestment),
          profitPercent_investitionsmenge: toStr(calculatedValues.profitPercent_investitionsmenge),
          overallTrendPnlPercent_gesamtinvestment: toStr(calculatedValues.overallTrendPnlPercent_gesamtinvestment),
          overallTrendPnlPercent_investitionsmenge: toStr(calculatedValues.overallTrendPnlPercent_investitionsmenge),
          overallGridProfitPercent_gesamtinvestment: toStr(calculatedValues.overallGridProfitPercent_gesamtinvestment),
          overallGridProfitPercent_investitionsmenge: toStr(calculatedValues.overallGridProfitPercent_investitionsmenge),
          highestGridProfitPercent_gesamtinvestment: toStr(calculatedValues.highestGridProfitPercent_gesamtinvestment),
          highestGridProfitPercent_investitionsmenge: toStr(calculatedValues.highestGridProfitPercent_investitionsmenge),
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
        setFormData(prev => ({
          ...prev,
          date: toStr(calculatedValues.date),
          botDirection: botDirection,
          leverage: toStr(calculatedValues.leverage),
          longestRuntime: toStr(calculatedValues.longestRuntime),
          avgRuntime: toStr(calculatedValues.avgRuntime),
          investment: toStr(calculatedValues.investment),
          extraMargin: toStr(calculatedValues.extraMargin),
          totalInvestment: toStr(calculatedValues.totalInvestment),
          profit: toStr(calculatedValues.profit),
          profitPercent: toStr(calculatedValues.profitPercent_gesamtinvestment || calculatedValues.profitPercent),
          overallTrendPnlUsdt: toStr(calculatedValues.overallTrendPnlUsdt),
          overallTrendPnlPercent: toStr(calculatedValues.overallTrendPnlPercent_gesamtinvestment || calculatedValues.overallTrendPnlPercent),
          overallGridProfitUsdt: toStr(calculatedValues.overallGridProfitUsdt),
          overallGridProfitPercent: toStr(calculatedValues.overallGridProfitPercent_gesamtinvestment || calculatedValues.overallGridProfitPercent),
          highestGridProfit: toStr(calculatedValues.highestGridProfit),
          highestGridProfitPercent: toStr(calculatedValues.highestGridProfitPercent_gesamtinvestment || calculatedValues.highestGridProfitPercent),
          avgGridProfitHour: toStr(calculatedValues.avgGridProfitHour),
          avgGridProfitDay: toStr(calculatedValues.avgGridProfitDay),
          avgGridProfitWeek: toStr(calculatedValues.avgGridProfitWeek)
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
            selectedBotTypeId={selectedBotTypeId}
            onSelectBotType={setSelectedBotTypeId}
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
                
                {phaseTwoVerified && !phaseTwoStep2Complete && (
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
                
                {waitingForPhaseThreeConfirmation && (
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
                
                {!waitingForConfirmation && !phaseTwoVerified && !waitingForPhaseThreeConfirmation && (
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
                onClick={() => setOutputMode('update-metrics')}
                data-testid="button-update-metrics"
                className="flex-1"
              >
                Update Metrics
              </Button>
              <Button
                type="button"
                variant={outputMode === 'closed-bots' ? 'default' : 'outline'}
                onClick={() => setOutputMode('closed-bots')}
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
                        placeholder="Long, Short, Neutral"
                        value={formData.botDirection}
                        readOnly
                        className="bg-muted"
                        data-testid="input-bot-direction"
                      />
                    </div>

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
                      <Label htmlFor="longestRuntime" className={!phaseTwoVerified ? 'text-muted-foreground' : ''}>Längste Laufzeit (Tage, Stunden, Sekunden)</Label>
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

                    <div>
                      <Label htmlFor="avgRuntime" className={!phaseTwoVerified ? 'text-muted-foreground' : ''}>Durchschnittliche Laufzeit (Tage, Stunden, Sekunden)</Label>
                      <Input
                        id="avgRuntime"
                        type="text"
                        placeholder="z.B. 1d 3h 15s"
                        value={formData.avgRuntime}
                        onChange={(e) => setFormData({ ...formData, avgRuntime: e.target.value })}
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
                        onChange={(e) => setFormData({ ...formData, uploadRuntime: e.target.value })}
                        disabled={!phaseTwoVerified}
                        data-testid="input-upload-runtime"
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
                        onChange={(e) => setFormData({ ...formData, investment: e.target.value })}
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
                        onChange={(e) => setFormData({ ...formData, extraMargin: e.target.value })}
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
                        step="0.01"
                        placeholder="0.00"
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
                      <Label>Last Grid Profit Durchschnitt</Label>
                      <div className="grid grid-cols-4 gap-2 mt-2">
                        <div className="relative">
                          <Label htmlFor="lastAvgGridProfitHour" className="text-xs text-muted-foreground">Stunde</Label>
                          <span className="absolute left-3 bottom-2.5 text-sm text-muted-foreground font-medium">{getSignPrefix(formData.lastAvgGridProfitHour)}</span>
                          <Input
                            id="lastAvgGridProfitHour"
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            className={getSignPrefix(formData.lastAvgGridProfitHour) ? "pl-6" : ""}
                            value={formData.lastAvgGridProfitHour}
                            onChange={(e) => setFormData({ ...formData, lastAvgGridProfitHour: e.target.value })}
                            data-testid="input-last-avg-grid-profit-hour"
                          />
                        </div>
                        <div className="relative">
                          <Label htmlFor="lastAvgGridProfitDay" className="text-xs text-muted-foreground">Tag</Label>
                          <span className="absolute left-3 bottom-2.5 text-sm text-muted-foreground font-medium">{getSignPrefix(formData.lastAvgGridProfitDay)}</span>
                          <Input
                            id="lastAvgGridProfitDay"
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            className={getSignPrefix(formData.lastAvgGridProfitDay) ? "pl-6" : ""}
                            value={formData.lastAvgGridProfitDay}
                            onChange={(e) => setFormData({ ...formData, lastAvgGridProfitDay: e.target.value })}
                            data-testid="input-last-avg-grid-profit-day"
                          />
                        </div>
                        <div className="relative">
                          <Label htmlFor="lastAvgGridProfitWeek" className="text-xs text-muted-foreground">Woche</Label>
                          <span className="absolute left-3 bottom-2.5 text-sm text-muted-foreground font-medium">{getSignPrefix(formData.lastAvgGridProfitWeek)}</span>
                          <Input
                            id="lastAvgGridProfitWeek"
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            className={getSignPrefix(formData.lastAvgGridProfitWeek) ? "pl-6" : ""}
                            value={formData.lastAvgGridProfitWeek}
                            onChange={(e) => setFormData({ ...formData, lastAvgGridProfitWeek: e.target.value })}
                            data-testid="input-last-avg-grid-profit-week"
                          />
                        </div>
                        <div className="relative">
                          <Label htmlFor="lastAvgGridProfitChained" className="text-xs text-muted-foreground">Change</Label>
                          <div className="flex gap-1">
                            <Input
                              id="lastAvgGridProfitChained"
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              className="flex-1"
                              value={formData.lastAvgGridProfitChained}
                              onChange={(e) => setFormData({ ...formData, lastAvgGridProfitChained: e.target.value })}
                              data-testid="input-last-avg-grid-profit-chained"
                            />
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
                          step="0.01"
                          placeholder="0.00"
                          className={getSignPrefix(formData.overallGridProfitUsdt) ? "pl-6" : ""}
                          value={formData.overallGridProfitUsdt}
                          onChange={(e) => setFormData({ ...formData, overallGridProfitUsdt: e.target.value })}
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
                        <Label htmlFor="highestGridProfit">Höchster Grid Profit (USDT)</Label>
                        <span className="absolute left-3 bottom-2.5 text-sm text-muted-foreground font-medium">{getSignPrefix(formData.highestGridProfit)}</span>
                        <Input
                          id="highestGridProfit"
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          className={getSignPrefix(formData.highestGridProfit) ? "pl-6" : ""}
                          value={formData.highestGridProfit}
                          onChange={(e) => setFormData({ ...formData, highestGridProfit: e.target.value })}
                          data-testid="input-highest-grid-profit"
                        />
                      </div>

                      <div>
                        <Label htmlFor="highestGridProfitPercent">Höchster Grid Profit (%)</Label>
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <span className="absolute left-3 top-2.5 text-sm text-muted-foreground font-medium">{getSignPrefix(formData.highestGridProfitPercent)}</span>
                            <Input
                              id="highestGridProfitPercent"
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              className={getSignPrefix(formData.highestGridProfitPercent) ? "pl-6" : ""}
                              value={formData.highestGridProfitPercent}
                              onChange={(e) => setFormData({ ...formData, highestGridProfitPercent: e.target.value })}
                              data-testid="input-highest-grid-profit-percent"
                            />
                          </div>
                          <Select value={highestGridProfitPercentBase} onValueChange={(val) => setHighestGridProfitPercentBase(val as 'gesamtinvestment' | 'investitionsmenge')}>
                            <SelectTrigger className="w-44 h-10 text-xs" data-testid="select-highest-grid-profit-percent-base">
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
                    disabled={!phaseTwoVerified || isAiLoading}
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
