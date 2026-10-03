import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxHeight?: string;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxHeight = 'max-h-[90vh]',
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs transition-opacity"
    >
      {/* Backdrop tap to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Sheet panel */}
      <div
        className={`relative z-10 w-full max-w-lg overflow-hidden rounded-t-[32px] border-t border-[var(--border)] bg-[var(--card)] shadow-2xl animate-slide-up ${maxHeight} flex flex-col`}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 cursor-grab" onClick={onClose}>
          <div className="h-1.5 w-12 rounded-full bg-[var(--border)]" />
        </div>

        {/* Sheet header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--border)]/50">
          <h2 className="text-lg font-bold tracking-tight text-[var(--text)]">
            {title || ''}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--background)] hover:text-[var(--text)] transition-colors active:scale-95"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Sheet body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 pb-8 safe-nav-padding">
          {children}
        </div>
      </div>
    </div>
  );
};
