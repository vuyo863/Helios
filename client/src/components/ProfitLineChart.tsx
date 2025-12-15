import { Card } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useState, useEffect } from "react";

interface ChartDataPoint {
  date: string;
  profit: number;
}

interface ProfitLineChartProps {
  data: ChartDataPoint[];
  title: string;
}

export default function ProfitLineChart({ data, title }: ProfitLineChartProps) {
  // Animation nur bei echten Datenänderungen, nicht bei Auto-Refresh
  const [animationActive, setAnimationActive] = useState(true);
  
  useEffect(() => {
    // Animation aktivieren bei Datenänderung
    setAnimationActive(true);
    
    // Nach 1.5s deaktivieren (Auto-Refresh soll nicht animieren)
    const timer = setTimeout(() => {
      setAnimationActive(false);
    }, 1500);
    
    return () => clearTimeout(timer);
  }, [data.length, title]);

  return (
    <Card className="p-6">
      <h3 className="text-lg font-bold mb-6">{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
          />
          <YAxis 
            tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
            label={{ value: 'USDT', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: 'hsl(var(--muted-foreground))' } }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />
          <Line 
            type="monotone" 
            dataKey="profit" 
            stroke="hsl(var(--chart-2))" 
            strokeWidth={2}
            dot={{ fill: 'hsl(var(--chart-2))', r: 4 }}
            isAnimationActive={animationActive}
            animationDuration={800}
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}
