import React from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onClose: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = '確定刪除',
  cancelText = '取消',
  type = 'danger',
  onConfirm,
  onClose,
}) => {
  if (!isOpen) return null;

  const isDanger = type === 'danger';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#0e0e0e] border border-white/10 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-5 text-center relative overflow-hidden">
        {/* Ambient Top Glow */}
        <div
          className={`absolute -top-12 left-1/2 -translate-x-1/2 w-40 h-40 rounded-full blur-[50px] pointer-events-none ${
            isDanger ? 'bg-rose-500/20' : 'bg-amber-500/20'
          }`}
        />

        {/* Animated Icon Circle */}
        <div className="relative z-10 flex justify-center">
          <div
            className={`w-14 h-14 rounded-2xl border flex items-center justify-center shadow-lg transition-transform hover:scale-105 ${
              isDanger
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            }`}
          >
            {isDanger ? <Trash2 className="w-7 h-7" /> : <AlertTriangle className="w-7 h-7" />}
          </div>
        </div>

        {/* Text Content */}
        <div className="relative z-10 space-y-2">
          <h3 className="text-lg font-black text-white tracking-tight">{title}</h3>
          <p className="text-xs sm:text-sm text-gray-400 leading-relaxed px-2">{message}</p>
        </div>

        {/* Action Buttons */}
        <div className="relative z-10 flex items-center gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-xs sm:text-sm font-bold text-gray-300 transition cursor-pointer active:scale-95"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`flex-1 py-2.5 px-4 font-black rounded-2xl text-xs sm:text-sm transition cursor-pointer active:scale-95 shadow-lg flex items-center justify-center gap-1.5 ${
              isDanger
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
                : 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/30'
            }`}
          >
            <Trash2 className="w-4 h-4" />
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
