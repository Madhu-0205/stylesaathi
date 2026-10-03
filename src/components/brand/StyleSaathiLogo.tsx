import React from 'react';

export type LogoVariant = 'full' | 'mark' | 'wordmark' | 'favicon';
export type LogoLayout = 'horizontal' | 'stacked';

export interface StyleSaathiLogoProps {
  variant?: LogoVariant;
  layout?: LogoLayout;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showTagline?: boolean;
  showSince?: boolean; // For splash/brand presentations only
  themeOverride?: 'light' | 'dark';
}

/**
 * Official StyleSaathi Logo — Canonical Brand Direction
 * Features the signature wardrobe clothing rack with suspended garments
 * in a soft blush/mauve and deep ink visual language.
 */
export const StyleSaathiLogo: React.FC<StyleSaathiLogoProps> = ({
  variant = 'full',
  layout = 'horizontal',
  size = 'md',
  className = '',
  showTagline = false,
  showSince = false,
}) => {
  // Dimension tokens
  const sizeMap = {
    xs: { mark: 22, text: 'text-sm', track: 'tracking-[0.2em]', sub: 'text-[7.5px]' },
    sm: { mark: 28, text: 'text-base', track: 'tracking-[0.22em]', sub: 'text-[8.5px]' },
    md: { mark: 36, text: 'text-xl', track: 'tracking-[0.24em]', sub: 'text-[9.5px]' },
    lg: { mark: 48, text: 'text-2xl', track: 'tracking-[0.26em]', sub: 'text-[11px]' },
    xl: { mark: 64, text: 'text-3xl', track: 'tracking-[0.28em]', sub: 'text-xs' },
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  // The Canonical Wardrobe Symbol SVG
  const WardrobeSymbol = ({ symbolSize }: { symbolSize: number }) => (
    <svg
      width={symbolSize}
      height={Math.round(symbolSize * 0.85)}
      viewBox="0 0 120 102"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0 transition-transform duration-300"
      aria-hidden="true"
    >
      <defs>
        {/* Soft Blush to Wine Gradient for Hero Garment */}
        <linearGradient id="heroGarmentGrad" x1="60" y1="30" x2="60" y2="82" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#C95B75" />
          <stop offset="100%" stopColor="#9D173F" />
        </linearGradient>

        {/* Soft Mauve/Rose Gradient for Left Garment */}
        <linearGradient id="leftGarmentGrad" x1="38" y1="32" x2="38" y2="68" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E6B4BE" />
          <stop offset="100%" stopColor="#BA7584" />
        </linearGradient>

        {/* Burnished Gold Accent for Right Garment */}
        <linearGradient id="rightGarmentGrad" x1="82" y1="32" x2="82" y2="72" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E5C384" />
          <stop offset="100%" stopColor="#B38947" />
        </linearGradient>

        {/* Subtle Drop Shadow */}
        <filter id="softShadow" x="-10%" y="-10%" width="120%" height="120%" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#171514" floodOpacity="0.08" />
        </filter>
      </defs>

      {/* Wardrobe Rack Architectural Structure */}
      <g className="text-(--ink) stroke-current" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        {/* Top Horizontal Rail */}
        <line x1="16" y1="22" x2="104" y2="22" className="stroke-(--ink)" />
        {/* Left & Right Finials */}
        <circle cx="16" cy="22" r="2" className="fill-(--burnished-gold) stroke-none" />
        <circle cx="104" cy="22" r="2" className="fill-(--burnished-gold) stroke-none" />

        {/* Vertical Left and Right Posts */}
        <line x1="22" y1="22" x2="22" y2="92" className="stroke-(--ink) opacity-90" strokeWidth="2" />
        <line x1="98" y1="22" x2="98" y2="92" className="stroke-(--ink) opacity-90" strokeWidth="2" />

        {/* Bottom Stabilizer Feet */}
        <line x1="14" y1="92" x2="30" y2="92" className="stroke-(--ink)" strokeWidth="2.2" />
        <line x1="90" y1="92" x2="106" y2="92" className="stroke-(--ink)" strokeWidth="2.2" />

        {/* Lower Shelf / Stretcher Bar */}
        <line x1="22" y1="84" x2="98" y2="84" className="stroke-(--border) dark:stroke-(--border)" strokeWidth="1.5" />
      </g>

      {/* Garment 1 (Left): Soft Blush Kurti / Tunic */}
      <g filter="url(#softShadow)">
        {/* Hanger Hook & Wire */}
        <path d="M38 22 V25 C38 27 36 28 36 29" stroke="var(--burnished-gold)" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M30 34 L38 29 L46 34 Z" fill="none" stroke="var(--burnished-gold)" strokeWidth="1.2" strokeLinejoin="round" />
        {/* Garment Silhouette */}
        <path
          d="M34 34 Q38 36 42 34 L45 42 L42 43 L43 64 C43 66 33 66 33 64 L34 43 L31 42 Z"
          fill="url(#leftGarmentGrad)"
          fillOpacity="0.88"
          stroke="#94535F"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        {/* Delicate Center Slit / Hem detail */}
        <line x1="38" y1="52" x2="38" y2="64" stroke="#FFFDF8" strokeWidth="1" strokeOpacity="0.6" strokeLinecap="round" />
      </g>

      {/* Garment 2 (Center Hero): Flowing Saree / Long Silhouette in Deep Kumkum/Mauve */}
      <g filter="url(#softShadow)">
        {/* Center Hanger Hook & Wire */}
        <path d="M60 22 V24 C60 26 58 27 58 28" stroke="var(--burnished-gold)" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M50 33 L60 28 L70 33 Z" fill="none" stroke="var(--burnished-gold)" strokeWidth="1.4" strokeLinejoin="round" />
        {/* Hero Fluid Drape Silhouette */}
        <path
          d="M54 33 Q60 35 66 33 L71 44 L67 45 L69 78 C69 80 51 80 51 78 L53 45 L49 44 Z"
          fill="url(#heroGarmentGrad)"
          stroke="#7A102E"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        {/* Fluid Indian Pallu Pleat Accent */}
        <path
          d="M55 37 Q61 46 56 60 Q62 70 58 78"
          fill="none"
          stroke="#FFFDF8"
          strokeWidth="1.1"
          strokeOpacity="0.65"
          strokeLinecap="round"
        />
        <path
          d="M60 40 Q65 48 62 64 Q66 72 63 78"
          fill="none"
          stroke="#F7ECEE"
          strokeWidth="0.9"
          strokeOpacity="0.45"
          strokeLinecap="round"
        />
      </g>

      {/* Garment 3 (Right): Gold-Accented Tailored Drape / Dupatta */}
      <g filter="url(#softShadow)">
        {/* Hanger Hook & Wire */}
        <path d="M82 22 V25 C82 27 80 28 80 29" stroke="var(--burnished-gold)" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M74 34 L82 29 L90 34 Z" fill="none" stroke="var(--burnished-gold)" strokeWidth="1.2" strokeLinejoin="round" />
        {/* Folded Drape Silhouette */}
        <path
          d="M76 34 L88 34 L87 70 C87 72 77 72 77 70 Z"
          fill="url(#rightGarmentGrad)"
          fillOpacity="0.85"
          stroke="#946F30"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        {/* Vertical Crease Line */}
        <line x1="82" y1="36" x2="82" y2="69" stroke="#FFFDF8" strokeWidth="1" strokeOpacity="0.5" strokeLinecap="round" />
      </g>
    </svg>
  );

  // Favicon Variant (simplified & high contrast for 16x16 / 32x32)
  if (variant === 'favicon') {
    return (
      <svg
        width={currentSize.mark}
        height={currentSize.mark}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        <rect width="64" height="64" rx="16" fill="#F7F2E9" />
        <path d="M12 18 H52" stroke="#171514" strokeWidth="3" strokeLinecap="round" />
        <line x1="16" y1="18" x2="16" y2="52" stroke="#171514" strokeWidth="2.5" />
        <line x1="48" y1="18" x2="48" y2="52" stroke="#171514" strokeWidth="2.5" />
        <line x1="10" y1="52" x2="22" y2="52" stroke="#171514" strokeWidth="3" strokeLinecap="round" />
        <line x1="42" y1="52" x2="54" y2="52" stroke="#171514" strokeWidth="3" strokeLinecap="round" />
        {/* Left Blush Garment */}
        <rect x="22" y="24" width="7" height="18" rx="2" fill="#BA7584" />
        {/* Center Wine Garment */}
        <rect x="30" y="22" width="9" height="25" rx="2" fill="#9D173F" />
        {/* Right Gold Garment */}
        <rect x="40" y="24" width="6" height="19" rx="2" fill="#A88445" />
      </svg>
    );
  }

  // Wordmark only
  if (variant === 'wordmark') {
    return (
      <div className={`flex flex-col select-none ${className}`}>
        <span className={`font-serif ${currentSize.text} ${currentSize.track} font-normal text-(--ink) leading-none`}>
          STYLESAATHI
        </span>
        {showTagline && (
          <span className={`mt-1 font-sans ${currentSize.sub} font-bold uppercase tracking-[0.2em] text-(--burnished-gold)`}>
            Digital Wardrobe
          </span>
        )}
      </div>
    );
  }

  // Compact symbol mark only
  if (variant === 'mark') {
    return (
      <div className={`inline-flex items-center justify-center select-none ${className}`}>
        <WardrobeSymbol symbolSize={currentSize.mark} />
      </div>
    );
  }

  // Full Logo Lockup (Horizontal or Stacked)
  if (layout === 'stacked') {
    return (
      <div className={`flex flex-col items-center text-center select-none ${className}`}>
        <WardrobeSymbol symbolSize={Math.round(currentSize.mark * 1.35)} />
        <div className="mt-2.5 flex flex-col items-center">
          <span className={`font-serif ${currentSize.text} ${currentSize.track} font-normal text-(--ink) leading-none`}>
            STYLESAATHI
          </span>
          {showTagline && (
            <span className={`mt-1.5 font-sans ${currentSize.sub} font-bold uppercase tracking-[0.22em] text-(--burnished-gold)`}>
              Personal Wardrobe &amp; Stylist
            </span>
          )}
          {showSince && (
            <span className="mt-1 text-[8.5px] font-sans font-semibold uppercase tracking-[0.25em] text-(--muted) opacity-80">
              SINCE 2026
            </span>
          )}
        </div>
      </div>
    );
  }

  // Default Full Logo (Horizontal Lockup for Headers / Navbars)
  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <WardrobeSymbol symbolSize={currentSize.mark} />
      <div className="flex flex-col justify-center">
        <span className={`font-serif ${currentSize.text} ${currentSize.track} font-normal text-(--ink) leading-none`}>
          STYLESAATHI
        </span>
        {showTagline && (
          <span className={`mt-0.5 font-sans ${currentSize.sub} font-bold uppercase tracking-[0.2em] text-(--burnished-gold)`}>
            Wardrobe
          </span>
        )}
      </div>
    </div>
  );
};
