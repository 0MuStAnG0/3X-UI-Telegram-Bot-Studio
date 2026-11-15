import React from 'react';

interface QrMatrixProps {
  value: string;
}

export function QrMatrix({ value }: QrMatrixProps) {
  const size = 21;
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  const isFinder = (r: number, c: number) => {
    const inCorner = (rr: number, cc: number) => {
      if (rr < 0 || cc < 0 || rr >= 7 || cc >= 7) return false;
      if (rr === 0 || rr === 6 || cc === 0 || cc === 6) return true;
      if (rr >= 2 && rr <= 4 && cc >= 2 && cc <= 4) return true;
      return false;
    };
    return inCorner(r, c) || inCorner(r, size - 1 - c) || inCorner(size - 1 - r, c);
  };

  const isFinderZone = (r: number, c: number) =>
    (r < 8 && c < 8) || (r < 8 && c >= size - 8) || (r >= size - 8 && c < 8);

  const cells: React.ReactNode[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      let dark = false;
      if (isFinderZone(r, c)) {
        dark = isFinder(r, c);
      } else {
        const bit = ((hash ^ (r * 31 + c * 17)) >>> ((r + c) % 16)) & 1;
        dark = bit === 1;
      }
      if (dark) {
        cells.push(<rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill="#0f172a" />);
      }
    }
  }

  return (
    <div className="mt-2 inline-block bg-white p-2 rounded border border-slate-200">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="w-28 h-28"
        role="img"
        aria-label={`QR Code برای ${value}`}
      >
        <rect width={size} height={size} fill="#ffffff" />
        {cells}
      </svg>
    </div>
  );
}
