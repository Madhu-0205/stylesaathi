import React, { useState, useRef } from 'react';
import { Camera, Check, AlertCircle, RefreshCw, ChevronDown, ChevronUp, Sparkles, ShieldCheck } from 'lucide-react';
import { BottomSheet } from '../common/BottomSheet';
import {
  Category,
  Subcategory,
  Occasion,
  WardrobeItem,
  FabricType,
  PatternType,
  SilhouetteFit,
  CulturalContext,
  ConfidenceLevel,
} from '../../types';
import {
  CATEGORIES,
  SUBCATEGORIES,
  OCCASIONS,
  COLOR_PALETTE,
  FABRICS,
  PATTERNS,
  SILHOUETTES,
} from '../../data/taxonomy';
import { compressImageToBlob } from '../../utils/imageCompressor';
import { autoTagImage } from '../../services/autoTag';
import { saveImage } from '../../services/imageStore';
import { useWardrobeContext } from '../../context/WardrobeContext';

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
  const { showToast } = useWardrobeContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Progressive Disclosure: Collapsed Advanced Section
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('Tops');
  const [subcategory, setSubcategory] = useState<Subcategory>('t-shirt');
  const [colors, setColors] = useState<string[]>(['white']);
  const [occasions, setOccasions] = useState<Occasion[]>(['college', 'casual outing']);
  const [formality, setFormality] = useState(2);

  // Phase 2 Fashion Intelligence fields
  const [fabric, setFabric] = useState<FabricType>('cotton');
  const [pattern, setPattern] = useState<PatternType>('solid');
  const [fit, setFit] = useState<SilhouetteFit>('regular');
  const [purchasePrice, setPurchasePrice] = useState<string>('');
  const [culturalContext, setCulturalContext] = useState<CulturalContext>('contemporary');
  const [aiConfidence, setAiConfidence] = useState<number>(0.75);
  const [confidenceLevel, setConfidenceLevel] = useState<ConfidenceLevel>('MEDIUM');
  const [userVerified, setUserVerified] = useState<boolean>(false);

  const resetForm = () => {
    if (photoPreview) {
      try {
        URL.revokeObjectURL(photoPreview);
      } catch {}
    }
    setPhotoBlob(null);
    setPhotoPreview(null);
    setIsProcessing(false);
    setError(null);
    setName('');
    setCategory('Tops');
    setSubcategory('t-shirt');
    setColors(['white']);
    setOccasions(['college', 'casual outing']);
    setFormality(2);
    setFabric('cotton');
    setPattern('solid');
    setFit('regular');
    setPurchasePrice('');
    setCulturalContext('contemporary');
    setAiConfidence(0.75);
    setConfidenceLevel('MEDIUM');
    setUserVerified(false);
    setShowAdvanced(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsProcessing(true);

    try {
      // 1. Client-side canvas compression (~800px max side, JPEG quality ~0.8) into a Blob
      const blob = await compressImageToBlob(file, 800, 0.8);
      setPhotoBlob(blob);

      if (photoPreview) {
        try {
          URL.revokeObjectURL(photoPreview);
        } catch {}
      }
      const preview = URL.createObjectURL(blob);
      setPhotoPreview(preview);

      // 2. Vision auto-tagging seam
      const tagResult = await autoTagImage(file);
      setCategory(tagResult.category);
      if (tagResult.subcategory) setSubcategory(tagResult.subcategory);
      setColors(tagResult.colors);
      setOccasions(tagResult.occasions);
      setFormality(tagResult.formality);
      if (tagResult.fabric) setFabric(tagResult.fabric);
      if (tagResult.pattern) setPattern(tagResult.pattern);
      if (tagResult.fit) setFit(tagResult.fit);
      if (tagResult.culturalContext) setCulturalContext(tagResult.culturalContext);
      if (tagResult.confidence !== undefined) setAiConfidence(tagResult.confidence);
      if (tagResult.confidenceLevel) setConfidenceLevel(tagResult.confidenceLevel);
      setUserVerified(false);

      // 3. Smart initial name suggestion
      const colorStr = tagResult.colors[0] ? `${tagResult.colors[0]} ` : '';
      const subStr = tagResult.subcategory || tagResult.category;
      setName(`${colorStr}${subStr}`.replace(/^\w/, (c) => c.toUpperCase()));
    } catch (err: any) {
      setError(err?.message || "Couldn't add this photo. Try another image.");
      if (photoPreview) {
        try {
          URL.revokeObjectURL(photoPreview);
        } catch {}
      }
      setPhotoBlob(null);
      setPhotoPreview(null);
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
    setUserVerified(true);
  };

  const toggleColor = (c: string) => {
    setColors((prev) =>
      prev.includes(c) ? (prev.length > 1 ? prev.filter((x) => x !== c) : prev) : [...prev, c]
    );
    setUserVerified(true);
  };

  const toggleOccasion = (occ: Occasion) => {
    setOccasions((prev) =>
      prev.includes(occ) ? (prev.length > 1 ? prev.filter((x) => x !== occ) : prev) : [...prev, occ]
    );
    setUserVerified(true);
  };

  const handleSave = async () => {
    let photoId: string | undefined;

    if (photoBlob) {
      const id = crypto.randomUUID ? crypto.randomUUID() : `photo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      try {
        await saveImage(id, photoBlob);
        photoId = id;
      } catch (saveErr) {
        console.warn('Failed to save image into IndexedDB:', saveErr);
        showToast("Couldn't save the photo, the item was saved without one");
      }
    }

    const priceNum = purchasePrice.trim() ? parseFloat(purchasePrice) : undefined;

    const newItem: WardrobeItem = {
      id: crypto.randomUUID ? crypto.randomUUID() : `item-${Date.now()}`,
      name: name.trim() || `${category} piece`,
      photoId,
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
      fabric,
      pattern,
      fit,
      purchasePrice: !isNaN(priceNum as number) ? priceNum : undefined,
      culturalContext,
      aiConfidence,
      userVerified,
      provenance: {
        classification: {
          source: userVerified ? 'user' : 'ai',
          confidence: aiConfidence,
          verifiedAt: userVerified ? Date.now() : undefined,
        },
      },
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
      title="ADD TO WARDROBE"
    >
      <div className="space-y-5 pb-4">
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

          {photoPreview ? (
            <div className="space-y-3">
              <div className="relative aspect-4/3 w-full overflow-hidden rounded-2xl border border-border bg-(--ivory)">
                <img
                  src={photoPreview}
                  alt="Upload preview"
                  className="h-full w-full object-contain p-2"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-3 right-3 flex min-h-11 items-center gap-1.5 rounded-xl border border-border bg-(--paper)/95 px-3.5 py-1.5 text-xs font-semibold text-(--ink) shadow-sm backdrop-blur-xs transition-colors hover:bg-(--paper) focus-editorial active:scale-95"
                >
                  <RefreshCw className="h-3.5 w-3.5 text-(--burnished-gold)" />
                  <span>Change Photo</span>
                </button>
              </div>

              {/* Natural Stylist Suggestion Tag with Confidence */}
              <div className="rounded-xl border border-(--burnished-gold)/40 bg-(--ivory) p-3 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-(--burnished-gold)" />
                    <span className="text-[9.5px] font-bold uppercase tracking-[0.2em] text-(--burnished-gold)">
                      SUGGESTED DETAILS · {Math.round(aiConfidence * 100)}% CONFIDENCE
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-serif italic text-(--ink)">
                    {colors[0] || ''} {fabric} {subcategory || category.toLowerCase()} in {pattern} weave.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setUserVerified(true)}
                  className={`inline-flex shrink-0 min-h-9 items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                    userVerified
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'border border-(--burnished-gold)/60 bg-(--paper) text-(--ink) hover:border-(--ink)'
                  }`}
                >
                  {userVerified ? (
                    <>
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Verified</span>
                    </>
                  ) : (
                    <span>Confirm</span>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex aspect-4/3 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-(--ivory)/40 p-6 text-center transition-all hover:border-(--kumkum) hover:bg-(--ivory) active:scale-[0.99] focus-editorial"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              aria-label="Upload garment photograph"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-card text-(--burnished-gold) border border-border shadow-2xs">
                <Camera className="h-5 w-5" />
              </div>
              <h4 className="mt-3 font-serif text-base text-(--ink)">
                {isProcessing ? 'Analyzing garment details...' : 'Photograph or select garment'}
              </h4>
              <p className="mt-1 text-[11px] text-muted max-w-xs">
                Warm directional lighting on a neutral surface gives the cleanest look.
              </p>
            </div>
          )}

          {error && (
            <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Item Name Input */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
            GARMENT NAME
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setUserVerified(true);
            }}
            placeholder="e.g. Ivory Cotton Kurta, Raw Denim Jeans"
            className="mt-1 w-full min-h-12 rounded-xl border border-border bg-(--paper) px-3.5 py-2.5 font-serif text-base text-(--ink) outline-none focus-editorial"
          />
        </div>

        {/* Category Chips with 44px Touch Targets */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
            CATEGORY
          </label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => handleCategoryChange(cat)}
                aria-pressed={category === cat}
                className={`min-h-11 rounded-xl px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all focus-editorial active:scale-95 ${
                  category === cat
                    ? 'border border-(--ink) bg-(--ink) text-(--paper) shadow-2xs'
                    : 'border border-border bg-card text-muted hover:border-(--ink)'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Subcategory Chips with 44px Touch Targets */}
        {SUBCATEGORIES[category] && (
          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
              GARMENT TYPE
            </label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {SUBCATEGORIES[category].map((sub) => (
                <button
                  key={sub}
                  type="button"
                  onClick={() => {
                    setSubcategory(sub);
                    setUserVerified(true);
                  }}
                  aria-pressed={subcategory === sub}
                  className={`min-h-11 rounded-xl px-3.5 py-1.5 text-xs font-medium capitalize transition-all focus-editorial active:scale-95 ${
                    subcategory === sub
                      ? 'border border-(--burnished-gold) bg-(--ivory) text-(--ink) font-semibold'
                      : 'border border-border bg-card text-muted hover:text-(--ink)'
                  }`}
                >
                  {sub}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Colors Selection with 44px Touch Targets */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
            PRIMARY COLORS
          </label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {COLOR_PALETTE.map((c) => {
              const isSelected = colors.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleColor(c)}
                  aria-pressed={isSelected}
                  className={`flex min-h-11 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium capitalize transition-all focus-editorial active:scale-95 ${
                    isSelected
                      ? 'border-(--kumkum) bg-(--ivory) text-(--ink) font-semibold'
                      : 'border border-border bg-card text-muted hover:border-(--ink)'
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full border border-black/10"
                    style={{ backgroundColor: c }}
                  />
                  <span>{c}</span>
                  {isSelected && <Check className="h-3 w-3 stroke-3 text-(--kumkum)" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Progressive Disclosure: Advanced Fashion Details Accordion */}
        <div className="border border-border rounded-2xl overflow-hidden bg-card/60">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full min-h-12 flex items-center justify-between px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-(--ink) transition-colors hover:bg-card focus-editorial"
            aria-expanded={showAdvanced}
          >
            <div className="flex items-center gap-2">
              <span className="text-(--burnished-gold)">●</span>
              <span>Advanced Fashion Details ({fabric} · {pattern} · {fit})</span>
            </div>
            {showAdvanced ? (
              <ChevronUp className="h-4 w-4 text-muted" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted" />
            )}
          </button>

          {showAdvanced && (
            <div className="p-4 pt-1 space-y-4 border-t border-border animate-fade-in bg-card">
              {/* Fabric Type */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
                  FABRIC / MATERIAL
                </label>
                <div className="mt-1.5 flex flex-wrap gap-2 max-h-40 overflow-y-auto no-scrollbar p-0.5">
                  {FABRICS.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => {
                        setFabric(f as FabricType);
                        setUserVerified(true);
                      }}
                      aria-pressed={fabric === f}
                      className={`min-h-11 rounded-xl px-3 py-1 text-xs capitalize transition-all focus-editorial active:scale-95 ${
                        fabric === f
                          ? 'border border-(--ink) bg-(--ink) text-(--paper) font-semibold'
                          : 'border border-border bg-card text-muted hover:text-(--ink)'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pattern Type */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
                  SURFACE PATTERN
                </label>
                <div className="mt-1.5 flex flex-wrap gap-2 max-h-36 overflow-y-auto no-scrollbar p-0.5">
                  {PATTERNS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setPattern(p as PatternType);
                        setUserVerified(true);
                      }}
                      aria-pressed={pattern === p}
                      className={`min-h-11 rounded-xl px-3 py-1 text-xs capitalize transition-all focus-editorial active:scale-95 ${
                        pattern === p
                          ? 'border border-(--ink) bg-(--ink) text-(--paper) font-semibold'
                          : 'border border-border bg-card text-muted hover:text-(--ink)'
                      }`}
                    >
                      {p.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Silhouette / Fit */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
                  FIT & SILHOUETTE
                </label>
                <div className="mt-1.5 flex flex-wrap gap-2 p-0.5">
                  {SILHOUETTES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setFit(s as SilhouetteFit);
                        setUserVerified(true);
                      }}
                      aria-pressed={fit === s}
                      className={`min-h-11 rounded-xl px-3 py-1 text-xs capitalize transition-all focus-editorial active:scale-95 ${
                        fit === s
                          ? 'border border-(--ink) bg-(--ink) text-(--paper) font-semibold'
                          : 'border border-border bg-card text-muted hover:text-(--ink)'
                      }`}
                    >
                      {s.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Purchase Price (INR) for Cost-Per-Wear */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
                  PURCHASE PRICE (₹) · OPTIONAL FOR COST-PER-WEAR
                </label>
                <div className="mt-1 relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={purchasePrice}
                    onChange={(e) => {
                      setPurchasePrice(e.target.value);
                      setUserVerified(true);
                    }}
                    placeholder="e.g. 1499"
                    className="w-full min-h-11 pl-8 pr-4 rounded-xl border border-border bg-(--paper) text-sm text-(--ink) outline-none focus-editorial"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Formality level */}
        <div>
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
              FORMALITY LEVEL
            </label>
            <span className="text-xs font-serif italic text-(--ink)">
              {formality === 1
                ? 'Casual / Relaxed'
                : formality === 2
                ? 'Everyday'
                : formality === 3
                ? 'Smart Casual'
                : formality === 4
                ? 'Festive / Formal'
                : 'Wedding / Ultra Festive'}
            </span>
          </div>
          <div className="mt-1.5 grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => {
                  setFormality(lvl);
                  setUserVerified(true);
                }}
                aria-pressed={formality === lvl}
                className={`min-h-11 rounded-xl text-xs font-bold transition-all focus-editorial active:scale-95 ${
                  formality === lvl
                    ? 'border border-(--ink) bg-(--ink) text-(--paper) shadow-2xs'
                    : 'border border-border bg-card text-muted hover:border-(--ink)'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        {/* Suitable Occasions with 44px Touch Targets */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
            SUITABLE OCCASIONS
          </label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {OCCASIONS.map((occ) => {
              const isSelected = occasions.includes(occ);
              return (
                <button
                  key={occ}
                  type="button"
                  onClick={() => toggleOccasion(occ)}
                  aria-pressed={isSelected}
                  className={`min-h-11 rounded-xl px-3 py-1 text-xs font-medium uppercase tracking-wider transition-all focus-editorial active:scale-95 ${
                    isSelected
                      ? 'border border-(--kumkum) bg-(--kumkum) text-white shadow-2xs'
                      : 'border border-border bg-card text-muted hover:border-(--ink)'
                  }`}
                >
                  {occ}
                </button>
              );
            })}
          </div>
        </div>

        {/* Save CTA */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleSave}
            className="w-full min-h-12 rounded-xl border border-(--ink) bg-(--ink) px-4 py-3 text-xs font-semibold uppercase tracking-wider text-(--paper) shadow-sm transition-all hover:bg-(--ink)/90 focus-editorial active:scale-98"
          >
            Add to Wardrobe
          </button>
        </div>
      </div>
    </BottomSheet>
  );
};
