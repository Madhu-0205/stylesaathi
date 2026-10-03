import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
  maxHeight = 'max-h-[88vh]',
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs transition-opacity duration-300 animate-fade-in"
    >
      {/* Backdrop tap to close */}
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      {/* Sheet panel */}
      <div
        className={`relative z-10 w-full max-w-110 mx-auto overflow-hidden rounded-t-3xl border-t border-(--border) bg-(--card) shadow-2xl animate-slide-up ${maxHeight} flex flex-col`}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 cursor-grab" onClick={onClose} aria-hidden="true">
          <div className="h-1 w-10 rounded-full bg-(--border)" />
        </div>

        {/* Sheet header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-(--border)">
          <h2 className="font-serif text-lg font-normal tracking-wide uppercase text-(--ink)">
            {title || ''}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close sheet"
            className="flex h-11 w-11 items-center justify-center rounded-full text-(--muted) hover:text-(--ink) transition-colors active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Sheet body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 pb-8 safe-nav-padding">
          {children}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
};

