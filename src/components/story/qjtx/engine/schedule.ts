/**
 * 把事件与各回的拍排成一条轴：滚动位置（以屏为单位）→ 落在哪一拍、走到几成。
 * 一切画面状态都由这个位置算出来，所以倒着滚和正着滚看到的完全一样。
 */

import type { Beat, Scene, SpineConfig, StoryEvent } from "./types";

/** 阅读线：笔尖停在屏幕高度的这个位置 */
export const TIP = 0.55;

export type EntryKind = "opening" | "event" | "chapter" | "end";

export interface Entry {
  kind: EntryKind;
  /** 起点，屏 */
  start: number;
  length: number;
  /** 这一段里卷面是否跟着走（编年在走，回内定住） */
  advances: boolean;
  /** 进入这一段时卷面已走过的距离，屏 */
  worldStart: number;
  event?: StoryEvent;
  scene?: Scene;
  beat?: Beat;
  beatIndex?: number;
}

export interface StoryNode {
  event: StoryEvent;
  /** 节点在卷面上的位置（屏）：卷面走到 world - TIP 时，笔尖正好到这里 */
  world: number;
}

export interface Schedule {
  entries: Entry[];
  nodes: StoryNode[];
  /** 总长，屏 */
  total: number;
}

const OPENING_LENGTH = 1.6;
const END_LENGTH = 1.2;

export function buildSchedule(
  events: StoryEvent[],
  scenes: Record<string, Scene>,
  spine: SpineConfig,
): Schedule {
  const entries: Entry[] = [];
  const nodes: StoryNode[] = [];
  let start = 0;
  let world = 0;

  const push = (entry: Omit<Entry, "start" | "worldStart">) => {
    entries.push({ ...entry, start, worldStart: world });
    start += entry.length;
    if (entry.advances) world += entry.length;
  };

  push({ kind: "opening", length: OPENING_LENGTH, advances: false });

  for (const event of events) {
    const scene = event.important ? scenes[String(event.id)] : undefined;
    if (!scene) {
      // 笔尖在这一段的正中经过节点
      nodes.push({ event, world: world + spine.eventLength / 2 + TIP });
      push({ kind: "event", length: spine.eventLength, advances: true, event });
      continue;
    }
    scene.beats.forEach((beat, beatIndex) => {
      const advances = beat.kind === "come";
      if (advances) nodes.push({ event, world: world + beat.length + TIP });
      push({
        kind: "chapter",
        length: beat.length,
        advances,
        event,
        scene,
        beat,
        beatIndex,
      });
    });
  }

  push({ kind: "end", length: END_LENGTH, advances: true });

  return { entries, nodes, total: start };
}

export interface Located {
  entry: Entry;
  index: number;
  /** 本段内走到几成，0..1 */
  progress: number;
  /** 卷面已走过的距离，屏 */
  world: number;
}

export function locate(schedule: Schedule, position: number): Located {
  const { entries } = schedule;
  const p = Math.min(Math.max(position, 0), schedule.total - 1e-6);
  let lo = 0;
  let hi = entries.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (entries[mid].start <= p) lo = mid;
    else hi = mid - 1;
  }
  const entry = entries[lo];
  const progress = entry.length > 0 ? (p - entry.start) / entry.length : 1;
  const world = entry.worldStart + (entry.advances ? progress * entry.length : 0);
  return { entry, index: lo, progress, world };
}

/** 某一回某一拍在轴上的起点（屏），调参面板跳转用 */
export function beatStart(
  schedule: Schedule,
  sceneId: number,
  beatIndex: number,
): number | null {
  const entry = schedule.entries.find(
    (e) => e.scene?.id === sceneId && e.beatIndex === beatIndex,
  );
  return entry ? entry.start : null;
}
