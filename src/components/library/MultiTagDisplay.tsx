import { useTranslations } from "next-intl";

/**
 * 列表视图里的类型、流派：一行灰色小字，多个用「·」隔开，
 * 放不下就截断，悬停看全称。不再按类别上色、不做胶囊。
 */
const MultiTagDisplay = ({
  tags,
  type,
}: {
  tags: string[] | null | undefined;
  type: "type" | "genre";
}) => {
  const tEnum = useTranslations("enums");

  const text =
    tags && tags.length > 0
      ? tags
          .map((v) => (tEnum.has(`${type}.${v}`) ? tEnum(`${type}.${v}`) : v))
          .join(" · ")
      : type === "type"
        ? "未知类型"
        : "未知流派";

  return (
    <span
      title={text}
      className="w-24 truncate text-center text-xs tracking-wider text-slate-400 dark:text-slate-500"
    >
      {text}
    </span>
  );
};

export default MultiTagDisplay;
