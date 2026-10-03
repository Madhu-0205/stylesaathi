import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center rounded-3xl border border-[var(--border)] bg-[var(--card)]/60 my-4">
      {icon && (
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--background)] text-[var(--accent)]">
          {icon}
        </div>
      )}
      <h3 className="text-base font-bold text-[var(--text)] tracking-tight sm:text-lg">
        {title}
      </h3>
      <p className="mt-1.5 max-w-xs text-xs font-medium text-[var(--muted)] leading-relaxed sm:text-sm">
        {description}
      </p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-[var(--accent)] px-5 py-2.5 text-xs font-bold text-white shadow-xs transition-transform hover:opacity-95 active:scale-95"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};
