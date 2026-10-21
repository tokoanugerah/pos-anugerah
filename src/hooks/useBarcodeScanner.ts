import { useEffect, useRef } from 'react';

interface UseBarcodeScannerProps {
  onScan: (barcode: string) => void;
  minChars?: number;
  maxDelayMs?: number;
  enabled?: boolean;
}

export function useBarcodeScanner({
  onScan,
  minChars = 4,
  maxDelayMs = 60,
  enabled = true,
}: UseBarcodeScannerProps) {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if user is actively typing in an input or textarea that shouldn't be intercepted
      const target = event.target as HTMLElement | null;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      const isScannerInput = target?.getAttribute('data-scanner-input') === 'true';

      // If user pressed Enter
      if (event.key === 'Enter') {
        const barcode = bufferRef.current.trim();
        if (barcode.length >= minChars) {
          event.preventDefault();
          onScan(barcode);
          bufferRef.current = '';
          return;
        }
        bufferRef.current = '';
        return;
      }

      // Check key timing to distinguish scanner vs normal manual human typing
      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTimeRef.current;
      lastKeyTimeRef.current = currentTime;

      // If typed keys are spaced out more than maxDelayMs, reset buffer unless inside scanner input
      if (timeDiff > maxDelayMs && bufferRef.current.length > 0) {
        bufferRef.current = '';
      }

      // Only collect printable single characters
      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        bufferRef.current += event.key;

        // If not in input, prevent default only if we suspect it's a rapid scanner burst
        if (!isInput && bufferRef.current.length > 3 && timeDiff <= maxDelayMs) {
          event.preventDefault();
        } else if (isScannerInput) {
          // Allowed
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [onScan, minChars, maxDelayMs, enabled]);
}
