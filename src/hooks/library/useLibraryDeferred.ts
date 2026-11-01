"use client";

/**
 * 加载曲库页的第二档（src/components/library/deferred.ts，见 docs/LIBRARY.md 阶段 4「2.」）。
 *
 * 平时等页面空闲再加载，用户第一次点搜索框、筛选按钮时基本已经到了；
 * needNow（地址栏带了搜索、人名曲风，或展开了筛选面板）时挂载后立即加载。
 * 模块加载过一次就留在内存里，从详情页返回时同步可用，不再等。
 */
import { useEffect, useMemo, useState } from "react";
import type { LibraryEngine } from "@/lib/library/engine";
import { whenIdle } from "@/lib/utils/idle";
import type { Song } from "@/lib/types";

type DeferredModule = typeof import("@/components/library/deferred");

let loaded: DeferredModule | null = null;
let loading: Promise<DeferredModule> | null = null;

function load(): Promise<DeferredModule> {
  loading ??= import("@/components/library/deferred").then(
    (mod) => (loaded = mod),
    (error: unknown) => {
      // 下次再试（比如网络恢复后用户又点了搜索）
      loading = null;
      throw error;
    },
  );
  return loading;
}

/** 一份曲库一个 engine；返回曲库时 initialSongsData 还是同一个数组就不重建 */
const engines = new WeakMap<Song[], LibraryEngine>();

export function useLibraryDeferred(songs: Song[], needNow: boolean) {
  // 水合时一定是 null（加载在挂载之后才开始），和服务端一致
  const [mod, setMod] = useState<DeferredModule | null>(loaded);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (mod) return;
    let cancelled = false;
    const run = () => {
      load().then(
        (m) => {
          if (cancelled) return;
          setMod(m);
          setFailed(false);
        },
        () => {
          if (!cancelled) setFailed(true);
        },
      );
    };
    if (needNow) {
      run();
      return () => {
        cancelled = true;
      };
    }
    const cancelIdle = whenIdle(run, { timeout: 3000 });
    return () => {
      cancelled = true;
      cancelIdle();
    };
  }, [mod, needNow]);

  const engine = useMemo(() => {
    if (!mod) return null;
    let engine = engines.get(songs);
    if (!engine) {
      engine = mod.createLibraryEngine(songs);
      engines.set(songs, engine);
    }
    return engine;
  }, [mod, songs]);

  return {
    engine,
    /** 筛选面板；没到时 null */
    SongFilters: mod?.SongFilters ?? null,
    /** 加载失败：不再等它，列表照常显示 */
    failed,
  };
}
