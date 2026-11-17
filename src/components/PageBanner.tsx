import React from 'react';
import { Info } from 'lucide-react';

interface PageBannerProps {
  title: string;
  description: string;
}

export const PageBanner: React.FC<PageBannerProps> = ({ title, description }) => {
  return (
    <div className="no-print flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800">
      <Info className="w-4 h-4 text-blue-700 mt-0.5 shrink-0" />
      <div className="min-w-0 text-xs leading-relaxed">
        <span className="font-semibold text-slate-900">{title}</span>
        <span className="mx-1.5 text-slate-300" aria-hidden="true">
          ·
        </span>
        <span className="text-slate-600">{description}</span>
      </div>
    </div>
  );
};
