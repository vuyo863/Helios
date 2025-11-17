export interface BotTypeUpdate {
  id: string;
  updateName: string;
  updateDate: string;
  updateTime: string;
}

export const mockUpdatesData: Record<string, BotTypeUpdate[]> = {
  "Grid Trading Bots": [
    {
      id: "u1",
      updateName: "Q4 Performance Update",
      updateDate: "15.11.2025",
      updateTime: "14:30"
    },
    {
      id: "u2",
      updateName: "Strategie Anpassung",
      updateDate: "10.11.2025",
      updateTime: "09:15"
    },
    {
      id: "u3",
      updateName: "Initiale Metriken",
      updateDate: "05.11.2025",
      updateTime: "16:45"
    }
  ],
  "Futures Bots": [
    {
      id: "u4",
      updateName: "Hebel Optimierung",
      updateDate: "16.11.2025",
      updateTime: "10:20"
    },
    {
      id: "u5",
      updateName: "Risiko-Analyse Update",
      updateDate: "12.11.2025",
      updateTime: "15:45"
    }
  ],
};
