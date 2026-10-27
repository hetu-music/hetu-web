"use client";

import { SPLIT_FONT_STYLESHEETS } from "@/lib/split-fonts";
import { ensureSplitFontStyles } from "@/lib/utils/font-preload";
import { useEffect } from "react";
import { preload } from "react-dom";

/**
 * 挂上楷体、刻本、霞鹜等宽的分片 @font-face 表（见 lib/split-fonts）。
 *
 * 每张表要列出上千个分片的 unicode-range，gzip 后仍有几十 KB，写成普通
 * <link rel="stylesheet"> 会阻塞首屏渲染。字体本来就是 swap，晚到只是先用
 * 备用字体，所以服务端只低优先级预取，水合后再由脚本插入（脚本插入的样式表
 * 不阻塞渲染）。
 */
export function SplitFontStyles() {
  for (const href of SPLIT_FONT_STYLESHEETS) {
    preload(href, { as: "style", fetchPriority: "low" });
  }

  useEffect(() => {
    ensureSplitFontStyles();
  }, []);

  return null;
}
