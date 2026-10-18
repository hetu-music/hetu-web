import { ChevronRight } from "lucide-react";
import React, { useState } from "react";
import type { ImageryCategory } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import { TEXT_BUTTON_CLASS } from "../kit/styles";
import type { CategoryNode } from "./types";

export const CategoryTreeNode = React.memo(function CategoryTreeNode({
  node,
  depth,
  imageryCountByCategory,
  onAddChild,
  onEdit,
}: {
  node: CategoryNode;
  depth: number;
  imageryCountByCategory: Map<number, number>;
  onAddChild: (parentId: number) => void;
  onEdit: (category: ImageryCategory) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = node.children.length > 0;
  const count = imageryCountByCategory.get(node.id) ?? 0;

  return (
    <div className={cn(depth > 0 && "ml-4")}>
      <div className="group flex items-baseline gap-2 py-1.5 text-sm">
        <button
          type="button"
          onClick={() => hasChildren && setExpanded((v) => !v)}
          aria-expanded={hasChildren ? expanded : undefined}
          className={cn(
            "flex min-w-0 flex-1 items-baseline gap-1.5 text-left",
            hasChildren
              ? "text-slate-700 dark:text-slate-300"
              : "cursor-default text-slate-600 dark:text-slate-400",
          )}
        >
          <ChevronRight
            size={12}
            className={cn(
              "shrink-0 translate-y-px text-slate-400 transition-transform",
              !hasChildren && "invisible",
              expanded && "rotate-90",
            )}
          />
          <span className="truncate">{node.name}</span>
          {count > 0 && (
            <span className="shrink-0 text-xs tabular-nums text-slate-400">
              {count}
            </span>
          )}
        </button>
        <span className="flex shrink-0 gap-3 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-within:opacity-100">
          {hasChildren && (
            <button
              type="button"
              onClick={() => onAddChild(node.id)}
              className={TEXT_BUTTON_CLASS}
            >
              加子类
            </button>
          )}
          <button
            type="button"
            onClick={() => onEdit(node)}
            className={TEXT_BUTTON_CLASS}
          >
            编辑
          </button>
        </span>
      </div>

      {!hasChildren && node.description && (
        <p className="mb-1 ml-[18px] truncate text-xs text-slate-400 dark:text-slate-500">
          {node.description}
        </p>
      )}

      {hasChildren && expanded && (
        <div className="border-l border-slate-200/70 dark:border-slate-800">
          {node.children.map((child) => (
            <CategoryTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              imageryCountByCategory={imageryCountByCategory}
              onAddChild={onAddChild}
              onEdit={onEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
});
