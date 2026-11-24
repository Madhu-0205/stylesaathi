import React, { useState } from 'react';
import {
  ArrowRight,
  Check,
  Sparkles,
  ShieldCheck,
  Compass,
  Shirt,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useWardrobeContext } from '../context/WardrobeContext';
import { useAuth } from '../context/AuthContext';
import { STYLE_VIBES } from '../data/taxonomy';
import { StyleSaathiLogo } from '../components/brand/StyleSaathiLogo';
import { Button } from '@/components/ui/button';

export const CONTEXT_CHOICES = [
  { id: 'everyday', label: 'Everyday Ease', desc: 'Comfortable, breathable staples for daily life' },
  { id: 'office', label: 'Work & Professional', desc: 'Tailored shirts, trousers & polished kurtas' },
  { id: 'college', label: 'Campus & College', desc: 'Effortless relaxed denim, tees & fusion wear' },
  { id: 'festive', label: 'Festive & Family Pooja', desc: 'Traditional weaves, kurtas & celebratory drape' },
  { id: 'party', label: 'Evenings & Outings', desc: 'Statement pieces, modern silhouettes & night out' },
];

export type OnboardingPortalChoice = 'stylist' | 'wardrobe' | 'inspiration';

export interface OnboardingScreenProps {
  onSelectChoice?: (destination: OnboardingPortalChoice) => void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onSelectChoice }) => {
  const {
    loadSample,
    setOnboarded,
    setSetupCompleted,
    styleVibes,
    setStyleVibes,
    preferences,
    updatePreferences,
  } = useWardrobeContext();

  const { status, continueAsGuest } = useAuth();

  const [wardrobeMode, setWardrobeMode] = useState<'demo' | 'empty'>('demo');
  const [showPreferences, setShowPreferences] = useState(false);
  const [selectedContexts, setSelectedContexts] = useState<string[]>(
    preferences?.preferredContexts?.length > 0 ? preferences.preferredContexts : ['everyday', 'office']
  );

  const toggleVibe = (vibe: string) => {
    if (styleVibes.includes(vibe)) {
      setStyleVibes(styleVibes.filter((v) => v !== vibe));
    } else {
      setStyleVibes([...styleVibes, vibe]);
    }
  };

  const toggleContext = (ctxId: string) => {
    if (selectedContexts.includes(ctxId)) {
      if (selectedContexts.length > 1) {
        setSelectedContexts(selectedContexts.filter((c) => c !== ctxId));
      }
    } else {
      setSelectedContexts([...selectedContexts, ctxId]);
    }
  };

  const handleEnterDestination = async (destination: OnboardingPortalChoice) => {
    // 1. Save preferences
    await updatePreferences({
      preferredContexts: selectedContexts.length > 0 ? selectedContexts : ['everyday'],
      preferredAesthetics: styleVibes.length > 0 ? styleVibes : ['Contemporary', 'Indo-Western'],
    });

    // 2. Configure wardrobe canvas (demo capsule vs clean closet)
    if (wardrobeMode === 'demo') {
      await loadSample();
    }

    // 3. Ensure guest authentication if unauthenticated for instant friction-free entry
    if (status === 'unauthenticated' && continueAsGuest) {
      try {
        await continueAsGuest();
      } catch (e) {
        console.warn('Guest login error in onboarding:', e);
      }
    }

    // 4. Mark setup complete and route directly to destination
    setOnboarded(true);
    setSetupCompleted(true);

    if (onSelectChoice) {
      onSelectChoice(destination);
    }
  };

  return (
    <div className="w-full max-w-lg md:max-w-xl mx-auto flex min-h-dvh flex-col justify-between p-5 sm:p-8 animate-fade-in bg-background">
      {/* Brand Header */}
      <header className="flex items-center justify-between pt-2 border-b border-border/80 pb-3">
        <div className="flex items-center gap-2">
          <StyleSaathiLogo variant="mark" size="xs" />
          <span className="editorial-kicker text-(--burnished-gold)">
            STYLESAATHI
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase font-bold tracking-widest text-muted">
            EDITORIAL EDITION
          </span>
        </div>
      </header>

      {/* Main Luxury Container */}
      <main className="my-auto py-6 space-y-6">
        <div className="rounded-3xl glass-card specular-border p-6 sm:p-8 shadow-xs bg-(--paper)/90 space-y-6">
          {/* Centered Brand Presentation */}
          <div className="flex justify-center py-2 border-b border-(--border)/60 pb-5">
            <StyleSaathiLogo variant="full" layout="stacked" size="lg" showTagline={true} showSince={true} />
          </div>

          {/* Editorial Welcome Header */}
          <div className="text-center space-y-2">
            <span className="editorial-kicker text-(--kumkum)">
              BALANCED LUXURY FASHION COMPANION
            </span>
            <h1 className="editorial-hero text-2xl sm:text-3xl font-normal text-(--ink) tracking-tight leading-tight">
              Welcome to your personal style world.
            </h1>
            <p className="text-xs sm:text-sm text-muted leading-relaxed font-normal max-w-md mx-auto">
              Discover your style. Explore your wardrobe. Find inspiration. Choose how you would like to begin your journey:
            </p>
          </div>

          {/* Three Choice-Driven Entry Portals */}
          <div className="space-y-3 pt-2">
            {/* PORTAL 1: MEET YOUR PERSONAL STYLIST */}
            <button
              type="button"
              onClick={() => handleEnterDestination('stylist')}
              data-testid="welcome-portal-stylist"
              className="w-full text-left p-4 rounded-2xl border border-border/80 bg-card hover:border-(--burnished-gold) hover:bg-(--ivory)/60 transition-all shadow-2xs group cursor-pointer tactile-press min-h-12"
            >
              <div className="flex items-start gap-3.5">
                <div className="h-10 w-10 rounded-full bg-(--burnished-gold)/15 flex items-center justify-center text-(--burnished-gold) shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-serif text-base font-semibold text-(--ink) group-hover:text-(--burnished-gold) transition-colors">
                      Meet Your Personal Stylist
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted group-hover:text-(--burnished-gold) group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <p className="text-xs text-muted font-sans mt-0.5 leading-relaxed">
                    Conversational styling with AI Saathi for daily look calibration, weather comfort, and silhouette proportion.
                  </p>
                </div>
              </div>
            </button>

            {/* PORTAL 2: EXPLORE YOUR WARDROBE */}
            <button
              type="button"
              onClick={() => handleEnterDestination('wardrobe')}
              data-testid="welcome-portal-wardrobe"
              className="w-full text-left p-4 rounded-2xl border border-border/80 bg-card hover:border-(--ink) hover:bg-(--ivory)/60 transition-all shadow-2xs group cursor-pointer tactile-press min-h-12"
            >
              <div className="flex items-start gap-3.5">
                <div className="h-10 w-10 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                  <Shirt className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-serif text-base font-semibold text-(--ink) group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                      Explore Your Wardrobe
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted group-hover:text-(--ink) group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <p className="text-xs text-muted font-sans mt-0.5 leading-relaxed">
                    Step straight into your living archive. Browse authentic garments, inspect fabric weaves, and organize slots.
                  </p>
                </div>
              </div>
            </button>

            {/* PORTAL 3: EXPLORE FASHION INSPIRATION */}
            <button
              type="button"
              onClick={() => handleEnterDestination('inspiration')}
              data-testid="welcome-portal-inspiration"
              className="w-full text-left p-4 rounded-2xl border border-border/80 bg-card hover:border-(--kumkum) hover:bg-(--ivory)/60 transition-all shadow-2xs group cursor-pointer tactile-press min-h-12"
            >
              <div className="flex items-start gap-3.5">
                <div className="h-10 w-10 rounded-full bg-(--kumkum)/15 flex items-center justify-center text-(--kumkum) shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                  <Compass className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-serif text-base font-semibold text-(--ink) group-hover:text-(--kumkum) transition-colors">
                      Explore Fashion Inspiration
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted group-hover:text-(--kumkum) group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <p className="text-xs text-muted font-sans mt-0.5 leading-relaxed">
                    Editorial trend discovery grounded in Indian craft councils, fashion week archives, and drape styling.
                  </p>
                </div>
              </div>
            </button>
          </div>

          {/* Wardrobe Canvas Selection: Curated Capsule vs Clean Closet */}
          <div className="pt-4 border-t border-border/70 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                Starting Wardrobe Environment
              </span>
              <span className="text-[10px] text-muted italic">
                Strict Demo Isolation
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setWardrobeMode('demo')}
                data-testid="wardrobe-mode-demo"
                className={`p-3 rounded-xl border text-left transition-all min-h-12 couture-press ${
                  wardrobeMode === 'demo'
                    ? 'border-(--burnished-gold) bg-(--ivory) shadow-2xs'
                    : 'border-border bg-card hover:border-border/80'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-xs font-semibold text-(--ink) flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-(--burnished-gold)" />
                    Curated Indian Capsule
                  </span>
                  {wardrobeMode === 'demo' && <Check className="w-3.5 h-3.5 text-(--burnished-gold)" />}
                </div>
                <p className="text-[10.5px] text-muted mt-1 leading-normal">
                  28 authentic pieces (6 photos + 22 textile swatches). Strictly isolated in memory; never syncs or replaces personal data.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setWardrobeMode('empty')}
                data-testid="wardrobe-mode-empty"
                className={`p-3 rounded-xl border text-left transition-all min-h-12 couture-press ${
                  wardrobeMode === 'empty'
                    ? 'border-(--ink) bg-(--ivory) shadow-2xs'
                    : 'border-border bg-card hover:border-border/80'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-xs font-semibold text-(--ink) flex items-center gap-1.5">
                    <Shirt className="w-3.5 h-3.5 text-muted" />
                    Clean Personal Closet
                  </span>
                  {wardrobeMode === 'empty' && <Check className="w-3.5 h-3.5 text-(--ink)" />}
                </div>
                <p className="text-[10.5px] text-muted mt-1 leading-normal">
                  Start fresh with zero pre-loaded items. Photograph and catalog your own authentic wardrobe piece by piece.
                </p>
              </button>
            </div>
          </div>

          {/* Expandable Style & Occasion Calibration */}
          <div className="pt-2 border-t border-border/70">
            <button
              type="button"
              onClick={() => setShowPreferences(!showPreferences)}
              className="w-full flex items-center justify-between py-2 text-xs font-semibold text-muted hover:text-(--ink) transition-colors cursor-pointer min-h-11"
            >
              <span>Personalize Aesthetics &amp; Frequent Occasions</span>
              {showPreferences ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showPreferences && (
              <div className="pt-3 space-y-4 animate-fade-in">
                {/* Style Vibes */}
                <div>
                  <label className="editorial-kicker text-muted block mb-2">
                    SELECT YOUR STYLE VIBES:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {STYLE_VIBES.map((vibe) => {
                      const isSelected = styleVibes.includes(vibe);
                      return (
                        <button
                          key={vibe}
                          type="button"
                          onClick={() => toggleVibe(vibe)}
                          className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all select-none active:scale-[0.97] tactile-press-sm ${
                            isSelected
                              ? 'border border-(--ink) bg-(--ink) text-(--paper) shadow-2xs'
                              : 'border border-border bg-card text-muted hover:border-(--ink)'
                          }`}
                        >
                          {isSelected && <Check className="h-3.5 w-3.5 stroke-3 text-(--burnished-gold)" />}
                          <span>{vibe}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Frequent Contexts */}
                <div>
                  <label className="editorial-kicker text-muted block mb-2">
                    PRIMARY OCCASION SETTINGS:
                  </label>
                  <div className="space-y-1.5">
                    {CONTEXT_CHOICES.map((ctx) => {
                      const isSelected = selectedContexts.includes(ctx.id);
                      return (
                        <button
                          key={ctx.id}
                          type="button"
                          onClick={() => toggleContext(ctx.id)}
                          className={`w-full text-left min-h-12 p-2.5 rounded-xl border transition-all flex items-center justify-between couture-press ${
                            isSelected
                              ? 'border-(--ink) bg-(--ivory) shadow-2xs'
                              : 'border-border/80 bg-card hover:border-(--ink)'
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <span className="font-serif text-xs font-semibold text-(--ink) block">
                              {ctx.label}
                            </span>
                            <span className="text-[10px] text-muted font-sans block truncate">
                              {ctx.desc}
                            </span>
                          </div>
                          <div
                            className={`h-4 w-4 rounded-full flex items-center justify-center shrink-0 border ${
                              isSelected
                                ? 'bg-(--ink) border-(--ink) text-white'
                                : 'border-border bg-card'
                            }`}
                          >
                            {isSelected && <Check className="h-2.5 w-2.5 stroke-3" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Privacy & Safety Guarantee */}
          <div className="pt-2 flex items-center justify-between text-[11px] text-muted border-t border-border/70">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>100% Private, Local-First Architecture</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-(--burnished-gold)" />
              <span>₹0 Shopping Required</span>
            </div>
          </div>
        </div>
      </main>

      {/* Editorial Footer */}
      <footer className="text-center py-2 text-[11px] text-muted">
        <span>Curated with respect for Indian heritage, weather &amp; sustainable wardrobes.</span>
      </footer>
    </div>
  );
};
