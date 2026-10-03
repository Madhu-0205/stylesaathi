import React, { useEffect } from 'react';
import { AlertCircle, X } from 'lucide-react';

interface ToastProps {
  message: string | null;
  onClose: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({ message, onClose, duration = 4000 }) => {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, onClose, duration]);

  if (!message) return null;

  return (
    <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 px-4 w-full max-w-sm pointer-events-none transition-all duration-300">
      <div className="pointer-events-auto flex items-center justify-between gap-3 rounded-xl border border-(--border) bg-(--card)/95 px-4 py-3 text-xs text-(--text) shadow-lg backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <AlertCircle className="h-4 w-4 shrink-0 text-(--accent)" />
          <span className="font-medium leading-tight">{message}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close notification"
          className="shrink-0 p-1 text-(--muted) hover:text-(--text) transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
