import type { StoryEvent } from "./engine/types";
import type { TimelineEvent } from "./types";

/** story_qjtx 的行（经 getQjtxTimeline 映射后）→ 滚动叙事用的事件 */
export function toStoryEvent(event: TimelineEvent): StoryEvent {
  return {
    id: Number(event.id),
    year: event.year ?? "",
    month: event.month && event.month !== "无考" ? event.month : undefined,
    content: event.content ?? [],
    important: !!event.important,
    detail: event.detail
      ? {
          title: event.detail.title,
          quote: event.detail.quote,
          body: event.detail.body,
          closing: event.detail.closing,
        }
      : undefined,
  };
}
