export interface ToastOptions {
  message: string;
  type: "success" | "warning" | "error" | "info";
  title?: string;
  duration?: number;
}

export function showToast(options: ToastOptions) {
  if (typeof window !== "undefined") {
    const event = new CustomEvent("qdf-toast", { detail: options });
    window.dispatchEvent(event);
  }
}
