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
    <div className="flex flex-col items-center justify-center p-8 sm:p-10 text-center rounded-2xl border border-(--border) bg-(--card) my-4 shadow-2xs">
      {icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-(--ivory) text-(--burnished-gold) border border-(--border)">
          {icon}
        </div>
      )}
      <h3 className="font-serif text-2xl font-normal text-(--ink) tracking-tight">
        {title}
      </h3>
      <p className="mt-2 max-w-sm text-xs font-normal text-(--muted) leading-relaxed">
        {description}
      </p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg border border-(--ink) bg-(--ink) px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-(--paper) shadow-sm transition-all hover:bg-(--ink)/90 active:scale-95"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};

