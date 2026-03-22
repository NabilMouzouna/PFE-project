"use client";

import { forwardRef, type TextareaHTMLAttributes } from "react";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, id, className = "", ...props }, ref) => {
    const inputId = id ?? `textarea-${Math.random().toString(36).slice(2)}`;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-var(--foreground)">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          className={[
            "w-full resize-y rounded-md border-none border-b-2 border-var(--line) bg-transparent p-2 transition-colors focus:border-var(--accent) focus:outline-none",
            error && "border-red-500 focus:border-red-500",
            className,
          ].join(" ")}
          {...props}
        />
        {error && (
          <p id={`${inputId}-error`} className="mt-1.5 text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={`${inputId}-hint`} className="mt-1.5 text-xs text-var(--foreground)/60">
            {hint}
          </p>
        )}
      </div>
    );
  },
);

Textarea.displayName = "Textarea";
