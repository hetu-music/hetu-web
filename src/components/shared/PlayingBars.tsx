import { cn } from "@/lib/utils/utils";

const BARS = [60, 100, 40];

/**
 * 「正在播放」的三道跳动条。动画是无限循环的，调用方只在播放中、且所在区域
 * 可见时才挂载它——藏在 opacity-0 里的动画照样逐帧合成，手机上会发热。
 */
export default function PlayingBars({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("flex h-3 shrink-0 items-end gap-0.5", className)}
    >
      {BARS.map((h, i) => (
        <span
          key={i}
          className="playing-bar-anim w-0.5 rounded-full bg-(--tone)"
          style={{ height: `${h}%`, animationDelay: `${i * 0.2}s` }}
        />
      ))}
    </span>
  );
}
