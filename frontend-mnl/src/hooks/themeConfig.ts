/**
 * Theme configuration and utility functions
 * Maps theme-aware colors and provides style utilities
 */

export const themeVars = {
  // Primary colors
  bg: 'var(--bg)',
  text: 'var(--text)',
  card: 'var(--card)',
  border: 'var(--border)',

  // Extended palette
  background: 'var(--background)',
  foreground: 'var(--foreground)',
  sidebarBg: 'var(--sidebar-bg)',
  sidebarBorder: 'var(--sidebar-border)',
  panelBg: 'var(--panel-bg)',
  panelBorder: 'var(--panel-border)',

  // Semantic colors
  accent: 'var(--accent)',
  accentHover: 'var(--accent-hover)',
  mutedText: 'var(--muted-text)',
  mutedBg: 'var(--muted-bg)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  error: 'var(--error)',
  info: 'var(--info)',

  // Component-specific
  inputBg: 'var(--input-bg)',
  inputBorder: 'var(--input-border)',
  inputText: 'var(--input-text)',
  buttonHover: 'var(--button-hover)',
  tableRowHover: 'var(--table-row-hover)',
  codeBg: 'var(--code-bg)',
};

/**
 * Utility to apply theme-aware inline styles
 */
export function useThemeStyle(styles: Partial<React.CSSProperties>) {
  return styles;
}

/**
 * Map of deprecated hardcoded colors to theme variables
 * Use for quick refactoring reference
 */
export const colorMigration = {
  // Replace these...
  'bg-white': { style: { backgroundColor: 'var(--card)' } },
  'bg-black': { style: { backgroundColor: 'var(--bg)' } },
  'text-white': { style: { color: 'var(--text)' } },
  'text-black': { style: { color: 'var(--text)' } },
  'text-slate-100': { style: { color: 'var(--text)' } },
  'text-slate-900': { style: { color: 'var(--text)' } },
  'bg-slate-50': { style: { backgroundColor: 'var(--muted-bg)' } },
  'bg-slate-950': { style: { backgroundColor: 'var(--bg)' } },
  'border-slate-200': { style: { borderColor: 'var(--border)' } },
  'border-slate-800': { style: { borderColor: 'var(--border)' } },
};

/**
 * Get CSS variable value (useful in JavaScript)
 */
export function getCSSVariable(variableName: string): string {
  if (typeof window === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(
    `--${variableName}`
  );
}
