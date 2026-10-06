import * as React from "react";
import { Separator as SeparatorPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

const Separator = React.forwardRef<
  React.ComponentRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root> & {
    variant?: "default" | "textile" | "gold";
  }
>(
  (
    { className, orientation = "horizontal", decorative = true, variant = "default", ...props },
    ref
  ) => {
    let variantClass = "bg-border";
    if (variant === "textile" && orientation === "horizontal") {
      variantClass = "textile-divider bg-transparent";
    } else if (variant === "gold" && orientation === "horizontal") {
      variantClass = "gold-accent-rule bg-transparent";
    }

    return (
      <SeparatorPrimitive.Root
        ref={ref}
        decorative={decorative}
        orientation={orientation}
        className={cn(
          "shrink-0",
          orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
          variantClass,
          className
        )}
        {...props}
      />
    );
  }
);
Separator.displayName = "Separator";

export { Separator };
