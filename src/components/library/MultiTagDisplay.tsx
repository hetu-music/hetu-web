import { useTranslations } from "next-intl";

/** 最多列出几个，余下的记作「+N」 */
const MAX_SHOWN = 2;

/**
 * 列表视图里的类型、流派：一行灰色小字，最多列两个，余下记作「+N」，
 * 悬停看全部。不换行、不按类别上色、不做胶囊。
 */
const MultiTagDisplay = ({
  tags,
  type,
}: {
  tags: string[] | null | undefined;
  type: "type" | "genre";
}) => {
  const tEnum = useTranslations("enums");
  const tCommon = useTranslations("common");

  const labels =
    tags && tags.length > 0
      ? tags.map((v) => (tEnum.has(`${type}.${v}`) ? tEnum(`${type}.${v}`) : v))
      : [tCommon("unknown")];
  const rest = labels.length - MAX_SHOWN;

  return (
    <span
      title={labels.join(" · ")}
      className="flex w-24 items-baseline justify-center gap-1.5 whitespace-nowrap text-xs tracking-wider text-slate-400 dark:text-slate-500"
    >
      <span className="min-w-0 truncate">
        {labels.slice(0, MAX_SHOWN).join(" · ")}
      </span>
      {rest > 0 && <span className="shrink-0 tabular-nums">+{rest}</span>}
    </span>
  );
};

export default MultiTagDisplay;
