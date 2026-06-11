import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, "content"> {
  header?: ReactNode;
  content?: ReactNode;
  footer?: ReactNode;
  headerClassName?: string;
  contentClassName?: string;
  footerClassName?: string;
}

interface CardSectionProps extends HTMLAttributes<HTMLDivElement> {}

function joinClasses(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

export function Card({
  className,
  header,
  content,
  footer,
  headerClassName,
  contentClassName,
  footerClassName,
  children,
  ...props
}: CardProps) {
  const resolvedContent = content ?? children;

  return (
    <section
      className={joinClasses(
        "ui-card-surface overflow-hidden transition-all duration-300",
        className,
      )}
      {...props}
    >
      {header ? (
        <div
          className={joinClasses(
            "border-b border-border/50 px-8 py-5",
            headerClassName,
          )}
        >
          {header}
        </div>
      ) : null}

      {resolvedContent ? (
        <div className={joinClasses("px-8 py-6", contentClassName)}>{resolvedContent}</div>
      ) : null}

      {footer ? (
        <div
          className={joinClasses(
            "border-t border-border/50 bg-surface-subtle/30 px-8 py-5",
            footerClassName,
          )}
        >
          {footer}
        </div>
      ) : null}
    </section>
  );
}

export function CardHeader({ className, ...props }: CardSectionProps) {
  return (
    <div
      className={joinClasses("border-b border-border/50 px-8 py-5", className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: CardSectionProps) {
  return <div className={joinClasses("px-8 py-6", className)} {...props} />;
}

export function CardFooter({ className, ...props }: CardSectionProps) {
  return (
    <div
      className={joinClasses(
        "border-t border-border/50 bg-surface-subtle/30 px-8 py-5",
        className,
      )}
      {...props}
    />
  );
}

