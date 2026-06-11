"use client";

import { useTheme } from "@/hooks/useTheme";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  if (!theme) return null;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="ui-button inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/40"
      style={{
        borderColor: "var(--border)",
        backgroundColor: "var(--card)",
        color: "var(--text)",
      }}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={theme === "dark"}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      <span className="relative flex h-5 w-5 items-center justify-center">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className={`absolute h-5 w-5 transition-all duration-300 ${theme === "light" ? "scale-100 rotate-0 opacity-100" : "scale-75 -rotate-45 opacity-0"}`}
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4.5" />
          <path d="M12 2.5v2.2M12 19.3v2.2M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" strokeLinecap="round" />
        </svg>
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className={`absolute h-5 w-5 transition-all duration-300 ${theme === "dark" ? "scale-100 rotate-0 opacity-100" : "scale-75 rotate-45 opacity-0"}`}
          aria-hidden="true"
        >
          <path d="M21.6 14.7A8.5 8.5 0 0 1 9.3 2.4a1 1 0 0 0-1.1 1.3 9.8 9.8 0 1 0 11.9 11.9 1 1 0 0 0-1.5-1Z" />
        </svg>
      </span>
    </button>
  );
}
