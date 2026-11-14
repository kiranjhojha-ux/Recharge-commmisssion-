import React from 'react';
import { formatINR } from '../lib/format';

interface DemoQrCodeProps {
  amount: number;
  purpose: string;
}

export const DemoQrCode: React.FC<DemoQrCodeProps> = ({ amount, purpose }) => {
  const size = 21;
  const cells: boolean[][] = [];
  let seed = amount * 31 + purpose.length * 17;

  for (let r = 0; r < size; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < size; c++) {
      const inTopLeft = r < 7 && c < 7;
      const inTopRight = r < 7 && c >= size - 7;
      const inBottomLeft = r >= size - 7 && c < 7;

      if (inTopLeft || inTopRight || inBottomLeft) {
        const lr = inBottomLeft ? r - (size - 7) : r;
        const lc = inTopRight ? c - (size - 7) : c;
        const isBorder = lr === 0 || lr === 6 || lc === 0 || lc === 6;
        const isCore = lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4;
        row.push(isBorder || isCore);
      } else {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        row.push(seed % 2 === 0);
      }
    }
    cells.push(row);
  }

  return (
    <div className="flex flex-col items-center rounded-xl border border-blue-200 bg-blue-50/50 p-5 text-center">
      <div className="mb-2 text-xs font-semibold text-blue-800">डेमो भुगतान QR प्लेसहोल्डर (UPI)</div>
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="h-40 w-40 text-slate-900"
          role="img"
          aria-label={`डेमो भुगतान QR कोड ${formatINR(amount)}`}
        >
          <rect width={size} height={size} fill="#ffffff" />
          {cells.map((row, rIdx) =>
            row.map((filled, cIdx) =>
              filled ? (
                <rect key={`${rIdx}-${cIdx}`} x={cIdx} y={rIdx} width={1} height={1} fill="currentColor" />
              ) : null,
            ),
          )}
        </svg>
      </div>
      <div className="mt-3 font-mono-tabular text-lg font-bold text-blue-900">{formatINR(amount)}</div>
      <div className="mt-1 text-xs text-slate-600">{purpose}</div>
      <p className="mt-2 max-w-xs text-[11px] leading-relaxed text-amber-800">
        डेमो मोड सूचना: यह केवल एक प्लेसहोल्डर QR है। वास्तविक भुगतान गेटवे सक्रिय नहीं है; एडमिन सत्यापन के बाद ही राशि स्वीकृत होगी।
      </p>
    </div>
  );
};
