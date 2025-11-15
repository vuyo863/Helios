import ProfitLineChart from '../ProfitLineChart';

export default function ProfitLineChartExample() {
  const mockData = [
    { date: '05.01', profit: 120 },
    { date: '06.01', profit: 280 },
    { date: '07.01', profit: 195 },
    { date: '08.01', profit: 410 },
    { date: '09.01', profit: 342 },
    { date: '10.01', profit: 468 },
  ];

  return (
    <div className="p-6 bg-background">
      <ProfitLineChart data={mockData} title="Profit-Verlauf" />
    </div>
  );
}
