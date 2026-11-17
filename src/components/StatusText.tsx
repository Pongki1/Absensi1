import React from 'react';
import { CheckCircle2, Clock, FileText, MinusCircle, AlertTriangle } from 'lucide-react';
import type { AttendanceStatus } from '../types/attendance';

interface StatusTextProps {
  status: AttendanceStatus;
}

export const StatusText: React.FC<StatusTextProps> = ({ status }) => {
  switch (status) {
    case 'Hadir':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>Hadir</span>
        </span>
      );
    case 'Terlambat':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>Terlambat</span>
        </span>
      );
    case 'Izin':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 whitespace-nowrap">
          <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span>Izin</span>
        </span>
      );
    case 'Sakit':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 whitespace-nowrap">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>Sakit</span>
        </span>
      );
    case 'Alpa':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 whitespace-nowrap">
          <MinusCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
          <span>Alpa</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>Belum Scan</span>
        </span>
      );
  }
};
