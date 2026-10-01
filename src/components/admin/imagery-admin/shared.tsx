import type React from "react";
import { Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils/utils";

export { cn };

export function pageShellClassName() {
  return "rounded-[28px] border border-slate-200/70 dark:border-slate-800/70 bg-white/85 dark:bg-slate-900/65 shadow-[0_20px_60px_-32px_rgba(15,23,42,0.35)] backdrop-blur-sm";
}

export function cardClassName() {
  return "rounded-3xl border border-slate-200/70 dark:border-slate-800/70 bg-white/95 dark:bg-slate-900/75 shadow-[0_16px_48px_-28px_rgba(15,23,42,0.35)]";
}

export function mutedCardClassName() {
  return "rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-slate-50/85 dark:bg-slate-950/35";
}

export function primaryButtonClassName() {
  return "inline-flex items-center gap-2 rounded-full bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-violet-500/15 transition-all hover:-translate-y-0.5 hover:bg-violet-500 disabled:opacity-50";
}

export function secondaryButtonClassName() {
  return "inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors hover:border-violet-300 dark:hover:border-violet-700";
}

export function ghostButtonClassName() {
  return "px-3 py-1.5 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700";
}

export function inputClassName() {
  return "w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none transition-colors placeholder:text-slate-400 focus:border-violet-500";
}

export function compactInputClassName() {
  return "w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none transition-colors placeholder:text-slate-400 focus:border-violet-500";
}

export function formLabelClassName() {
  return "mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400";
}

export function StatPill({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/60 dark:border-slate-800/80 bg-white/75 dark:bg-slate-950/50 px-4 py-3 backdrop-blur-sm">
      <div className="text-[11px] uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
        {value}
      </div>
    </div>
  );
}

export function SectionIntro({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        pageShellClassName(),
        "relative overflow-hidden px-6 py-6 md:px-7",
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.13),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.10),transparent_32%)]" />
      <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <div className="text-[11px] uppercase tracking-[0.32em] text-violet-500 dark:text-violet-400">
            {eyebrow}
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            {description}
          </p>
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-3">{actions}</div>
        )}
      </div>
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <div className={cn("relative group", className)}>
      <Search
        size={16}
        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
      />
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cn(inputClassName(), "rounded-full pl-11 pr-10")}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-300 transition-colors hover:text-slate-500"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div
      className={cn(cardClassName(), "px-6 py-16 text-center text-slate-400")}
    >
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
        {icon}
      </div>
      <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
        {title}
      </h3>
      <p className="mt-2 text-sm text-slate-400">{description}</p>
    </div>
  );
}

export function LoadingState({ text }: { text: string }) {
  return (
    <div
      className={cn(
        cardClassName(),
        "flex items-center justify-center gap-2 px-6 py-16 text-slate-400",
      )}
    >
      <Loader2 className="animate-spin" size={18} />
      <span>{text}</span>
    </div>
  );
}

export function ModalBackdrop({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div onClick={(event) => event.stopPropagation()}>{children}</div>
    </div>
  );
}

export function ModalCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "w-[calc(100vw-2rem)] max-w-md rounded-[28px] border border-slate-200/80 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900",
        className,
      )}
    >
      {children}
    </div>
  );
}
