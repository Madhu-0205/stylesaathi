import React from 'react';
import { Check, X } from 'lucide-react';
import { WardrobeItem } from '../../types';
import { BottomSheet } from '../common/BottomSheet';
import { ItemImage } from '../common/ItemImage';

interface AccessoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  accessories: WardrobeItem[];
  currentAccessory: WardrobeItem | null;
  onSelectAccessory: (accessory: WardrobeItem | null) => void;
}

export const AccessoryDrawer: React.FC<AccessoryDrawerProps> = ({
  isOpen,
  onClose,
  accessories,
  currentAccessory,
  onSelectAccessory,
}) => {
  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="FINISH THE LOOK">
      <div className="space-y-4">
        <p className="text-xs text-muted font-normal leading-relaxed">
          Curate an accessory from your clean wardrobe pieces — bag, watch, jewellery, or scarf — to complete this editorial composition.
        </p>

        {currentAccessory && (
          <div className="flex items-center justify-between rounded-xl border border-(--burnished-gold) bg-(--ivory) p-3">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 overflow-hidden rounded-lg bg-(--paper) border border-border">
                <ItemImage
                  item={currentAccessory}
                  className="h-full w-full object-cover"
                />
              </div>
              <div>
                <span className="text-xs font-semibold text-(--ink)">
                  {currentAccessory.name}
                </span>
                <span className="block text-[10px] uppercase tracking-wider text-(--burnished-gold) font-bold">
                  Attached to Look
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                onSelectAccessory(null);
                onClose();
              }}
              className="flex min-h-11 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-medium text-muted hover:text-(--kumkum) hover:border-(--kumkum) transition-colors active:scale-95"
            >
              <X className="h-3.5 w-3.5" />
              <span>Remove</span>
            </button>
          </div>
        )}

        {accessories.length === 0 ? (
          <div className="rounded-xl border border-border bg-(--ivory) p-6 text-center text-xs text-muted">
            <p className="font-serif text-base italic text-(--ink) mb-1">No clean accessories found</p>
            Add a watch, bag, jewellery, sunglasses, or scarf to your wardrobe to complete your styled looks.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {accessories.map((acc) => {
              const isSelected = currentAccessory?.id === acc.id;
              return (
                <div
                  key={acc.id}
                  onClick={() => {
                    onSelectAccessory(isSelected ? null : acc);
                    onClose();
                  }}
                  className={`group relative flex flex-col overflow-hidden rounded-xl border p-2 cursor-pointer transition-all active:scale-98 ${
                    isSelected
                      ? 'border-(--kumkum) bg-(--ivory) ring-1 ring-(--kumkum)'
                      : 'border-border bg-card hover:border-(--ink)'
                  }`}
                >
                  <div className="aspect-square w-full overflow-hidden rounded-lg bg-(--ivory)">
                    <ItemImage
                      item={acc}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="mt-2 px-0.5">
                    <h5 className="truncate text-xs font-semibold text-(--ink)">
                      {acc.name}
                    </h5>
                    <span className="text-[10px] uppercase tracking-wider text-muted">
                      {acc.subcategory || 'accessory'}
                    </span>
                  </div>
                  {isSelected && (
                    <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-(--kumkum) text-white shadow-xs">
                      <Check className="h-3 w-3 stroke-3" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </BottomSheet>
  );
};

