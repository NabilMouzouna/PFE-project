"use client";

import { useEffect, useCallback } from "react";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Overrides default `max-w-lg` on the panel (e.g. `max-w-2xl`). */
  panelClassName?: string;
}

export function Modal({ isOpen, onClose, title, children, panelClassName }: ModalProps) {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleEscape]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
    >
      <div
        className="fixed inset-0 cursor-pointer bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`relative z-10 max-h-[90vh] w-full overflow-auto rounded-xl border-2 border-var(--line) bg-var(--paper) p-6 shadow-[6px_6px_0_var(--line)] ${panelClassName ?? "max-w-lg"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="mb-4 flex items-center justify-between border-b border-var(--line) pb-4">
            <h2 id="modal-title" className="text-xl font-semibold text-var(--ink)">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded p-1 text-var(--foreground)/60 transition-colors hover:bg-var(--panel) hover:text-var(--foreground) focus:outline-none focus:ring-2 focus:ring-var(--accent)"
              aria-label="Close modal"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
