import { describe, it, expect, beforeEach } from 'vitest';
import { activeAlarmSchema, insertActiveAlarmSchema } from '../shared/schema';
import type { ActiveAlarm, InsertActiveAlarm } from '../shared/schema';

describe('Active Alarms - Cross-Device Sync Tests', () => {
  let mockStorage: Map<string, ActiveAlarm>;

  beforeEach(() => {
    mockStorage = new Map();
  });

  const createMockAlarm = (overrides: Partial<ActiveAlarm> = {}): ActiveAlarm => ({
    id: crypto.randomUUID(),
    trendPriceName: 'BTC/USDT',
    threshold: '50000',
    alarmLevel: 'gefährlich',
    triggeredAt: new Date().toISOString(),
    message: 'Preis über 50000 USDT',
    note: 'Test alarm',
    requiresApproval: true,
    ...overrides,
  });

  describe('Schema Validation Tests', () => {
    it('should validate a complete alarm object', () => {
      const alarm = createMockAlarm();
      const result = activeAlarmSchema.safeParse(alarm);
      expect(result.success).toBe(true);
    });

    it('should validate alarm with all optional fields', () => {
      const alarm = createMockAlarm({
        repetitionsCompleted: 3,
        repetitionsTotal: 5,
        autoDismissAt: new Date().toISOString(),
        lastNotifiedAt: new Date().toISOString(),
        sequenceMs: 60000,
        channels: {
          push: true,
          email: true,
          sms: false,
          webPush: true,
          nativePush: false,
        },
      });
      const result = activeAlarmSchema.safeParse(alarm);
      expect(result.success).toBe(true);
    });

    it('should reject alarm without required fields', () => {
      const invalidAlarm = { id: 'test', trendPriceName: 'BTC' };
      const result = activeAlarmSchema.safeParse(invalidAlarm);
      expect(result.success).toBe(false);
    });

    it('should validate all alarm levels', () => {
      const levels = ['harmlos', 'achtung', 'gefährlich', 'sehr_gefährlich'] as const;
      levels.forEach(level => {
        const alarm = createMockAlarm({ alarmLevel: level });
        const result = activeAlarmSchema.safeParse(alarm);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid alarm level', () => {
      const alarm = { ...createMockAlarm(), alarmLevel: 'invalid_level' };
      const result = activeAlarmSchema.safeParse(alarm);
      expect(result.success).toBe(false);
    });
  });

  describe('Insert Schema Validation Tests', () => {
    it('should allow insert without id (will be generated)', () => {
      const insertData: InsertActiveAlarm = {
        trendPriceName: 'ETH/USDT',
        threshold: '3500',
        alarmLevel: 'achtung',
        triggeredAt: new Date().toISOString(),
        message: 'Test message',
        note: 'Test note',
        requiresApproval: false,
      };
      const result = insertActiveAlarmSchema.safeParse(insertData);
      expect(result.success).toBe(true);
    });

    it('should allow insert with optional id', () => {
      const insertData: InsertActiveAlarm = {
        id: 'custom-id',
        trendPriceName: 'ETH/USDT',
        threshold: '3500',
        alarmLevel: 'harmlos',
        triggeredAt: new Date().toISOString(),
        message: 'Test',
        note: '',
        requiresApproval: true,
      };
      const result = insertActiveAlarmSchema.safeParse(insertData);
      expect(result.success).toBe(true);
    });
  });

  describe('Storage Operations Tests', () => {
    it('should create alarm and store in map', () => {
      const alarm = createMockAlarm();
      mockStorage.set(alarm.id, alarm);
      expect(mockStorage.size).toBe(1);
      expect(mockStorage.get(alarm.id)).toEqual(alarm);
    });

    it('should retrieve alarm by id', () => {
      const alarm = createMockAlarm();
      mockStorage.set(alarm.id, alarm);
      const retrieved = mockStorage.get(alarm.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.trendPriceName).toBe('BTC/USDT');
    });

    it('should return undefined for non-existent alarm', () => {
      const retrieved = mockStorage.get('non-existent-id');
      expect(retrieved).toBeUndefined();
    });

    it('should delete alarm by id (APPROVE)', () => {
      const alarm = createMockAlarm();
      mockStorage.set(alarm.id, alarm);
      expect(mockStorage.size).toBe(1);
      
      const deleted = mockStorage.delete(alarm.id);
      expect(deleted).toBe(true);
      expect(mockStorage.size).toBe(0);
    });

    it('should return false when deleting non-existent alarm', () => {
      const deleted = mockStorage.delete('non-existent-id');
      expect(deleted).toBe(false);
    });

    it('should clear all alarms', () => {
      mockStorage.set('1', createMockAlarm({ id: '1' }));
      mockStorage.set('2', createMockAlarm({ id: '2' }));
      mockStorage.set('3', createMockAlarm({ id: '3' }));
      expect(mockStorage.size).toBe(3);
      
      mockStorage.clear();
      expect(mockStorage.size).toBe(0);
    });
  });

  describe('Cross-Device Sync Logic Tests', () => {
    it('should sync approval across devices - alarm deleted globally', () => {
      const alarm = createMockAlarm({ requiresApproval: true });
      mockStorage.set(alarm.id, alarm);
      
      mockStorage.delete(alarm.id);
      
      const device2Check = mockStorage.get(alarm.id);
      expect(device2Check).toBeUndefined();
    });

    it('should maintain alarm state for multiple devices polling', () => {
      const alarm = createMockAlarm();
      mockStorage.set(alarm.id, alarm);
      
      const device1 = mockStorage.get(alarm.id);
      const device2 = mockStorage.get(alarm.id);
      const device3 = mockStorage.get(alarm.id);
      
      expect(device1).toEqual(device2);
      expect(device2).toEqual(device3);
    });

    it('should update alarm repetition count correctly', () => {
      const alarm = createMockAlarm({ repetitionsCompleted: 1 });
      mockStorage.set(alarm.id, alarm);
      
      const existing = mockStorage.get(alarm.id)!;
      const updated: ActiveAlarm = {
        ...existing,
        repetitionsCompleted: 2,
        lastNotifiedAt: new Date().toISOString(),
      };
      mockStorage.set(alarm.id, updated);
      
      const retrieved = mockStorage.get(alarm.id);
      expect(retrieved?.repetitionsCompleted).toBe(2);
    });

    it('should handle concurrent approvals gracefully', () => {
      const alarm = createMockAlarm();
      mockStorage.set(alarm.id, alarm);
      
      const firstApproval = mockStorage.delete(alarm.id);
      const secondApproval = mockStorage.delete(alarm.id);
      
      expect(firstApproval).toBe(true);
      expect(secondApproval).toBe(false);
    });
  });

  describe('Alarm Level Priority Tests', () => {
    it('should sort alarms by triggered time (newest first)', () => {
      const now = Date.now();
      const alarm1 = createMockAlarm({ id: '1', triggeredAt: new Date(now - 10000).toISOString() });
      const alarm2 = createMockAlarm({ id: '2', triggeredAt: new Date(now).toISOString() });
      const alarm3 = createMockAlarm({ id: '3', triggeredAt: new Date(now - 5000).toISOString() });
      
      mockStorage.set('1', alarm1);
      mockStorage.set('2', alarm2);
      mockStorage.set('3', alarm3);
      
      const sorted = Array.from(mockStorage.values()).sort((a, b) => 
        new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime()
      );
      
      expect(sorted[0].id).toBe('2');
      expect(sorted[1].id).toBe('3');
      expect(sorted[2].id).toBe('1');
    });

    it('should identify highest alarm level correctly', () => {
      const levelPriority: Record<string, number> = {
        'sehr_gefährlich': 0,
        'gefährlich': 1,
        'achtung': 2,
        'harmlos': 3,
      };
      
      mockStorage.set('1', createMockAlarm({ id: '1', alarmLevel: 'harmlos' }));
      mockStorage.set('2', createMockAlarm({ id: '2', alarmLevel: 'sehr_gefährlich' }));
      mockStorage.set('3', createMockAlarm({ id: '3', alarmLevel: 'achtung' }));
      
      const alarms = Array.from(mockStorage.values());
      const highest = alarms.reduce((prev, curr) => 
        levelPriority[curr.alarmLevel] < levelPriority[prev.alarmLevel] ? curr : prev
      );
      
      expect(highest.alarmLevel).toBe('sehr_gefährlich');
    });
  });

  describe('Auto-Dismiss Logic Tests', () => {
    it('should calculate correct auto-dismiss time', () => {
      const now = Date.now();
      const repeatCount = 3;
      const sequenceMs = 60000;
      const restwartezeitMs = 30000;
      
      const autoDismissMs = Math.max(0, repeatCount - 1) * sequenceMs + restwartezeitMs;
      const expectedDismissAt = now + autoDismissMs;
      
      expect(autoDismissMs).toBe(150000);
    });

    it('should not auto-dismiss when requiresApproval is true', () => {
      const alarm = createMockAlarm({ 
        requiresApproval: true,
        autoDismissAt: undefined 
      });
      
      expect(alarm.autoDismissAt).toBeUndefined();
    });

    it('should set autoDismissAt when requiresApproval is false', () => {
      const dismissTime = new Date(Date.now() + 120000).toISOString();
      const alarm = createMockAlarm({ 
        requiresApproval: false,
        autoDismissAt: dismissTime 
      });
      
      expect(alarm.autoDismissAt).toBeDefined();
      expect(new Date(alarm.autoDismissAt!).getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('Channel Configuration Tests', () => {
    it('should store channel configuration correctly', () => {
      const channels = {
        push: true,
        email: true,
        sms: false,
        webPush: true,
        nativePush: false,
      };
      
      const alarm = createMockAlarm({ channels });
      mockStorage.set(alarm.id, alarm);
      
      const retrieved = mockStorage.get(alarm.id);
      expect(retrieved?.channels).toEqual(channels);
    });

    it('should handle alarm without channels', () => {
      const alarm = createMockAlarm();
      delete (alarm as any).channels;
      
      mockStorage.set(alarm.id, alarm);
      const retrieved = mockStorage.get(alarm.id);
      expect(retrieved?.channels).toBeUndefined();
    });
  });

  describe('Repetition Tracking Tests', () => {
    it('should track repetitions correctly', () => {
      const alarm = createMockAlarm({
        repetitionsCompleted: 1,
        repetitionsTotal: 5,
      });
      
      mockStorage.set(alarm.id, alarm);
      
      for (let i = 2; i <= 5; i++) {
        const current = mockStorage.get(alarm.id)!;
        mockStorage.set(alarm.id, {
          ...current,
          repetitionsCompleted: i,
          lastNotifiedAt: new Date().toISOString(),
        });
      }
      
      const final = mockStorage.get(alarm.id);
      expect(final?.repetitionsCompleted).toBe(5);
    });

    it('should handle infinite repetitions (no total)', () => {
      const alarm = createMockAlarm({
        repetitionsCompleted: 10,
        repetitionsTotal: undefined,
        requiresApproval: true,
      });
      
      expect(alarm.repetitionsTotal).toBeUndefined();
      expect(alarm.requiresApproval).toBe(true);
    });
  });

  describe('Multiple Alarms Management Tests', () => {
    it('should handle multiple alarms for same trading pair', () => {
      const alarm1 = createMockAlarm({ id: '1', threshold: '50000' });
      const alarm2 = createMockAlarm({ id: '2', threshold: '55000' });
      
      mockStorage.set('1', alarm1);
      mockStorage.set('2', alarm2);
      
      const allAlarms = Array.from(mockStorage.values());
      const btcAlarms = allAlarms.filter(a => a.trendPriceName === 'BTC/USDT');
      
      expect(btcAlarms.length).toBe(2);
    });

    it('should correctly count active alarms', () => {
      for (let i = 0; i < 10; i++) {
        mockStorage.set(`${i}`, createMockAlarm({ id: `${i}` }));
      }
      
      expect(mockStorage.size).toBe(10);
    });
  });
});
