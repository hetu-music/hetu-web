/**
 * OpenCC 简繁转换工具
 * 封装 opencc-js，提供懒初始化的转换函数
 *
 * 注意：此文件仅在服务端运行（Server Components / Route Handlers）
 * opencc-js 的字典文件较大，不应打包到客户端
 */

// opencc-js 使用 CommonJS default export
// eslint-disable-next-line @typescript-eslint/no-require-imports
const OpenCC = require("opencc-js");

type ConverterFn = (text: string) => string;

let _converter: ConverterFn | null = null;

function getConverter(): ConverterFn {
  const current = _converter;
  if (current) {
    return current;
  }
  const newConverter = OpenCC.Converter({
    from: "cn",
    to: "twp",
  }) as ConverterFn;
  _converter = newConverter;
  return newConverter;
}

let _toSimplified: ConverterFn | null = null;

/**
 * 繁→简只做逐字转换（tw，不用 twp）：用于把用户输入对齐到库里的简体，
 * 词汇级改写（如「軟體」→「软件」）会改变用户原本要找的字。
 */
function getSimplifiedConverter(): ConverterFn {
  if (!_toSimplified) {
    _toSimplified = OpenCC.Converter({ from: "tw", to: "cn" }) as ConverterFn;
  }
  return _toSimplified;
}

/**
 * 将繁体中文字符串转换为简体，已是简体的部分原样保留。
 * 库内歌曲资料以简体存储，繁体输入需先转成简体才能匹配。
 */
export function toSimplified(text: string): string {
  if (!text) return text;
  try {
    return getSimplifiedConverter()(text);
  } catch {
    return text;
  }
}

/**
 * 将简体中文字符串转换为繁体中文（台湾）
 * 如果输入为 null 或空，直接返回原值
 */
export function toTraditional(text: string | null | undefined): string | null {
  if (!text) return text ?? null;
  try {
    return getConverter()(text);
  } catch {
    // 转换失败时 fallback 到原始文本，不崩溃
    return text;
  }
}

/**
 * 将简体中文字符串数组转换为繁体中文（台湾）
 */
export function toTraditionalArray(
  arr: string[] | null | undefined,
): string[] | null {
  if (!arr) return arr ?? null;
  const converter = getConverter();
  try {
    return arr.map((s) => converter(s));
  } catch {
    return arr;
  }
}

/**
 * 转换 LRC 格式歌词：保留时间戳，只转换文字部分
 */
export function toTraditionalLrc(
  lrc: string | null | undefined,
): string | null {
  if (!lrc) return lrc ?? null;
  const converter = getConverter();
  try {
    return lrc
      .split("\n")
      .map((line) => {
        // 匹配 [00:12.34] 格式的时间戳前缀，保留标签，只转换后面的文字
        const match = line.match(/^(\[.*?\])([\s\S]*)$/);
        if (match) {
          return match[1] + converter(match[2]);
        }
        return converter(line);
      })
      .join("\n");
  } catch {
    return lrc;
  }
}
