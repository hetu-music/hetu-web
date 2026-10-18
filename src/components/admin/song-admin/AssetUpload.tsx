"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { apiCheckFileExists } from "@/lib/api/client-api";
import { cn } from "@/lib/utils/utils";
import { notify } from "../kit/toast";
import { OUTLINE_BUTTON_CLASS } from "../kit/styles";

const MAX_BYTES = 100 * 1024 * 1024;

/** 封面与乐谱只差格式与接口，原先两个组件逐行相同 */
const KINDS = {
  cover: {
    label: "封面",
    format: "JPG",
    accept: ".jpg,.jpeg,image/jpeg",
    matches: (type: string) => type.includes("jpeg") || type.includes("jpg"),
    endpoint: "/api/admin/upload-cover",
  },
  score: {
    label: "乐谱",
    format: "PNG",
    accept: ".png,image/png",
    matches: (type: string) => type.includes("png"),
    endpoint: "/api/admin/upload-score",
  },
} as const;

export default function AssetUpload({
  kind,
  songId,
  csrfToken,
  onUploaded,
}: {
  kind: keyof typeof KINDS;
  songId: number;
  csrfToken: string;
  onUploaded?: () => void;
}) {
  const config = KINDS[kind];
  const [uploading, setUploading] = useState(false);
  const [exists, setExists] = useState<boolean | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    void apiCheckFileExists(songId, kind, csrfToken)
      .then((result) => active && setExists(result?.exists ?? false))
      .catch((error) => {
        console.error(`Check ${kind} failed:`, error);
        if (active) setExists(false);
      });
    return () => {
      active = false;
    };
  }, [csrfToken, kind, songId]);

  const upload = async (file: File) => {
    if (!config.matches(file.type)) {
      notify({ type: "error", text: `只允许上传 ${config.format} 格式` });
      return;
    }
    if (file.size > MAX_BYTES) {
      notify({ type: "error", text: "文件大小不能超过 100MB" });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("songId", String(songId));
      const response = await fetch(config.endpoint, {
        method: "POST",
        headers: { "X-CSRF-Token": csrfToken },
        body: formData,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "上传失败");
      setExists(true);
      notify({
        type: "success",
        text: result.message || `${config.label}已上传`,
      });
      onUploaded?.();
    } catch (error) {
      notify({
        type: "error",
        text: error instanceof Error ? error.message : "上传失败",
      });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className={OUTLINE_BUTTON_CLASS}
      >
        {uploading && <Loader2 size={14} className="animate-spin" />}
        {uploading
          ? "上传中…"
          : exists
            ? `替换${config.label}`
            : `上传${config.label}`}
      </button>
      <span
        className={cn(
          "text-xs",
          exists
            ? "text-slate-500 dark:text-slate-400"
            : "text-slate-400 dark:text-slate-500",
        )}
      >
        {exists === null ? "检查中…" : exists ? "已上传" : "未上传"}
        <span className="mx-2 text-slate-300 dark:text-slate-600">·</span>
        {config.format}，不超过 100MB
      </span>
      <input
        ref={inputRef}
        type="file"
        accept={config.accept}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
        className="hidden"
      />
    </div>
  );
}
