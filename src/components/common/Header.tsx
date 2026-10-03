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
    <header className="mb-6 flex items-start justify-between gap-4 pt-2">
      <div>
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] font-bold uppercase tracking-widest text-(--accent)">
            StyleSaathi
          </span>
          <span className="h-1 w-1 rounded-full bg-(--accent)" />
          <span className="text-[11px] font-medium text-(--muted)">Wardrobe</span>
        </div>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-(--text) sm:text-3xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-0.5 text-xs text-(--muted) font-medium sm:text-sm">
            {subtitle}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {action}
        {onToggleTheme && (
          <button
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-(--border) bg-(--card) text-(--text) transition-colors hover:border-(--accent) active:scale-95"
          >
            {theme === 'dark' ? (
              <Sun className="h-5 w-5 text-amber-400" />
            ) : (
              <Moon className="h-5 w-5 text-(--text)" />
            )}
          </button>
        )}
      </div>
    </header>
  );
};
