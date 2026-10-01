"use client";

import { Slider as BaseSlider } from "@base-ui/react/slider";
import * as React from "react";
import { cn } from "@/lib/utils/utils";

type SliderProps = Omit<
  React.ComponentProps<typeof BaseSlider.Root<number[]>>,
  "className" | "onValueChange"
> & {
  className?: string;
  value: number[];
  onValueChange: (value: number[]) => void;
  "aria-label"?: string;
};

/** 一道细线，选中的区间用强调色；滑块是页面底色的小圆，描一圈强调色 */
function Slider({
  className,
  value,
  onValueChange,
  "aria-label": ariaLabel,
  ...props
}: SliderProps) {
  return (
    <BaseSlider.Root
      value={value}
      onValueChange={(next) => onValueChange(next as number[])}
      className={cn("w-full", className)}
      {...props}
    >
      <BaseSlider.Control className="flex w-full touch-none select-none items-center py-2">
        <BaseSlider.Track className="relative h-0.5 w-full rounded-full bg-slate-200 dark:bg-slate-700">
          <BaseSlider.Indicator className="rounded-full bg-(--tone)" />
          {value.map((_, i) => (
            <BaseSlider.Thumb
              key={i}
              index={i}
              getAriaLabel={ariaLabel ? () => ariaLabel : undefined}
              className={cn(
                "block size-3.5 rounded-full bg-[#FAFAFA] dark:bg-[#0B0F19]",
                "border-2 border-(--tone)",
                "transition-[scale] hover:scale-110 data-dragging:scale-110",
                "cursor-grab data-dragging:cursor-grabbing",
                "has-focus-visible:ring-4 has-focus-visible:ring-(--tone)/20",
                "data-disabled:pointer-events-none data-disabled:opacity-50",
              )}
            />
          ))}
        </BaseSlider.Track>
      </BaseSlider.Control>
    </BaseSlider.Root>
  );
}

export { Slider };
