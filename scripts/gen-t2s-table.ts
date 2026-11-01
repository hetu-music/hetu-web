/* eslint-disable no-console */
/**
 * 生成搜索归一化用的逐字繁转简表 src/lib/search/t2s.json（见 docs/LIBRARY.md 阶段 2）。
 * 生成后提交；只在升级 opencc-js 时重跑。
 *
 * 用法：pnpm exec tsx scripts/gen-t2s-table.ts
 *
 * 取 opencc 的 TSCharacters（繁→简）里一个字对一个字的条目，再把 TWVariantsRev
 * （台湾异体字→标准繁体）接到前面，这样台湾字形（如「啟」「為」）也能转回简体。
 * 一个字有几个简体候选时取第一个，与 opencc 的默认选择一致。
 *
 * 输出是一个字符串，繁简两两相接：「繁简繁简…」。比对象省一半体积。
 */
import fs from "fs";
import path from "path";

const DICT_DIR = path.join(
  "node_modules",
  "opencc-js",
  "dist",
  "esm-lib",
  "dict",
);
const OUT = path.join("src", "lib", "search", "t2s.json");

/** 读 opencc-js 的字典模块：export default "键 值 值|键 值|…" */
function parseDict(name: string): Map<string, string> {
  const src = fs.readFileSync(path.join(DICT_DIR, `${name}.js`), "utf8");
  const body = src.slice(src.indexOf('"') + 1, src.lastIndexOf('"'));
  const map = new Map<string, string>();
  for (const entry of body.split("|")) {
    const [key, value] = entry.split(" ");
    if (!key || !value) continue;
    // 只要一个字对一个字，且 UTF-16 长度相同：归一化后的位置表要一一对应
    if ([...key].length !== 1 || [...value].length !== 1) continue;
    if (key.length !== value.length) continue;
    map.set(key, value);
  }
  return map;
}

function main() {
  const ts = parseDict("TSCharacters");
  const twRev = parseDict("TWVariantsRev");

  // 本身就是简体字的不动：TWVariantsRev 里有「么→幺」，照搬会把简体的「什么」转成「什幺」
  const simplifiedChars = new Set(ts.values());
  const t2s = new Map<string, string>(ts);
  for (const [variant, standard] of twRev) {
    if (simplifiedChars.has(variant)) continue;
    const simplified = ts.get(standard) ?? standard;
    if (simplified.length === variant.length) t2s.set(variant, simplified);
  }
  // 链式的条目（「薴→苧」「苧→苎」）一直转到底，保证转一次就到简体
  for (const [k, v] of t2s) {
    let target = v;
    for (
      let i = 0;
      i < 4 && t2s.has(target) && t2s.get(target) !== target;
      i++
    ) {
      target = t2s.get(target) as string;
    }
    t2s.set(k, target);
  }
  for (const [k, v] of t2s) if (k === v) t2s.delete(k);

  // 转出来的字不能再被转一次，否则同一个字在简体原文和繁体页上会归一化成不同的字
  const unstable = [...t2s].filter(([, v]) => {
    const again = t2s.get(v);
    return again !== undefined && again !== v;
  });
  if (unstable.length > 0) {
    throw new Error(
      `转换不稳定：${unstable.map(([k, v]) => `${k}→${v}→${t2s.get(v)}`).join("、")}`,
    );
  }

  let pairs = "";
  for (const [k, v] of [...t2s].sort(([a], [b]) => (a < b ? -1 : 1))) {
    pairs += k + v;
  }
  fs.writeFileSync(OUT, JSON.stringify(pairs) + "\n");
  console.log(`${OUT}：${t2s.size} 个字`);
}

main();
