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
      className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-full px-4 text-[11px] font-bold tracking-wider uppercase transition-all select-none active:scale-95 disabled:opacity-40 disabled:pointer-events-none ${
        active
          ? 'bg-(--text) text-(--background) shadow-2xs'
          : 'border border-(--border) bg-(--card)/60 text-(--muted) hover:text-(--text) hover:border-(--muted)'
      } ${className}`}
    >
      {icon && <span className="text-xs shrink-0">{icon}</span>}
      <span>{label}</span>
      {count !== undefined && (
        <span
          className={`ml-0.5 text-[10px] font-semibold ${
            active ? 'opacity-80' : 'text-(--muted)'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
};
