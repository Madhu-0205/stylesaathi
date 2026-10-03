import React from 'react';
import { StyleSaathiLoader, StyleSaathiLoaderProps } from './StyleSaathiLoader';

export interface StyleSaathiLoadingOverlayProps extends StyleSaathiLoaderProps {
  isVisible?: boolean;
  isFadingOut?: boolean;
  fullScreen?: boolean;
}

/**
 * Reusable StyleSaathi Loading Overlay
 * Used for significant application state transitions (initial repository hydration,
 * bulk wardrobe operations, and high-computation styling simulations).
 */
export const StyleSaathiLoadingOverlay: React.FC<StyleSaathiLoadingOverlayProps> = ({
  isVisible = true,
  isFadingOut = false,
  fullScreen = true,
  statusText = 'Curating your wardrobe…',
  subtext,
  size = 'md',
}) => {
  if (!isVisible && !isFadingOut) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Loading StyleSaathi"
      className={`${
        fullScreen ? 'fixed inset-0 z-50' : 'absolute inset-0 z-30'
      } flex flex-col items-center justify-center bg-(--background)/95 backdrop-blur-md p-6 transition-all duration-400 ease-out select-none ${
        isFadingOut ? 'opacity-0 scale-[0.99] pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      <div className="flex flex-col items-center justify-center max-w-sm w-full mx-auto">
        <StyleSaathiLoader
          size={size}
          statusText={statusText}
          subtext={subtext}
        />
      </div>
    </div>
  );
};
