import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ChartDataPoint {
  name: string;
  profit: number;
}

interface ProfitBarChartProps {
  data: ChartDataPoint[];
  title: string;
}

export default function ProfitBarChart({ data, title }: ProfitBarChartProps) {
  return (
    <Card className="p-6">
      <h3 className="text-lg font-bold mb-6">{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis 
            dataKey="name" 
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
          <Bar 
            dataKey="profit" 
            fill="hsl(var(--chart-1))"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
