import React from 'react';
import { Button } from '@/components/ui/button';

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
    <div className="flex flex-col items-center justify-center p-8 sm:p-10 text-center rounded-2xl border border-border bg-card my-4 shadow-2xs animate-fade-in">
      {icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-(--ivory) text-(--burnished-gold) border border-border shadow-2xs">
          {icon}
        </div>
      )}
      <h3 className="font-serif text-2xl font-normal text-(--ink) tracking-tight">
        {title}
      </h3>
      <p className="mt-2 max-w-sm text-xs font-normal text-muted leading-relaxed">
        {description}
      </p>
      {action && (
        <Button
          type="button"
          onClick={action.onClick}
          className="mt-6 uppercase tracking-wider font-semibold shadow-2xs"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
};

