import { cn } from "@/lib/utils/utils";

/**
 * 竖排摘句：一道强调色细线，右起逐列错落排下。
 * 歌曲卷首放歌词摘句，主页扉页放题词；只用于宽屏的大字（窄屏见 SongHero 的 CompactExcerpt）。
 */
export default function VerticalExcerpt({
  columns,
  className,
}: {
  /** 每一列是一个短语 */
  columns: string[];
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn("flex flex-row-reverse items-start gap-5", className)}
    >
      <span className="w-px h-20 mt-1 bg-(--tone)/60" />
      {columns.map((col, i) => (
        <span
          key={i}
          className="font-calligraphy text-[1.7rem] leading-none tracking-[0.35em] text-slate-700/85 dark:text-slate-300/85 [writing-mode:vertical-rl]"
          style={{ marginTop: i * 3 + "rem" }}
        >
          {col}
        </span>
      ))}
    </div>
  );
}
