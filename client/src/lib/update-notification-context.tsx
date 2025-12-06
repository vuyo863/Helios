import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface UpdateNotificationContextType {
  pendingUpdate: boolean;
  notifyUpdate: () => void;
  clearPendingUpdate: () => void;
  onUpdateConfirmed: (() => void) | null;
  setOnUpdateConfirmed: (callback: (() => void) | null) => void;
}

const UpdateNotificationContext = createContext<UpdateNotificationContextType | null>(null);

export function UpdateNotificationProvider({ children }: { children: ReactNode }) {
  const [pendingUpdate, setPendingUpdate] = useState(false);
  const [onUpdateConfirmed, setOnUpdateConfirmedState] = useState<(() => void) | null>(null);

  const notifyUpdate = useCallback(() => {
    setPendingUpdate(true);
  }, []);

  const clearPendingUpdate = useCallback(() => {
    setPendingUpdate(false);
  }, []);

  const setOnUpdateConfirmed = useCallback((callback: (() => void) | null) => {
    setOnUpdateConfirmedState(() => callback);
  }, []);

  return (
    <UpdateNotificationContext.Provider value={{
      pendingUpdate,
      notifyUpdate,
      clearPendingUpdate,
      onUpdateConfirmed,
      setOnUpdateConfirmed
    }}>
      {children}
    </UpdateNotificationContext.Provider>
  );
}

export function useUpdateNotification() {
  const context = useContext(UpdateNotificationContext);
  if (!context) {
    throw new Error('useUpdateNotification must be used within UpdateNotificationProvider');
  }
  return context;
}
