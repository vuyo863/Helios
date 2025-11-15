import { useState } from "react";
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
import { Upload, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function UploadForm() {
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    date: '',
    botName: '',
    investment: '',
    profit: '',
    profitPercent: '',
    periodType: '',
    notes: '',
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
    
    console.log('Form submitted:', { file: selectedFile, ...formData });
    
    toast({
      title: "Erfolgreich gespeichert",
      description: "Der Eintrag wurde erfolgreich hinzugefügt.",
    });

    setSelectedFile(null);
    setFormData({
      date: '',
      botName: '',
      investment: '',
      profit: '',
      profitPercent: '',
      periodType: '',
      notes: '',
    });
  };

  return (
    <Card className="p-8 max-w-2xl mx-auto">
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
                <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
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
            <Label htmlFor="botName">Bot-Name</Label>
            <Input
              id="botName"
              type="text"
              placeholder="z.B. ETH/USDT Futures Moon"
              value={formData.botName}
              onChange={(e) => setFormData({ ...formData, botName: e.target.value })}
              required
              data-testid="input-bot-name"
            />
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
              onChange={(e) => setFormData({ ...formData, profit: e.target.value })}
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

          <Button type="submit" className="w-full" data-testid="button-submit">
            Eintrag speichern
          </Button>
        </div>
      </form>
    </Card>
  );
}
