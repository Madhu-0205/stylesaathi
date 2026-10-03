import React, { useState } from 'react';
import { Sparkles, ArrowRight, Check } from 'lucide-react';
import { useWardrobeContext } from '../context/WardrobeContext';
import { STYLE_VIBES } from '../data/taxonomy';

export const OnboardingScreen: React.FC = () => {
  const { loadSample, setOnboarded, styleVibes, setStyleVibes } = useWardrobeContext();
  const [step, setStep] = useState(0);

  const slides = [
    {
      badge: 'Personal Wardrobe',
      title: 'Your wardrobe. Your style.',
      subtitle:
        'Turn the clothes you already own into styled, complete outfits you will actually want to wear.',
      accentLetter: 'Saathi',
    },
    {
      badge: 'Indian-First Styling',
      title: 'Dress for the moment.',
      subtitle:
        'From college fits to weddings, kurtas to sneakers, office meetings to Diwali pujas.',
      accentLetter: 'Occasions',
    },
    {
      badge: 'Fashion Intelligence',
      title: 'Buy smarter. Style more.',
      subtitle:
        'Find the single missing piece that unlocks your next 10–15 complete outfits.',
      accentLetter: 'Gaps',
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
    <div className="mobile-shell flex min-h-screen flex-col justify-between p-6 sm:p-8 animate-fade-in">
      {/* Brand Header */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xl font-black tracking-tight text-[var(--text)]">
            Style<span className="text-[var(--accent)]">Saathi</span>
          </span>
        </div>
        <span className="rounded-full bg-[var(--background)] px-3 py-1 text-[11px] font-bold text-[var(--muted)] border border-[var(--border)]">
          Step {step + 1} of 3
        </span>
      </div>

      {/* Main Slide Card */}
      <div className="my-auto py-6">
        <div className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8 shadow-sm">
          {/* Subtle background glow */}
          <div className="absolute -top-12 -right-12 h-36 w-36 rounded-full bg-[var(--accent)]/10 blur-2xl pointer-events-none" />

          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-light)] px-3 py-1 text-[11px] font-black uppercase tracking-wider text-[var(--accent)] mb-4">
            <Sparkles className="h-3 w-3 stroke-[2.5]" />
            <span>{currentSlide.badge}</span>
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-4xl font-black text-[var(--text)] tracking-tight leading-tight">
            {currentSlide.title}
          </h1>

          {/* Subtitle */}
          <p className="mt-3 text-sm text-[var(--muted)] leading-relaxed font-medium">
            {currentSlide.subtitle}
          </p>

          {/* Step 2 Vibe selection interactive chips */}
          {step === 1 && (
            <div className="mt-6 pt-5 border-t border-[var(--border)]/60">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] block mb-2.5">
                Pick your aesthetic vibes:
              </label>
              <div className="flex flex-wrap gap-2">
                {STYLE_VIBES.map((vibe) => {
                  const isSelected = styleVibes.includes(vibe);
                  return (
                    <button
                      key={vibe}
                      type="button"
                      onClick={() => toggleVibe(vibe)}
                      className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-4 text-xs font-bold transition-all ${
                        isSelected
                          ? 'bg-[var(--accent)] text-white shadow-xs'
                          : 'border border-[var(--border)] bg-[var(--background)] text-[var(--text)] hover:border-[var(--muted)]'
                      }`}
                    >
                      {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
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
            className="w-full min-h-[52px] inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-5 py-3.5 text-sm font-bold text-white shadow-md transition-transform hover:opacity-95 active:scale-[0.98]"
          >
            <span>Continue</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={handleFinishWithSample}
              className="w-full min-h-[52px] inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-5 py-3.5 text-sm font-bold text-white shadow-md transition-transform hover:opacity-95 active:scale-[0.98]"
            >
              <Sparkles className="h-4 w-4" />
              <span>Load Sample Indian Wardrobe</span>
            </button>
            <button
              type="button"
              onClick={handleFinishEmpty}
              className="w-full min-h-[48px] rounded-2xl border border-[var(--border)] bg-[var(--card)] px-5 py-3 text-xs font-bold text-[var(--text)] transition-colors hover:border-[var(--accent)] active:scale-95"
            >
              Start Empty With My Clothes
            </button>
          </div>
        )}

        {/* Step dots */}
        <div className="flex justify-center gap-2 pt-2">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStep(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={`h-2 rounded-full transition-all ${
                i === step ? 'w-6 bg-[var(--accent)]' : 'w-2 bg-[var(--border)]'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
