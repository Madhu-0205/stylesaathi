import React from 'react';

export interface StyleSaathiLoaderProps {
  statusText?: string;
  subtext?: string;
  size?: 'sm' | 'md' | 'lg';
  compact?: boolean;
  className?: string;
}

/**
 * Original StyleSaathi Wardrobe Loading Animation
 *
 * An editorial sequence of garments dynamically entering and settling onto a
 * minimalist wardrobe rail, with authentic fabric sway and styling selection highlight.
 *
 * Respects prefers-reduced-motion and scales flawlessly across 320px–1920px viewports.
 */
export const StyleSaathiLoader: React.FC<StyleSaathiLoaderProps> = ({
  statusText = 'Curating your wardrobe…',
  subtext,
  size = 'md',
  compact = false,
  className = '',
}) => {
  // Sizing configurations
  const dimensions = {
    sm: { width: 140, height: 110, fontSize: 'text-xs', subSize: 'text-[9.5px]' },
    md: { width: 220, height: 170, fontSize: 'text-sm', subSize: 'text-[11px]' },
    lg: { width: 290, height: 225, fontSize: 'text-base', subSize: 'text-xs' },
  }[size];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={`flex flex-col items-center justify-center text-center select-none ${className}`}
    >
      {/* Animated Wardrobe Rack SVG */}
      <div className="relative flex items-center justify-center">
        <svg
          width={dimensions.width}
          height={dimensions.height}
          viewBox="0 0 160 125"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="overflow-visible"
        >
          <defs>
            {/* Gradients for Authentic Indian Fabrics */}
            {/* 1. Blush Kurti */}
            <linearGradient id="loaderKurtiGrad" x1="42" y1="28" x2="42" y2="76" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#E8B4BD" />
              <stop offset="100%" stopColor="#BA7584" />
            </linearGradient>

            {/* 2. Crisp Contemporary Shirt */}
            <linearGradient id="loaderShirtGrad" x1="66" y1="28" x2="66" y2="68" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#F5EFE6" />
              <stop offset="100%" stopColor="#D5CBBF" />
            </linearGradient>

            {/* 3. Hero Wine / Kumkum Saree with Pallu */}
            <linearGradient id="loaderSareeGrad" x1="94" y1="26" x2="94" y2="92" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#C94A6B" />
              <stop offset="100%" stopColor="#8A1336" />
            </linearGradient>

            {/* 4. Burnished Gold Trouser / Drape */}
            <linearGradient id="loaderTrouserGrad" x1="120" y1="28" x2="120" y2="82" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#E2C285" />
              <stop offset="100%" stopColor="#A88445" />
            </linearGradient>

            {/* Subtle Atelier Shadow */}
            <filter id="loaderShadow" x="-20%" y="-10%" width="140%" height="130%" filterUnits="userSpaceOnUse">
              <feDropShadow dx="0" dy="2.5" stdDeviation="2" floodColor="#171514" floodOpacity="0.12" />
            </filter>

            {/* Subtle Aura for Curated Hero Selection */}
            <filter id="curatedGlow" x="-30%" y="-20%" width="160%" height="150%" filterUnits="userSpaceOnUse">
              <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#9D173F" floodOpacity="0.25" />
            </filter>
          </defs>

          {/* ==============================================================
              PHASE 2: WARDROBE RACK STRUCTURE (Architectural & Minimal)
             ============================================================== */}
          <g className="text-(--ink) stroke-current">
            {/* Top Horizontal Rail */}
            <line
              x1="18"
              y1="24"
              x2="142"
              y2="24"
              strokeWidth="2.5"
              strokeLinecap="round"
              className="animate-rail-draw"
            />
            {/* Brass Finial Spheres */}
            <circle cx="18" cy="24" r="2.5" fill="#A88445" stroke="none" />
            <circle cx="142" cy="24" r="2.5" fill="#A88445" stroke="none" />

            {/* Slender Vertical Posts */}
            <line x1="24" y1="24" x2="24" y2="108" strokeWidth="2" strokeLinecap="round" className="opacity-90" />
            <line x1="136" y1="24" x2="136" y2="108" strokeWidth="2" strokeLinecap="round" className="opacity-90" />

            {/* Base Stabilizer Feet */}
            <line x1="14" y1="108" x2="34" y2="108" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="126" y1="108" x2="146" y2="108" strokeWidth="2.5" strokeLinecap="round" />

            {/* Lower Accessory Stretcher Bar */}
            <line
              x1="24"
              y1="98"
              x2="136"
              y2="98"
              strokeWidth="1.25"
              className="stroke-(--border) dark:stroke-(--border) opacity-80"
            />
          </g>

          {/* ==============================================================
              PHASE 3 & 4: GARMENTS ENTER & NATURAL FABRIC SWAY
             ============================================================== */}

          {/* 1. Soft Blush Kurti (Enters at 0.35s, subtle sway A) */}
          <g
            className="animate-garment-1 origin-[42px_24px]"
            style={{ transformOrigin: '42px 24px' }}
            filter="url(#loaderShadow)"
          >
            {/* Hanger Hook & Wire */}
            <path d="M42 24 V27 C42 29 40 30 40 31" stroke="#A88445" strokeWidth="1.3" strokeLinecap="round" />
            <path d="M33 36 L42 31 L51 36 Z" fill="none" stroke="#A88445" strokeWidth="1.2" strokeLinejoin="round" />
            {/* Kurti Body */}
            <path
              d="M37 36 Q42 38 47 36 L51 44 L48 45 L49 70 C49 72 35 72 35 70 L36 45 L33 44 Z"
              fill="url(#loaderKurtiGrad)"
              stroke="#94535F"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
            {/* Slit Line */}
            <line x1="42" y1="58" x2="42" y2="70" stroke="#FFFDF8" strokeWidth="0.9" strokeLinecap="round" opacity="0.65" />
          </g>

          {/* 2. Clean Relaxed Shirt (Enters at 0.50s, subtle sway B) */}
          <g
            className="animate-garment-2 origin-[68px_24px]"
            style={{ transformOrigin: '68px 24px' }}
            filter="url(#loaderShadow)"
          >
            {/* Hanger Hook & Wire */}
            <path d="M68 24 V27 C68 29 66 30 66 31" stroke="#A88445" strokeWidth="1.3" strokeLinecap="round" />
            <path d="M59 36 L68 31 L77 36 Z" fill="none" stroke="#A88445" strokeWidth="1.2" strokeLinejoin="round" />
            {/* Shirt Body with collar & button placket */}
            <path
              d="M62 36 L65 39 L71 39 L74 36 L79 43 L76 44 L77 66 C77 68 59 68 59 66 L60 44 L57 43 Z"
              fill="url(#loaderShirtGrad)"
              stroke="#8A7E70"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
            {/* Center Placket */}
            <line x1="68" y1="39" x2="68" y2="66" stroke="#8A7E70" strokeWidth="0.8" strokeLinecap="round" opacity="0.6" />
          </g>

          {/* 3. Hero Flowing Saree (Enters at 0.65s, Curate Highlight pulse) */}
          <g
            className="animate-garment-3-hero origin-[96px_24px]"
            style={{ transformOrigin: '96px 24px' }}
            filter="url(#curatedGlow)"
          >
            {/* Hanger Hook & Wire */}
            <path d="M96 24 V26 C96 28 94 29 94 30" stroke="#C6A664" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M85 35 L96 30 L107 35 Z" fill="none" stroke="#C6A664" strokeWidth="1.4" strokeLinejoin="round" />
            {/* Fluid Indian Saree Silhouette */}
            <path
              d="M89 35 Q96 37 103 35 L109 46 L104 47 L106 88 C106 91 86 91 86 88 L88 47 L83 46 Z"
              fill="url(#loaderSareeGrad)"
              stroke="#7A102E"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
            {/* Sweeping Pallu Drape Pleats */}
            <path
              d="M91 39 Q97 50 93 68 Q100 78 95 88"
              fill="none"
              stroke="#FFFDF8"
              strokeWidth="1.2"
              strokeLinecap="round"
              opacity="0.75"
            />
            <path
              d="M96 44 Q102 55 98 72 Q103 81 100 88"
              fill="none"
              stroke="#F7ECEE"
              strokeWidth="0.9"
              strokeLinecap="round"
              opacity="0.5"
            />
            {/* Selection Star Sparkle on Hero Piece */}
            <circle cx="96" cy="46" r="1.5" fill="#C6A664" className="animate-sparkle-pulse" />
          </g>

          {/* 4. Tailored Bottom / Dupatta Fold (Enters at 0.80s, subtle sway B) */}
          <g
            className="animate-garment-4 origin-[120px_24px]"
            style={{ transformOrigin: '120px 24px' }}
            filter="url(#loaderShadow)"
          >
            {/* Hanger Hook & Wire */}
            <path d="M120 24 V27 C120 29 118 30 118 31" stroke="#A88445" strokeWidth="1.3" strokeLinecap="round" />
            <path d="M112 36 L120 31 L128 36 Z" fill="none" stroke="#A88445" strokeWidth="1.2" strokeLinejoin="round" />
            {/* Tailored Folded Drape */}
            <path
              d="M114 36 L126 36 L125 76 C125 78 115 78 115 76 Z"
              fill="url(#loaderTrouserGrad)"
              stroke="#946F30"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
            {/* Crease Line */}
            <line x1="120" y1="38" x2="120" y2="75" stroke="#FFFDF8" strokeWidth="0.9" strokeLinecap="round" opacity="0.6" />
          </g>
        </svg>
      </div>

      {/* ==============================================================
          PHASE 5: BRAND WORDMARK & REFINED STATUS
         ============================================================== */}
      {!compact && (
        <div className="mt-4 flex flex-col items-center animate-fade-in text-center px-4">
          <span className="font-serif text-lg sm:text-xl font-normal tracking-[0.26em] text-(--ink) leading-tight">
            STYLESAATHI
          </span>

          {statusText && (
            <div className="mt-1.5 flex items-center justify-center gap-1.5 text-(--muted)">
              <span className={`font-sans ${dimensions.subSize} font-medium tracking-wide text-(--muted)`}>
                {statusText}
              </span>
              {/* Soft pulsating dots */}
              <span className="inline-flex gap-1 items-center">
                <span className="h-1 w-1 rounded-full bg-(--kumkum) animate-pulse" />
                <span className="h-1 w-1 rounded-full bg-(--burnished-gold) animate-pulse delay-150" />
                <span className="h-1 w-1 rounded-full bg-(--kumkum) animate-pulse delay-300" />
              </span>
            </div>
          )}

          {subtext && (
            <p className="mt-1 text-[10px] text-(--muted)/80 font-serif italic max-w-xs">
              {subtext}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
