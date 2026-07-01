import { ApiError, post } from "@/services/api";

export type PaymentBillingCycle = "monthly" | "annual";
export type PaymentCurrency = "INR" | "USD";

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  message?: string;
};

export type RazorpayOrder = {
  provider: "razorpay";
  key_id: string;
  order_id: string;
  amount: number;
  amount_display: string;
  currency: PaymentCurrency;
  plan_id: string;
  plan_name: string;
  billing_cycle: PaymentBillingCycle;
  receipt: string;
};

export type RazorpayPaymentResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayFailureResponse = {
  error?: {
    code?: string;
    description?: string;
    reason?: string;
  };
};

type RazorpayCheckoutOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpayPaymentResponse) => void | Promise<void>;
  modal?: {
    ondismiss?: () => void;
  };
  notes?: Record<string, string>;
  theme?: {
    color?: string;
  };
};

type RazorpayCheckoutInstance = {
  open: () => void;
  on: (event: "payment.failed", handler: (response: RazorpayFailureResponse) => void) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayCheckoutInstance;
  }
}

export function isPaymentAuthError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

export async function createRazorpayOrder(payload: {
  planId: string;
  billingCycle: PaymentBillingCycle;
  currency: PaymentCurrency;
}): Promise<RazorpayOrder> {
  const response = await post<ApiEnvelope<RazorpayOrder>>("/billing/razorpay/order", {
    body: {
      plan_id: payload.planId,
      billing_cycle: payload.billingCycle,
      currency: payload.currency,
    },
  });
  return response.data;
}

export async function verifyRazorpayPayment(payload: {
  planId: string;
  billingCycle: PaymentBillingCycle;
  response: RazorpayPaymentResponse;
}): Promise<{ verified: boolean }> {
  const response = await post<ApiEnvelope<{ verified: boolean }>>("/billing/razorpay/verify", {
    body: {
      plan_id: payload.planId,
      billing_cycle: payload.billingCycle,
      razorpay_order_id: payload.response.razorpay_order_id,
      razorpay_payment_id: payload.response.razorpay_payment_id,
      razorpay_signature: payload.response.razorpay_signature,
    },
  });
  return response.data;
}

export function loadRazorpayCheckout(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Razorpay checkout can only load in the browser."));
  }
  if (window.Razorpay) {
    return Promise.resolve();
  }

  const scriptId = "razorpay-checkout-js";
  const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;
  if (existingScript) {
    return new Promise((resolve, reject) => {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Unable to load Razorpay checkout.")), {
        once: true,
      });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Unable to load Razorpay checkout."));
    document.body.appendChild(script);
  });
}
