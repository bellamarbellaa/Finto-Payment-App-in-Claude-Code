import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

/**
 * A real, scannable QR code — a phone camera must be able to read this, so it
 * uses a proper encoder rather than a decorative grid of squares.
 * Error correction is set to M so the code survives a screen photographed at
 * an angle.
 */
export function QrCode({ value, size = 196 }: { value: string; size?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvas.current) return;

    QRCode.toCanvas(canvas.current, value, {
      width: size,
      margin: 0,
      errorCorrectionLevel: 'M',
      color: { dark: '#0B0C0B', light: '#FFFFFF' }
    }).catch(() => {
      // A failed render leaves the link text below it, which still works.
    });
  }, [value, size]);

  return <canvas ref={canvas} width={size} height={size} aria-label="Payment QR code" />;
}
