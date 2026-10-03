import React, { useState, useRef } from 'react';
import { Camera, Upload, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { BottomSheet } from '../common/BottomSheet';
import { Category, Subcategory, Occasion, WardrobeItem } from '../../types';
import { CATEGORIES, SUBCATEGORIES, OCCASIONS, COLOR_PALETTE } from '../../data/taxonomy';
import { compressImage } from '../../utils/imageCompressor';
import { autoTagger } from '../../utils/autoTagger';

interface AddItemSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onAddItem: (item: WardrobeItem) => Promise<void>;
}

export const AddItemSheet: React.FC<AddItemSheetProps> = ({
  isOpen,
  onClose,
  onAddItem,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields auto-populated by AutoTagger
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('Tops');
  const [subcategory, setSubcategory] = useState<Subcategory>('t-shirt');
  const [colors, setColors] = useState<string[]>(['white']);
  const [occasions, setOccasions] = useState<Occasion[]>(['college', 'casual outing']);
  const [formality, setFormality] = useState(2);

  const resetForm = () => {
    setPhotoData(null);
    setIsProcessing(false);
    setError(null);
    setName('');
    setCategory('Tops');
    setSubcategory('t-shirt');
    setColors(['white']);
    setOccasions(['college', 'casual outing']);
    setFormality(2);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsProcessing(true);

    try {
      // 1. Client-side canvas compression (~800px max, JPEG 0.78)
      const compressed = await compressImage(file);
      setPhotoData(compressed);

      // 2. Vision auto-tagging seam
      const tagResult = await autoTagger.analyze(file);
      setCategory(tagResult.category);
      if (tagResult.subcategory) setSubcategory(tagResult.subcategory);
      setColors(tagResult.colors);
      setOccasions(tagResult.occasions);
      setFormality(tagResult.formality);

      // 3. Smart initial name suggestion
      const colorStr = tagResult.colors[0] ? `${tagResult.colors[0]} ` : '';
      const subStr = tagResult.subcategory || tagResult.category;
      setName(`${colorStr}${subStr}`.replace(/^\w/, (c) => c.toUpperCase()));
    } catch (err: any) {
      setError(err?.message || "Couldn't add this photo. Try another image.");
      setPhotoData(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCategoryChange = (cat: Category) => {
    setCategory(cat);
    const available = SUBCATEGORIES[cat];
    if (available && available.length > 0) {
      setSubcategory(available[0]);
    }
  };

  const toggleColor = (c: string) => {
    setColors((prev) =>
      prev.includes(c) ? (prev.length > 1 ? prev.filter((x) => x !== c) : prev) : [...prev, c]
    );
  };

  const toggleOccasion = (occ: Occasion) => {
    setOccasions((prev) =>
      prev.includes(occ) ? (prev.length > 1 ? prev.filter((x) => x !== occ) : prev) : [...prev, occ]
    );
  };

  const handleSave = async () => {
    const newItem: WardrobeItem = {
      id: crypto.randomUUID ? crypto.randomUUID() : `item-${Date.now()}`,
      name: name.trim() || `${category} piece`,
      photo: photoData,
      category,
      subcategory,
      colors,
      seasons: ['summer', 'monsoon', 'winter'],
      occasions,
      formality,
      status: 'clean',
      favorite: false,
      note: '',
      timesWorn: 0,
      createdAt: Date.now(),
    };

    await onAddItem(newItem);
    resetForm();
    onClose();
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={() => {
        resetForm();
        onClose();
      }}
      title="Add to Wardrobe"
    >
      <div className="space-y-5">
        {/* Photo Upload Area */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />

          {photoData ? (
            <div className="relative aspect-4/3 w-full overflow-hidden rounded-3xl border border-(--border) bg-(--background)">
              <img
                src={photoData}
                alt="Upload preview"
                className="h-full w-full object-contain p-2"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-(--card)/90 px-3 py-1.5 text-xs font-bold text-(--text) shadow-md backdrop-blur-xs transition-transform hover:scale-105 active:scale-95"
              >
                <RefreshCw className="h-3.5 w-3.5 text-(--accent)" />
                Change Photo
              </button>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex aspect-4/3 cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-(--border) bg-(--background)/60 p-6 text-center transition-all hover:border-(--accent) hover:bg-(--background) active:scale-[0.99]"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-(--card) text-(--accent) shadow-xs">
                <Camera className="h-6 w-6 stroke-2" />
              </div>
              <h4 className="mt-3 text-sm font-bold text-(--text)">
                {isProcessing ? 'Processing photo...' : 'Take photo or choose from gallery'}
              </h4>
              <p className="mt-1 text-xs text-(--muted)">
                JPEG, PNG or WebP · Auto-compressed to under 200KB
              </p>
            </div>
          )}

          {error && (
            <div className="mt-2.5 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Name Input */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-(--muted)">
            Item Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. White Cotton Kurta, Blue Jeans"
            className="mt-1 w-full rounded-2xl border border-(--border) bg-(--background) px-4 py-3 text-sm font-bold text-(--text) outline-none focus:border-(--accent)"
          />
        </div>

        {/* Category Chips */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-(--muted)">
            Category
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => handleCategoryChange(cat)}
                className={`min-h-10 rounded-full px-3.5 py-1 text-xs font-semibold transition-all ${
                  category === cat
                    ? 'bg-(--accent) text-white shadow-xs'
                    : 'border border-(--border) bg-(--card) text-(--text) hover:border-(--muted)'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Subcategory Chips */}
        {SUBCATEGORIES[category] && (
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-(--muted)">
              Garment Type
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {SUBCATEGORIES[category].map((sub) => (
                <button
                  key={sub}
                  type="button"
                  onClick={() => setSubcategory(sub)}
                  className={`min-h-10 rounded-full px-3.5 py-1 text-xs font-semibold capitalize transition-all active:scale-95 ${
                    subcategory === sub
                      ? 'bg-(--text) text-(--background) shadow-xs'
                      : 'border border-(--border) bg-(--card) text-(--muted) hover:text-(--text)'
                  }`}
                >
                  {sub}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Colors Selection */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-(--muted)">
            Primary Colors (Tap to pick)
          </label>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {COLOR_PALETTE.map((c) => {
              const isSelected = colors.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleColor(c)}
                  className={`flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 py-1 text-xs font-medium capitalize transition-all active:scale-95 ${
                    isSelected
                      ? 'border-(--accent) bg-(--accent-light) text-(--accent) font-bold shadow-2xs'
                      : 'border-(--border) bg-(--card) text-(--muted) hover:border-(--muted)'
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full border border-black/20"
                    style={{ backgroundColor: c }}
                  />
                  <span>{c}</span>
                  {isSelected && <Check className="h-3 w-3 stroke-3" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Formality level */}
        <div>
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold uppercase tracking-wider text-(--muted)">
              Formality Level
            </label>
            <span className="text-xs font-bold text-(--text)">
              {formality === 1
                ? 'Casual / Loungewear'
                : formality === 2
                ? 'Casual / Everyday'
                : formality === 3
                ? 'Smart Casual'
                : formality === 4
                ? 'Formal / Festive'
                : 'Wedding / Ultra Festive'}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setFormality(lvl)}
                className={`min-h-11 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                  formality === lvl
                    ? 'bg-(--accent) text-white shadow-xs'
                    : 'border border-(--border) bg-(--card) text-(--muted) hover:border-(--muted)'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        {/* Occasions */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-(--muted)">
            Suitable Occasions
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {OCCASIONS.map((occ) => {
              const isSelected = occasions.includes(occ);
              return (
                <button
                  key={occ}
                  type="button"
                  onClick={() => toggleOccasion(occ)}
                  className={`min-h-10 rounded-full px-3.5 py-1 text-xs font-semibold capitalize transition-all active:scale-95 ${
                    isSelected
                      ? 'bg-(--accent) text-white shadow-2xs'
                      : 'border border-(--border) bg-(--card) text-(--muted) hover:border-(--muted)'
                  }`}
                >
                  {occ}
                </button>
              );
            })}
          </div>
        </div>

        {/* Save CTA */}
        <div className="pt-3">
          <button
            type="button"
            onClick={handleSave}
            className="w-full min-h-12.5 rounded-2xl bg-(--accent) px-4 py-3 text-sm font-bold text-white shadow-md transition-transform hover:opacity-95 active:scale-[0.98]"
          >
            Add to Wardrobe
          </button>
        </div>
      </div>
    </BottomSheet>
  );
};
