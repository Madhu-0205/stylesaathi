import React from 'react';
import { Check, X } from 'lucide-react';
import { WardrobeItem } from '../../types';
import { BottomSheet } from '../common/BottomSheet';
import { LazyImage } from '../common/LazyImage';

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
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Complete the Look">
      <div className="space-y-4">
        <p className="text-xs text-(--muted)">
          Select an accessory from your clean wardrobe pieces to complete this look.
        </p>

        {currentAccessory && (
          <div className="flex items-center justify-between rounded-2xl border border-(--accent) bg-(--accent-light)/40 p-3">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 overflow-hidden rounded-xl bg-(--background)">
                <LazyImage
                  src={currentAccessory.photo}
                  alt={currentAccessory.name}
                  category={currentAccessory.category}
                  subcategory={currentAccessory.subcategory}
                  colors={currentAccessory.colors}
                />
              </div>
              <div>
                <span className="text-xs font-bold text-(--text)">
                  {currentAccessory.name}
                </span>
                <span className="block text-[11px] capitalize text-(--accent)">
                  Currently Attached
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                onSelectAccessory(null);
                onClose();
              }}
              className="flex min-h-11 items-center gap-1.5 rounded-full border border-(--border) bg-(--card) px-3.5 text-xs font-semibold text-(--muted) hover:text-red-600 transition-colors active:scale-95"
            >
              <X className="h-3.5 w-3.5" />
              Remove
            </button>
          </div>
        )}

        {accessories.length === 0 ? (
          <div className="rounded-2xl border border-(--border) bg-(--background) p-6 text-center text-xs text-(--muted)">
            No accessories found in your wardrobe. Add a watch, bag, jewellery, or belt in the Wardrobe tab.
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
                  className={`group relative flex flex-col overflow-hidden rounded-2xl border p-2 cursor-pointer transition-all active:scale-95 ${
                    isSelected
                      ? 'border-(--accent) bg-(--accent-light)/30 ring-2 ring-(--accent)/30'
                      : 'border-(--border) bg-(--card) hover:border-(--muted)'
                  }`}
                >
                  <div className="aspect-square w-full overflow-hidden rounded-xl bg-(--background)">
                    <LazyImage
                      src={acc.photo}
                      alt={acc.name}
                      category={acc.category}
                      subcategory={acc.subcategory}
                      colors={acc.colors}
                    />
                  </div>
                  <div className="mt-2 px-1">
                    <h5 className="truncate text-xs font-bold text-(--text)">
                      {acc.name}
                    </h5>
                    <span className="text-[10px] capitalize text-(--muted)">
                      {acc.subcategory || 'accessory'}
                    </span>
                  </div>
                  {isSelected && (
                    <div className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-(--accent) text-white shadow-xs">
                      <Check className="h-3.5 w-3.5 stroke-3" />
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
