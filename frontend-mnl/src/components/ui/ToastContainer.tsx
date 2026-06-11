"use client";

import React, { useEffect, useState } from "react";
import { ToastOptions } from "@/utils/toast";

interface ActiveToast extends ToastOptions {
  id: string;
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ActiveToast[]>([]);

  useEffect(() => {
    const handleToastEvent = (e: Event) => {
      const customEvent = e as CustomEvent<ToastOptions>;
      if (!customEvent.detail) return;

      const newToast: ActiveToast = {
        ...customEvent.detail,
        id: Math.random().toString(36).substring(2, 9),
      };

      setToasts((prev) => [...prev, newToast]);

      const duration = customEvent.detail.duration ?? 5000;
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
      }, duration);
    };

    window.addEventListener("qdf-toast", handleToastEvent);
    return () => {
      window.removeEventListener("qdf-toast", handleToastEvent);
    };
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 w-full max-w-sm pointer-events-none">
      {toasts.map((toast) => {
        let typeColor = "border-accent text-accent bg-accent/[0.03]";
        let typeLabel = "INFO";
        let typeIcon = "ℹ️";

        if (toast.type === "success") {
          typeColor = "border-emerald-500/30 text-emerald-400 bg-emerald-500/[0.02]";
          typeLabel = "SUCCESS";
          typeIcon = "✓";
        } else if (toast.type === "warning") {
          typeColor = "border-amber-500/30 text-amber-400 bg-amber-500/[0.02]";
          typeLabel = "WARNING";
          typeIcon = "⚠";
        } else if (toast.type === "error") {
          typeColor = "border-rose-500/30 text-rose-400 bg-rose-500/[0.02]";
          typeLabel = "ERROR";
          typeIcon = "✕";
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-4 p-4 rounded-xl border backdrop-blur-md shadow-2xl transition-all duration-300 animate-slide-in ${typeColor}`}
            style={{
              borderColor: "var(--border)",
              background: "var(--card)",
            }}
          >
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current text-[10px] font-black">
              {typeIcon}
            </div>

            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-widest opacity-60">
                  {toast.title ?? typeLabel}
                </span>
                <button
                  onClick={() => removeToast(toast.id)}
                  className="text-muted-text/40 hover:text-text text-xs transition-colors p-0.5"
                  aria-label="Dismiss alert"
                >
                  ✕
                </button>
              </div>
              <p className="text-xs font-bold text-text leading-tight">{toast.message}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
