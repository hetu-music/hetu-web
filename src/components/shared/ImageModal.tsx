"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  RotateCw,
  RefreshCw,
  HelpCircle,
} from "lucide-react";

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  src: string;
  alt: string;
  title?: string;
}

const ImageModal: React.FC<ImageModalProps> = ({
  isOpen,
  onClose,
  src,
  alt,
  title,
}) => {
  const t = useTranslations("common.imageViewer");

  // 关闭时调用方会立刻把 src 清空，面板却还在放退场动画；留着上一张图，
  // 否则 <img> 拿到空 src 会报错
  const [shown, setShown] = useState({ src, alt, title });
  if (
    isOpen &&
    src &&
    (src !== shown.src || alt !== shown.alt || title !== shown.title)
  ) {
    setShown({ src, alt, title });
  }
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [lastTouchDistance, setLastTouchDistance] = useState(0);
  const [lastTouchTime, setLastTouchTime] = useState(0);
  const [touchCount, setTouchCount] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const imageRef = useRef<HTMLDivElement>(null);

  // 重置状态
  const resetTransform = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setRotation(0);
  }, []);

  // 缩放控制
  const zoomIn = useCallback(() => {
    setScale((prev) => Math.min(prev * 1.5, 5));
  }, []);

  const zoomOut = useCallback(() => {
    setScale((prev) => Math.max(prev / 1.5, 0.5));
  }, []);

  // 旋转控制
  const rotateClockwise = useCallback(() => {
    setRotation((prev) => (prev + 90) % 360);
  }, []);

  const rotateCounterClockwise = useCallback(() => {
    setRotation((prev) => (prev - 90 + 360) % 360);
  }, []);

  // 禁用浏览器默认的触摸与页面缩放，双指只缩放图片。锁滚动交给 Dialog
  useEffect(() => {
    if (isOpen) {
      const body = document.body;
      const prevTouchAction = body.style.touchAction;
      const prevUserSelect = body.style.userSelect;
      body.style.touchAction = "none";
      body.style.userSelect = "none";

      // 添加viewport meta标签来禁用缩放（如果不存在）
      let viewportMeta = document.querySelector(
        'meta[name="viewport"]',
      ) as HTMLMetaElement;
      let originalViewportContent = "";

      if (viewportMeta) {
        originalViewportContent = viewportMeta.content;
        viewportMeta.content =
          "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no";
      } else {
        viewportMeta = document.createElement("meta");
        viewportMeta.name = "viewport";
        viewportMeta.content =
          "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no";
        document.head.appendChild(viewportMeta);
      }

      return () => {
        body.style.touchAction = prevTouchAction;
        body.style.userSelect = prevUserSelect;

        // 恢复原始viewport设置
        if (originalViewportContent) {
          viewportMeta.content = originalViewportContent;
        } else {
          viewportMeta.remove();
        }
      };
    }
  }, [isOpen]);

  // 处理键盘事件
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Esc 由 Dialog 处理
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        zoomIn();
      } else if (event.key === "-") {
        event.preventDefault();
        zoomOut();
      } else if (event.key === "0") {
        event.preventDefault();
        resetTransform();
      } else if (event.key === "r" || event.key === "R") {
        event.preventDefault();
        rotateClockwise();
      } else if (event.key === "l" || event.key === "L") {
        event.preventDefault();
        rotateCounterClockwise();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    isOpen,
    zoomIn,
    zoomOut,
    resetTransform,
    rotateClockwise,
    rotateCounterClockwise,
  ]);

  // 切换提示显示
  const toggleHint = useCallback(() => {
    setShowHint((prev) => !prev);
  }, []);

  // 鼠标拖拽
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (scale > 1) {
        setIsDragging(true);
        setDragStart({
          x: e.clientX - position.x,
          y: e.clientY - position.y,
        });
      }
    },
    [scale, position],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging && scale > 1) {
        setPosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        });
      }
    },
    [isDragging, scale, dragStart],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 计算两个触摸点之间的距离
  const getTouchDistance = useCallback((touches: React.TouchList) => {
    if (touches.length < 2) return 0;
    const touch1 = touches[0];
    const touch2 = touches[1];
    return Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2),
    );
  }, []);

  // 触摸开始
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();

      if (e.touches.length === 1) {
        const currentTime = Date.now();
        const timeDiff = currentTime - lastTouchTime;

        // 检测双击（300ms内的第二次点击）
        if (timeDiff < 300 && touchCount === 1) {
          // 双击事件
          if (scale === 1) {
            setScale(2);
          } else {
            resetTransform();
          }
          setTouchCount(0);
          setLastTouchTime(0);
          return;
        }

        // 记录单击
        setTouchCount(1);
        setLastTouchTime(currentTime);

        // 延迟检查是否为单击（如果300ms内没有第二次点击）
        setTimeout(() => {
          setTouchCount(0);
        }, 300);

        // 单指拖拽
        if (scale > 1) {
          setIsDragging(true);
          setDragStart({
            x: e.touches[0].clientX - position.x,
            y: e.touches[0].clientY - position.y,
          });
        }
      } else if (e.touches.length === 2) {
        // 双指缩放
        setIsDragging(false);
        setTouchCount(0); // 重置双击计数
        const distance = getTouchDistance(e.touches);
        setLastTouchDistance(distance);
      }
    },
    [
      scale,
      position,
      getTouchDistance,
      lastTouchTime,
      touchCount,
      resetTransform,
    ],
  );

  // 触摸移动
  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();

      if (e.touches.length === 1 && isDragging && scale > 1) {
        // 单指拖拽
        setPosition({
          x: e.touches[0].clientX - dragStart.x,
          y: e.touches[0].clientY - dragStart.y,
        });
      } else if (e.touches.length === 2) {
        // 双指缩放
        const distance = getTouchDistance(e.touches);
        if (lastTouchDistance > 0) {
          const scaleChange = distance / lastTouchDistance;
          setScale((prev) => Math.min(Math.max(prev * scaleChange, 0.5), 5));
        }
        setLastTouchDistance(distance);
      }
    },
    [isDragging, scale, dragStart, lastTouchDistance, getTouchDistance],
  );

  // 触摸结束
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();

    // 只有在没有剩余触摸点时才重置状态
    if (e.touches.length === 0) {
      setIsDragging(false);
      setLastTouchDistance(0);
    }
  }, []);

  // 滚轮缩放处理
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (isOpen && imageRef.current?.contains(e.target as Node)) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        setScale((prev) => Math.min(Math.max(prev * delta, 0.5), 5));
      }
    };

    if (isOpen) {
      // 使用 passive: false 来允许 preventDefault
      document.addEventListener("wheel", handleWheel, { passive: false });
    }

    return () => {
      document.removeEventListener("wheel", handleWheel);
    };
  }, [isOpen]);

  // 全局触摸事件处理 - 防止浏览器默认行为
  useEffect(() => {
    if (isOpen) {
      const preventDefaultTouch = (e: TouchEvent) => {
        // 只在模态框打开时阻止默认行为
        if (e.touches.length > 1) {
          // 多指触摸时总是阻止默认行为
          e.preventDefault();
        }
      };

      const preventDefaultGesture = (e: Event) => {
        e.preventDefault();
      };

      // 添加事件监听器
      document.addEventListener("touchstart", preventDefaultTouch, {
        passive: false,
      });
      document.addEventListener("touchmove", preventDefaultTouch, {
        passive: false,
      });
      document.addEventListener("gesturestart", preventDefaultGesture, {
        passive: false,
      });
      document.addEventListener("gesturechange", preventDefaultGesture, {
        passive: false,
      });
      document.addEventListener("gestureend", preventDefaultGesture, {
        passive: false,
      });

      return () => {
        document.removeEventListener("touchstart", preventDefaultTouch);
        document.removeEventListener("touchmove", preventDefaultTouch);
        document.removeEventListener("gesturestart", preventDefaultGesture);
        document.removeEventListener("gesturechange", preventDefaultGesture);
        document.removeEventListener("gestureend", preventDefaultGesture);
      };
    }
  }, [isOpen]);

  // 双击重置
  const handleDoubleClick = useCallback(() => {
    if (scale === 1) {
      setScale(2);
    } else {
      resetTransform();
    }
  }, [scale, resetTransform]);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      // 退场放完再复原缩放和旋转。放在打开时复原的话，上次放大过的图会先以放大的样子出现再缩回去
      onOpenChangeComplete={(open) => {
        if (!open) {
          resetTransform();
          setShowHint(false);
        }
      }}
    >
      <DialogContent
        variant="viewer"
        aria-label={shown.title ? undefined : shown.alt}
        className="flex items-center justify-center p-4"
        style={{ touchAction: "none" }}
      >
        {/* 图片标题 - 左上角 */}
        {shown.title && (
          <div className="absolute top-4 left-4 z-10">
            <DialogTitle className="text-white dark:text-white text-lg font-semibold bg-black/30 backdrop-blur-sm px-4 py-2 rounded-full">
              {shown.title}
            </DialogTitle>
          </div>
        )}

        {/* Hint 和关闭按钮 - 右上角 */}
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          <button
            onClick={toggleHint}
            className="p-2 rounded-full bg-black/30 backdrop-blur-sm border border-white/20 text-white/70 hover:text-white hover:bg-black/40 transition-all duration-200"
            aria-label={t("help")}
            title={t("help")}
          >
            <HelpCircle size={18} />
          </button>

          <button
            onClick={onClose}
            className="p-2 rounded-full bg-black/30 backdrop-blur-sm border border-white/20 text-white/70 hover:text-white hover:bg-black/40 transition-all duration-200"
            aria-label={t("close")}
            title={`${t("close")} (Esc)`}
          >
            <X size={18} />
          </button>
        </div>

        {/* 操作提示弹窗 - 屏幕中央 */}
        {showHint && (
          <div
            className="absolute inset-0 flex items-center justify-center z-20"
            onClick={toggleHint}
          >
            <div
              className="bg-black/80 backdrop-blur-sm text-white p-6 rounded-2xl border border-white/20 max-w-md mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-4">
                <h3 className="text-lg font-semibold">{t("help")}</h3>
              </div>
              <div className="space-y-2 text-sm text-white/90">
                <div>• {t("hintZoom")}</div>
                <div>• {t("hintDoubleClick")}</div>
                <div>• {t("hintDrag")}</div>
                <div>• {t("hintRotate")}</div>
                <div>• {t("hintReset")}</div>
                <div>• {t("hintClose")}</div>
              </div>
            </div>
          </div>
        )}

        {/* 图片容器 - 占满整个屏幕。开合时只有图片微微缩放，周围的标题和工具栏只淡入淡出 */}
        <div
          className="absolute inset-0 flex items-center justify-center overflow-hidden transition-[scale] duration-300 ease-page group-data-starting-style:scale-95 group-data-ending-style:scale-95 group-data-ending-style:duration-200"
          style={{ touchAction: "none" }}
        >
          <div
            ref={imageRef}
            className="relative select-none flex items-center justify-center w-full h-full"
            style={{
              transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px) rotate(${rotation}deg)`,
              transition: isDragging ? "none" : "transform 0.2s ease-out",
              cursor:
                scale > 1 ? (isDragging ? "grabbing" : "grab") : "default",
              touchAction: "none",
              userSelect: "none",
              WebkitUserSelect: "none",
              WebkitTouchCallout: "none",
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onDoubleClick={handleDoubleClick}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {shown.src && (
              <Image
                src={shown.src}
                alt={shown.alt}
                width={1200}
                height={800}
                // 加载完再淡入，不在面板淡入之后突然冒出来
                onLoad={() => setLoadedSrc(shown.src)}
                className={`max-w-full max-h-full object-contain transition-opacity duration-300 ease-page ${
                  loadedSrc === shown.src ? "opacity-100" : "opacity-0"
                }`}
                style={{ objectFit: "contain" }}
                priority
                draggable={false}
              />
            )}
          </div>
        </div>

        {/* 控制按钮组 - 小屏居中，大屏右下角 */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 sm:left-auto sm:right-4 sm:translate-x-0 z-10 max-w-[calc(100vw-1rem)] sm:max-w-none px-2 sm:px-0">
          <div className="flex items-center gap-1.5 sm:gap-2 bg-black/30 backdrop-blur-sm px-3 sm:px-4 py-3 rounded-full border border-white/10 overflow-x-auto scrollbar-hide">
            <button
              onClick={zoomOut}
              className="p-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white hover:bg-white/20 transition-all duration-200 shrink-0"
              aria-label={t("zoomOut")}
              title={`${t("zoomOut")} (-)`}
            >
              <ZoomOut size={16} />
            </button>

            <span className="text-white text-sm min-w-[2.8rem] sm:min-w-12 text-center shrink-0">
              {Math.round(scale * 100)}%
            </span>

            <button
              onClick={zoomIn}
              className="p-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white hover:bg-white/20 transition-all duration-200 shrink-0"
              aria-label={t("zoomIn")}
              title={`${t("zoomIn")} (+)`}
            >
              <ZoomIn size={16} />
            </button>

            <div className="w-px h-5 sm:h-6 bg-white/20 mx-1 shrink-0"></div>

            <button
              onClick={rotateCounterClockwise}
              className="p-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white hover:bg-white/20 transition-all duration-200 shrink-0"
              aria-label={t("rotateLeft")}
              title={`${t("rotateLeft")} (L)`}
            >
              <RotateCcw size={16} />
            </button>

            <button
              onClick={rotateClockwise}
              className="p-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white hover:bg-white/20 transition-all duration-200 shrink-0"
              aria-label={t("rotateRight")}
              title={`${t("rotateRight")} (R)`}
            >
              <RotateCw size={16} />
            </button>

            <div className="w-px h-5 sm:h-6 bg-white/20 mx-1 shrink-0"></div>

            <button
              onClick={resetTransform}
              className="p-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white hover:bg-white/20 transition-all duration-200 shrink-0"
              aria-label={t("reset")}
              title={`${t("reset")} (0)`}
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImageModal;
