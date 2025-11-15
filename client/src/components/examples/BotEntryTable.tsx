import BotEntryTable from '../BotEntryTable';
import { BotEntry } from '@shared/schema';

export default function BotEntryTableExample() {
  const mockEntries: BotEntry[] = [
    {
      id: '1',
      date: '2025-01-10',
      botName: 'ETH/USDT Futures Moon',
      investment: '5000.00',
      profit: '125.50',
      profitPercent: '2.51',
      periodType: 'Tag',
      notes: null,
      screenshotPath: null,
    },
    {
      id: '2',
      date: '2025-01-09',
      botName: 'BTC Grid Bot',
      investment: '10000.00',
      profit: '342.80',
      profitPercent: '3.43',
      periodType: 'Woche',
      notes: null,
      screenshotPath: null,
    },
  ];

  return (
    <div className="p-6 bg-background">
      <BotEntryTable entries={mockEntries} />
    </div>
  );
}
