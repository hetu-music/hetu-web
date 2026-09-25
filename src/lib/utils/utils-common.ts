// 格式化时间
export function formatTime(seconds: number | null): string {
  if (!seconds || isNaN(seconds)) return "未知";
  const min = Math.floor(seconds / 60);
  const sec = (seconds % 60).toString().padStart(2, "0");
  return `${min}:${sec}`;
}

// 格式化日期为"年月日"格式
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "未知";
  try {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}年${month}月${day}日`;
  } catch {
    return dateStr;
  }
}

// Admin 页面函数
// 通用防抖函数（适用于回调/输入等场景）
export function debounce<Args extends unknown[]>(
  func: (...args: Args) => void,
  wait: number,
): (...args: Args) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// 工具函数：将对象中的空字符串转为 null
export function convertEmptyStringToNull<T>(obj: T): T {
  if (Array.isArray(obj)) {
    return obj.map(convertEmptyStringToNull) as T;
  } else if (obj && typeof obj === "object") {
    const newObj: Record<string, unknown> = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const val = (obj as Record<string, unknown>)[key];
        if (val === "") {
          newObj[key] = null;
        } else if (Array.isArray(val)) {
          newObj[key] = val.map((item) => (item === "" ? null : item));
        } else {
          newObj[key] = val;
        }
      }
    }
    return newObj as T;
  }
  return obj;
}

// 字段格式化工具（用于表格/详情展示）
export function formatField(
  val: unknown,
  type: "text" | "number" | "array" | "boolean" | "date" | "textarea",
): string {
  if (val == null) return "-";
  if (type === "array")
    return Array.isArray(val) ? (val as string[]).join(", ") : String(val);
  if (type === "boolean") return val ? "是" : "否";
  if (type === "date") return val ? String(val).slice(0, 10) : "-";
  if (type === "textarea" && typeof val === "string" && val.length > 50) {
    return val.substring(0, 50) + "...";
  }
  return String(val);
}

/**
 * 把对象序列化为可安全嵌入 <script type="application/ld+json"> 的字符串。
 *
 * JSON.stringify 不会转义 `<`，因此内容里出现 `</script>` 就能提前闭合标签
 * 逃逸出脚本块。JSON-LD 的字段取自数据库（意象分类名、故事标题等），属于
 * 可被编辑的内容，必须转义后再写入。
 *
 * 公开页面是 ISR、CSP 带 'unsafe-inline'，没有 CSP 兜底，这里是唯一防线。
 * 同时转义 U+2028/U+2029——它们在 JSON 里合法，但在 JS 源码中是换行符。
 */
export function serializeJsonLd(data: unknown): string {
  // 统一用 replacer 生成 \uXXXX 转义，避免逐条手写转义字面量时出错
  return JSON.stringify(data).replace(
    /[<>&\u2028\u2029]/g,
    (char) => "\\u" + char.charCodeAt(0).toString(16).padStart(4, "0"),
  );
}

// 带超时的 fetch
//
// 原生 fetch 不带超时：外部服务不回包时，请求会一直挂到操作系统的 TCP 超时
// （Linux 默认两分钟以上），期间连接和内存都占着。所有对外请求都应该走这里。
//
// 超时抛 TimeoutError（DOMException），调用方现有的 try/catch 即可接住。
// 调用方自己传了 signal 时以调用方的为准。
export function fetchWithTimeout(
  input: string | URL | Request,
  init: RequestInit = {},
  timeoutMs = 5000,
): Promise<Response> {
  return fetch(input, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(timeoutMs),
  });
}
