import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface ReportFiltersProps {
  onFilterChange: (filters: { startDate: string; endDate: string; periodType: string }) => void;
}

export default function ReportFilters({ onFilterChange }: ReportFiltersProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [periodType, setPeriodType] = useState('Tag');

  const handleApply = () => {
    onFilterChange({ startDate, endDate, periodType });
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-bold mb-6">Zeitraum filtern</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <Label htmlFor="startDate">Von</Label>
          <Input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            data-testid="input-start-date"
          />
        </div>
        <div>
          <Label htmlFor="endDate">Bis</Label>
          <Input
            id="endDate"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            data-testid="input-end-date"
          />
        </div>
        <div className="flex items-end">
          <Button onClick={handleApply} className="w-full" data-testid="button-apply-filter">
            Filter anwenden
          </Button>
        </div>
      </div>
      
      <div className="mt-6">
        <Label className="mb-3 block">Zeitraum-Typ</Label>
        <div className="flex gap-2 flex-wrap">
          {['Tag', 'Woche', 'Monat'].map((type) => (
            <Button
              key={type}
              variant={periodType === type ? 'default' : 'outline'}
              onClick={() => setPeriodType(type)}
              data-testid={`button-period-${type.toLowerCase()}`}
            >
              {type}
            </Button>
          ))}
        </div>
      </div>
    </Card>
  );
}
