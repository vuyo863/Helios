import { useEffect } from 'react';

/**
 * SEPARATE HOOK - iOS Zoom Fix
 * 
 * Problem: iOS Safari restores focus to the last active element after page reload.
 * This can cause an unwanted zoom effect, especially when the focused element
 * is an input field in the watchlist/threshold area.
 * 
 * Solution: On page load, immediately blur any focused element to prevent
 * iOS from auto-zooming to restore focus.
 * 
 * This hook is completely separate from the Cross-Device Sync system.
 */
export function useIOSZoomFix() {
  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    if (isIOS) {
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement && activeElement !== document.body) {
        activeElement.blur();
        console.log('[iOS-ZOOM-FIX] Blurred active element on page load to prevent auto-zoom');
      }
    }
  }, []);
}
