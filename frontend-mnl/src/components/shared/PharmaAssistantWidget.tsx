"use client";

import { useState, useMemo } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import AssistantWidget from "../dashboard/AssistantWidget";
import { showToast } from "@/utils/toast";

const ALLOWED_PATHS = [
  "/dashboard",
  "/research-projects",
  "/targets",
  "/molecules",
  "/docking",
  "/quantum",
  "/simulation",
  "/validation",
  "/visualization",
  "/chemical-space",
  "/similarity"
];

const EXCLUDED_PATHS = [
  "/login",
  "/register",
  "/settings",
  "/billing",
  "/team",
  "/audit-logs"
];

export default function PharmaAssistantWidget() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const shouldShow = useMemo(() => {
    if (EXCLUDED_PATHS.some(path => pathname.startsWith(path))) return false;
    return ALLOWED_PATHS.some(path => pathname.startsWith(path));
  }, [pathname]);

  if (!shouldShow) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="mb-4 w-80 overflow-hidden"
          >
            <AssistantWidget 
              activePath={pathname}
              onPromptClick={(prompt) => {
                showToast({
                  type: "info",
                  title: "Assistant Prompt",
                  message: `"${prompt}" is ready in the full assistant workspace.`,
                });
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex h-14 w-14 items-center justify-center rounded-full shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 ${
          isOpen ? "bg-text text-bg rotate-90" : "bg-accent text-bg"
        }`}
      >
        {isOpen ? (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <div className="relative">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
            </span>
          </div>
        )}
      </button>
    </div>
  );
}
