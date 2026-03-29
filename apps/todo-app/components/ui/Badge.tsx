"use client";

export type BadgeVariant = "default" | "success" | "warning" | "info" | "done" | "open";

export interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-var(--panel) text-var(--ink) border border-var(--line)",
  success: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  done: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  open: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
};

export function Badge({ variant = "default", children, className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex cursor-default items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
