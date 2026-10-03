import React from 'react';
import { Category, Subcategory } from '../../types';

interface ClothingFallbackProps {
  category: Category;
  subcategory?: Subcategory;
  name?: string;
  colors?: string[];
  className?: string;
  showLabel?: boolean;
}

export const ClothingFallback: React.FC<ClothingFallbackProps> = ({
  category,
  subcategory,
  name,
  colors = [],
  className = '',
  showLabel = false,
}) => {
  // Editorial SVG silhouettes for different clothing types
  const renderSilhouette = () => {
    switch (category) {
      case 'Tops':
        if (subcategory === 'shirt') {
          return (
            <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-14 w-14 opacity-75">
              <path d="M22 14 L28 20 L36 20 L42 14 L54 22 L48 32 L42 28 L42 54 L22 54 L22 28 L16 32 L10 22 Z" />
              <line x1="32" y1="20" x2="32" y2="54" />
              <circle cx="32" cy="28" r="1" fill="currentColor" />
              <circle cx="32" cy="36" r="1" fill="currentColor" />
              <circle cx="32" cy="44" r="1" fill="currentColor" />
            </svg>
          );
        }
        return (
          // T-Shirt / Top
          <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-14 w-14 opacity-75">
            <path d="M20 14 C26 18 38 18 44 14 L56 22 L48 32 L42 28 L42 54 L22 54 L22 28 L16 32 L8 22 Z" />
          </svg>
        );

      case 'Bottoms':
        if (subcategory === 'trousers' || subcategory === 'palazzo') {
          return (
            <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-14 w-14 opacity-75">
              <path d="M18 14 L46 14 L48 54 L34 54 L32 28 L30 54 L16 54 Z" />
            </svg>
          );
        }
        return (
          // Jeans
          <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-14 w-14 opacity-75">
            <path d="M20 14 L44 14 L48 54 L35 54 L32 26 L29 54 L16 54 Z" />
            <line x1="20" y1="20" x2="44" y2="20" strokeDasharray="2 2" />
          </svg>
        );

      case 'Ethnic':
        if (subcategory === 'saree') {
          return (
            <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-14 w-14 opacity-75">
              <path d="M24 14 L40 14 L44 26 L46 54 L18 54 L20 26 Z" />
              <path d="M20 20 Q32 30 46 50" strokeWidth="2" strokeDasharray="3 3" />
              <path d="M24 16 L44 42" strokeWidth="2" />
            </svg>
          );
        }
        if (subcategory === 'dupatta') {
          return (
            <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-14 w-14 opacity-75">
              <path d="M14 18 C26 12 38 24 50 18 L48 48 C36 42 24 54 12 48 Z" />
            </svg>
          );
        }
        // Kurta / Kurti
        return (
          <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-14 w-14 opacity-75">
            <path d="M22 12 L42 12 L50 20 L44 28 L39 25 L40 56 L34 56 L33 42 L31 42 L30 56 L24 56 L25 25 L20 28 L14 20 Z" />
            <line x1="32" y1="12" x2="32" y2="28" />
          </svg>
        );

      case 'Dresses':
        return (
          <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-14 w-14 opacity-75">
            <path d="M26 12 L38 12 L38 22 L48 54 L16 54 L26 22 Z" />
          </svg>
        );

      case 'Outerwear':
        return (
          <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-14 w-14 opacity-75">
            <path d="M18 12 L46 12 L54 22 L46 32 L40 28 L40 54 L24 54 L24 28 L18 32 L10 22 Z" />
            <path d="M24 12 L32 24 L40 12" />
          </svg>
        );

      case 'Footwear':
        return (
          <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-14 w-14 opacity-75">
            <path d="M12 40 C14 30 24 24 38 26 L52 34 L54 44 C50 46 20 46 12 40 Z" />
            <line x1="12" y1="42" x2="54" y2="42" strokeWidth="3" />
          </svg>
        );

      case 'Accessories':
        if (subcategory === 'watch') {
          return (
            <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-14 w-14 opacity-75">
              <rect x="28" y="10" width="8" height="44" rx="2" />
              <circle cx="32" cy="32" r="12" fill="var(--card, #FFF)" />
              <line x1="32" y1="32" x2="32" y2="26" />
              <line x1="32" y1="32" x2="37" y2="32" />
            </svg>
          );
        }
        return (
          // Bag
          <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-14 w-14 opacity-75">
            <path d="M24 22 C24 16 40 16 40 22" />
            <rect x="16" y="22" width="32" height="30" rx="4" />
          </svg>
        );

      default:
        return (
          <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-14 w-14 opacity-75">
            <rect x="18" y="18" width="28" height="28" rx="6" />
          </svg>
        );
    }
  };

  return (
    <div
      className={`relative flex h-full w-full flex-col items-center justify-center p-3 text-(--muted) select-none bg-(--background)/60 ${className}`}
    >
      <div className="text-(--muted)/80 transition-transform duration-200 group-hover:scale-105">
        {renderSilhouette()}
      </div>

      {showLabel && name && (
        <span className="mt-2 text-center text-[11px] font-medium tracking-tight text-(--muted) line-clamp-1 max-w-[90%]">
          {name}
        </span>
      )}

      {colors.length > 0 && (
        <div className="mt-1.5 flex gap-1 items-center">
          {colors.slice(0, 3).map((c, i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full border border-black/15 shadow-2xs"
              style={{
                backgroundColor:
                  c === 'white'
                    ? '#FFFFFF'
                    : c === 'cream'
                    ? '#FDFBF7'
                    : c === 'beige'
                    ? '#E8DFD8'
                    : c === 'navy'
                    ? '#1B2A4A'
                    : c === 'olive'
                    ? '#556B2F'
                    : c === 'mustard'
                    ? '#E1AD01'
                    : c,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};
