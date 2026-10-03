import React from 'react';
import { Sun, Moon } from 'lucide-react';

interface HeaderProps {
  title: string;
  subtitle?: string;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  action?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  theme,
  onToggleTheme,
  action,
}) => {
  return (
    <header className="mb-5 pt-1">
      {/* Brand Wordmark & Descriptor */}
      <div className="flex items-center justify-between border-b border-(--border)/50 pb-2.5 mb-3.5">
        <div className="flex items-baseline gap-2">
          <span className="text-[11px] font-extrabold tracking-[0.22em] text-(--text) uppercase">
            StyleSaathi
          </span>
          <span className="hidden sm:inline-block text-[9px] tracking-[0.14em] text-(--muted) uppercase font-medium">
            Your wardrobe, thoughtfully styled
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {onToggleTheme && (
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="flex h-10 w-10 items-center justify-center rounded-full text-(--muted) hover:text-(--text) transition-colors active:scale-95"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-amber-300 stroke-[1.8]" />
              ) : (
                <Moon className="h-4 w-4 stroke-[1.8]" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Main Editorial Title Row */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl sm:text-4xl font-normal tracking-tight text-(--text) leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-0.5 text-xs text-(--muted) font-medium tracking-wide">
              {subtitle}
            </p>
          )}
        </div>

        {action && (
          <div className="shrink-0 pb-0.5">
            {action}
          </div>
        )}
      </div>
    </header>
  );
};
