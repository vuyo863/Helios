import { useState, useMemo, useEffect } from "react";
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
import { Upload as UploadIcon, X, Send, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import BotTypeManager from "@/components/BotTypeManager";
import { BotEntry, BotType } from "@shared/schema";
import { mockUpdatesData } from "@shared/bot-type-updates";
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
  
  const { data: botTypes = [] } = useQuery<BotType[]>({
    queryKey: ['/api/bot-types'],
  });
  const [formData, setFormData] = useState({
    date: '',
    botName: '',
    botType: '',
    version: '',
    botDirection: 'Long',
    investment: '',
    extraMargin: '',
    profit: '',
    profitPercent: '',
    periodType: 'Tag',
    longestRuntime: '',
    avgRuntime: '',
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
  });

  const [infoTimeRange, setInfoTimeRange] = useState("Insgesamt");
  const [investmentTimeRange, setInvestmentTimeRange] = useState("Insgesamt");
  const [profitTimeRange, setProfitTimeRange] = useState("Insgesamt");
  const [trendTimeRange, setTrendTimeRange] = useState("Insgesamt");
  const [gridTimeRange, setGridTimeRange] = useState("Insgesamt");
  const [outputMode, setOutputMode] = useState<'update-metrics' | 'closed-bots'>('update-metrics');

  const uploadMutation = useMutation({
    mutationFn: async (data: typeof formData & { botTypeId: string | null }) => {
      return await apiRequest('POST', '/api/upload', data);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/entries'] });
      toast({
        title: "Erfolgreich gespeichert",
        description: "Der Eintrag wurde erfolgreich hinzugefügt.",
      });
      
      
      setSelectedFiles([]);
      setFormData(prev => ({
        ...prev,
        version: '',
        date: '',
        botName: '',
        investment: '',
        extraMargin: '',
        profit: '',
        profitPercent: '',
        periodType: 'Tag',
        longestRuntime: '',
        avgRuntime: '',
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
      }));
    },
    onError: () => {
      toast({
        title: "Fehler",
        description: "Der Eintrag konnte nicht gespeichert werden.",
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
    
    setIsAiLoading(true);
    
    try {
      const base64Images = await convertFilesToBase64(selectedFiles);
      
      const userMessage = `Bitte analysiere ${fileCount === 1 ? 'diesen Screenshot' : 'diese Screenshots'} und extrahiere die Bot-Performance-Daten.`;
      
      setChatMessages(prev => [...prev, { role: 'user', content: `${fileCount} ${fileText} zur Analyse hochgeladen` }]);
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...chatMessages, { role: 'user', content: userMessage }],
          images: base64Images,
          botTypes: botTypes,
          updateHistory: mockUpdatesData,
        }),
      });

      if (!response.ok) {
        throw new Error('AI-Analyse fehlgeschlagen');
      }

      const data = await response.json();
      
      setChatMessages(prev => [...prev, { role: 'ai', content: data.response }]);
      
      setScreenshotsSent(true);
      
      toast({
        title: "Erfolgreich analysiert",
        description: `${fileCount} ${fileText} analysiert.`,
      });
    } catch (error) {
      console.error('AI error:', error);
      toast({
        title: "Fehler",
        description: "Die AI-Analyse ist fehlgeschlagen. Bitte versuchen Sie es erneut.",
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
          updateHistory: mockUpdatesData,
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
      botDirection: 'Long',
      investment: '',
      extraMargin: '',
      profit: '',
      profitPercent: '',
      periodType: 'Tag',
      longestRuntime: '',
      avgRuntime: '',
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
    const filledFields: string[] = [];
    const fieldLabels: Record<string, string> = {
      date: 'Datum',
      botName: 'Bot-Name',
      botType: 'Bot Type',
      version: 'Version',
      botDirection: 'Bot-Richtung',
      investment: 'Investitionsmenge',
      extraMargin: 'Extra Margin',
      profit: 'Gesamtprofit (USDT)',
      profitPercent: 'Gesamtprofit (%)',
      periodType: 'Periodentyp',
      longestRuntime: 'Längste Laufzeit',
      avgRuntime: 'Durchschnittliche Laufzeit',
      avgGridProfitHour: 'Grid Profit Durchschnitt (Stunde)',
      avgGridProfitDay: 'Grid Profit Durchschnitt (Tag)',
      avgGridProfitWeek: 'Grid Profit Durchschnitt (Woche)',
      overallTrendPnlUsdt: 'Gesamter Trend P&L (USDT)',
      overallTrendPnlPercent: 'Gesamter Trend P&L (%)',
      highestGridProfit: 'Höchster Grid Profit',
      highestGridProfitPercent: 'Höchster Grid Profit (%)',
      overallGridProfitUsdt: 'Gesamter Grid Profit (USDT)',
      overallGridProfitPercent: 'Gesamter Grid Profit (%)',
      leverage: 'Hebel',
    };

    Object.entries(formData).forEach(([key, value]) => {
      if (value && value.toString().trim() !== '') {
        const label = fieldLabels[key as keyof typeof fieldLabels];
        if (label) {
          filledFields.push(`${label}: ${value}`);
        }
      }
    });

    if (filledFields.length === 0) {
      toast({
        title: "Keine Felder ausgefüllt",
        description: "Bitte füllen Sie mindestens ein Feld aus, bevor Sie die Einstellungen an die AI senden.",
        variant: "destructive",
      });
      return;
    }

    setIsAiLoading(true);

    try {
      const userMessage = `Bitte analysiere Screenshots basierend auf diesen Einstellungen:\n\n${filledFields.join('\n')}\n\nSuche nur nach diesen spezifischen Metriken in den Screenshots.`;
      
      const userDisplayMessage = `Einstellungen an AI gesendet:\n\n${filledFields.join('\n')}`;
      
      setChatMessages(prev => [...prev, { role: 'user', content: userDisplayMessage }]);
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...chatMessages, { role: 'user', content: userMessage }],
          botTypes: botTypes,
          updateHistory: mockUpdatesData,
        }),
      });

      if (!response.ok) {
        throw new Error('AI-Kommunikation fehlgeschlagen');
      }

      const data = await response.json();
      setChatMessages(prev => [...prev, { role: 'ai', content: data.response }]);
      
      toast({
        title: "Erfolgreich gesendet",
        description: `${filledFields.length} Einstellungen an AI gesendet.`,
      });
    } catch (error) {
      console.error('AI fields error:', error);
      toast({
        title: "Fehler",
        description: "Die Einstellungen konnten nicht an die AI gesendet werden.",
        variant: "destructive",
      });
    } finally {
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
              
              <ScrollArea className="h-64 mb-4 border rounded-lg p-4">
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
              </ScrollArea>

              <div className="flex gap-2">
                <Input
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
                <Button 
                  onClick={handleChatSend}
                  size="icon"
                  disabled={isAiLoading || !chatInput.trim()}
                  data-testid="button-send-chat"
                >
                  <Send className="w-4 h-4" />
                </Button>
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
                      disabled={uploadMutation.isPending}
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
                      }}
                    >
                      {uploadMutation.isPending ? 'Speichert...' : 'Save'}
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
                        data-testid="input-version"
                      />
                    </div>
                  </div>
                </div>

                {outputMode === 'update-metrics' && (
                  <>
                    {(!screenshotsSent || !botTypeSent) && (
                      <div className="border border-yellow-500 bg-yellow-50 rounded-lg p-4">
                        <p className="text-sm text-yellow-800 font-medium">
                          ⚠️ Bitte zuerst: {!screenshotsSent && 'Screenshots hochladen & an AI senden'}{!screenshotsSent && !botTypeSent && ' + '}{!botTypeSent && 'Bot Type speichern'}
                        </p>
                        <p className="text-xs text-yellow-700 mt-1">
                          Die Analyse-Einstellungen können erst ausgefüllt werden, wenn beide Schritte abgeschlossen sind.
                        </p>
                      </div>
                    )}
                    <div className="border border-cyan-500 rounded-lg p-4 bg-white space-y-4">
                      <div className="flex items-center justify-between gap-4">
                        <h3 className="text-base font-semibold text-foreground">Info</h3>
                        <Select value={infoTimeRange} onValueChange={setInfoTimeRange} disabled={!screenshotsSent || !botTypeSent}>
                          <SelectTrigger className="w-40 h-8 text-xs" data-testid="select-info-timerange">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Insgesamt">Insgesamt</SelectItem>
                            <SelectItem value="Seit letztem Update">Seit letztem Update</SelectItem>
                            <SelectItem value="Startwerte">Startwerte</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="date" className={!screenshotsSent || !botTypeSent ? 'text-muted-foreground' : ''}>Datum</Label>
                      <Input
                        id="date"
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        disabled={!screenshotsSent || !botTypeSent}
                        data-testid="input-date"
                      />
                    </div>

                    <div>
                      <Label htmlFor="botDirection" className={!screenshotsSent || !botTypeSent ? 'text-muted-foreground' : ''}>Bot-Richtung</Label>
                      <Select
                        value={formData.botDirection}
                        onValueChange={(value) => setFormData({ ...formData, botDirection: value })}
                        disabled={!screenshotsSent || !botTypeSent}
                      >
                        <SelectTrigger id="botDirection" data-testid="select-bot-direction">
                          <SelectValue placeholder="Short oder Long" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Long" data-testid="option-long">Long</SelectItem>
                          <SelectItem value="Short" data-testid="option-short">Short</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="leverage" className={!screenshotsSent || !botTypeSent ? 'text-muted-foreground' : ''}>Hebel</Label>
                      <Input
                        id="leverage"
                        type="text"
                        placeholder="z.B. 1x, 5x, 10x"
                        value={formData.leverage}
                        onChange={(e) => setFormData({ ...formData, leverage: e.target.value })}
                        disabled={!screenshotsSent || !botTypeSent}
                        data-testid="input-leverage"
                      />
                    </div>

                    <div>
                      <Label htmlFor="longestRuntime" className={!screenshotsSent || !botTypeSent ? 'text-muted-foreground' : ''}>Längste Laufzeit (Tage, Stunden, Sekunden)</Label>
                      <Input
                        id="longestRuntime"
                        type="text"
                        placeholder="z.B. 2d 5h 30s"
                        value={formData.longestRuntime}
                        onChange={(e) => setFormData({ ...formData, longestRuntime: e.target.value })}
                        disabled={!screenshotsSent || !botTypeSent}
                        data-testid="input-longest-runtime"
                      />
                    </div>

                    <div>
                      <Label htmlFor="avgRuntime" className={!screenshotsSent || !botTypeSent ? 'text-muted-foreground' : ''}>Durchschnittliche Laufzeit (Tage, Stunden, Sekunden)</Label>
                      <Input
                        id="avgRuntime"
                        type="text"
                        placeholder="z.B. 1d 3h 15s"
                        value={formData.avgRuntime}
                        onChange={(e) => setFormData({ ...formData, avgRuntime: e.target.value })}
                        disabled={!screenshotsSent || !botTypeSent}
                        data-testid="input-avg-runtime"
                      />
                    </div>
                  </div>
                </div>

                <div className="border border-cyan-500 rounded-lg p-4 bg-white space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-base font-semibold text-foreground">Investment</h3>
                    <Select value={investmentTimeRange} onValueChange={setInvestmentTimeRange}>
                      <SelectTrigger className="w-40 h-8 text-xs" data-testid="select-investment-timerange">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Insgesamt">Insgesamt</SelectItem>
                        <SelectItem value="Seit letztem Update">Seit letztem Update</SelectItem>
                        <SelectItem value="Startwerte">Startwerte</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        <SelectItem value="Insgesamt">Insgesamt</SelectItem>
                        <SelectItem value="Seit letztem Update">Seit letztem Update</SelectItem>
                        <SelectItem value="Startwerte">Startwerte</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="profit">Gesamtprofit (USDT)</Label>
                      <Input
                        id="profit"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={formData.profit}
                        onChange={(e) => {
                          const profitValue = e.target.value;
                          setFormData({ ...formData, profit: profitValue });
                          
                          if (profitValue && formData.investment) {
                            const profitPercent = (parseFloat(profitValue) / parseFloat(formData.investment)) * 100;
                            setFormData(prev => ({ ...prev, profitPercent: profitPercent.toFixed(2) }));
                          }
                        }}
                        required
                        data-testid="input-profit"
                      />
                    </div>

                    <div>
                      <Label htmlFor="profitPercent">Gesamtprofit (%)</Label>
                      <Input
                        id="profitPercent"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={formData.profitPercent}
                        onChange={(e) => setFormData({ ...formData, profitPercent: e.target.value })}
                        data-testid="input-profit-percent"
                      />
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
                        <SelectItem value="Insgesamt">Insgesamt</SelectItem>
                        <SelectItem value="Seit letztem Update">Seit letztem Update</SelectItem>
                        <SelectItem value="Startwerte">Startwerte</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative">
                      <Label htmlFor="overallTrendPnlUsdt">Trend P&L (USDT)</Label>
                      <span className="absolute left-3 bottom-2.5 text-sm text-muted-foreground">$</span>
                      <Input
                        id="overallTrendPnlUsdt"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        className="pl-7"
                        value={formData.overallTrendPnlUsdt}
                        onChange={(e) => setFormData({ ...formData, overallTrendPnlUsdt: e.target.value })}
                        data-testid="input-overall-trend-pnl-usdt"
                      />
                    </div>
                    <div className="relative">
                      <Label htmlFor="overallTrendPnlPercent">Trend P&L (%)</Label>
                      <span className="absolute right-3 bottom-2.5 text-sm text-muted-foreground">%</span>
                      <Input
                        id="overallTrendPnlPercent"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        className="pr-7"
                        value={formData.overallTrendPnlPercent}
                        onChange={(e) => setFormData({ ...formData, overallTrendPnlPercent: e.target.value })}
                        data-testid="input-overall-trend-pnl-percent"
                      />
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
                        <SelectItem value="Insgesamt">Insgesamt</SelectItem>
                        <SelectItem value="Seit letztem Update">Seit letztem Update</SelectItem>
                        <SelectItem value="Startwerte">Startwerte</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <Label>Grid Profit Durchschnitt</Label>
                      <div className="grid grid-cols-3 gap-3 mt-2">
                        <div>
                          <Label htmlFor="avgGridProfitHour" className="text-xs text-muted-foreground">Stunde</Label>
                          <Input
                            id="avgGridProfitHour"
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={formData.avgGridProfitHour}
                            onChange={(e) => setFormData({ ...formData, avgGridProfitHour: e.target.value })}
                            data-testid="input-avg-grid-profit-hour"
                          />
                        </div>
                        <div>
                          <Label htmlFor="avgGridProfitDay" className="text-xs text-muted-foreground">Tag</Label>
                          <Input
                            id="avgGridProfitDay"
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={formData.avgGridProfitDay}
                            onChange={(e) => setFormData({ ...formData, avgGridProfitDay: e.target.value })}
                            data-testid="input-avg-grid-profit-day"
                          />
                        </div>
                        <div>
                          <Label htmlFor="avgGridProfitWeek" className="text-xs text-muted-foreground">Woche</Label>
                          <Input
                            id="avgGridProfitWeek"
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={formData.avgGridProfitWeek}
                            onChange={(e) => setFormData({ ...formData, avgGridProfitWeek: e.target.value })}
                            data-testid="input-avg-grid-profit-week"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="relative">
                        <Label htmlFor="overallGridProfitUsdt">Gesamter Grid Profit (USDT)</Label>
                        <span className="absolute left-3 bottom-2.5 text-sm text-muted-foreground">$</span>
                        <Input
                          id="overallGridProfitUsdt"
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          className="pl-7"
                          value={formData.overallGridProfitUsdt}
                          onChange={(e) => setFormData({ ...formData, overallGridProfitUsdt: e.target.value })}
                          data-testid="input-overall-grid-profit-usdt"
                        />
                      </div>
                      <div className="relative">
                        <Label htmlFor="overallGridProfitPercent">Gesamter Grid Profit (%)</Label>
                        <span className="absolute right-3 bottom-2.5 text-sm text-muted-foreground">%</span>
                        <Input
                          id="overallGridProfitPercent"
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          className="pr-7"
                          value={formData.overallGridProfitPercent}
                          onChange={(e) => setFormData({ ...formData, overallGridProfitPercent: e.target.value })}
                          data-testid="input-overall-grid-profit-percent"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="highestGridProfit">Höchster Grid Profit (USDT)</Label>
                        <Input
                          id="highestGridProfit"
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={formData.highestGridProfit}
                          onChange={(e) => setFormData({ ...formData, highestGridProfit: e.target.value })}
                          data-testid="input-highest-grid-profit"
                        />
                      </div>

                      <div>
                        <Label htmlFor="highestGridProfitPercent">Höchster Grid Profit (%)</Label>
                        <Input
                          id="highestGridProfitPercent"
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={formData.highestGridProfitPercent}
                          onChange={(e) => setFormData({ ...formData, highestGridProfitPercent: e.target.value })}
                          data-testid="input-highest-grid-profit-percent"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                  </>
                )}

                <div className="flex gap-4">
                  <Button 
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={handleSendFieldsToAI}
                    disabled={!screenshotsSent || !botTypeSent || isAiLoading}
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
