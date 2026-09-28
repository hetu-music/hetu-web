"use client";

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils/utils";

const Slider = React.forwardRef<
  React.ComponentRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => {
  // Derive thumb count from value or defaultValue so we render the correct number of thumbs
  const thumbCount = (props.value ?? props.defaultValue ?? [0]).length;

  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn(
        "relative flex w-full touch-none select-none items-center",
        className,
      )}
      {...props}
    >
      {/* 一道细线，选中的区间用强调色 */}
      <SliderPrimitive.Track className="relative h-0.5 w-full grow overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <SliderPrimitive.Range className="absolute h-full bg-(--tone)" />
      </SliderPrimitive.Track>

      {Array.from({ length: thumbCount }).map((_, i) => (
        <SliderPrimitive.Thumb
          key={i}
          className={cn(
            "block size-3.5 rounded-full bg-[#FAFAFA] dark:bg-[#0B0F19]",
            "border-2 border-(--tone)",
            "transition-transform hover:scale-110 active:scale-110 active:cursor-grabbing",
            "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-(--tone)/20",
            "disabled:pointer-events-none disabled:opacity-50",
            "cursor-grab",
          )}
        />
      ))}
    </SliderPrimitive.Root>
  );
});
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
