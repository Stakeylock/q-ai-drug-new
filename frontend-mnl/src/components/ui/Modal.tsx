"use client";

import { useEffect, useRef, useState } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  content?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  closeOnOutsideClick?: boolean;
}

const EXIT_ANIMATION_MS = 200;

function joinClasses(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

export function Modal({
  isOpen,
  onClose,
  title,
  content,
  actions,
  children,
  closeOnOutsideClick = true,
}: ModalProps) {
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(isOpen);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modalRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        if (modalRef.current) {
          const focusable = modalRef.current.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex="0"]'
          );
          if (focusable.length > 0) {
            (focusable[0] as HTMLElement).focus();
          } else {
            modalRef.current.focus();
          }
        }
      }, 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    if (isOpen) {
      setIsRendered(true);
      requestAnimationFrame(() => setIsVisible(true));
      return;
    }

    setIsVisible(false);
    closeTimerRef.current = setTimeout(() => {
      setIsRendered(false);
      closeTimerRef.current = null;
    }, EXIT_ANIMATION_MS);

    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isRendered) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isRendered, onClose]);

  if (!isRendered) {
    return null;
  }

  const resolvedContent = content ?? children;

  return (
    <div
      className={joinClasses(
        "fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300",
        isVisible ? "opacity-100 backdrop-blur-md" : "opacity-0 backdrop-blur-none",
      )}
      onClick={(event) => {
        if (closeOnOutsideClick && event.target === event.currentTarget) {
          onClose();
        }
      }}
      role="presentation"
    >
      <div
        className="absolute inset-0 bg-background/80"
        aria-hidden="true"
      />

      <section
        ref={modalRef}
        tabIndex={-1}
        className={joinClasses(
          "ui-card-surface relative z-10 w-full max-w-xl shadow-premium transition-all duration-300 overflow-hidden outline-none",
          isVisible ? "scale-100 translate-y-0 opacity-100" : "scale-95 translate-y-4 opacity-0",
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
      >
        {title ? (
          <header className="border-b border-border/50 px-8 py-6 bg-surface-subtle/30">
            <h2
              id="modal-title"
              className="text-xl font-bold tracking-tight text-text"
            >
              {title}
            </h2>
          </header>
        ) : null}

        {resolvedContent ? (
          <div className="px-8 py-8 text-base leading-relaxed text-text">
            {resolvedContent}
          </div>
        ) : null}

        {actions ? (
          <footer className="border-t border-border/50 bg-surface-subtle/30 px-8 py-6">
            <div className="flex items-center justify-end gap-3">
              {actions}
            </div>
          </footer>
        ) : null}
      </section>
    </div>
  );
}


export type { ModalProps };
