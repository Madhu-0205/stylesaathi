import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors focus:outline-none focus:ring-1.5 focus:ring-(--accent)",
  {
    variants: {
      variant: {
        default:
          "border border-(--accent)/30 bg-(--accent)/10 text-(--accent)",
        secondary:
          "border border-(--border) bg-(--card) text-(--muted)",
        outline:
          "border border-(--border) text-(--text)",
        gold:
          "border border-(--gold-rule)/40 bg-(--gold-rule)/10 text-(--burnished-gold)",
        marigold:
          "border border-(--marigold)/40 bg-(--marigold)/10 text-(--marigold)",
        mehndi:
          "border border-(--mehndi)/40 bg-(--mehndi)/10 text-(--mehndi)",
        indigo:
          "border border-(--indigo)/40 bg-(--indigo)/10 text-(--indigo)",
        destructive:
          "border border-(--danger)/40 bg-(--danger)/10 text-(--danger)",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
