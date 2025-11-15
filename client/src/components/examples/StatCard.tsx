import StatCard from '../StatCard';
import { Wallet } from 'lucide-react';

export default function StatCardExample() {
  return (
    <div className="p-6 bg-background">
      <StatCard 
        label="Gesamtkapital" 
        value="15.420,50 USDT" 
        icon={Wallet}
        iconColor="bg-blue-100 text-blue-600"
      />
    </div>
  );
}
