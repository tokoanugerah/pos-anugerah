import { useEffect, useRef } from 'react';

interface UseBarcodeScannerProps {
  onScan: (barcode: string) => void;
  minChars?: number;
  maxDelayMs?: number;
  enabled?: boolean;
}

export function useBarcodeScanner({
  onScan,
  minChars = 3,
  maxDelayMs = 150,
  enabled = true,
}: UseBarcodeScannerProps) {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isInput = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      const isScannerInput = target?.getAttribute('data-scanner-input') === 'true';

      // Ignore pure control/modifier keys that scanners or OS might emit
      if (
        event.key === 'Shift' ||
        event.key === 'Control' ||
        event.key === 'Alt' ||
        event.key === 'Meta' ||
        event.key === 'CapsLock' ||
        event.key === 'Tab' ||
        event.key === 'Escape'
      ) {
        return;
      }

      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTimeRef.current;
      lastKeyTimeRef.current = currentTime;

      // Handle barcode termination: standard scanners send 'Enter'
      if (event.key === 'Enter') {
        let scannedCode = bufferRef.current.trim();

        // Fallback 1: If user was focused on an input element (like the barcode input), check the input value
        if (!scannedCode && isInput && target) {
          const val = (target as HTMLInputElement).value;
          if (val && val.trim().length >= minChars) {
            scannedCode = val.trim();
          }
        }

        if (scannedCode.length >= minChars) {
          event.preventDefault();
          event.stopPropagation();
          bufferRef.current = '';
          onScanRef.current(scannedCode);
          return;
        }

        // Reset buffer if Enter pressed with insufficient length
        bufferRef.current = '';
        return;
      }

      // If keys are spaced too far apart (e.g. human typing manually outside scanner input), reset buffer
      if (timeDiff > maxDelayMs && bufferRef.current.length > 0) {
        bufferRef.current = '';
      }

      // Capture single printable character
      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        bufferRef.current += event.key;

        // If scanning outside of an input, prevent default browser shortcut actions
        if (!isInput && bufferRef.current.length >= 2) {
          // Keep browser from executing page hotkeys while scanner bursts digits
          event.preventDefault();
        } else if (isScannerInput) {
          // Let it type into the visible input as feedback
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [minChars, maxDelayMs, enabled]);
}
