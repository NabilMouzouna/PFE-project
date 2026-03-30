"use client";

import { type ButtonHTMLAttributes, forwardRef } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border-var(--line) bg-var(--accent) text-[#fffaf0] shadow-[3px_3px_0_var(--line)] hover:-translate-x-px hover:-translate-y-px hover:shadow-[4px_4px_0_var(--line)] focus:outline-none focus:ring-2 focus:ring-var(--accent) focus:ring-offset-2",
  secondary:
    "border-2 border-var(--line) bg-var(--panel) text-var(--ink) hover:bg-var(--paper) focus:outline-none focus:ring-2 focus:ring-var(--accent) focus:ring-offset-2",
  ghost:
    "border-transparent bg-transparent text-var(--accent) hover:bg-var(--accent)/10 focus:outline-none focus:ring-2 focus:ring-var(--accent)",
  danger:
    "border-var(--line) bg-red-600 text-white shadow-[3px_3px_0_var(--line)] hover:bg-red-700 hover:-translate-x-px hover:-translate-y-px focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-2.5 py-1.5 text-xs",
  md: "px-4 py-2 text-sm font-medium",
  lg: "px-6 py-3 text-base font-semibold",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading = false, disabled, className = "", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled ?? loading}
        className={[
          "cursor-pointer select-none rounded-lg border-2 font-semibold transition-all duration-150 active:translate-[2px,2px] active:shadow-[1px_1px_0_var(--line)] disabled:cursor-not-allowed disabled:opacity-60",
          variantClasses[variant],
          sizeClasses[size],
          className,
        ].join(" ")}
        {...props}
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            {children}
          </span>
        ) : (
          children
        )}
      </button>
    );
  },
);

Button.displayName = "Button";
