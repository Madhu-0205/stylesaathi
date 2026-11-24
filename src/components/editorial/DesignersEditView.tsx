import React, { useState } from 'react';
import {
  Sparkles,
  BookOpen,
  Palette,
  Layers,
  ShieldCheck,
  Scissors,
  Compass,
  ArrowRight,
} from 'lucide-react';
import {
  DESIGNERS_EDIT_PHILOSOPHIES,
} from '../../engine/knowledge/designersEditCatalog';
import { Button } from '@/components/ui/button';

interface DesignersEditViewProps {
  onAskSaathi?: (prompt: string) => void;
  className?: string;
}

export const DesignersEditView: React.FC<DesignersEditViewProps> = ({
  onAskSaathi,
  className = '',
}) => {
  const [activePhilosophyId, setActivePhilosophyId] = useState<string>(
    DESIGNERS_EDIT_PHILOSOPHIES[0].id
  );

  const activePhilosophy =
    DESIGNERS_EDIT_PHILOSOPHIES.find((p) => p.id === activePhilosophyId) ||
    DESIGNERS_EDIT_PHILOSOPHIES[0];

  return (
    <section
      aria-label="The Designer's Edit"
      className={`rounded-3xl border border-border/80 bg-(--paper)/90 p-5 sm:p-6 shadow-sm backdrop-blur-md specular-border couture-card ${className}`}
    >
      {/* Header */}
      <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border-b border-border/70 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-(--burnished-gold)/15 text-(--burnished-gold) border border-(--burnished-gold)/20">
              <Compass className="h-4 w-4" />
            </span>
            <h2 className="font-serif text-xl sm:text-2xl font-normal tracking-tight text-(--ink)">
              The Designer's Edit
            </h2>
            <span className="rounded-full bg-(--burnished-gold)/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-(--burnished-gold) border border-(--burnished-gold)/20">
              StyleSaathi 4.0
            </span>
          </div>
          <p className="mt-1 text-xs text-muted font-sans leading-relaxed">
            Verified principles of living Indian textile craft &amp; contemporary architectural tailoring.
          </p>
        </div>
      </div>

      {/* Philosophy Selector Tabs */}
      <div
        role="tablist"
        aria-label="Editorial style philosophies"
        className="mb-5 flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1"
      >
        {DESIGNERS_EDIT_PHILOSOPHIES.map((phil) => {
          const isActive = phil.id === activePhilosophy.id;
          return (
            <button
              key={phil.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActivePhilosophyId(phil.id)}
              className={`flex-shrink-0 min-h-11 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all couture-press cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-(--burnished-gold) ${
                isActive
                  ? 'bg-(--ink) text-(--paper) shadow-2xs font-bold'
                  : 'bg-card/70 border border-border/80 text-muted hover:text-(--ink) hover:border-(--ink)'
              }`}
            >
              {phil.title}
            </button>
          );
        })}
      </div>

      {/* Active Philosophy Card */}
      <div className="space-y-5">
        {/* Banner */}
        <div className="rounded-2xl bg-(--ivory) border border-border/80 p-4.5 shadow-2xs">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="editorial-kicker text-(--kumkum)">DESIGN PHILOSOPHY</span>
              <h3 className="font-serif text-lg sm:text-xl font-normal text-(--ink) mt-0.5">
                {activePhilosophy.title}
              </h3>
              <p className="text-xs font-medium text-(--burnished-gold)">
                {activePhilosophy.subtitle}
              </p>
            </div>
            {onAskSaathi && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  onAskSaathi(
                    `How do I style a ${activePhilosophy.title.toLowerCase()} outfit from my wardrobe?`
                  )
                }
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-(--burnished-gold)/30 bg-(--paper) px-3.5 py-1.5 text-xs font-semibold text-(--burnished-gold) hover:text-(--ink) hover:border-(--burnished-gold) couture-press shrink-0"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Style This</span>
              </Button>
            )}
          </div>
          <p className="mt-2.5 text-xs sm:text-sm leading-relaxed text-muted font-sans">
            {activePhilosophy.description}
          </p>
        </div>

        {/* Core Principles */}
        <div>
          <h4 className="mb-2.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-(--ink)">
            <BookOpen className="h-3.5 w-3.5 text-(--burnished-gold)" />
            Core Editorial Principles
          </h4>
          <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {activePhilosophy.corePrinciples.map((principle, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2.5 rounded-xl border border-border/80 bg-card/60 p-3 text-xs text-(--ink) shadow-2xs"
              >
                <span className="mt-0.5 flex h-4.5 w-4.5 flex-shrink-0 items-center justify-center rounded-full bg-(--burnished-gold)/15 text-[10px] font-bold text-(--burnished-gold)">
                  {idx + 1}
                </span>
                <span className="leading-relaxed font-sans">{principle}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Recommended Palettes */}
        <div>
          <h4 className="mb-2.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-(--ink)">
            <Palette className="h-3.5 w-3.5 text-(--burnished-gold)" />
            Curated Color Palettes
          </h4>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {activePhilosophy.recommendedPalettes.map((palette, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-border/80 bg-card/60 p-3.5 shadow-2xs"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-serif font-medium text-(--ink)">
                    {palette.name}
                  </span>
                  <div className="flex gap-1.5">
                    {palette.hexCodes.map((hex, hIdx) => (
                      <span
                        key={hIdx}
                        className="h-4.5 w-4.5 rounded-full border border-black/10 shadow-2xs dark:border-white/10"
                        style={{ backgroundColor: hex }}
                        title={hex}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-[11px] text-muted font-sans leading-relaxed">
                  {palette.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Living Handloom & Textile Traditions */}
        <div>
          <h4 className="mb-2.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-(--ink)">
            <Layers className="h-3.5 w-3.5 text-(--burnished-gold)" />
            Living Handloom &amp; Craft Traditions
          </h4>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {activePhilosophy.textileTraditions.map((craft, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-border/80 bg-card/60 p-3.5 shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-serif font-medium text-(--ink)">
                    {craft.name}
                  </span>
                  <span className="rounded-full bg-(--burnished-gold)/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-(--burnished-gold) border border-(--burnished-gold)/20">
                    {craft.region}
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] text-muted font-sans leading-relaxed">
                  {craft.description}
                </p>
                <div className="mt-2.5 flex items-center justify-between text-[10px] text-muted font-sans pt-1 border-t border-border/60">
                  <span>Season: <strong className="text-(--ink)">{craft.bestSeason}</strong></span>
                  <span className="italic">{craft.technique}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Silhouette Guide */}
        <div>
          <h4 className="mb-2.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-(--ink)">
            <Scissors className="h-3.5 w-3.5 text-(--burnished-gold)" />
            Silhouette &amp; Proportion Architecture
          </h4>
          <div className="rounded-xl border border-border/80 bg-card/60 p-3.5 text-xs shadow-2xs">
            <p className="mb-2.5 font-medium text-(--ink)">
              <span className="font-bold text-(--burnished-gold)">Proportions: </span>
              {activePhilosophy.silhouetteGuide.proportions}
            </p>
            <div className="grid grid-cols-2 gap-2.5 text-[11px] text-muted font-sans">
              <div>
                <span className="font-semibold text-(--ink)">Top: </span>
                {activePhilosophy.silhouetteGuide.top}
              </div>
              <div>
                <span className="font-semibold text-(--ink)">Bottom: </span>
                {activePhilosophy.silhouetteGuide.bottom}
              </div>
              <div>
                <span className="font-semibold text-(--ink)">Layering: </span>
                {activePhilosophy.silhouetteGuide.layering}
              </div>
              <div>
                <span className="font-semibold text-(--ink)">Footwear: </span>
                {activePhilosophy.silhouetteGuide.footwear}
              </div>
            </div>
          </div>
        </div>

        {/* Verified Provenance Footer */}
        <div className="flex items-center justify-between border-t border-border/70 pt-3 text-[10px] text-muted">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Verified against: {activePhilosophy.verifiedSources[0]}</span>
          </div>
          {onAskSaathi && (
            <button
              type="button"
              onClick={() => onAskSaathi(`Tell me more about ${activePhilosophy.title}`)}
              className="inline-flex min-h-11 items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-(--burnished-gold) hover:text-(--ink) hover:bg-(--ivory) cursor-pointer tactile-press"
            >
              <span>Learn more</span> <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </section>
  );
};

