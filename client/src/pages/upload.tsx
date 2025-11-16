import { useState, useMemo } from "react";
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
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function Upload() {
  const { toast } = useToast();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedBotTypeId, setSelectedBotTypeId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'ai', content: string }>>([]);
  const [chatInput, setChatInput] = useState("");
  const [formData, setFormData] = useState({
    date: '',
    botName: '',
    botDirection: 'Long',
    investment: '',
    profit: '',
    profitPercent: '',
    periodType: 'Tag',
    longestRuntime: '',
    avgRuntime: '',
    avgGridProfit: '',
    highestGridProfit: '',
    highestGridProfitPercent: '',
    overallAvgGridProfit: '',
    leverage: '',
  });


  const uploadMutation = useMutation({
    mutationFn: async (data: typeof formData & { botTypeId: string | null }) => {
      return await apiRequest('POST', '/api/upload', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/entries'] });
      toast({
        title: "Erfolgreich gespeichert",
        description: "Der Eintrag wurde erfolgreich hinzugefügt.",
      });
      
      setSelectedFiles([]);
      setFormData({
        date: '',
        botName: '',
        botDirection: 'Long',
        investment: '',
        profit: '',
        profitPercent: '',
        periodType: 'Tag',
        longestRuntime: '',
        avgRuntime: '',
        avgGridProfit: '',
        highestGridProfit: '',
        highestGridProfitPercent: '',
        overallAvgGridProfit: '',
        leverage: '',
      });
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

  const handleSendToAI = () => {
    if (selectedFiles.length === 0) {
      toast({
        title: "Keine Dateien",
        description: "Bitte laden Sie mindestens einen Screenshot hoch.",
        variant: "destructive",
      });
      return;
    }

    setChatMessages(prev => [
      ...prev,
      { role: 'user', content: `${selectedFiles.length} Screenshot(s) hochgeladen` },
      { role: 'ai', content: 'AI-Analyse wird in Zukunft verfügbar sein. Bitte geben Sie die Daten manuell in den Feldern unten ein.' }
    ]);
  };

  const handleChatSend = () => {
    if (!chatInput.trim()) return;
    
    setChatMessages(prev => [
      ...prev,
      { role: 'user', content: chatInput },
      { role: 'ai', content: 'AI-Chat wird in Zukunft verfügbar sein.' }
    ]);
    setChatInput("");
  };

  const handleEditBotType = (botType: BotType) => {
    setFormData({
      date: '',
      botName: botType.name,
      botDirection: 'Long',
      investment: '',
      profit: '',
      profitPercent: '',
      periodType: 'Tag',
      longestRuntime: '',
      avgRuntime: '',
      avgGridProfit: '',
      highestGridProfit: '',
      highestGridProfitPercent: '',
      overallAvgGridProfit: '',
      leverage: '',
    });
    toast({
      title: "Bot-Typ geladen",
      description: `Die Informationen für "${botType.name}" wurden in die Ausgabe-Felder geladen.`,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.botName.trim()) {
      toast({
        title: "Fehler",
        description: "Bitte wählen Sie einen Bot-Namen aus oder geben Sie einen neuen ein.",
        variant: "destructive",
      });
      return;
    }
    
    uploadMutation.mutate({
      ...formData,
      botTypeId: selectedBotTypeId,
      longestRuntime: formData.longestRuntime || null,
      avgRuntime: formData.avgRuntime || null,
      avgGridProfit: formData.avgGridProfit || null,
      highestGridProfit: formData.highestGridProfit || null,
      highestGridProfitPercent: formData.highestGridProfitPercent || null,
      overallAvgGridProfit: formData.overallAvgGridProfit || null,
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
                        <p className="text-sm">{msg.content}</p>
                      </div>
                    ))}
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
                  data-testid="input-chat"
                />
                <Button 
                  onClick={handleChatSend}
                  size="icon"
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
                disabled={selectedFiles.length === 0}
                data-testid="button-send-to-ai"
              >
                <Send className="w-4 h-4 mr-2" />
                An AI senden
              </Button>
            </Card>
          </div>

          <Card className="p-8">
            <h2 className="text-lg font-semibold mb-6">Ausgabe-Felder</h2>
            <form onSubmit={handleSubmit}>
              <div className="space-y-6">
                <div>
                  <Label htmlFor="botName">Bot-Name</Label>
                  <Input
                    id="botName"
                    type="text"
                    placeholder="z.B. ETH/USDT Grid Bot"
                    value={formData.botName}
                    onChange={(e) => setFormData({ ...formData, botName: e.target.value })}
                    required
                    data-testid="input-bot-name"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="date">Datum</Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      required
                      data-testid="input-date"
                    />
                  </div>

                  <div>
                    <Label htmlFor="botDirection">Bot-Richtung</Label>
                    <Select
                      value={formData.botDirection}
                      onValueChange={(value) => setFormData({ ...formData, botDirection: value })}
                      required
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
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    <Label htmlFor="leverage">Hebel</Label>
                    <Input
                      id="leverage"
                      type="text"
                      placeholder="z.B. 1x, 5x, 10x"
                      value={formData.leverage}
                      onChange={(e) => setFormData({ ...formData, leverage: e.target.value })}
                      data-testid="input-leverage"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="longestRuntime">Längste Laufzeit (Stunden)</Label>
                    <Input
                      id="longestRuntime"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.longestRuntime}
                      onChange={(e) => setFormData({ ...formData, longestRuntime: e.target.value })}
                      data-testid="input-longest-runtime"
                    />
                  </div>

                  <div>
                    <Label htmlFor="avgRuntime">Durchschnittliche Laufzeit (Stunden)</Label>
                    <Input
                      id="avgRuntime"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.avgRuntime}
                      onChange={(e) => setFormData({ ...formData, avgRuntime: e.target.value })}
                      data-testid="input-avg-runtime"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="avgGridProfit">Grid Profit Durchschnitt (USDT)</Label>
                    <Input
                      id="avgGridProfit"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.avgGridProfit}
                      onChange={(e) => setFormData({ ...formData, avgGridProfit: e.target.value })}
                      data-testid="input-avg-grid-profit"
                    />
                  </div>

                  <div>
                    <Label htmlFor="overallAvgGridProfit">Durchschnittlicher Grid Profit (gesamt, USDT)</Label>
                    <Input
                      id="overallAvgGridProfit"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.overallAvgGridProfit}
                      onChange={(e) => setFormData({ ...formData, overallAvgGridProfit: e.target.value })}
                      data-testid="input-overall-avg-grid-profit"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

                <div>
                  <Label htmlFor="periodType">Zeitraum-Typ</Label>
                  <Select
                    value={formData.periodType}
                    onValueChange={(value) => setFormData({ ...formData, periodType: value })}
                    required
                  >
                    <SelectTrigger id="periodType" data-testid="select-period-type">
                      <SelectValue placeholder="Wählen Sie einen Zeitraum" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Tag" data-testid="option-tag">Tag</SelectItem>
                      <SelectItem value="Woche" data-testid="option-woche">Woche</SelectItem>
                      <SelectItem value="Monat" data-testid="option-monat">Monat</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={uploadMutation.isPending}
                  data-testid="button-submit"
                >
                  {uploadMutation.isPending ? 'Wird gespeichert...' : 'Eintrag speichern'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
