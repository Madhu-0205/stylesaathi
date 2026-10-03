import React, { useState, useEffect } from 'react';
import { WardrobeItem } from '../../types';
import { getImageUrl } from '../../services/imageStore';
import { ClothingFallback } from './ClothingFallback';

interface ItemImageProps {
  item: WardrobeItem;
  className?: string;
  isHero?: boolean;
  showLabel?: boolean;
}

/**
 * Renders a wardrobe item photograph.
 * If the item has a photoId, loads the image Blob asynchronously from IndexedDB
 * via an Object URL. While loading, on error, or if no photo exists, renders the
 * styled editorial colored placeholder tile (ClothingFallback).
 */
export const ItemImage: React.FC<ItemImageProps> = ({
  item,
  className = '',
  isHero = false,
  showLabel = false,
}) => {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(item.photo || null);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(item.photoId && !item.photo));
  const [hasError, setHasError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setHasError(false);
    setImgLoaded(false);

    // If an asset URL or existing string is present, use it directly
    if (item.photo) {
      setResolvedSrc(item.photo);
      setIsLoading(false);
      return;
    }

    // Otherwise, load from IndexedDB using photoId
    if (item.photoId) {
      setIsLoading(true);
      getImageUrl(item.photoId)
        .then((url) => {
          if (isMounted) {
            setResolvedSrc(url || null);
            setIsLoading(false);
          }
        })
        .catch(() => {
          if (isMounted) {
            setResolvedSrc(null);
            setIsLoading(false);
          }
        });
    } else {
      setResolvedSrc(null);
      setIsLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [item.photo, item.photoId]);

  // If loading or if no photo or image failed to load, show the colored placeholder tile
  if (isLoading || !resolvedSrc || hasError) {
    return (
      <ClothingFallback
        category={item.category}
        subcategory={item.subcategory}
        name={item.name}
        colors={item.colors}
        className={className}
        showLabel={showLabel}
      />
    );
  }

  return (
    <div className={`relative h-full w-full overflow-hidden bg-(--background)/40 ${className}`}>
      {!imgLoaded && (
        <div className="absolute inset-0 animate-pulse bg-(--border)/30" />
      )}
      <img
        src={resolvedSrc}
        alt={item.name}
        loading={isHero ? undefined : 'lazy'}
        fetchPriority={isHero ? 'high' : undefined}
        onLoad={() => setImgLoaded(true)}
        onError={() => setHasError(true)}
        className={`h-full w-full object-contain p-2 transition-opacity duration-300 ${
          imgLoaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
};
