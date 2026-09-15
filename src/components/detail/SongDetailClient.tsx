"use client";

import NaviPlayer from "@/components/detail/NaviPlayer";
import TableOfContents from "@/components/detail/TableOfContents";
import UserReview from "@/components/detail/UserReview";
import FavoriteButton from "@/components/shared/FavoriteButton";
import FloatingActionButtons from "@/components/shared/FloatingActionButtons";
import ImageModal from "@/components/shared/ImageModal";
import LocaleSwitcher from "@/components/shared/LocaleSwitcher";
import MoreMenu from "@/components/shared/MoreMenu";
import ThemeToggle from "@/components/shared/ThemeToggle";
import { useUserContext } from "@/context/UserContext";
import { useScrollTop } from "@/hooks/ui/useScrollTop";
import { usePathname, useRouter } from "@/i18n/navigation";
import { getGenreTagStyle, getTypeTagStyle } from "@/lib/constants";
import { SongDetailClientProps } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import {
  calculateSongInfo,
  getCoverUrl,
  getNmnUrl,
} from "@/lib/utils/utils-song";
import {
  ArrowLeft,
  Disc,
  ExternalLink,
  FileText,
  Home,
  Info,
  LayoutTemplate,
  Mic2,
  PenTool,
  User,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import React, { useCallback, useEffect, useMemo, useState } from "react";

const SongDetailClient: React.FC<SongDetailClientProps> = ({ song }) => {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("song");
  const tNav = useTranslations("common.nav");
  const tCommon = useTranslations("common");
  const tEnum = useTranslations("enums");
  const { user, loaded: userLoaded } = useUserContext();

  const hasBenefits = userLoaded && !!user?.hasBenefits;

  const openUserPanel = (tab: "account" | "favorites" = "favorites") => {
    if (!user) {
      const next = encodeURIComponent(pathname + window.location.search);
      router.push(`/login?next=${next}`);
      return;
    }
    const d = parseInt(
      sessionStorage.getItem("__hetu_web_nav_depth") || "0",
      10,
    );
    sessionStorage.setItem("__hetu_web_nav_depth", String(d + 1));
    router.push(`/profile?tab=${tab}`);
  };

  const { showScrollTop, scrollToTop } = useScrollTop();
  const [lyricsType, setLyricsType] = useState<"normal" | "lrc">("normal");
  const [imageModal, setImageModal] = useState<{
    isOpen: boolean;
    src: string;
    alt: string;
    title: string;
  }>({
    isOpen: false,
    src: "",
    alt: "",
    title: "",
  });
  const [coverImageLoaded, setCoverImageLoaded] = useState(true);
  const [scoreImageLoaded, setScoreImageLoaded] = useState(true);
  const [animationReady, setAnimationReady] = useState(false);

  // songInfo 计算逻辑
  const songInfo = useMemo(() => {
    return calculateSongInfo(song, t, tCommon, tEnum);
  }, [song, t, tCommon, tEnum]);

  // 歌词按行拆分后逐行渲染。整段文本配 whitespace-pre-line 时，浏览器把歌词
  // 视为一个几十行的块，text-wrap: balance 会因超出实现的行数上限而失效；窄屏
  // 上一句歌词折行后，最后一个汉字就被单独甩到下一行（中文可在任意两字间断行）。
  const normalLyricLines = useMemo(
    () => (song.normalLyrics || song.lyrics || "").split(/\r?\n/),
    [song.normalLyrics, song.lyrics],
  );

  const lrcLyricLines = useMemo(
    () => (song.lyrics || "").split(/\r?\n/),
    [song.lyrics],
  );

  // 在组件挂载后立即启动动画
  useEffect(() => {
    // 使用 requestAnimationFrame 确保在下一帧启动动画
    requestAnimationFrame(() => {
      setAnimationReady(true);
    });
  }, []);

  // 分享歌曲
  const handleShare = useCallback(async () => {
    const artistText = song.artist ? ` - ${song.artist.join("、")}` : "";
    const shareData = {
      title: t("shareTitle"),
      text: t("shareText", { title: song.title, artist: artistText }),
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        console.warn(t("shareCancel"));
      }
    } else {
      try {
        await navigator.clipboard.writeText(window.location.href);
        alert(t("copySuccess"));
      } catch {
        console.warn(t("copyError"));
      }
    }
  }, [song.title, song.artist, t]);

  // 打开/关闭图片模态框
  const openImageModal = useCallback(
    (src: string, alt: string, title: string) => {
      setImageModal({ isOpen: true, src, alt, title });
    },
    [],
  );

  const closeImageModal = useCallback(() => {
    setImageModal({ isOpen: false, src: "", alt: "", title: "" });
  }, []);

  const handleCoverImageError = useCallback(
    () => setCoverImageLoaded(false),
    [],
  );
  const handleScoreImageError = useCallback(
    () => setScoreImageLoaded(false),
    [],
  );

  const [isBackActive, setIsBackActive] = useState(false);
  const [activeLinkId, setActiveLinkId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0B0F19] transition-colors duration-500">
      {/* 顶部导航 - 与 MusicLibraryClient 保持一致 */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#FAFAFA]/80 dark:bg-[#0B0F19]/80 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-800/50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 -ml-2">
              <button
                onClick={() => {
                  setIsBackActive(true);
                  // 通过 sessionStorage 中的导航深度判断是否有站内历史
                  // 该值由主页面在 router.push 前递增，确保 SPA 导航也能正确追踪
                  const navDepthStr = sessionStorage.getItem(
                    "__hetu_web_nav_depth",
                  );
                  const navDepth = navDepthStr ? parseInt(navDepthStr, 10) : 0;
                  if (navDepth > 0) {
                    sessionStorage.setItem(
                      "__hetu_web_nav_depth",
                      String(navDepth - 1),
                    );
                    router.back();
                  } else {
                    router.push("/");
                  }
                }}
                className={cn(
                  "p-2 rounded-full transition-colors text-slate-600 dark:text-slate-400 group",
                  isBackActive
                    ? "bg-slate-200/50 dark:bg-slate-800"
                    : "hover:bg-slate-200/50 dark:hover:bg-slate-800",
                )}
                title={tNav("back")}
              >
                <ArrowLeft
                  size={20}
                  className={cn(
                    "transition-transform",
                    isBackActive
                      ? "-translate-x-0.5"
                      : "group-hover:-translate-x-0.5",
                  )}
                />
              </button>

              <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-0.5" />

              <button
                onClick={() => router.push("/")}
                className="p-2 rounded-full transition-colors text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800 group"
                title={tNav("home")}
              >
                <Home
                  size={20}
                  className="transition-transform group-hover:scale-105 group-active:scale-95"
                />
              </button>
            </div>
            <div className="text-xl font-bold text-slate-900 dark:text-white tracking-tight hidden sm:block font-serif">
              {song.title}
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => openUserPanel("favorites")}
              className="relative p-2 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-400"
              title={user ? user.name : tNav("login")}
            >
              <User
                size={20}
                className={user ? "text-blue-500 dark:text-blue-400" : ""}
              />
            </button>

            {/* PC端显示的 语言 和 主题切换 */}
            <div className="hidden md:flex items-center gap-2">
              <LocaleSwitcher />
              <ThemeToggle />
            </div>

            {/* 移动端显示的“更多”下拉菜单 */}
            <div className="flex md:hidden relative">
              <MoreMenu />
            </div>
          </div>
        </div>
      </nav>

      <main className="pt-32 pb-28 max-w-7xl mx-auto px-6">
        {/* 主要内容网格 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* 左侧：封面与元信息 (Col-4) */}
          <div
            className={cn(
              "lg:col-span-4 space-y-8 lg:sticky lg:top-32 transition-all",
              animationReady
                ? "animate-in fade-in slide-in-from-bottom-8 duration-700"
                : "opacity-0",
            )}
          >
            {/* 封面卡片 */}
            <div
              className="group relative aspect-square w-full rounded-2xl overflow-hidden shadow-2xl shadow-slate-200/50 dark:shadow-black/40 ring-1 ring-slate-900/5 dark:ring-white/10 cursor-pointer"
              onClick={() =>
                coverImageLoaded &&
                openImageModal(
                  getCoverUrl(song),
                  song.album || song.title,
                  `${song.title} - 封面`,
                )
              }
            >
              {coverImageLoaded ? (
                <>
                  <Image
                    src={getCoverUrl(song)}
                    alt={song.title}
                    width={500}
                    height={500}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    priority
                    onError={handleCoverImageError}
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <span className="text-white text-sm font-medium bg-black/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/20">
                      {t("viewCover")}
                    </span>
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400">
                  <Disc size={48} className="mb-2 opacity-50" />
                  <span className="text-sm">{t("noCover")}</span>
                </div>
              )}
            </div>

            {/* 标签云 */}
            <div className="flex flex-wrap gap-2">
              {(song.type && song.type.length > 0 ? song.type : ["原创"]).map(
                (tVal) => (
                  <span
                    key={tVal}
                    className={cn(
                      "px-3 py-1 text-xs font-medium rounded-full border tracking-wide uppercase",
                      getTypeTagStyle(tVal, "emphasized"),
                    )}
                  >
                    {tEnum.has(`type.${tVal}`) ? tEnum(`type.${tVal}`) : tVal}
                  </span>
                ),
              )}
              {(song.genre || []).map((g) => (
                <span
                  key={g}
                  className={cn(
                    "px-3 py-1 text-xs font-medium rounded-full border",
                    getGenreTagStyle(g, "emphasized"),
                  )}
                >
                  {tEnum.has(`genre.${g}`) ? tEnum(`genre.${g}`) : g}
                </span>
              ))}
            </div>

            {/* ── 播放器区域 ─────────────────────────────────────────────── */}
            {userLoaded && hasBenefits && (
              <NaviPlayer
                songId={song.id}
                title={song.title}
                artist={song.artist?.join(" / ")}
                coverUrl={getCoverUrl(song)}
                hasAudio={song.has_audio}
              />
            )}

            {/* 外部链接 */}
            {(song.kugolink || song.qmlink || song.nelink) && (
              <div className="flex flex-col gap-3">
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Listen On
                </h2>
                <div className="grid grid-cols-1 gap-2">
                  {song.nelink && (
                    <a
                      href={song.nelink}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        setActiveLinkId("nelink");
                        setTimeout(() => setActiveLinkId(null), 1000);
                      }}
                      className={cn(
                        "flex items-center justify-between px-4 py-3 rounded-xl bg-white dark:bg-slate-800 border transition-all group",
                        activeLinkId === "nelink"
                          ? "border-red-500/50 shadow-sm"
                          : "border-slate-200 dark:border-slate-700 hover:border-red-500/50 hover:shadow-sm",
                      )}
                    >
                      <span
                        className={cn(
                          "text-sm font-medium transition-colors",
                          activeLinkId === "nelink"
                            ? "text-red-500"
                            : "text-slate-700 dark:text-slate-200 group-hover:text-red-500",
                        )}
                      >
                        {t("actions.netease")}
                      </span>
                      <ExternalLink
                        size={14}
                        className={cn(
                          "transition-colors",
                          activeLinkId === "nelink"
                            ? "text-red-400"
                            : "text-slate-400 group-hover:text-red-400",
                        )}
                      />
                    </a>
                  )}
                  {song.kugolink && (
                    <a
                      href={song.kugolink}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        setActiveLinkId("kugolink");
                        setTimeout(() => setActiveLinkId(null), 1000);
                      }}
                      className={cn(
                        "flex items-center justify-between px-4 py-3 rounded-xl bg-white dark:bg-slate-800 border transition-all group",
                        activeLinkId === "kugolink"
                          ? "border-blue-500/50 shadow-sm"
                          : "border-slate-200 dark:border-slate-700 hover:border-blue-500/50 hover:shadow-sm",
                      )}
                    >
                      <span
                        className={cn(
                          "text-sm font-medium transition-colors",
                          activeLinkId === "kugolink"
                            ? "text-blue-500"
                            : "text-slate-700 dark:text-slate-200 group-hover:text-blue-500",
                        )}
                      >
                        {t("actions.kugou")}
                      </span>
                      <ExternalLink
                        size={14}
                        className={cn(
                          "transition-colors",
                          activeLinkId === "kugolink"
                            ? "text-blue-400"
                            : "text-slate-400 group-hover:text-blue-400",
                        )}
                      />
                    </a>
                  )}
                  {song.qmlink && (
                    <a
                      href={song.qmlink}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        setActiveLinkId("qmlink");
                        setTimeout(() => setActiveLinkId(null), 1000);
                      }}
                      className={cn(
                        "flex items-center justify-between px-4 py-3 rounded-xl bg-white dark:bg-slate-800 border transition-all group",
                        activeLinkId === "qmlink"
                          ? "border-green-500/50 shadow-sm"
                          : "border-slate-200 dark:border-slate-700 hover:border-green-500/50 hover:shadow-sm",
                      )}
                    >
                      <span
                        className={cn(
                          "text-sm font-medium transition-colors",
                          activeLinkId === "qmlink"
                            ? "text-green-500"
                            : "text-slate-700 dark:text-slate-200 group-hover:text-green-500",
                        )}
                      >
                        {t("actions.qqmusic")}
                      </span>
                      <ExternalLink
                        size={14}
                        className={cn(
                          "transition-colors",
                          activeLinkId === "qmlink"
                            ? "text-green-400"
                            : "text-slate-400 group-hover:text-green-400",
                        )}
                      />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 右侧：详细内容 (Col-8) */}
          <div
            className={cn(
              "lg:col-span-8 space-y-12 transition-all",
              animationReady
                ? "animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100"
                : "opacity-0",
            )}
          >
            {/* 标题 & 基础信息 */}
            <section className="space-y-6" id="info">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 dark:text-slate-50 leading-tight">
                {song.title}
              </h1>

              {/* 信息卡片网格 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm">
                  <div className="flex items-center gap-2 mb-4 text-blue-600 dark:text-blue-400">
                    <User size={18} />
                    <h2 className="text-sm font-bold uppercase tracking-wider">
                      {t("sections.creativeInfo")}
                    </h2>
                  </div>
                  <div className="space-y-3">
                    {songInfo?.creativeInfo.map((item, index) => (
                      <div
                        key={index}
                        className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm border-b border-slate-50 dark:border-slate-800/50 last:border-0 pb-2 last:pb-0"
                      >
                        <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {item.label}
                        </span>
                        <span className="font-medium text-slate-900 dark:text-slate-200 text-right break-keep wrap-break-word">
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm">
                  <div className="flex items-center gap-2 mb-4 text-purple-600 dark:text-purple-400">
                    <Info size={18} />
                    <h2 className="text-sm font-bold uppercase tracking-wider">
                      {t("sections.basicInfo")}
                    </h2>
                  </div>
                  <div className="space-y-3">
                    {songInfo?.basicInfo.map((item, index) => (
                      <div
                        key={index}
                        className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm border-b border-slate-50 dark:border-slate-800/50 last:border-0 pb-2 last:pb-0"
                      >
                        <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {item.label}
                        </span>
                        <span className="font-medium text-slate-900 dark:text-slate-200 text-right break-keep wrap-break-word">
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 备注 */}
              {song.comment && (
                <div
                  id="remarks"
                  className="p-6 rounded-2xl bg-slate-100/70 dark:bg-slate-800/30 border border-slate-200/60 dark:border-slate-800"
                >
                  <div className="flex items-center gap-2 mb-3 text-slate-400">
                    <PenTool size={16} />
                    <h2 className="text-xs font-bold uppercase tracking-wider">
                      {t("sections.comment")}
                    </h2>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm whitespace-pre-line">
                    {song.comment}
                  </p>
                </div>
              )}

              {/* 我的评论 (内部自带权限校验与显示隐藏) */}
              <UserReview songId={song.id} />
            </section>

            {/* 歌词部分 */}
            <section
              id="lyrics"
              className="border-t border-slate-200 dark:border-slate-800 pt-10"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                  <Mic2 size={24} />
                  <h2 className="text-2xl font-bold">{t("sections.lyrics")}</h2>
                </div>

                {/* 歌词切换 */}
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                  <button
                    onClick={() => setLyricsType("normal")}
                    className={cn(
                      "px-4 py-1.5 rounded-md text-sm font-medium transition-all",
                      lyricsType === "normal"
                        ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white"
                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300",
                    )}
                  >
                    {t("lyricFormat.normal")}
                  </button>
                  <button
                    onClick={() => setLyricsType("lrc")}
                    className={cn(
                      "px-4 py-1.5 rounded-md text-sm font-medium transition-all",
                      lyricsType === "lrc"
                        ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white"
                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300",
                    )}
                  >
                    {t("lyricFormat.lrc")}
                  </button>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900/50 rounded-3xl p-5 sm:p-8 md:p-12 border border-slate-100 dark:border-slate-800 shadow-sm min-h-100">
                {song.lyrics ? (
                  <div className="relative overflow-hidden">
                    {/* 普通歌词 */}
                    <div
                      className={cn(
                        "leading-loose text-base sm:text-lg text-slate-700 dark:text-slate-300 font-light text-center",
                        "transition-all duration-500 ease-in-out",
                        lyricsType === "normal"
                          ? "opacity-100 translate-y-0 relative"
                          : "opacity-0 translate-y-4 absolute inset-0 pointer-events-none",
                      )}
                    >
                      {normalLyricLines.map((line, i) =>
                        line.trim() === "" ? (
                          // 空行用一个满行高的不换行空格占位，等价于原先 pre-line 的空行
                          <p key={i} aria-hidden>
                            {"\u00A0"}
                          </p>
                        ) : (
                          <p key={i} className="text-balance">
                            {line}
                          </p>
                        ),
                      )}
                    </div>

                    {/* LRC 歌词 */}
                    <div
                      className={cn(
                        "leading-loose text-base sm:text-lg text-slate-700 dark:text-slate-300 font-light text-left font-mono",
                        "transition-all duration-500 ease-in-out",
                        lyricsType === "lrc"
                          ? "opacity-100 translate-y-0 relative"
                          : "opacity-0 translate-y-4 absolute inset-0 pointer-events-none",
                      )}
                    >
                      {lrcLyricLines.map((line, i) =>
                        line.trim() === "" ? (
                          <p key={i} aria-hidden>
                            {"\u00A0"}
                          </p>
                        ) : (
                          // 悬挂缩进：折行部分对齐到时间戳之后，而不是顶回最左侧
                          <p
                            key={i}
                            className="text-balance pl-[10ch] -indent-[10ch]"
                          >
                            {line}
                          </p>
                        ),
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-50">
                    <FileText size={48} className="mb-4" />
                    <p>{t("noLyrics")}</p>
                  </div>
                )}
              </div>
            </section>

            {/* 乐谱部分 */}
            {song.nmn_status && (
              <section
                id="score"
                className="border-t border-slate-200 dark:border-slate-800 pt-10 pb-10"
              >
                <div className="flex items-center gap-2 mb-8 text-slate-900 dark:text-white">
                  <LayoutTemplate size={24} />
                  <h2 className="text-2xl font-bold">{t("sections.score")}</h2>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 overflow-hidden">
                  {scoreImageLoaded ? (
                    <div
                      className="relative group cursor-pointer rounded-lg overflow-hidden"
                      onClick={() =>
                        openImageModal(
                          getNmnUrl(song),
                          `${song.title} - 乐谱`,
                          "乐谱",
                        )
                      }
                    >
                      <Image
                        src={getNmnUrl(song)}
                        alt="Score"
                        width={800}
                        height={600}
                        className="w-full h-auto"
                        loading="eager"
                        onError={handleScoreImageError}
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <span className="bg-white/90 text-slate-900 px-4 py-2 rounded-full shadow-lg font-medium text-sm">
                          {t("zoomScore")}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="h-64 flex flex-col items-center justify-center text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                      <p>{t("scoreLoadError")}</p>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        </div>
      </main>

      <FloatingActionButtons
        showScrollTop={showScrollTop}
        onScrollToTop={scrollToTop}
        onShare={handleShare}
      >
        <FavoriteButton songId={song.id} variant="icon" />
      </FloatingActionButtons>

      <ImageModal
        isOpen={imageModal.isOpen}
        onClose={closeImageModal}
        src={imageModal.src}
        alt={imageModal.alt}
        title={imageModal.title}
      />

      <TableOfContents song={song} />
    </div>
  );
};

export default SongDetailClient;
