import React from 'react';
import { Category, Subcategory } from '../../types';

interface ClothingFallbackProps {
  category: Category;
  subcategory?: Subcategory;
  name?: string;
  colors?: string[];
  fabric?: string;
  className?: string;
  showLabel?: boolean;
}

interface PaletteTheme {
  bgGradient: string;
  borderClass: string;
  textColor: string;
  subtextColor: string;
  accentBadgeBg: string;
  accentBadgeBorder: string;
  swatchHex: string;
}

function resolveAtelierPalette(colors: string[] = [], name: string = ''): PaletteTheme {
  const primaryColor = (colors[0] || name).toLowerCase();

  if (primaryColor.includes('black') || primaryColor.includes('charcoal')) {
    return {
      bgGradient: 'from-[#22201D] via-[#1A1816] to-[#121110]',
      borderClass: 'border-[#3D3833]/80',
      textColor: 'text-[#F5EFEB]',
      subtextColor: 'text-[#B8AEA3]',
      accentBadgeBg: 'bg-[#2E2A25]/90',
      accentBadgeBorder: 'border-[#4A433B]',
      swatchHex: '#1C1A18',
    };
  }

  if (
    primaryColor.includes('white') ||
    primaryColor.includes('cream') ||
    primaryColor.includes('beige') ||
    primaryColor.includes('ivory')
  ) {
    return {
      bgGradient: 'from-[#FAF6F0] via-[#F4EDE2] to-[#E9DFCF]',
      borderClass: 'border-[#DCD0BE]/90',
      textColor: 'text-[#1D1A17]',
      subtextColor: 'text-[#6C6359]',
      accentBadgeBg: 'bg-[#EDE4D5]/90',
      accentBadgeBorder: 'border-[#CFBEA6]',
      swatchHex: '#FAF6F0',
    };
  }

  if (primaryColor.includes('blue') || primaryColor.includes('navy') || primaryColor.includes('indigo')) {
    return {
      bgGradient: 'from-[#141E30] via-[#0E1624] to-[#080D16]',
      borderClass: 'border-[#263753]/80',
      textColor: 'text-[#EDF2FA]',
      subtextColor: 'text-[#9DB0CC]',
      accentBadgeBg: 'bg-[#1C2B44]/90',
      accentBadgeBorder: 'border-[#354D74]',
      swatchHex: '#141E30',
    };
  }

  if (primaryColor.includes('olive') || primaryColor.includes('green')) {
    return {
      bgGradient: 'from-[#262E20] via-[#1D2418] to-[#131810]',
      borderClass: 'border-[#3B4732]/80',
      textColor: 'text-[#F0F4EC]',
      subtextColor: 'text-[#A9B89E]',
      accentBadgeBg: 'bg-[#2E3B26]/90',
      accentBadgeBorder: 'border-[#4A5D3E]',
      swatchHex: '#262E20',
    };
  }

  if (primaryColor.includes('mustard') || primaryColor.includes('yellow') || primaryColor.includes('gold')) {
    return {
      bgGradient: 'from-[#3E2E14] via-[#2D210D] to-[#1C1407]',
      borderClass: 'border-[#5A441F]/80',
      textColor: 'text-[#FCF6EB]',
      subtextColor: 'text-[#D0BC99]',
      accentBadgeBg: 'bg-[#4B3919]/90',
      accentBadgeBorder: 'border-[#735827]',
      swatchHex: '#C59A3F',
    };
  }

  if (
    primaryColor.includes('pink') ||
    primaryColor.includes('red') ||
    primaryColor.includes('maroon') ||
    primaryColor.includes('burgundy')
  ) {
    return {
      bgGradient: 'from-[#3A141D] via-[#2A0D14] to-[#1B070C]',
      borderClass: 'border-[#56212D]/80',
      textColor: 'text-[#FDF2F4]',
      subtextColor: 'text-[#D1A4AD]',
      accentBadgeBg: 'bg-[#4A1B25]/90',
      accentBadgeBorder: 'border-[#6F2939]',
      swatchHex: '#8C2B3E',
    };
  }

  // Default Warm Atelier Taupe
  return {
    bgGradient: 'from-[#282421] via-[#1E1B19] to-[#141211]',
    borderClass: 'border-[#423C37]/80',
    textColor: 'text-[#F4EFEA]',
    subtextColor: 'text-[#B4ACA4]',
    accentBadgeBg: 'bg-[#332E2A]/90',
    accentBadgeBorder: 'border-[#514943]',
    swatchHex: '#4A433D',
  };
}

