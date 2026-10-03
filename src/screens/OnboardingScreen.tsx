import React, { useState } from 'react';
import { ArrowRight, Check, Sparkles } from 'lucide-react';
import { useWardrobeContext } from '../context/WardrobeContext';
import { STYLE_VIBES } from '../data/taxonomy';

export const OnboardingScreen: React.FC = () => {
  const { loadSample, setOnboarded, styleVibes, setStyleVibes } = useWardrobeContext();
  const [step, setStep] = useState(0);

  const slides = [
    {
      kicker: 'PERSONAL WARDROBE',
      title: 'Your wardrobe. Your style.',
      subtitle:
        'Turn the clothes you already own into styled, complete outfits you will actually want to wear.',
    },
    {
      kicker: 'INDIAN OCCASION STYLING',
      title: 'Dress for the moment.',
      subtitle:
        'From college fits to weddings, cotton kurtas to straight denim, workday meetings to festive evenings.',
    },
    {
      kicker: 'WARDROBE INTELLIGENCE',
      title: 'Buy smarter. Style more.',
      subtitle:
        'Discover the single missing staple that unlocks your next 10–15 complete outfits without overbuying.',
    },
  ];

  const currentSlide = slides[step];

  const toggleVibe = (vibe: string) => {
    if (styleVibes.includes(vibe)) {
      setStyleVibes(styleVibes.filter((v) => v !== vibe));
    } else {
      setStyleVibes([...styleVibes, vibe]);
    }
  };

  const handleFinishWithSample = async () => {
    await loadSample();
    setOnboarded(true);
  };

  const handleFinishEmpty = () => {
    setOnboarded(true);
  };

  return (
    <div className="mobile-shell flex min-h-screen flex-col justify-between p-6 sm:p-8 animate-fade-in bg-(--background)">
      {/* Refined Brand Header */}
      <div className="flex items-center justify-between pt-2 border-b border-(--border) pb-3">
        <div>
          <span className="font-serif text-lg tracking-[0.25em] font-semibold text-(--ink)">
            STYLESAATHI
          </span>
          <span className="block text-[8px] tracking-[0.2em] uppercase text-(--burnished-gold) font-bold">
            YOUR WARDROBE, THOUGHTFULLY STYLED
          </span>
        </div>
        <span className="text-[11px] font-serif italic text-(--muted)">
          0{step + 1} / 03
        </span>
      </div>

      {/* Main Slide Card */}
      <div className="my-auto py-6">
        <div className="rounded-2xl border border-(--border) bg-(--card) p-6 sm:p-8 shadow-xs">
          {/* Kicker */}
          <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-(--kumkum)">
            {currentSlide.kicker}
          </span>

          {/* Title */}
          <h1 className="mt-2 font-serif text-3xl sm:text-4xl font-normal text-(--ink) tracking-tight leading-tight">
            {currentSlide.title}
          </h1>

          {/* Subtitle */}
          <p className="mt-3 text-xs sm:text-sm text-(--muted) leading-relaxed font-normal">
            {currentSlide.subtitle}
          </p>

          {/* Step 2 Vibe selection interactive chips */}
          {step === 1 && (
            <div className="mt-6 pt-5 border-t border-(--border)">
              <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-(--muted) block mb-2.5">
                CURATE YOUR AESTHETIC VIBES:
              </label>
              <div className="flex flex-wrap gap-2">
                {STYLE_VIBES.map((vibe) => {
                  const isSelected = styleVibes.includes(vibe);
                  return (
                    <button
                      key={vibe}
                      type="button"
                      onClick={() => toggleVibe(vibe)}
                      className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all active:scale-95 ${
                        isSelected
                          ? 'border border-(--ink) bg-(--ink) text-(--paper) shadow-2xs'
                          : 'border border-(--border) bg-(--card) text-(--muted) hover:border-(--ink)'
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3 stroke-3 text-(--burnished-gold)" />}
                      <span>{vibe}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="space-y-4 pb-4">
        {step < 2 ? (
          <button
            type="button"
            onClick={() => setStep(step + 1)}
            className="w-full min-h-12 inline-flex items-center justify-center gap-2 rounded-xl border border-(--ink) bg-(--ink) px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-(--paper) shadow-sm transition-all hover:bg-(--ink)/90 active:scale-98"
          >
            <span>Continue</span>
            <ArrowRight className="h-3.5 w-3.5 text-(--burnished-gold)" />
          </button>
        ) : (
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={handleFinishWithSample}
              className="w-full min-h-12.5 inline-flex items-center justify-center gap-2 rounded-xl border border-(--ink) bg-(--ink) px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-(--paper) shadow-sm transition-all hover:bg-(--ink)/90 active:scale-98"
            >
              <Sparkles className="h-3.5 w-3.5 text-(--burnished-gold)" />
              <span>Load Sample Indian Wardrobe</span>
            </button>
            <button
              type="button"
              onClick={handleFinishEmpty}
              className="w-full min-h-11 rounded-xl border border-(--border) bg-(--card) px-5 py-3 text-xs font-semibold uppercase tracking-wider text-(--muted) hover:border-(--ink) hover:text-(--ink) transition-colors active:scale-98"
            >
              Start Empty With My Clothes
            </button>
          </div>
        )}

        {/* Step dots - 44px touch target with sleek indicator */}
        <div className="flex justify-center gap-1 pt-2">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStep(i)}
              aria-label={`Go to slide ${i + 1}`}
              className="flex h-11 w-8 items-center justify-center rounded-full transition-transform active:scale-90"
            >
              <span
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? 'w-6 bg-(--ink)' : 'w-1.5 bg-(--border)'
                }`}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

