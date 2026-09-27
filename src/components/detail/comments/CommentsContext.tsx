"use client";

import { useUserContext } from "@/context/UserContext";
import { usePathname } from "@/i18n/navigation";
import {
  type AnchorContext,
  anchorForSlot,
  type CommentSlot,
  type CommentThread,
  groupComments,
} from "@/lib/utils/utils-comments";
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { useSongComments } from "./useSongComments";

interface CommentsContextValue {
  threads: Map<string, CommentThread[]>;
  anchorCtx: AnchorContext;
  loggedIn: boolean;
  loginHref: string;
  /** 宽屏：左栏里展开的那一处 */
  openSlot: string | null;
  setOpenSlot: (key: string | null) => void;
  /** 窄屏：底部面板打开的那一处 */
  sheetSlot: CommentSlot | null;
  setSheetSlot: (slot: CommentSlot | null) => void;
  create: (
    slot: CommentSlot,
    body: string,
    isPrivate: boolean,
  ) => Promise<void>;
  reply: (parentId: number, body: string) => Promise<void>;
  edit: (id: number, body: string) => Promise<void>;
  remove: (id: number) => Promise<void>;
  like: (id: number, liked: boolean) => void;
}

const CommentsContext = createContext<CommentsContextValue | null>(null);

export function useComments(): CommentsContextValue {
  const value = useContext(CommentsContext);
  if (!value)
    throw new Error("useComments must be used within CommentsProvider");
  return value;
}

export function CommentsProvider({
  songId,
  anchorCtx,
  onSheetOpen,
  children,
}: {
  songId: number;
  anchorCtx: AnchorContext;
  /** 底部面板打开时通知外层，好收起意象说明条 */
  onSheetOpen?: () => void;
  children: React.ReactNode;
}) {
  const { user } = useUserContext();
  const pathname = usePathname();
  const api = useSongComments(songId);
  const [openSlot, setOpenSlot] = useState<string | null>(null);
  const [sheetSlot, setSheetSlotState] = useState<CommentSlot | null>(null);
  const setSheetSlot = useCallback(
    (slot: CommentSlot | null) => {
      if (slot) onSheetOpen?.();
      setSheetSlotState(slot);
    },
    [onSheetOpen],
  );

  const threads = useMemo(
    () => groupComments(api.comments, anchorCtx),
    [api.comments, anchorCtx],
  );

  const { create: apiCreate, edit: apiEdit, remove: apiRemove, like } = api;
  const create = useCallback(
    async (slot: CommentSlot, body: string, isPrivate: boolean) => {
      await apiCreate({
        ...anchorForSlot(slot, anchorCtx),
        body,
        private: isPrivate,
      });
    },
    [apiCreate, anchorCtx],
  );
  const reply = useCallback(
    async (parentId: number, body: string) => {
      await apiCreate({ parentId, body });
    },
    [apiCreate],
  );
  const edit = useCallback(
    async (id: number, body: string) => {
      await apiEdit({ id, body });
    },
    [apiEdit],
  );
  const remove = useCallback(
    async (id: number) => {
      await apiRemove(id);
    },
    [apiRemove],
  );
  const toggleLike = useCallback(
    (id: number, liked: boolean) => like({ id, liked }),
    [like],
  );

  const value = useMemo<CommentsContextValue>(
    () => ({
      threads,
      anchorCtx,
      loggedIn: !!user,
      loginHref: `/login?next=${encodeURIComponent(pathname)}`,
      openSlot,
      setOpenSlot,
      sheetSlot,
      setSheetSlot,
      create,
      reply,
      edit,
      remove,
      like: toggleLike,
    }),
    [
      threads,
      anchorCtx,
      user,
      pathname,
      openSlot,
      sheetSlot,
      setSheetSlot,
      create,
      reply,
      edit,
      remove,
      toggleLike,
    ],
  );

  return (
    <CommentsContext.Provider value={value}>
      {children}
    </CommentsContext.Provider>
  );
}
