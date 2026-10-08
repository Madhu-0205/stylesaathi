import React from 'react';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', ...props }) => {
  return (
    <div
      className={`skeleton-shimmer rounded-xl bg-border/60 ${className}`}
      aria-hidden="true"
      {...props}
    />
  );
};

export const WardrobeItemSkeleton: React.FC = () => {
  return (
    <div className="flex flex-col space-y-2 select-none" aria-busy="true" aria-label="Loading wardrobe item">
      <Skeleton className="aspect-4/5 w-full rounded-2xl" />
      <Skeleton className="h-3.5 w-3/4 rounded-md" />
      <Skeleton className="h-2.5 w-1/2 rounded-md" />
    </div>
  );
};

export const OutfitCardSkeleton: React.FC = () => {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4"
      aria-busy="true"
      aria-label="Generating outfit recommendation"
    >
      <div className="flex justify-between items-center border-b border-border pb-2.5">
        <Skeleton className="h-4 w-32 rounded-md" />
        <Skeleton className="h-3 w-20 rounded-md" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-7 grid grid-cols-12 gap-2">
          <Skeleton className="col-span-8 aspect-4/5 rounded-2xl" />
          <div className="col-span-4 space-y-2">
            <Skeleton className="aspect-square rounded-xl" />
            <Skeleton className="aspect-square rounded-xl" />
          </div>
        </div>
        <div className="md:col-span-5 space-y-3">
          <Skeleton className="h-4 w-full rounded-md" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-11 flex-1 rounded-xl" />
            <Skeleton className="h-11 w-16 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
};
