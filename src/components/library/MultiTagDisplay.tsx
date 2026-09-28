import { useTranslations } from "next-intl";

/** 超过这个数就只列前几个，余下的记作「+N」 */
const MAX_SHOWN = 4;

/**
 * 列表视图里的类型、流派：灰色小字，一个标签一段，放不下就整段换行，
 * 不在字中间截断成省略号。不按类别上色、不做胶囊。
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
  const shown = labels.slice(0, MAX_SHOWN);
  const rest = labels.length - shown.length;

  return (
    <span
      title={labels.join(" · ")}
      className="flex w-24 flex-wrap justify-center gap-x-2 gap-y-0.5 text-xs leading-5 tracking-wider text-slate-400 dark:text-slate-500"
    >
      {shown.map((label) => (
        <span key={label} className="whitespace-nowrap">
          {label}
        </span>
      ))}
      {rest > 0 && <span className="tabular-nums">+{rest}</span>}
    </span>
  );
};

export default MultiTagDisplay;
