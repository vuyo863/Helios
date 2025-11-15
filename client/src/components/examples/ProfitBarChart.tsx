import ProfitBarChart from '../ProfitBarChart';

export default function ProfitBarChartExample() {
  const mockData = [
    { name: 'ETH Futures', profit: 468 },
    { name: 'BTC Grid', profit: 342 },
    { name: 'SOL Bot', profit: 215 },
    { name: 'ADA Moon', profit: 189 },
  ];

  return (
    <div className="p-6 bg-background">
      <ProfitBarChart data={mockData} title="Profit nach Bot" />
    </div>
  );
}
