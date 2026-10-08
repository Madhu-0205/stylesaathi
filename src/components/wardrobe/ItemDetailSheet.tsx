import React, { useState } from 'react';
import { Heart, Trash2, Plus, ShieldCheck, Sparkles } from 'lucide-react';
import { WardrobeItem, Status, FabricType, PatternType, SilhouetteFit } from '../../types';
import { BottomSheet } from '../common/BottomSheet';
import { ItemImage } from '../common/ItemImage';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FABRICS, PATTERNS, SILHOUETTES } from '../../data/taxonomy';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';

interface ItemDetailSheetProps {
  item: WardrobeItem | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<WardrobeItem>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export const ItemDetailSheet: React.FC<ItemDetailSheetProps> = ({
  item,
  isOpen,
  onClose,
  onUpdate,
  onDelete,
}) => {
  if (!item) return null;

  const [name, setName] = useState(item.name);
  const [note, setNote] = useState(item.note);
  const [status, setStatus] = useState<Status>(item.status);
  const [favorite, setFavorite] = useState(item.favorite);
  const [timesWorn, setTimesWorn] = useState(item.timesWorn);
  const [fabric, setFabric] = useState<FabricType | undefined>(item.fabric);
  const [pattern, setPattern] = useState<PatternType | undefined>(item.pattern);
  const [fit, setFit] = useState<SilhouetteFit | undefined>(item.fit);
  const [purchasePrice, setPurchasePrice] = useState<string>(
    item.purchasePrice !== undefined ? String(item.purchasePrice) : ''
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Cost-per-wear calculation
  const priceNum = purchasePrice.trim() ? parseFloat(purchasePrice) : item.purchasePrice;
  const costPerWear =
    priceNum !== undefined && !isNaN(priceNum)
      ? Math.round(priceNum / Math.max(timesWorn, 1))
      : null;

  const handleSave = async () => {
    const parsedPrice = purchasePrice.trim() ? parseFloat(purchasePrice) : undefined;
    await onUpdate(item.id, {
      name,
      note,
      status,
      favorite,
      timesWorn,
      fabric,
      pattern,
      fit,
      purchasePrice: parsedPrice !== undefined && !isNaN(parsedPrice) ? parsedPrice : undefined,
      userVerified: true, // User explicit review marks attributes authoritative
    });
    onClose();
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    await onDelete(item.id);
    setIsDeleting(false);
    setShowDeleteConfirm(false);
    onClose();
  };

  const handleWearIncrement = async () => {
    const next = timesWorn + 1;
    setTimesWorn(next);
    await onUpdate(item.id, { timesWorn: next });
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="GARMENT PROFILE">
      <div className="space-y-5 pb-4">
        {/* Large Garment Photograph */}
        <div className="relative aspect-4/3 w-full overflow-hidden rounded-2xl border border-border bg-(--ivory)">
          <ItemImage
            item={item}
            className="h-full w-full object-contain p-2"
            isHero
          />
          <button
            type="button"
            onClick={() => setFavorite(!favorite)}
            aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
            className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-(--paper)/90 backdrop-blur-xs text-muted shadow-sm transition-transform hover:scale-105 focus-editorial active:scale-95"
          >
            <Heart
              className={`h-5 w-5 transition-colors ${
                favorite
                  ? 'fill-(--kumkum) stroke-(--kumkum)'
                  : 'stroke-(--ink)'
              }`}
            />
          </button>
        </div>

        {/* Garment Title & Provenance Badge */}
        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-(--kumkum)">
              {item.category} · {item.subcategory || 'staple'}
            </span>
            {item.userVerified ? (
              <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 text-[9px] font-bold py-0.5">
                <ShieldCheck className="h-3 w-3 mr-1 text-emerald-600" />
                Verified
              </Badge>
            ) : item.aiConfidence ? (
              <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 text-[9px] font-bold py-0.5">
                <Sparkles className="h-3 w-3 mr-1 text-amber-600" />
                AI Suggested ({Math.round(item.aiConfidence * 100)}%)
              </Badge>
            ) : null}
          </div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full min-h-12 rounded-xl border border-border bg-(--paper) px-3.5 py-2.5 font-serif text-xl font-normal text-(--ink) outline-none focus-editorial"
          />
        </div>

        {/* Colors & Formality row */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3.5">
          {item.colors.map((c, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 rounded-md bg-(--ivory) px-2.5 py-1 text-xs font-medium capitalize text-(--ink) border border-border"
            >
              <span
                className="h-2 w-2 rounded-full border border-black/10"
                style={{ backgroundColor: c }}
              />
              {c}
            </span>
          ))}
          <span className="ml-auto text-xs text-muted font-medium">
            Formality: <strong className="text-(--ink)">{item.formality}/5</strong>
          </span>
        </div>

        {/* Fabric, Pattern, & Fit Attributes */}
        <div className="rounded-xl border border-border bg-card p-3.5 space-y-3">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted block">
            FASHION SPECIFICATIONS
          </span>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <span className="text-[9px] uppercase font-bold text-muted block">Fabric</span>
              <select
                value={fabric || 'cotton'}
                onChange={(e) => setFabric(e.target.value as FabricType)}
                className="mt-1 w-full min-h-10 rounded-lg border border-border bg-(--paper) px-2 py-1 text-xs font-semibold text-(--ink) outline-none focus-editorial"
              >
                {FABRICS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className="text-[9px] uppercase font-bold text-muted block">Pattern</span>
              <select
                value={pattern || 'solid'}
                onChange={(e) => setPattern(e.target.value as PatternType)}
                className="mt-1 w-full min-h-10 rounded-lg border border-border bg-(--paper) px-2 py-1 text-xs font-semibold text-(--ink) outline-none focus-editorial"
              >
                {PATTERNS.map((p) => (
                  <option key={p} value={p}>
                    {p.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className="text-[9px] uppercase font-bold text-muted block">Fit</span>
              <select
                value={fit || 'regular'}
                onChange={(e) => setFit(e.target.value as SilhouetteFit)}
                className="mt-1 w-full min-h-10 rounded-lg border border-border bg-(--paper) px-2 py-1 text-xs font-semibold text-(--ink) outline-none focus-editorial"
              >
                {SILHOUETTES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Physical Wardrobe State (Laundry) */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
            WARDROBE STATE
          </label>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(
              [
                { id: 'clean', label: 'Clean & Ready' },
                { id: 'needs_washing', label: 'Needs Wash' },
                { id: 'in_laundry', label: 'In Laundry' },
              ] as { id: Status; label: string }[]
            ).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStatus(s.id)}
                aria-pressed={status === s.id}
                className={`min-h-11 rounded-xl px-2 py-2 text-xs font-semibold transition-all focus-editorial ${
                  status === s.id
                    ? s.id === 'clean'
                      ? 'border border-(--ink) bg-(--ink) text-(--paper) shadow-2xs'
                      : s.id === 'needs_washing'
                      ? 'border border-amber-600 bg-amber-600 text-white shadow-2xs'
                      : 'border border-stone-600 bg-stone-700 text-white shadow-2xs'
                    : 'border border-border bg-card text-muted hover:border-(--ink)'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Wear History & Cost-Per-Wear */}
        <div className="rounded-xl border border-border bg-(--ivory) p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
                WEAR LOG
              </span>
              <p className="font-serif text-sm italic text-(--ink)">
                Worn {timesWorn} {timesWorn === 1 ? 'time' : 'times'} so far
              </p>
            </div>
            <button
              type="button"
              onClick={handleWearIncrement}
              className="flex min-h-11 items-center gap-1.5 rounded-xl border border-(--ink) bg-(--paper) px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-(--ink) transition-colors hover:bg-(--ink) hover:text-(--paper) focus-editorial active:scale-95"
            >
              <Plus className="h-3.5 w-3.5 text-(--burnished-gold)" />
              <span>Log Wear</span>
            </button>
          </div>

          {/* Cost-Per-Wear Display */}
          <div className="pt-2 border-t border-border/80 flex items-center justify-between text-xs">
            <span className="text-muted font-medium">Cost-Per-Wear (CPW):</span>
            {costPerWear !== null ? (
              <span className="font-bold text-(--ink)">
                ₹{costPerWear} <span className="text-[10px] text-muted font-normal">/ wear</span>
              </span>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-muted">₹</span>
                <input
                  type="number"
                  placeholder="Price"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  className="w-20 min-h-8 px-2 py-0.5 rounded-md border border-border text-xs text-(--ink) bg-(--paper) outline-none focus-editorial"
                />
              </div>
            )}
          </div>
        </div>

        {/* Styling or Care Note */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
            STYLING OR FABRIC CARE NOTE
          </label>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Dry clean recommended, pairs elegantly with tan Kolhapuris"
            className="mt-1.5 w-full rounded-xl border border-border bg-(--paper) p-3 text-xs text-(--ink) outline-none focus-editorial"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2.5 pt-2">
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isDeleting}
            aria-label="Remove item from wardrobe"
            className="flex min-h-12 w-12 items-center justify-center rounded-xl border border-red-200 text-red-600 transition-colors hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 focus-editorial active:scale-95"
          >
            <Trash2 className="h-4.5 w-4.5" />
          </button>
          <Button
            size="lg"
            onClick={handleSave}
            className="flex-1 min-h-12 font-semibold tracking-wider uppercase rounded-xl focus-editorial"
          >
            Save Changes
          </Button>
        </div>

        {/* Confirmation Modal */}
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove from wardrobe?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove &quot;{item.name}&quot; from your wardrobe? Any saved outfit plans including this piece will be updated.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep Piece</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={handleConfirmDelete}
              >
                Remove Piece
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </BottomSheet>
  );
};