export const ClothingFallback: React.FC<ClothingFallbackProps> = ({
  category,
  subcategory,
  name = 'Garment',
  colors = [],
  fabric,
  className = '',
}) => {
  const palette = resolveAtelierPalette(colors, name);
  const primaryColor = colors[0] || 'Natural';
  const fabricDescriptor = fabric || (subcategory ? `${subcategory}` : category);

  return (
    <div
      className={`relative flex h-full w-full flex-col justify-between overflow-hidden p-3.5 select-none bg-gradient-to-b ${palette.bgGradient} ${palette.borderClass} ${className}`}
    >
      {/* Subtle organic textile grain texture overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
          backgroundSize: '12px 12px',
        }}
      />

      {/* Decorative corner hairline accents */}
      <div className="pointer-events-none absolute left-2 top-2 h-2.5 w-2.5 border-l border-t border-current opacity-20" />
      <div className="pointer-events-none absolute right-2 top-2 h-2.5 w-2.5 border-r border-t border-current opacity-20" />
      <div className="pointer-events-none absolute bottom-2 left-2 h-2.5 w-2.5 border-b border-l border-current opacity-20" />
      <div className="pointer-events-none absolute bottom-2 right-2 h-2.5 w-2.5 border-b border-r border-current opacity-20" />

      {/* Top Header: Atelier Accession & Category */}
      <div className="relative z-10 flex items-center justify-between border-b border-current/15 pb-2 text-[9px] font-semibold tracking-[0.2em] uppercase">
        <span className={`${palette.subtextColor} font-mono text-[8px]`}>
          ATELIER ARCHIVE
        </span>
        <span className={`${palette.textColor} opacity-90`}>
          {category}
        </span>
      </div>

      {/* Center Display: Garment Name & Craft Badge */}
      <div className="relative z-10 my-auto flex flex-col items-center justify-center py-2 text-center">
        {/* Subtle decorative emblem */}
        <div className="mb-2 flex h-6 w-6 items-center justify-center rounded-full border border-current/25 opacity-40">
          <span className="font-serif text-[11px] italic">✦</span>
        </div>

        {/* Art-Directed Garment Title */}
        <h4
          className={`font-serif text-sm sm:text-base font-normal tracking-tight leading-snug line-clamp-2 px-1 ${palette.textColor}`}
          title={name}
        >
          {name}
        </h4>

        {/* Textile & Subcategory Tag */}
        <div className="mt-2.5 flex items-center gap-1.5 flex-wrap justify-center">
          <span
            className={`rounded-full px-2 py-0.5 text-[8.5px] font-medium tracking-wider uppercase backdrop-blur-xs ${palette.accentBadgeBg} ${palette.accentBadgeBorder} border ${palette.subtextColor}`}
          >
            {fabricDescriptor}
          </span>
        </div>
      </div>

      {/* Bottom Footer: Color swatch palette and provenance seal */}
      <div className="relative z-10 flex items-center justify-between border-t border-current/15 pt-2">
        {/* Color Swatch Gem */}
        <div className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-full border border-white/30 shadow-2xs"
            style={{ backgroundColor: palette.swatchHex }}
            title={`Primary color: ${primaryColor}`}
          />
          <span className={`text-[8.5px] font-medium uppercase tracking-wider capitalize ${palette.subtextColor}`}>
            {primaryColor}
          </span>
        </div>

        <span className={`text-[7.5px] font-mono tracking-widest uppercase opacity-60 ${palette.subtextColor}`}>
          NO. {Math.abs(name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 101)) % 900 + 100}
        </span>
      </div>
    </div>
  );
};
