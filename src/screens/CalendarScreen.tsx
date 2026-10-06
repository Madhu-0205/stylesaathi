import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Check,
  AlertCircle,
  Trash2,
  ArrowRight,
  Shirt,
  UserPlus,
} from 'lucide-react';
import { useWardrobeContext } from '../context/WardrobeContext';
import { useAuth } from '../context/AuthContext';
import { ItemImage } from '../components/common/ItemImage';
import { AuthView } from '../components/auth/AuthView';
import { WardrobeItem, OutfitPlan } from '../types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface CalendarScreenProps {
  onGoToDress: (occasion?: string) => void;
}

export const CalendarScreen: React.FC<CalendarScreenProps> = ({ onGoToDress }) => {
  const { plans, items, deletePlan, markOutfitWornOnDate, showToast } = useWardrobeContext();
  const { isGuest } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Month navigation state
  const [viewDate, setViewDate] = useState(() => new Date());

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  // Helper to format YYYY-MM-DD
  const formatDateStr = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const todayStr = formatDateStr(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(todayStr);

  // Month metadata
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const handlePrevMonth = () => {
    setViewDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(year, month + 1, 1));
  };

  const handleJumpToToday = () => {
    const now = new Date();
    setViewDate(now);
    setSelectedDateStr(todayStr);
  };

  // Find plan for selected date
  const selectedPlan = useMemo(() => {
    return plans.find((p) => p.date === selectedDateStr);
  }, [plans, selectedDateStr]);

  // Map of plans by date for fast calendar cell lookup
  const plansByDate = useMemo(() => {
    const map = new Map<string, OutfitPlan>();
    for (const p of plans) {
      map.set(p.date, p);
    }
    return map;
  }, [plans]);

  // Check if selected plan has any items in laundry or deleted
  const planIntegrity = useMemo(() => {
    if (!selectedPlan) return null;
    const pieces = Object.values(selectedPlan.outfit.slots).flat();
    if (selectedPlan.accessory) pieces.push(selectedPlan.accessory);

    const missingPieces: string[] = [];
    const laundryPieces: string[] = [];

    for (const piece of pieces) {
      const currentItem = items.find((i) => i.id === piece.id);
      if (!currentItem) {
        missingPieces.push(piece.name || piece.subcategory);
      } else if (currentItem.status === 'in_laundry' || currentItem.status === 'needs_washing') {
        laundryPieces.push(currentItem.name || currentItem.subcategory);
      }
    }

    return {
      pieces,
      isStale: missingPieces.length > 0,
      missingPieces,
      hasLaundry: laundryPieces.length > 0,
      laundryPieces,
    };
  }, [selectedPlan, items]);

  const handleWearToday = async () => {
    if (!selectedPlan) return;
    await markOutfitWornOnDate(selectedPlan.outfit, selectedPlan.date, selectedPlan.accessory);
    showToast('Look marked as worn! Recency updated.');
  };

  const handleConfirmDeletePlan = async () => {
    if (!selectedPlan) return;
    await deletePlan(selectedPlan.id);
    showToast('Plan removed from calendar');
    setIsDeleteDialogOpen(false);
  };

  // Formatted date string for selected date heading
  const selectedDateHeading = useMemo(() => {
    const [y, m, d] = selectedDateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const isToday = selectedDateStr === todayStr;
    const dateLabel = dateObj.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    return isToday ? `${dateLabel} · Today` : dateLabel;
  }, [selectedDateStr, todayStr]);

  return (
    <div className="pb-12 animate-fade-in">
      {/* Header */}
      <header className="mb-3 sm:mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border pb-2.5 sm:pb-3 gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[9.5px] font-bold uppercase tracking-[0.2em] text-(--kumkum)">
              STYLE CALENDAR
            </span>
          </div>
          <h1 className="mt-0.5 font-serif text-2xl sm:text-3xl font-normal text-(--ink) tracking-tight">
            Outfit Planner &amp; Journal
          </h1>
        </div>

        {/* Month Navigation Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleJumpToToday}
            className="min-h-8 rounded-full shadow-2xs font-semibold uppercase tracking-wider text-[11px] px-3 py-1"
          >
            Today
          </Button>
          <div className="inline-flex items-center rounded-full border border-border bg-card p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="flex min-h-8 min-w-8 items-center justify-center rounded-full text-muted hover:text-(--ink) hover:bg-(--ivory)"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 text-xs font-serif font-medium text-(--ink) min-w-28 text-center uppercase tracking-wider">
              {monthName}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="flex min-h-8 min-w-8 items-center justify-center rounded-full text-muted hover:text-(--ink) hover:bg-(--ivory)"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* MOBILE-ONLY: Smooth Horizontal Day Strip (Prevents Squeezing 7 cols into 375px) */}
      <div className="md:hidden mb-4">
        <div className="no-scrollbar -mx-3.5 sm:-mx-6 flex gap-1.5 overflow-x-auto px-3.5 sm:px-6 py-1">
          {Array.from({ length: daysInMonth }).map((_, idx) => {
            const dayNum = idx + 1;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const isSelected = dateStr === selectedDateStr;
            const isToday = dateStr === todayStr;
            const plan = plansByDate.get(dateStr);
            const dateObj = new Date(year, month, dayNum);
            const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'narrow' });

            return (
              <button
                key={`mob-${dayNum}`}
                type="button"
                onClick={() => setSelectedDateStr(dateStr)}
                className={`flex min-h-12 min-w-11 shrink-0 flex-col items-center justify-center rounded-xl border p-1 transition-all active:scale-95 ${
                  isSelected
                    ? 'border-(--ink) bg-(--ink) text-(--paper) shadow-2xs font-bold'
                    : isToday
                    ? 'border-(--kumkum) bg-(--ivory) text-(--ink)'
                    : 'border-border bg-card text-muted hover:border-(--ink)'
                }`}
              >
                <span className="text-[9px] uppercase font-medium opacity-80">{weekday}</span>
                <span className={`text-xs font-semibold ${isSelected ? 'text-(--paper)' : 'text-(--ink)'}`}>
                  {dayNum}
                </span>
                {plan ? (
                  <span
                    className={`mt-0.5 h-1.5 w-1.5 rounded-full ${
                      plan.status === 'worn'
                        ? isSelected ? 'bg-emerald-300' : 'bg-emerald-600'
                        : isSelected ? 'bg-(--burnished-gold)' : 'bg-(--kumkum)'
                    }`}
                  />
                ) : (
                  <span className="mt-0.5 h-1.5 w-1.5" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid: Tablet/Desktop Matrix on Left, Selected Day Outfit on Right */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 lg:gap-6 items-start">
        {/* TABLET / DESKTOP CALENDAR MATRIX (hidden on mobile) */}
        <div className="hidden md:block md:col-span-5 rounded-2xl border border-border bg-card p-5 shadow-2xs">
          {/* Days of week header */}
          <div className="grid grid-cols-7 text-center mb-2">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
              <span key={idx} className="text-[10px] font-bold text-muted uppercase tracking-wider">
                {day}
              </span>
            ))}
          </div>

          {/* Day Cells Grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty slots before first day */}
            {Array.from({ length: firstDayOfMonth }).map((_, idx) => (
              <div key={`empty-${idx}`} className="h-10 sm:h-11" />
            ))}

            {/* Days in Month */}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const isSelected = dateStr === selectedDateStr;
              const isToday = dateStr === todayStr;
              const plan = plansByDate.get(dateStr);

              return (
                <button
                  key={dayNum}
                  type="button"
                  onClick={() => setSelectedDateStr(dateStr)}
                  className={`group relative flex min-h-11 flex-col items-center justify-center rounded-xl transition-all active:scale-95 ${
                    isSelected
                      ? 'border border-(--ink) bg-(--ink) text-(--paper) shadow-2xs'
                      : isToday
                      ? 'border border-(--kumkum) bg-(--ivory) text-(--ink)'
                      : 'border border-transparent hover:border-border hover:bg-(--ivory)/60 text-(--ink)'
                  }`}
                >
                  <span className={`text-xs font-semibold ${isSelected ? 'text-(--paper)' : ''}`}>
                    {dayNum}
                  </span>

                  {/* Plan indicator dot */}
                  {plan && (
                    <span
                      className={`mt-0.5 h-1.5 w-1.5 rounded-full ${
                        plan.status === 'worn'
                          ? isSelected ? 'bg-emerald-300' : 'bg-emerald-600'
                          : isSelected ? 'bg-(--burnished-gold)' : 'bg-(--kumkum)'
                      }`}
                      title={`${plan.occasion} (${plan.status})`}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Calendar Legend */}
          <div className="mt-4 pt-3 border-t border-(--border)/70 flex items-center justify-between text-[10px] text-muted">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-(--kumkum)" />
              <span>Planned</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-600" />
              <span>Worn</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full border border-(--kumkum) bg-(--ivory)" />
              <span>Today</span>
            </div>
          </div>
        </div>

        {/* SELECTED DAY OUTFIT DETAIL (Dominant, Fashion-First) */}
        <div className="md:col-span-7">
          <div className="rounded-2xl border border-border bg-card p-4 sm:p-6 shadow-2xs">
            {/* Header: Date + Badges */}
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <div>
                <span className="text-[9.5px] font-bold uppercase tracking-[0.18em] text-muted block">
                  SELECTED DAY
                </span>
                <h2 className="font-serif text-xl sm:text-2xl font-normal text-(--ink) tracking-tight">
                  {selectedDateHeading}
                </h2>
              </div>

              {selectedPlan && (
                <div className="flex items-center gap-2">
                  <Badge variant="gold" className="text-[9px] font-bold uppercase tracking-wider">
                    {selectedPlan.occasion}
                  </Badge>
                  <Badge
                    variant={selectedPlan.status === 'worn' ? 'outline' : 'default'}
                    className={`text-[9px] font-bold uppercase tracking-wider ${
                      selectedPlan.status === 'worn'
                        ? 'border-emerald-600/40 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : ''
                    }`}
                  >
                    {selectedPlan.status === 'worn' ? '✓ Worn' : 'Planned'}
                  </Badge>
                </div>
              )}
            </div>

            {/* Plan Display OR Empty Day State */}
            {selectedPlan ? (
              <div className="space-y-4">
                {/* Fashion-First Integrity Notice if pieces are unavailable */}
                {planIntegrity?.isStale && (
                  <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/30 p-3 flex items-start gap-2.5 text-xs text-red-800 dark:text-red-300">
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                    <div className="flex-1">
                      <span className="font-semibold block">One piece isn&apos;t available anymore:</span>
                      <span className="text-[11px] opacity-90">
                        {planIntegrity.missingPieces.join(', ')} is no longer in your wardrobe.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onGoToDress(selectedPlan.occasion)}
                      className="text-[10px] font-bold uppercase underline hover:opacity-80 shrink-0"
                    >
                      Restyle
                    </button>
                  </div>
                )}

                {planIntegrity?.hasLaundry && !planIntegrity.isStale && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 p-3 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
                    <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                    <div className="flex-1">
                      <span className="font-semibold block">A piece is currently in care:</span>
                      <span className="text-[11px] opacity-90">
                        {planIntegrity.laundryPieces.join(', ')} is resting for wash before wearing.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onGoToDress(selectedPlan.occasion)}
                      className="text-[10px] font-bold uppercase underline hover:opacity-80 shrink-0"
                    >
                      Restyle
                    </button>
                  </div>
                )}

                {/* Garments Visual Rail Grid */}
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3 bg-(--ivory)/70 rounded-xl p-3 border border-(--border)/60">
                  {planIntegrity?.pieces.map((piece, pIdx) => (
                    <div
                      key={piece.id || pIdx}
                      className="aspect-3/4 rounded-xl border border-border bg-card overflow-hidden flex flex-col shadow-2xs relative"
                    >
                      <ItemImage item={piece} className="h-full w-full object-contain p-1" />
                      <div className="absolute bottom-0 inset-x-0 bg-(--card)/90 backdrop-blur-xs py-0.5 px-1 text-center">
                        <span className="block text-[8px] font-bold uppercase truncate text-(--ink)">
                          {piece.name || piece.subcategory}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Outfit Info */}
                <div>
                  <h3 className="font-serif text-lg text-(--ink) font-medium">
                    {selectedPlan.outfit.template}
                  </h3>
                  <p className="mt-1 text-xs text-muted leading-relaxed">
                    {selectedPlan.outfit.why}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-(--border)/60">
                  {selectedPlan.status !== 'worn' && (
                    <Button
                      variant="default"
                      size="default"
                      onClick={handleWearToday}
                      className="flex-1 min-h-11 shadow-2xs font-semibold uppercase tracking-wider"
                    >
                      <Check className="h-3.5 w-3.5 text-(--burnished-gold)" />
                      <span>Wear Today</span>
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    size="default"
                    onClick={() => onGoToDress(selectedPlan.occasion)}
                    className="min-h-11 shadow-2xs font-semibold uppercase tracking-wider"
                  >
                    <span>Change Look</span>
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsDeleteDialogOpen(true)}
                    className="min-h-11 min-w-11 text-muted hover:text-red-600 hover:border-red-300 border border-border"
                    aria-label="Delete plan"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              /* Empty Day State */
              <div className="py-8 text-center flex flex-col items-center justify-center">
                <div className="h-12 w-12 rounded-full bg-(--ivory) border border-border flex items-center justify-center mb-3">
                  <Shirt className="h-5 w-5 text-(--burnished-gold)" />
                </div>
                <h3 className="font-serif text-lg font-normal text-(--ink)">
                  No outfit planned for this date
                </h3>
                <p className="mt-1 text-xs text-muted max-w-xs">
                  Schedule a look from Dress Me to keep your wardrobe ready ahead of time.
                </p>
                <Button
                  variant="default"
                  onClick={() => onGoToDress()}
                  className="mt-4 min-h-11 gap-2 shadow-2xs font-semibold uppercase tracking-wider"
                >
                  <Sparkles className="h-3.5 w-3.5 text-(--burnished-gold)" />
                  <span>Style a Look</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Global Empty State if user has 0 plans total */}
      {plans.length === 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-(--ivory)/60 p-6 text-center">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-(--kumkum) block mb-1">
            WARDROBE RHYTHM
          </span>
          <h2 className="font-serif text-xl sm:text-2xl text-(--ink) font-normal">
            YOUR STYLE CALENDAR IS QUIET.
          </h2>
          <p className="mt-1.5 text-xs text-muted max-w-sm mx-auto">
            Plan a look from Dress Me and it will appear here. Build intentional daily wear without morning decision fatigue.
          </p>
          <Button
            variant="default"
            onClick={() => onGoToDress()}
            className="mt-3 min-h-11 gap-2 shadow-2xs font-semibold uppercase tracking-wider"
          >
            <Sparkles className="h-3.5 w-3.5 text-(--burnished-gold)" />
            <span>STYLE A LOOK</span>
          </Button>
        </div>
      )}

      {/* Guest Mode Value Banner */}
      {isGuest && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-(--ivory) border border-border flex items-center justify-center shrink-0">
              <UserPlus className="h-4 w-4 text-(--burnished-gold)" />
            </div>
            <div className="text-left">
              <span className="text-xs font-semibold text-(--ink) block">
                Create your StyleSaathi profile
              </span>
              <span className="text-[11px] text-muted">
                Keep your style preferences, outfit plans, and wear history synchronized safely.
              </span>
            </div>
          </div>
          <Button
            variant="default"
            size="sm"
            onClick={() => setShowAuthModal(true)}
            className="shrink-0 font-semibold uppercase tracking-wider"
          >
            Create Profile
          </Button>
        </div>
      )}

      {/* Delete Plan Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Planned Look?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the scheduled outfit plan for {selectedDateHeading}. Your garments will remain in your wardrobe.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleConfirmDeletePlan}>
              Remove Plan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Auth Modal if guest clicks to create profile */}
      {showAuthModal && (
        <AuthView isModal={true} onClose={() => setShowAuthModal(false)} onSuccess={() => setShowAuthModal(false)} />
      )}
    </div>
  );
};
