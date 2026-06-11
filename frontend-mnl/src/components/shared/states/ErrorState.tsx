import { toFriendlyErrorMessage } from "@/services/api";

interface ErrorStateProps {
  message?: string;
  title?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export function ErrorState({
  message = "Something did not load as expected.",
  title = "We hit a small hiccup",
  onRetry,
  retryLabel = "Try again",
  className = "",
}: ErrorStateProps) {
  return (
    <section
      role="alert"
      className={`ui-fade-in ui-state-transition rounded-xl border p-4 ${className}`}
      style={{
        borderColor: "var(--error-border)",
        backgroundColor: "var(--error-bg)",
        color: "var(--error-text)",
      }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
          <p className="mt-1 text-sm" style={{ color: "var(--error-text-secondary)" }}>{message}</p>
          <p className="mt-1 text-xs" style={{ color: "var(--error-text-tertiary)" }}>
            You can retry now. Existing data will stay visible when available.
          </p>
        </div>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="ui-button inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-xs font-semibold"
            style={{
              borderColor: "var(--error-border)",
              backgroundColor: "var(--error-button-bg)",
              color: "var(--error-button-text)",
            }}
          >
            {retryLabel}
          </button>
        ) : null}
      </div>
    </section>
  );
}

interface ApiErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  fallbackMessage?: string;
  title?: string;
  className?: string;
}

export function ApiErrorState({
  error,
  onRetry,
  fallbackMessage,
  title,
  className,
}: ApiErrorStateProps) {
  return (
    <ErrorState
      title={title}
      message={toFriendlyErrorMessage(error, fallbackMessage)}
      onRetry={onRetry}
      className={className}
    />
  );
}