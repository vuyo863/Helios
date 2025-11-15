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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Upload as UploadIcon, X, Check, ChevronsUpDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import BotTypeManager from "@/components/BotTypeManager";
import { BotEntry } from "@shared/schema";
import { cn } from "@/lib/utils";

export default function Upload() {
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedBotTypeId, setSelectedBotTypeId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [formData, setFormData] = useState({
    date: '',
    botName: '',
    investment: '',
    profit: '',
    profitPercent: '',
    periodType: 'Tag',
    notes: '',
  });

  const { data: entries = [] } = useQuery<BotEntry[]>({
    queryKey: ['/api/entries'],
  });

  const existingBotNames = useMemo(() => {
    const names = Array.from(new Set(entries.map(entry => entry.botName)));
    return names.sort();
  }, [entries]);

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
      
      setSelectedFile(null);
      setOpen(false);
      setFormData({
        date: '',
        botName: '',
        investment: '',
        profit: '',
        profitPercent: '',
        periodType: 'Tag',
        notes: '',
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
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
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
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold mb-2" data-testid="heading-upload">Screenshots hochladen</h1>
        <p className="text-muted-foreground mb-8">
          Laden Sie Screenshots Ihrer Pionex-Bot-Ergebnisse hoch und geben Sie die Details manuell ein.
        </p>

        <div className="max-w-2xl mx-auto space-y-6">
          <BotTypeManager
            selectedBotTypeId={selectedBotTypeId}
            onSelectBotType={setSelectedBotTypeId}
          />

          <Card className="p-8">
            <form onSubmit={handleSubmit}>
              <div className="mb-8">
                <Label className="text-base font-medium mb-3 block">Screenshot hochladen</Label>
                <div className="border-2 border-dashed rounded-lg p-12 text-center bg-muted/30 hover-elevate">
                  <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileChange}
                    data-testid="input-file-upload"
                  />
                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-4">
                      <span className="text-sm font-medium" data-testid="text-filename">{selectedFile.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={handleRemoveFile}
                        data-testid="button-remove-file"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <UploadIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground mb-2">
                        Klicken Sie hier oder ziehen Sie eine Datei hierher
                      </p>
                      <p className="text-xs text-muted-foreground">PNG, JPG bis zu 10MB</p>
                    </label>
                  )}
                </div>
              </div>

              <div className="space-y-6">
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
                  <Label>Bot-Name</Label>
                  <Popover open={open} onOpenChange={(isOpen) => {
                    setOpen(isOpen);
                    if (!isOpen) {
                      setSearchValue("");
                    }
                  }}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between"
                        data-testid="button-bot-name-select"
                      >
                        {formData.botName || "Bot-Name auswählen oder neu eingeben..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput 
                          placeholder="Bot-Name suchen oder neu eingeben..." 
                          data-testid="input-bot-name-search"
                          value={searchValue}
                          onValueChange={(value) => {
                            setSearchValue(value);
                            setFormData({ ...formData, botName: value });
                          }}
                        />
                        <CommandList>
                          <CommandEmpty>
                            <div className="p-2 text-sm">
                              {searchValue ? (
                                <>Drücken Sie Enter um "{searchValue}" zu verwenden</>
                              ) : (
                                "Geben Sie einen Bot-Namen ein"
                              )}
                            </div>
                          </CommandEmpty>
                          <CommandGroup heading="Vorhandene Bot-Namen">
                            {existingBotNames.map((name) => (
                              <CommandItem
                                key={name}
                                value={name}
                                onSelect={(currentValue) => {
                                  const selectedName = existingBotNames.find(
                                    n => n.toLowerCase() === currentValue.toLowerCase()
                                  ) || currentValue;
                                  setFormData({ ...formData, botName: selectedName });
                                  setSearchValue("");
                                  setOpen(false);
                                }}
                                data-testid={`option-bot-name-${name}`}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    formData.botName === name ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <Label htmlFor="investment">Investiertes Kapital (USDT)</Label>
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

                <div>
                  <Label htmlFor="notes">Notizen (optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Zusätzliche Informationen..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    data-testid="textarea-notes"
                  />
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
