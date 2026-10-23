import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, X, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { playSuccessBeep, playErrorBeep } from '../utils/sound';

interface CameraScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDetected: (barcode: string) => void;
  title?: string;
}

export const CameraScannerModal: React.FC<CameraScannerModalProps> = ({
  isOpen,
  onClose,
  onDetected,
  title = 'Scan Barcode Produk Menggunakan Kamera',
}) => {
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [manualCode, setManualCode] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = 'anugerah-barcode-reader';

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (e) {
        console.warn('Gagal mematikan kamera:', e);
      }
      scannerRef.current = null;
    }
    setIsCameraActive(false);
  }, []);

  const startScanner = useCallback(async () => {
    setErrorMsg('');
    await stopScanner();

    // Check if mediaDevices exists
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMsg('Peramban ini tidak mendukung akses kamera langsung. Silakan gunakan input manual atau scanner USB.');
      return;
    }

    try {
      const html5QrCode = new Html5Qrcode(containerId, {
        verbose: false,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE,
        ],
      });
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 15,
          qrbox: { width: 280, height: 180 },
        },
        (decodedText) => {
          const cleanCode = decodedText.trim();
          if (cleanCode) {
            playSuccessBeep();
            stopScanner();
            onDetected(cleanCode);
            onClose();
          }
        },
        () => {
          // Frame processed without barcode
        }
      );

      setIsCameraActive(true);
    } catch (err: unknown) {
      console.warn('Gagal memulai Html5Qrcode:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes('NotAllowedError') || errMsg.includes('Permission denied')) {
        setErrorMsg('Izin akses kamera ditolak. Silakan izinkan akses kamera di ikon gembok peramban.');
      } else if (errMsg.includes('NotFoundError') || errMsg.includes('no camera')) {
        setErrorMsg('Kamera atau webcam tidak ditemukan pada perangkat ini.');
      } else {
        setErrorMsg('Tidak dapat mengakses kamera. Pastikan kamera tidak sedang dipakai aplikasi lain.');
      }
    }
  }, [stopScanner, onDetected, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    // Small timeout to allow container element to render in DOM
    const timer = setTimeout(() => {
      startScanner();
    }, 100);

    return () => {
      clearTimeout(timer);
      stopScanner();
    };
  }, [isOpen, startScanner, stopScanner]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      playSuccessBeep();
      stopScanner();
      onDetected(manualCode.trim());
      setManualCode('');
      onClose();
    } else {
      playErrorBeep();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest-dark/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-card w-full max-w-lg rounded-3xl p-6 shadow-modal border-2 border-cream-300 relative flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-cream-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber flex items-center justify-center text-forest font-bold">
              <Camera className="w-5 h-5 text-forest" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-ink">{title}</h3>
              <p className="text-xs text-ink-muted">Arahkan kamera ke barcode kemasan produk</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="p-2 rounded-2xl bg-cream-100 hover:bg-cream-200 text-ink transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Camera Viewport Container */}
        <div className="mt-4 relative bg-black rounded-2xl overflow-hidden min-h-[260px] flex items-center justify-center">
          <div id={containerId} className="w-full h-full" />

          {errorMsg && (
            <div className="absolute inset-0 bg-cream-100 flex flex-col items-center justify-center p-6 text-center z-10">
              <AlertCircle className="w-12 h-12 text-status-dangerText mb-2" />
              <p className="text-sm font-semibold text-ink leading-relaxed max-w-xs">{errorMsg}</p>
              <button
                type="button"
                onClick={startScanner}
                className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-amber hover:bg-amber-hover text-forest font-black rounded-xl text-xs shadow-elevated transition-transform active:scale-95"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Coba Nyalakan Lagi</span>
              </button>
            </div>
          )}

          {!isCameraActive && !errorMsg && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-black/70">
              <RefreshCw className="w-8 h-8 animate-spin text-amber mb-2" />
              <p className="text-xs font-semibold">Menghubungkan ke sensor kamera...</p>
            </div>
          )}
        </div>

        {/* Manual Barcode Input Fallback */}
        <div className="mt-5 pt-4 border-t border-cream-200">
          <p className="text-xs font-medium text-ink-muted mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-dark" />
            Atau masukkan kode barcode secara manual jika scanner kamera buram:
          </p>
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Ketik angka barcode (cth: 899886620022)"
              className="flex-1 px-4 py-3 bg-cream-100 border border-cream-300 rounded-xl font-mono text-base font-semibold focus:outline-none focus:ring-2 focus:ring-forest text-ink"
            />
            <button
              type="submit"
              className="px-5 py-3 bg-forest hover:bg-forest-light text-white font-bold rounded-xl text-sm transition-colors"
            >
              Kirim
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
