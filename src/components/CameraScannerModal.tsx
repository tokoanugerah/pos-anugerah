import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';
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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    setErrorMsg('');
    setIsScanning(true);
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setupBarcodeDetection();
      }
    } catch (err: unknown) {
      console.warn('Akses kamera tidak diizinkan atau tidak ditemukan:', err);
      setErrorMsg('Kamera tidak dapat diakses. Pastikan izin kamera aktif atau gunakan input manual.');
      setIsScanning(false);
    }
  };

  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  };

  const setupBarcodeDetection = () => {
    // Check if native BarcodeDetector is available (supported in Chromium/Chrome/Edge/Android)
    if ('BarcodeDetector' in window) {
      try {
        const barcodeDetector = new (window as unknown as {
          BarcodeDetector: new (options?: { formats: string[] }) => {
            detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>;
          };
        }).BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
        });

        const detectFrame = async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) {
            animationFrameRef.current = requestAnimationFrame(detectFrame);
            return;
          }

          try {
            const barcodes = await barcodeDetector.detect(videoRef.current);
            if (barcodes.length > 0 && barcodes[0].rawValue) {
              const code = barcodes[0].rawValue;
              playSuccessBeep();
              onDetected(code);
              stopCamera();
              onClose();
              return;
            }
          } catch {
            // Frame detection error, continue next frame
          }

          animationFrameRef.current = requestAnimationFrame(detectFrame);
        };

        animationFrameRef.current = requestAnimationFrame(detectFrame);
      } catch (e) {
        console.warn('BarcodeDetector gagal diinisialisasi:', e);
      }
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      playSuccessBeep();
      onDetected(manualCode.trim());
      setManualCode('');
      stopCamera();
      onClose();
    } else {
      playErrorBeep();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest-dark/70 backdrop-blur-sm p-4 animate-in fade-in">
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
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-2 rounded-2xl bg-cream-100 hover:bg-cream-200 text-ink transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Camera Viewport */}
        <div className="mt-4 relative bg-black rounded-2xl overflow-hidden aspect-[4/3] flex items-center justify-center">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            autoPlay
            playsInline
            muted
          />

          {/* Scanner Guide Reticle */}
          {isScanning && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              <div className="w-3/4 h-1/2 border-2 border-amber rounded-2xl relative shadow-[0_0_15px_rgba(247,202,88,0.5)]">
                {/* Scanning laser line animation */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-amber animate-pulse shadow-[0_0_8px_#F7CA58]" />
              </div>
              <p className="mt-3 text-xs font-semibold text-white bg-black/60 px-3 py-1 rounded-full">
                Posisikan garis merah/kuning di atas barcode
              </p>
            </div>
          )}

          {errorMsg && (
            <div className="absolute inset-0 bg-cream-100 flex flex-col items-center justify-center p-6 text-center">
              <AlertCircle className="w-12 h-12 text-status-dangerText mb-2" />
              <p className="text-sm font-semibold text-ink">{errorMsg}</p>
              <button
                onClick={startCamera}
                className="mt-4 flex items-center gap-2 px-4 py-2 bg-amber hover:bg-amber-hover text-forest font-bold rounded-xl text-sm"
              >
                <RefreshCw className="w-4 h-4" /> Coba Nyalakan Lagi
              </button>
            </div>
          )}
        </div>

        {/* Manual Barcode Input Fallback */}
        <div className="mt-5 pt-4 border-t border-cream-200">
          <p className="text-xs font-medium text-ink-muted mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-dark" />
            Atau masukkan kode barcode secara manual jika kamera buram:
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
