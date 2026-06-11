interface AuthStatusMessageProps {
  type: "error" | "success";
  message: string;
}

function joinClasses(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

const TYPE_STYLES = {
  error: "border border-rose-500/40 bg-rose-500/10 text-rose-300",
  success: "border border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
} as const;

export function AuthStatusMessage({ type, message }: AuthStatusMessageProps) {
  return (
    <p
      className={joinClasses("rounded-lg px-3 py-2 text-sm", TYPE_STYLES[type])}
      role={type === "error" ? "alert" : "status"}
      aria-live={type === "error" ? "assertive" : "polite"}
    >
      {message}
    </p>
  );
}
