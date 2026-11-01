/**
 * 曲库页的第二档（见 docs/LIBRARY.md 阶段 4「2.」）：筛选面板（Base UI 的下拉框、滑轨）和
 * engine.ts（归一化、繁转简、搜索内核）放进同一个 chunk，一次加载。不在首屏路径上，
 * 由 useLibraryDeferred 在页面空闲时预加载；地址栏带了搜索、人名曲风或展开了面板时挂载后立即加载。
 * 只能用 import() 引用这个文件，静态引用就又回到首屏了。
 */
export { createLibraryEngine } from "@/lib/library/engine";
export { default as SongFilters } from "./SongFilters";
