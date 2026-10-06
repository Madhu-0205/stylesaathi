import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wider transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent) focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] select-none",
  {
    variants: {
      variant: {
        default:
          "bg-(--accent) text-white shadow-2xs hover:bg-(--accent-hover) hover:shadow-xs active:bg-(--accent-hover)",
        secondary:
          "bg-(--card) text-(--text) border border-(--border) hover:bg-(--ivory) hover:border-(--text)/30 shadow-2xs",
        outline:
          "border border-(--border) bg-transparent text-(--text) hover:bg-(--card) hover:border-(--accent) hover:text-(--accent)",
        ghost:
          "bg-transparent text-(--text) hover:bg-(--card) hover:text-(--ink)",
        gold:
          "border border-(--gold-rule) bg-transparent text-(--burnished-gold) hover:bg-(--gold-rule)/10 hover:border-(--burnished-gold)",
        destructive:
          "bg-(--danger) text-white shadow-2xs hover:opacity-90 active:opacity-100",
        link:
          "text-(--accent) underline-offset-4 hover:underline p-0 h-auto font-normal lowercase tracking-normal",
      },
      size: {
        default: "min-h-11 px-5 py-2.5 rounded-full",
        sm: "min-h-9 px-3.5 py-1.5 text-[11px] rounded-full",
        lg: "min-h-12 px-6 py-3 text-sm rounded-full",
        icon: "h-11 w-11 p-0 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot.Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
