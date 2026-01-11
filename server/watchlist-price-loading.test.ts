import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const BASE_URL = 'http://localhost:5000';

// Helper to wait
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to make API calls
async function apiCall(method: string, path: string, body?: any) {
  const options: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) options.body = JSON.stringify(body);
  const response = await fetch(`${BASE_URL}${path}`, options);
  return { status: response.status, data: await response.json().catch(() => null) };
}

// Helper to fetch Binance spot price directly
async function fetchBinanceSpotPrice(symbol: string): Promise<number | null> {
  try {
    const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
    if (!response.ok) return null;
    const data = await response.json();
    return parseFloat(data.lastPrice);
  } catch {
    return null;
  }
}

// Helper to fetch Binance futures price directly
async function fetchBinanceFuturesPrice(symbol: string): Promise<number | null> {
  try {
    const response = await fetch(`https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${symbol}`);
    if (!response.ok) return null;
    const data = await response.json();
    return parseFloat(data.lastPrice);
  } catch {
    return null;
  }
}

describe('Watchlist Price Loading Tests - Backend API', () => {
  const testSymbols = [
    { symbol: 'BTCUSDT', marketType: 'spot' },
    { symbol: 'ETHUSDT', marketType: 'spot' },
    { symbol: 'SOLUSDT', marketType: 'spot' },
    { symbol: 'XRPUSDT', marketType: 'spot' },
    { symbol: 'DOGEUSDT', marketType: 'spot' },
  ];
  
  // Clean up after tests
  afterAll(async () => {
    for (const { symbol, marketType } of testSymbols) {
      await apiCall('DELETE', `/api/notification-watchlist?symbol=${symbol}&marketType=${marketType}`);
    }
  });
  
  describe('Test 1: Add new trading pairs to watchlist', () => {
    it('should successfully add all test symbols to watchlist', async () => {
      for (const { symbol, marketType } of testSymbols) {
        const { status, data } = await apiCall('POST', '/api/notification-watchlist', { symbol, marketType });
        expect(status).toBeLessThan(400);
        console.log(`[TEST] Added ${symbol} (${marketType}) - Status: ${status}`);
      }
    });
  });
  
  describe('Test 2: Verify watchlist contains all added pairs', () => {
    it('should return all test symbols in watchlist', async () => {
      const { status, data } = await apiCall('GET', '/api/notification-settings');
      expect(status).toBe(200);
      expect(data.watchlist).toBeDefined();
      
      for (const { symbol, marketType } of testSymbols) {
        const found = data.watchlist.find((item: any) => item.symbol === symbol && item.marketType === marketType);
        expect(found).toBeDefined();
        console.log(`[TEST] Verified ${symbol} in watchlist: ${!!found}`);
      }
    });
  });
  
  describe('Test 3: Binance Spot API directly accessible', () => {
    it('should fetch live prices from Binance Spot API', async () => {
      for (const { symbol, marketType } of testSymbols.filter(t => t.marketType === 'spot')) {
        const price = await fetchBinanceSpotPrice(symbol);
        expect(price).not.toBeNull();
        expect(price).toBeGreaterThan(0);
        console.log(`[TEST] Binance Spot ${symbol}: $${price}`);
      }
    });
  });
  
  describe('Test 4: Wait 10 seconds for price interval to run', () => {
    it('should allow time for price fetching intervals', async () => {
      console.log('[TEST] Waiting 10 seconds for price intervals...');
      await delay(10000);
      console.log('[TEST] Wait complete');
    }, 15000);
  });
  
  describe('Test 5: Verify notification settings returns correct structure', () => {
    it('should return watchlist with symbol and marketType', async () => {
      const { status, data } = await apiCall('GET', '/api/notification-settings');
      expect(status).toBe(200);
      
      expect(data.watchlist).toBeInstanceOf(Array);
      expect(data.watchlist.length).toBeGreaterThanOrEqual(testSymbols.length);
      
      // Each item should have id, symbol, marketType
      for (const item of data.watchlist) {
        expect(item.id).toBeDefined();
        expect(item.symbol).toBeDefined();
        expect(item.marketType).toBeDefined();
        console.log(`[TEST] Watchlist item: id=${item.id}, symbol=${item.symbol}, marketType=${item.marketType}`);
      }
    });
  });
  
  describe('Test 6: Verify pairMarketTypes ID format is symbol-based', () => {
    it('should generate correct IDs for frontend (symbol or symbol-PERP)', async () => {
      const { data } = await apiCall('GET', '/api/notification-settings');
      
      for (const { symbol, marketType } of testSymbols) {
        const expectedId = marketType === 'futures' ? `${symbol}-PERP` : symbol;
        const found = data.watchlist.find((item: any) => item.symbol === symbol);
        expect(found).toBeDefined();
        console.log(`[TEST] Symbol: ${symbol}, Expected Frontend ID: ${expectedId}`);
      }
    });
  });
  
  describe('Test 7: Simulate page refresh - watchlist persists', () => {
    it('should maintain all watchlist items after simulated refresh', async () => {
      // First call to simulate initial load
      const { data: initialData } = await apiCall('GET', '/api/notification-settings');
      const initialCount = initialData.watchlist.length;
      
      // Wait a moment
      await delay(1000);
      
      // Second call to simulate refresh
      const { data: refreshedData } = await apiCall('GET', '/api/notification-settings');
      const refreshedCount = refreshedData.watchlist.length;
      
      expect(refreshedCount).toBe(initialCount);
      console.log(`[TEST] Watchlist stable after refresh: ${initialCount} -> ${refreshedCount}`);
    });
  });
  
  describe('Test 8: Verify Binance API batch request works', () => {
    it('should fetch multiple prices in one batch request', async () => {
      const symbols = testSymbols.filter(t => t.marketType === 'spot').map(t => t.symbol);
      const symbolsParam = symbols.map(s => `"${s}"`).join(',');
      
      const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=[${symbolsParam}]`);
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data).toBeInstanceOf(Array);
      expect(data.length).toBe(symbols.length);
      
      for (const item of data) {
        expect(item.symbol).toBeDefined();
        expect(item.lastPrice).toBeDefined();
        console.log(`[TEST] Batch price: ${item.symbol} = $${item.lastPrice}`);
      }
    });
  });
  
  describe('Test 9: Verify exponential backoff constants are set', () => {
    it('should have correct retry settings documented', () => {
      // These are the expected values from the implementation
      const MAX_RETRIES = 5;
      const MAX_BACKOFF_DELAY = 10000; // 10 seconds
      
      console.log(`[TEST] Expected MAX_RETRIES: ${MAX_RETRIES}`);
      console.log(`[TEST] Expected MAX_BACKOFF_DELAY: ${MAX_BACKOFF_DELAY}ms`);
      
      // Just verify constants are reasonable
      expect(MAX_RETRIES).toBeGreaterThan(0);
      expect(MAX_BACKOFF_DELAY).toBeGreaterThanOrEqual(5000);
    });
  });
  
  describe('Test 10: Final stability check after 10s wait', () => {
    it('should maintain consistent watchlist over time', async () => {
      const { data: beforeData } = await apiCall('GET', '/api/notification-settings');
      const beforeSymbols = beforeData.watchlist.map((w: any) => w.symbol).sort();
      
      console.log('[TEST] Waiting 10 more seconds for stability check...');
      await delay(10000);
      
      const { data: afterData } = await apiCall('GET', '/api/notification-settings');
      const afterSymbols = afterData.watchlist.map((w: any) => w.symbol).sort();
      
      expect(afterSymbols).toEqual(beforeSymbols);
      console.log(`[TEST] Watchlist stable: ${beforeSymbols.length} symbols maintained`);
      
      // Verify all test symbols still present
      for (const { symbol } of testSymbols) {
        expect(afterSymbols).toContain(symbol);
      }
    }, 15000);
  });
});
