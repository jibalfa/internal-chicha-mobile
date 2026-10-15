"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Camera,
  X,
  RefreshCw,
  Zap,
  AlertCircle,
  ScanBarcode,
  Keyboard,
  CheckCircle2,
} from "lucide-react";
import { playSuccessBeep } from "@/lib/sound";

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (decodedText: string) => void;
  title?: string;
  subtitle?: string;
  continuous?: boolean; // if true, keeps scanning for multiple items (e.g. POS)
}

export default function BarcodeScannerModal({
  isOpen,
  onClose,
  onScan,
  title = "Scan QR / Barcode",
  subtitle = "Arahkan kamera ke barcode atau QR code pada kemasan produk",
  continuous = false,
}: BarcodeScannerModalProps) {
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState<string>("");
  const [showManualInput, setShowManualInput] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);

  const scannerRef = useRef<any>(null);
  const lastScannedTimeRef = useRef<number>(0);
  const isStoppingRef = useRef<boolean>(false);

  // Initialize and start scanner when opened
  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    setIsInitializing(true);
    setErrorMessage(null);
    setLastScannedCode(null);
    isStoppingRef.current = false;

    // Dynamically import html5-qrcode to prevent SSR issues
    import("html5-qrcode")
      .then(async ({ Html5Qrcode, Html5QrcodeSupportedFormats }) => {
        if (!mounted) return;

        try {
          const devices = await Html5Qrcode.getCameras();
          if (!mounted) return;

          if (!devices || devices.length === 0) {
            setErrorMessage("Kamera tidak ditemukan pada perangkat Anda.");
            setIsInitializing(false);
            return;
          }

          setCameras(devices);

          // Prefer back camera (environment) if available
          let chosenCamera = devices[0].id;
          const backCam = devices.find((d) =>
            d.label.toLowerCase().includes("back") ||
            d.label.toLowerCase().includes("rear") ||
            d.label.toLowerCase().includes("belakang") ||
            d.label.toLowerCase().includes("environment")
          );
          if (backCam) {
            chosenCamera = backCam.id;
          }
          setSelectedCameraId(chosenCamera);

          const formatsToSupport = [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.ITF,
          ];

          const scanner = new Html5Qrcode("reader-element", {
            formatsToSupport,
            verbose: false,
          });
          scannerRef.current = scanner;

          await scanner.start(
            chosenCamera,
            {
              fps: 15,
              qrbox: (viewfinderWidth, viewfinderHeight) => {
                const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
                const qrboxEdgeSize = Math.floor(minEdge * 0.75);
                return {
                  width: Math.max(220, qrboxEdgeSize),
                  height: Math.max(160, Math.floor(qrboxEdgeSize * 0.75)),
                };
              },
              aspectRatio: 1.0,
            },
            (decodedText) => {
              if (isStoppingRef.current) return;

              const now = Date.now();
              const trimmed = decodedText.trim();
              if (!trimmed) return;

              // In continuous mode, debounce scans of same item within 1.5 seconds
              if (continuous) {
                if (trimmed === lastScannedCode && now - lastScannedTimeRef.current < 1500) {
                  return;
                }
              }

              lastScannedTimeRef.current = now;
              setLastScannedCode(trimmed);
              playSuccessBeep();
              onScan(trimmed);

              if (!continuous) {
                isStoppingRef.current = true;
                handleClose();
              }
            },
            () => {
              // scanning frame did not contain barcode, ignore
            }
          );

          if (mounted) {
            setIsInitializing(false);
            // Check torch support
            try {
              const capabilities = (scanner as any).getRunningTrackCapabilities?.();
              if (capabilities && capabilities.torch) {
                setHasTorch(true);
              }
            } catch (e) {
              setHasTorch(false);
            }
          }
        } catch (err: any) {
          if (mounted) {
            setIsInitializing(false);
            console.error("Camera scanner error:", err);
            setErrorMessage(
              err?.name === "NotAllowedError" || err?.message?.includes("Permission")
                ? "Izin akses kamera ditolak. Silakan izinkan akses kamera di pengaturan browser."
                : `Gagal mengakses kamera: ${err?.message || "Kesalahan tidak dikenal"}`
            );
          }
        }
      })
      .catch((err) => {
        if (mounted) {
          setIsInitializing(false);
          setErrorMessage("Gagal memuat pustaka scanner: " + err.message);
        }
      });

    return () => {
      mounted = false;
      cleanupScanner();
    };
  }, [isOpen]);

  const cleanupScanner = async () => {
    isStoppingRef.current = true;
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (err) {
        // ignore cleanup error
      }
      scannerRef.current = null;
    }
  };

  const handleClose = async () => {
    await cleanupScanner();
    onClose();
  };

  const switchCamera = async (newCameraId: string) => {
    if (!scannerRef.current || newCameraId === selectedCameraId) return;
    try {
      setIsInitializing(true);
      if (scannerRef.current.isScanning) {
        await scannerRef.current.stop();
      }
      setSelectedCameraId(newCameraId);
      await scannerRef.current.start(
        newCameraId,
        {
          fps: 15,
          qrbox: { width: 250, height: 200 },
        },
        (decodedText: string) => {
          const trimmed = decodedText.trim();
          if (!trimmed) return;
          playSuccessBeep();
          setLastScannedCode(trimmed);
          onScan(trimmed);
          if (!continuous) {
            handleClose();
          }
        },
        () => {}
      );
      setIsInitializing(false);
    } catch (err: any) {
      setIsInitializing(false);
      setErrorMessage("Gagal beralih kamera: " + err.message);
    }
  };

  const toggleTorch = async () => {
    if (!scannerRef.current) return;
    try {
      const nextState = !torchOn;
      await (scannerRef.current as any).applyVideoConstraints({
        advanced: [{ torch: nextState }],
      });
      setTorchOn(nextState);
    } catch (e) {
      setHasTorch(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = manualCode.trim();
    if (!code) return;
    playSuccessBeep();
    setLastScannedCode(code);
    onScan(code);
    setManualCode("");
    if (!continuous) {
      handleClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <ScanBarcode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base leading-tight flex items-center gap-2">
                {title}
                {continuous && (
                  <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 rounded-full border border-emerald-500/30 uppercase tracking-wider">
                    POS Multi-Scan
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{subtitle}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewport Area */}
        <div className="relative flex-1 bg-black flex flex-col items-center justify-center overflow-hidden min-h-[300px] max-h-[420px]">
          {/* HTML5 QR Code Container */}
          <div
            id="reader-element"
            className="w-full h-full flex items-center justify-center [&>video]:w-full [&>video]:h-full [&>video]:object-cover"
          />

          {/* Target Scan Box Overlay */}
          {!errorMessage && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
              <div className="relative w-64 h-52 sm:w-72 sm:h-56 rounded-2xl border-2 border-emerald-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] flex items-center justify-center">
                {/* Corner Accents */}
                <span className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                <span className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                <span className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                <span className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />

                {/* Animated Laser Scan Line */}
                <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#34d399] animate-bounce" />

                <div className="text-center px-4 py-1.5 rounded-full bg-slate-900/85 backdrop-blur-md border border-slate-700/60 text-[11px] font-medium text-emerald-300">
                  Posisikan Barcode / QR di sini
                </div>
              </div>
            </div>
          )}

          {/* Loading Indicator */}
          {isInitializing && !errorMessage && (
            <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center gap-3 z-10">
              <div className="w-10 h-10 border-3 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
              <p className="text-sm font-medium text-slate-300">Mengaktifkan kamera...</p>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center z-10">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-3">
                <AlertCircle className="w-7 h-7" />
              </div>
              <h4 className="font-bold text-white text-sm mb-1">Kamera Tidak Tersedia</h4>
              <p className="text-xs text-slate-400 max-w-xs mb-4">{errorMessage}</p>
              <button
                onClick={() => setShowManualInput(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition"
              >
                <Keyboard className="w-4 h-4" />
                Input Barcode Manual
              </button>
            </div>
          )}

          {/* Camera Quick Controls (Torch & Camera Switch) */}
          <div className="absolute top-3 right-3 flex items-center gap-2 z-20">
            {hasTorch && (
              <button
                onClick={toggleTorch}
                className={`p-2.5 rounded-xl backdrop-blur-md border transition ${
                  torchOn
                    ? "bg-amber-500 text-slate-950 border-amber-400"
                    : "bg-slate-900/80 text-white border-slate-700 hover:bg-slate-800"
                }`}
                title="Lampu Kilat / Flash"
              >
                <Zap className="w-4 h-4" />
              </button>
            )}
            {cameras.length > 1 && (
              <button
                onClick={() => {
                  const currentIndex = cameras.findIndex((c) => c.id === selectedCameraId);
                  const nextIndex = (currentIndex + 1) % cameras.length;
                  switchCamera(cameras[nextIndex].id);
                }}
                className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-white border border-slate-700 backdrop-blur-md transition"
                title="Ganti Kamera Depan/Belakang"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Footer & Feedback Area */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex flex-col gap-3">
          {/* Last scanned banner */}
          {lastScannedCode && (
            <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 animate-fadeIn">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs font-medium">Terscan:</span>
                <span className="text-xs font-mono font-bold bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/30 text-emerald-200">
                  {lastScannedCode}
                </span>
              </div>
              {continuous && (
                <span className="text-[11px] text-emerald-400 font-medium">Siap scan item berikutnya...</span>
              )}
            </div>
          )}

          {/* Manual Input Toggle or Form */}
          {showManualInput ? (
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Ketik Barcode / SKU..."
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  autoFocus
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
              <button
                type="submit"
                disabled={!manualCode.trim()}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs transition"
              >
                Kirim
              </button>
              <button
                type="button"
                onClick={() => setShowManualInput(false)}
                className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
              >
                Batal
              </button>
            </form>
          ) : (
            <div className="flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <ScanBarcode className="w-4 h-4 text-slate-500" />
                <span>Mendukung Barcode 1D & QR Code 2D</span>
              </div>
              <button
                type="button"
                onClick={() => setShowManualInput(true)}
                className="text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1.5 transition"
              >
                <Keyboard className="w-3.5 h-3.5" />
                Input Manual
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
