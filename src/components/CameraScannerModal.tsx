import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Camera,
  X,
  RefreshCw,
  AlertCircle,
  Sparkles,
  Zap,
  ZapOff,
  SwitchCamera,
  Upload,
} from 'lucide-react';
import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
  type CameraDevice,
} from 'html5-qrcode';
import { playSuccessBeep, playErrorBeep, playKeyClick } from '../utils/sound';

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
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const containerId = 'anugerah-barcode-reader';

  // Trigger haptic vibration on mobile devices
  const triggerHaptic = () => {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate([80, 40, 80]);
      } catch {
        // Ignore haptic errors
      }
    }
  };

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (e) {
        console.warn('Gagal mematikan scanner kamera:', e);
      }
      scannerRef.current = null;
    }
    setIsCameraActive(false);
    setIsTorchOn(false);
    setHasTorch(false);
  }, []);

  const handleBarcodeFound = useCallback(
    async (decodedText: string) => {
      const clean = decodedText.trim();
      if (!clean) return;

      triggerHaptic();
      playSuccessBeep();
      await stopScanner();
      onDetected(clean);
      onClose();
    },
    [stopScanner, onDetected, onClose]
  );

  const startScanner = useCallback(
    async (targetCameraId?: string) => {
      setErrorMsg('');
      await stopScanner();

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setErrorMsg(
          'Peramban tidak mendukung akses kamera langsung. Silakan gunakan tombol Foto Barcode atau ketik kode manual di bawah.'
        );
        return;
      }

      try {
        // 1. Inisialisasi daftar kamera jika belum ada
        let cameraList = cameras;
        if (cameraList.length === 0) {
          try {
            cameraList = await Html5Qrcode.getCameras();
            setCameras(cameraList);
          } catch (e) {
            console.warn('Gagal memuat daftar kamera:', e);
          }
        }

        // Tentukan kamera belakang terbaik
        let activeCamId = targetCameraId || selectedCameraId;
        if (!activeCamId && cameraList.length > 0) {
          // Cari kamera yang memiliki label 'back', 'rear', atau 'belakang'
          const backCam = cameraList.find((c) =>
            /back|rear|belakang|environment/i.test(c.label)
          );
          activeCamId = backCam ? backCam.id : cameraList[0].id;
          setSelectedCameraId(activeCamId);
        }

        // 2. Buat instance scanner dengan semua format ritel dan akselerasi native
        const html5QrCode = new Html5Qrcode(containerId, {
          verbose: false,
          useBarCodeDetectorIfSupported: true,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.CODE_93,
            Html5QrcodeSupportedFormats.ITF,
            Html5QrcodeSupportedFormats.CODABAR,
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.DATA_MATRIX,
          ],
        });
        scannerRef.current = html5QrCode;

        // 3. Konfigurasi kamera: HD 720p untuk ketajaman garis barcode
        const cameraConfig = activeCamId
          ? { deviceId: { exact: activeCamId } }
          : { facingMode: 'environment' };

        await html5QrCode.start(
          cameraConfig,
          {
            fps: 20,
            // Viewfinder luas horizontal agar barcode panjang EAN-13 tidak terpotong
            qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
              const width = Math.floor(viewfinderWidth * 0.92);
              const height = Math.floor(Math.min(viewfinderHeight * 0.65, 260));
              return { width, height };
            },
            aspectRatio: 1.333333,
            videoConstraints: {
              facingMode: { ideal: 'environment' },
              width: { min: 640, ideal: 1280, max: 1920 },
              height: { min: 480, ideal: 720, max: 1080 },
              // @ts-expect-error advanced continuous focus constraint for mobile
              advanced: [{ focusMode: 'continuous' }],
            },
          },
          (decodedText) => {
            handleBarcodeFound(decodedText);
          },
          () => {
            // Frame tanpa barcode (lanjut scanning)
          }
        );

        setIsCameraActive(true);

        // Periksa apakah perangkat mendukung lampu flash (Torch)
        try {
          const capabilities = html5QrCode.getRunningTrackCameraCapabilities();
          const torch = capabilities.torchFeature();
          if (torch.isSupported()) {
            setHasTorch(true);
          }
        } catch {
          setHasTorch(false);
        }
      } catch (err: unknown) {
        console.warn('Gagal memulai kamera:', err);
        const errMsg = err instanceof Error ? err.message : String(err);
        if (errMsg.includes('NotAllowedError') || errMsg.includes('Permission denied')) {
          setErrorMsg(
            'Izin akses kamera ditolak. Silakan izinkan akses kamera pada ikon gembok di bilah alamat peramban.'
          );
        } else if (errMsg.includes('NotFoundError') || errMsg.includes('no camera')) {
          setErrorMsg('Kamera tidak terdeteksi pada perangkat ini.');
        } else {
          setErrorMsg(
            'Tidak dapat mengakses video kamera. Pastikan kamera tidak sedang dipakai aplikasi lain, atau gunakan tombol Foto Barcode di bawah.'
          );
        }
      }
    },
    [cameras, selectedCameraId, stopScanner, handleBarcodeFound]
  );

  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      startScanner();
    }, 120);

    return () => {
      clearTimeout(timer);
      stopScanner();
    };
  }, [isOpen, startScanner, stopScanner]);

  // Toggle Torch / Lampu Flash HP
  const handleToggleTorch = async () => {
    if (!scannerRef.current) return;
    playKeyClick();
    try {
      const capabilities = scannerRef.current.getRunningTrackCameraCapabilities();
      const torch = capabilities.torchFeature();
      if (torch.isSupported()) {
        const nextState = !isTorchOn;
        await torch.apply(nextState);
        setIsTorchOn(nextState);
      }
    } catch (e) {
      console.warn('Gagal mengatur lampu flash:', e);
    }
  };

  // Ganti Kamera (Switch Camera antar lensa HP)
  const handleSwitchCamera = async () => {
    if (cameras.length <= 1) return;
    playKeyClick();
    const currentIndex = cameras.findIndex((c) => c.id === selectedCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCamId = cameras[nextIndex].id;
    setSelectedCameraId(nextCamId);
    await startScanner(nextCamId);
  };

  // Scan Barcode dari Foto Galeri / Jepretan Kamera Langsung (100% Tajam)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    playKeyClick();
    setIsProcessingFile(true);
    setErrorMsg('');

    try {
      // Jika scanner video sedang berjalan, hentikan sebentar
      await stopScanner();

      const html5QrCode = new Html5Qrcode('anugerah-barcode-reader-file', {
        verbose: false,
        useBarCodeDetectorIfSupported: true,
      });

      const decodedText = await html5QrCode.scanFile(file, false);
      html5QrCode.clear();

      if (decodedText) {
        handleBarcodeFound(decodedText);
      } else {
        playErrorBeep();
        setErrorMsg('Tidak menemukan barcode pada foto tersebut. Pastikan garis barcode terlihat jelas dan tidak buram.');
      }
    } catch (err) {
      console.warn('Gagal scan foto barcode:', err);
      playErrorBeep();
      setErrorMsg('Barcode pada foto tidak terbaca. Pastikan foto tegak, cukup cahaya, dan garis barcode tajam.');
    } finally {
      setIsProcessingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Kirim manual angka barcode
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      handleBarcodeFound(manualCode.trim());
      setManualCode('');
    } else {
      playErrorBeep();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest-dark/80 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in">
      <div className="bg-card w-full max-w-lg rounded-3xl p-5 sm:p-6 shadow-modal border-2 border-cream-300 relative flex flex-col max-h-[92vh] overflow-y-auto">
        {/* Header Modal */}
        <div className="flex items-center justify-between pb-3.5 border-b border-cream-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber flex items-center justify-center text-forest font-black shadow-sm">
              <Camera className="w-5 h-5 text-forest stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-ink">{title}</h3>
              <p className="text-xs text-ink-muted">Arahkan kamera ke garis barcode produk</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              playKeyClick();
              stopScanner();
              onClose();
            }}
            className="p-2 rounded-2xl bg-cream-100 hover:bg-cream-200 text-ink transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Viewport Kamera Utama */}
        <div className="mt-3 relative bg-black rounded-2xl overflow-hidden min-h-[260px] sm:min-h-[300px] flex items-center justify-center border border-cream-300 shadow-inner">
          {/* Target Element untuk Html5Qrcode */}
          <div id={containerId} className="w-full h-full" />
          <div id="anugerah-barcode-reader-file" className="hidden" />

          {/* Laser Scanner Alignment Guide */}
          {isCameraActive && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4">
              <div className="w-full max-w-[320px] h-36 border-2 border-amber/80 rounded-2xl relative shadow-[0_0_20px_rgba(247,202,88,0.4)] flex items-center justify-center">
                {/* Horizontal Laser Line */}
                <div className="w-full h-0.5 bg-amber animate-pulse shadow-[0_0_10px_#F7CA58]" />
                <span className="absolute -top-3 px-3 py-0.5 bg-forest text-amber text-[10px] font-black uppercase tracking-wider rounded-full border border-amber/40 shadow-sm">
                  Posisikan Barcode Mendatar
                </span>
              </div>
              <p className="mt-3 text-[11px] font-bold text-white bg-black/75 px-3 py-1 rounded-full shadow-sm">
                Dekatkan hingga garis barcode memenuhi kotak
              </p>
            </div>
          )}

          {/* Controls Overlay: Lampu Flash & Ganti Kamera */}
          {isCameraActive && (
            <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
              {hasTorch && (
                <button
                  type="button"
                  onClick={handleToggleTorch}
                  className={`p-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-md ${
                    isTorchOn
                      ? 'bg-amber text-forest ring-2 ring-amber/50 font-black'
                      : 'bg-black/60 text-white hover:bg-black/80'
                  }`}
                  title="Nyalakan/Matikan Lampu Flash"
                >
                  {isTorchOn ? <Zap className="w-4 h-4 fill-forest" /> : <ZapOff className="w-4 h-4" />}
                  <span className="text-[11px]">{isTorchOn ? 'Lampu ON' : 'Lampu'}</span>
                </button>
              )}

              {cameras.length > 1 && (
                <button
                  type="button"
                  onClick={handleSwitchCamera}
                  className="p-2.5 bg-black/60 hover:bg-black/80 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md"
                  title="Ganti Lensa Kamera"
                >
                  <SwitchCamera className="w-4 h-4" />
                  <span className="text-[11px]">Ganti Lensa</span>
                </button>
              )}
            </div>
          )}

          {/* Loading Indicator */}
          {!isCameraActive && !errorMsg && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-black/80 p-4 text-center">
              <RefreshCw className="w-8 h-8 animate-spin text-amber mb-2" />
              <p className="text-sm font-bold">Menghubungkan ke sensor kamera HP...</p>
              <p className="text-xs text-cream-300 mt-1">Mengaktifkan fokus otomatis & sensor barcode HD</p>
            </div>
          )}

          {/* Error Message & Retry */}
          {errorMsg && (
            <div className="absolute inset-0 bg-cream-100 flex flex-col items-center justify-center p-5 text-center z-20">
              <AlertCircle className="w-12 h-12 text-status-dangerText mb-2" />
              <p className="text-xs sm:text-sm font-bold text-ink leading-relaxed max-w-xs">{errorMsg}</p>
              <button
                type="button"
                onClick={() => startScanner()}
                className="mt-3.5 flex items-center gap-2 px-5 py-2.5 bg-amber hover:bg-amber-hover text-forest font-black rounded-xl text-xs shadow-elevated transition-transform active:scale-95"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Coba Nyalakan Lagi</span>
              </button>
            </div>
          )}
        </div>

        {/* Opsi Foto Barcode (100% Berhasil jika Kamera Live Sulit Fokus) */}
        <div className="mt-3 pt-3 border-t border-cream-200 flex items-center justify-between gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileUpload}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessingFile}
            className="w-full py-2.5 px-3 bg-forest-surface hover:bg-forest/10 border border-forest/30 text-forest font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            {isProcessingFile ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-forest" />
                <span>Membaca Foto Barcode...</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 text-forest" />
                <span>Kamera Buram? Ambil Foto Barcode</span>
              </>
            )}
          </button>
        </div>

        {/* Manual Barcode Input Fallback */}
        <div className="mt-3 pt-3 border-t border-cream-200">
          <p className="text-xs font-semibold text-ink-muted mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-dark" />
            Atau masukkan angka barcode manual di bawah ini:
          </p>
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Ketik angka barcode (cth: 899886620022)"
              className="flex-1 px-4 py-2.5 bg-cream-100 border border-cream-300 rounded-xl font-mono text-sm sm:text-base font-bold focus:outline-none focus:ring-2 focus:ring-forest text-ink"
            />
            <button
              type="submit"
              className="px-5 py-2.5 bg-forest hover:bg-forest-light text-white font-extrabold rounded-xl text-xs sm:text-sm transition-colors whitespace-nowrap"
            >
              Kirim
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
