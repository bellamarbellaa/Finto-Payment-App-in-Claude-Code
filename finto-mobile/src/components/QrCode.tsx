import { useMemo } from 'react';
import Svg, { Rect } from 'react-native-svg';
import QRCode from 'qrcode';
import { colors } from '../lib/theme';

/**
 * A real, scannable QR code.
 *
 * `qrcode` generates the module matrix and react-native-svg draws it — rather
 * than rendering to a canvas, which React Native has no equivalent of. Error
 * correction M so the code still reads when photographed off a screen at an
 * angle.
 */
export function QrCode({ value, size = 196 }: { value: string; size?: number }) {
  const matrix = useMemo(() => {
    try {
      const created = QRCode.create(value, { errorCorrectionLevel: 'M' });
      return { count: created.modules.size, data: created.modules.data };
    } catch {
      return null;
    }
  }, [value]);

  if (!matrix) return null;

  const cell = size / matrix.count;
  const squares: React.ReactElement[] = [];

  for (let row = 0; row < matrix.count; row++) {
    for (let column = 0; column < matrix.count; column++) {
      if (!matrix.data[row * matrix.count + column]) continue;

      squares.push(
        <Rect
          key={`${row}-${column}`}
          x={column * cell}
          y={row * cell}
          // A hair of overlap prevents seams between modules on some densities.
          width={cell + 0.5}
          height={cell + 0.5}
          fill={colors.ink}
        />
      );
    }
  }

  return (
    <Svg width={size} height={size} accessibilityLabel="Payment QR code">
      <Rect x={0} y={0} width={size} height={size} fill={colors.white} />
      {squares}
    </Svg>
  );
}
