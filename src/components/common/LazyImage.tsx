import React, { useState } from 'react';
import { ClothingFallback } from './ClothingFallback';
import { Category, Subcategory } from '../../types';

interface LazyImageProps {
  src?: string | null;
  alt: string;
  category: Category;
  subcategory?: Subcategory;
  colors?: string[];
  className?: string;
  isHero?: boolean;
}

export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  category,
  subcategory,
  colors,
  className = '',
  isHero = false,
}) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  if (!src || error) {
    return (
      <ClothingFallback
        category={category}
        subcategory={subcategory}
        name={alt}
        colors={colors}
        className={className}
      />
    );
  }

  return (
    <div className={`relative h-full w-full overflow-hidden bg-[var(--background)]/40 ${className}`}>
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-[var(--border)]/30" />
      )}
      <img
        src={src}
        alt={alt}
        loading={isHero ? undefined : 'lazy'}
        fetchPriority={isHero ? 'high' : undefined}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        className={`h-full w-full object-contain p-2 transition-opacity duration-300 ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
};
