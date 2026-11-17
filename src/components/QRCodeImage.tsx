import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QRCodeImageProps {
  value: string;
  size?: number;
  className?: string;
  alt?: string;
}

export const QRCodeImage: React.FC<QRCodeImageProps> = ({
  value,
  size = 128,
  className = '',
  alt,
}) => {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, {
      width: size * 2,
      margin: 1,
      color: {
        dark: '#0F172A',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch(() => {
        if (active) setDataUrl('');
      });

    return () => {
      active = false;
    };
  }, [value, size]);

  if (!dataUrl) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`flex items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-[10px] font-mono text-slate-400 ${className}`}
      >
        QR
      </div>
    );
  }

  return (
    <img
      src={dataUrl}
      width={size}
      height={size}
      alt={alt || `Kode QR ${value}`}
      referrerPolicy="no-referrer"
      className={`block rounded-md bg-white ${className}`}
    />
  );
};
