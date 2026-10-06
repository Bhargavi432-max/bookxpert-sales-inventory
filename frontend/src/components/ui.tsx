import clsx from "clsx";
import { ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";
import { forwardRef, useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TdHTMLAttributes, type TextareaHTMLAttributes } from "react";

import type { ApprovalStatus, InventoryTxnType, OrderStatus } from "../api/types";
import { humanize } from "../lib/format";

type Variant = "primary" | "secondary" | "danger" | "success" | "ghost";

const variants: Record<Variant, string> = {
  primary: "bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-300",
  secondary: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 disabled:text-slate-400",
  danger: "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300",
  success: "bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-300",
  ghost: "text-slate-600 hover:bg-slate-100 disabled:text-slate-300",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md";
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({ variant = "primary", size = "md", loading, icon, className, children, disabled, ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed",
        size === "sm" ? "px-3 py-1.5 text-sm" : "px-4 py-2 text-sm",
        variants[variant],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

const fieldClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-100";
const invalidClass = "border-red-400 focus:border-red-500 focus:ring-red-500/20";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  ({ className, invalid, ...props }, ref) => (
    <input ref={ref} className={clsx(fieldClass, invalid && invalidClass, className)} aria-invalid={invalid} {...props} />
  ),
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(
  ({ className, invalid, children, ...props }, ref) => (
    <select ref={ref} className={clsx(fieldClass, invalid && invalidClass, className)} aria-invalid={invalid} {...props}>
      {children}
    </select>
  ),
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  ({ className, invalid, ...props }, ref) => (
    <textarea ref={ref} className={clsx(fieldClass, invalid && invalidClass, className)} aria-invalid={invalid} {...props} />
  ),
);

export function Field({ label, error, hint, children, className }: { label: string; error?: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={clsx("block", className)}>
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function Card({ children, className, title, action }: { children: ReactNode; className?: string; title?: string; action?: ReactNode }) {
  return (
    <section className={clsx("rounded-xl border border-slate-200 bg-white shadow-sm", className)}>
      {title && (
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx("h-6 w-6 animate-spin text-indigo-600", className)} />;
}

export function LoadingBlock() {
  return (
    <div className="flex justify-center py-16">
      <Spinner />
    </div>
  );
}

export function EmptyState({ title, message, action }: { title: string; message?: string; action?: ReactNode }) {
  return (
    <div className="px-6 py-14 text-center">
      <p className="font-medium text-slate-700">{title}</p>
      {message && <p className="mt-1 text-sm text-slate-500">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="text-sm text-red-600">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

const badgeTones = {
  gray: "bg-slate-100 text-slate-700 ring-slate-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  blue: "bg-sky-50 text-sky-700 ring-sky-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
};
export type Tone = keyof typeof badgeTones;

export function Badge({ tone = "gray", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={clsx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap", badgeTones[tone])}>{children}</span>;
}

const statusTones: Record<OrderStatus | ApprovalStatus | InventoryTxnType, Tone> = {
  PENDING_APPROVAL: "amber",
  PENDING: "amber",
  COMPLETED: "green",
  APPROVED: "green",
  REJECTED: "red",
  CANCELLED: "gray",
  INITIAL: "violet",
  SALE: "blue",
  RESTOCK: "green",
  ADJUSTMENT: "amber",
};

export function StatusBadge({ status }: { status: OrderStatus | ApprovalStatus | InventoryTxnType }) {
  return <Badge tone={statusTones[status]}>{humanize(status)}</Badge>;
}

export function Pagination({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm text-slate-600">
      <span>
        {from}–{to} of {total}
      </span>
      <div className="flex gap-1">
        <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page" icon={<ChevronLeft className="h-4 w-4" />} />
        <span className="px-2 py-1.5">
          {page} / {pages}
        </span>
        <Button variant="ghost" size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Next page" icon={<ChevronRight className="h-4 w-4" />} />
      </div>
    </div>
  );
}

export function Modal({ open, title, onClose, children, footer, wide }: { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-[10vh]" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className={clsx("w-full rounded-xl bg-white shadow-xl", wide ? "max-w-2xl" : "max-w-lg")} onMouseDown={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="px-5 py-4">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">{footer}</footer>}
      </div>
    </div>
  );
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-100 text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={clsx("bg-slate-50 px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500", className)}>{children}</th>;
}

export function Td({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={clsx("px-5 py-3 align-middle", className)} {...props} />;
}
