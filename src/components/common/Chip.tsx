import React from 'react';

interface ChipProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
  count?: number;
  icon?: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export const Chip: React.FC<ChipProps> = ({
  label,
  active = false,
  onClick,
  count,
  icon,
  className = '',
  disabled = false,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-full px-4 text-xs font-semibold tracking-wide transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none select-none ${
        active
          ? 'bg-[var(--accent)] text-white shadow-xs'
          : 'border border-[var(--border)] bg-[var(--card)] text-[var(--text)] hover:border-[var(--muted)]/50'
      } ${className}`}
    >
      {icon && <span className="text-sm shrink-0">{icon}</span>}
      <span className="capitalize">{label}</span>
      {count !== undefined && (
        <span
          className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
            active ? 'bg-white/20 text-white' : 'bg-[var(--background)] text-[var(--muted)]'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
};
