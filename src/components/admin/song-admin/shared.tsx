import Image from "next/image";
import type { Song } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import { getCoverUrl } from "@/lib/utils/utils-song";

/** 列表用的小尺寸封面缩略图 */
export function AdminCoverArt({
  song,
  className,
}: {
  song: Song;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden w-full h-full bg-slate-100 dark:bg-slate-800",
        className,
      )}
    >
      <Image
        src={getCoverUrl(song)}
        alt={song.title}
        width={100}
        height={100}
        className="w-full h-full object-cover"
      />
    </div>
  );
}

export function FieldErrorMessage({
  message,
  className,
}: {
  message?: string;
  className?: string;
}) {
  if (!message) return null;
  return <p className={cn("text-xs text-red-500", className)}>{message}</p>;
}
