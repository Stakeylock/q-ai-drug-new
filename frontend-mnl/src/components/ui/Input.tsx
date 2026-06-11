import { forwardRef, useId } from "react";

interface BaseFieldProps {
  label?: string;
  error?: string;
  containerClassName?: string;
  labelClassName?: string;
}

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    BaseFieldProps {}

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    BaseFieldProps {}

function joinClasses(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

interface FieldShellProps extends BaseFieldProps {
  id: string;
  errorId: string;
  hasError: boolean;
  children: React.ReactNode;
}

function FieldShell({
  id,
  errorId,
  label,
  error,
  hasError,
  containerClassName,
  labelClassName,
  children,
}: FieldShellProps) {
  return (
    <div className={joinClasses("flex w-full flex-col gap-1.5", containerClassName)}>
      {label ? (
        <label
          htmlFor={id}
          className={joinClasses(
            "text-xs font-bold uppercase tracking-widest text-text-secondary transition-colors group-focus-within:text-primary",
            labelClassName,
          )}
        >
          {label}
        </label>
      ) : null}

      <div className="group relative">{children}</div>

      {hasError ? (
        <p id={errorId} className="text-xs font-medium text-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    id,
    label,
    error,
    className,
    containerClassName,
    labelClassName,
    "aria-describedby": ariaDescribedBy,
    ...props
  },
  ref,
) {
  const generatedId = useId().replace(/:/g, "");
  const fieldId = id ?? `input-${generatedId}`;
  const errorId = `${fieldId}-error`;
  const hasError = Boolean(error);

  const describedBy = joinClasses(ariaDescribedBy, hasError && errorId) || undefined;

  return (
    <FieldShell
      id={fieldId}
      errorId={errorId}
      label={label}
      error={error}
      hasError={hasError}
      containerClassName={containerClassName}
      labelClassName={labelClassName}
    >
      <input
        id={fieldId}
        ref={ref}
        className={joinClasses(
          "w-full rounded-xl border-2 bg-surface px-4 py-3 text-sm text-text transition-all duration-200 outline-none",
          hasError
            ? "border-error/50 focus:border-error"
            : "border-border/50 focus:border-primary focus:ring-4 focus:ring-primary/10",
          className,
        )}
        aria-invalid={hasError}
        aria-describedby={describedBy}
        {...props}
      />
    </FieldShell>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    id,
    label,
    error,
    className,
    containerClassName,
    labelClassName,
    rows = 4,
    "aria-describedby": ariaDescribedBy,
    ...props
  },
  ref,
) {
  const generatedId = useId().replace(/:/g, "");
  const fieldId = id ?? `textarea-${generatedId}`;
  const errorId = `${fieldId}-error`;
  const hasError = Boolean(error);

  const describedBy = joinClasses(ariaDescribedBy, hasError && errorId) || undefined;

  return (
    <FieldShell
      id={fieldId}
      errorId={errorId}
      label={label}
      error={error}
      hasError={hasError}
      containerClassName={containerClassName}
      labelClassName={labelClassName}
    >
      <textarea
        id={fieldId}
        ref={ref}
        rows={rows}
        className={joinClasses(
          "w-full rounded-xl border-2 bg-surface px-4 py-3 text-sm text-text transition-all duration-200 outline-none",
          hasError
            ? "border-error/50 focus:border-error"
            : "border-border/50 focus:border-primary focus:ring-4 focus:ring-primary/10",
          className,
        )}
        aria-invalid={hasError}
        aria-describedby={describedBy}
        {...props}
      />
    </FieldShell>
  );
});


Input.displayName = "Input";
Textarea.displayName = "Textarea";
