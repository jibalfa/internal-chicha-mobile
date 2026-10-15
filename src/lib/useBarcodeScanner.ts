"use client";

import { useEffect, useRef } from "react";

interface UseBarcodeScannerOptions {
  onScan: (barcode: string) => void;
  enabled?: boolean;
  minChars?: number;
  maxIntervalMs?: number;
}

/**
 * Custom hook to listen for hardware USB/Bluetooth barcode scanner gun input.
 * Hardware scanners send keystrokes in rapid succession followed by an 'Enter' key.
 */
export function useBarcodeScanner({
  onScan,
  enabled = true,
  minChars = 3,
  maxIntervalMs = 70, // Max ms between keystrokes for barcode gun emulation
}: UseBarcodeScannerOptions) {
  const bufferRef = useRef<string>("");
  const lastKeyTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in standard inputs unless it's a barcode scanner input
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      // If user is typing in a textarea or non-search text input, ignore
      if (isInput) {
        const inputElement = target as HTMLInputElement;
        const isBarcodeSearchInput = inputElement.getAttribute("data-barcode-target") === "true";
        if (!isBarcodeSearchInput) {
          // Allow normal typing without capturing
          return;
        }
      }

      const now = Date.now();
      const interval = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (e.key === "Enter") {
        const barcode = bufferRef.current.trim();
        bufferRef.current = "";

        if (barcode.length >= minChars) {
          e.preventDefault();
          e.stopPropagation();
          onScan(barcode);
        }
        return;
      }

      // If interval between keystrokes is too long (human typing outside dedicated input), reset buffer
      if (interval > maxIntervalMs && bufferRef.current.length > 0) {
        bufferRef.current = "";
      }

      // Only capture single printable characters
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        bufferRef.current += e.key;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled, minChars, maxIntervalMs, onScan]);
}
