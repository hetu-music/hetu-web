/**
 * 带参数打开曲库链接时先藏住列表（见 docs/LIBRARY.md 阶段 4「1.」）。
 *
 * 服务端渲染的是默认状态（第一页、网格、不筛选）。地址栏带了影响列表的参数（LIST_PARAMS）时，
 * 页面里的内联脚本在首次绘制前给 <html> 加上 PENDING_ATTR，globals.css 据此把列表藏起来；
 * 页面按地址栏筛完后去掉（useListReveal）。最晚 REVEAL_TIMEOUT_MS 后无论如何都显示：
 * JS 加载失败时不至于一直空着，代价是网速很慢时可能先看到没筛过的列表。
 * 禁用 JS 时脚本本身不跑，列表照常显示。
 */
import { LIST_PARAMS } from "./url-state";

export const PENDING_ATTR = "data-library-pending";
/** 列表和分页的外框，globals.css 里按它藏 */
export const LIST_ID = "library-list";
export const REVEAL_TIMEOUT_MS = 3000;

export const PENDING_SCRIPT = `(function(){try{var p=new URLSearchParams(location.search),k=${JSON.stringify(LIST_PARAMS)};for(var i=0;i<k.length;i++)if(p.has(k[i])){var d=document.documentElement;d.setAttribute("${PENDING_ATTR}","");setTimeout(function(){d.removeAttribute("${PENDING_ATTR}")},${REVEAL_TIMEOUT_MS});return}}catch(e){}})()`;
