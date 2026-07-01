"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError } from "@/services/api";
import {
  createRazorpayOrder,
  isPaymentAuthError,
  loadRazorpayCheckout,
  type PaymentCurrency,
  verifyRazorpayPayment,
} from "@/services/payments";

type BillingCycle = "monthly" | "annual";

type Plan = {
  id: string;
  name: string;
  eyebrow: string;
  description: string;
  usdMonthly: number | null;
  inrMonthly: number | null;
  seats: string;
  features: string[];
  cta: string;
  href: string;
  featured?: boolean;
};

const ANNUAL_DISCOUNT = 0.8;

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    eyebrow: "Learn and explore",
    description: "For individual researchers evaluating the core discovery workflow.",
    usdMonthly: 0,
    inrMonthly: 0,
    seats: "1 researcher",
    features: [
      "500 generated molecules / month",
      "100 docking jobs / month",
      "Basic ADMET predictions",
      "10 GB research storage",
      "Community support",
    ],
    cta: "Start free",
    href: "/signup?plan=free",
  },
  {
    id: "explorer",
    name: "Explorer",
    eyebrow: "Independent research",
    description: "For scientists moving from early ideas into repeatable experiments.",
    usdMonthly: 79,
    inrMonthly: 6499,
    seats: "Up to 3 researchers",
    features: [
      "5,000 generated molecules / month",
      "750 docking jobs / month",
      "Advanced ADMET predictions",
      "50 GB research storage",
      "Standard email support",
    ],
    cta: "Choose Explorer",
    href: "/signup?plan=explorer",
  },
  {
    id: "research",
    name: "Research",
    eyebrow: "Most popular",
    description: "For active discovery teams running end-to-end candidate programs.",
    usdMonthly: 299,
    inrMonthly: 24999,
    seats: "Up to 10 researchers",
    features: [
      "50,000 generated molecules / month",
      "5,000 docking and GNINA jobs",
      "Quantum reranking credits",
      "250 GB research storage",
      "Team workspaces and audit history",
      "Priority scientific support",
    ],
    cta: "Choose Research",
    href: "/signup?plan=research",
    featured: true,
  },
  {
    id: "scale",
    name: "Scale",
    eyebrow: "Multi-program teams",
    description: "For growing biotech teams coordinating multiple discovery programs.",
    usdMonthly: 799,
    inrMonthly: 66999,
    seats: "Up to 30 researchers",
    features: [
      "250,000 generated molecules / month",
      "25,000 docking and GNINA jobs",
      "Expanded quantum compute credits",
      "1 TB research storage",
      "API and workflow integrations",
      "Priority onboarding and support",
    ],
    cta: "Choose Scale",
    href: "/signup?plan=scale",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    eyebrow: "Private and governed",
    description: "For regulated organizations requiring tailored capacity and controls.",
    usdMonthly: null,
    inrMonthly: null,
    seats: "Unlimited researchers",
    features: [
      "Custom compute and storage limits",
      "Private cloud or on-premise deployment",
      "SSO, SCIM, and advanced audit controls",
      "Custom model and data integrations",
      "Security and procurement review",
      "Dedicated scientific success team",
    ],
    cta: "Contact sales",
    href: "/signup?plan=enterprise",
  },
];

const FALLBACK_RATES: Record<string, number> = {
  USD: 1,
  INR: 83.5,
  EUR: 0.92,
  GBP: 0.79,
  AED: 3.67,
  AUD: 1.52,
  CAD: 1.37,
  CHF: 0.9,
  JPY: 157,
  SGD: 1.35,
};

function roundConvertedPrice(value: number) {
  if (value >= 10000) return Math.round(value / 100) * 100;
  if (value >= 1000) return Math.round(value / 10) * 10;
  return Math.round(value);
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: value < 100 ? 2 : 0,
  }).format(value);
}

function getCurrencyName(currency: string) {
  try {
    return new Intl.DisplayNames(["en"], { type: "currency" }).of(currency) ?? currency;
  } catch {
    return currency;
  }
}

export function PricingExperience({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("annual");
  const [currency, setCurrency] = useState("USD");
  const [rates, setRates] = useState<Record<string, number>>(FALLBACK_RATES);
  const [ratesAreLive, setRatesAreLive] = useState(false);
  const [checkoutPlanId, setCheckoutPlanId] = useState<string | null>(null);
  const [checkoutMessage, setCheckoutMessage] = useState<{
    tone: "info" | "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadRates() {
      try {
        const response = await fetch("https://open.er-api.com/v6/latest/USD", {
          signal: controller.signal,
        });
        if (!response.ok) return;

        const data = (await response.json()) as {
          result?: string;
          rates?: Record<string, number>;
        };
        if (data.result === "success" && data.rates) {
          setRates({ ...data.rates, USD: 1 });
          setRatesAreLive(true);
        }
      } catch {
        // The locally defined rates keep pricing usable if the public rate service is unavailable.
      }
    }

    loadRates();
    return () => controller.abort();
  }, []);

  const currencies = Object.keys(rates).sort((left, right) => {
    const priority = ["USD", "INR"];
    const leftPriority = priority.indexOf(left);
    const rightPriority = priority.indexOf(right);
    if (leftPriority !== -1 || rightPriority !== -1) {
      if (leftPriority === -1) return 1;
      if (rightPriority === -1) return -1;
      return leftPriority - rightPriority;
    }
    return left.localeCompare(right);
  });

  function monthlyPrice(plan: Plan) {
    if (plan.usdMonthly === null) return null;
    if (currency === "INR" && plan.inrMonthly !== null) return plan.inrMonthly;

    const rate = rates[currency] ?? 1;
    return roundConvertedPrice(plan.usdMonthly * rate);
  }

  function signupHref(plan: Plan) {
    const separator = plan.href.includes("?") ? "&" : "?";
    return `${plan.href}${separator}billing=${billingCycle}`;
  }

  function checkoutCurrency(): PaymentCurrency {
    return currency === "USD" ? "USD" : "INR";
  }

  async function startCheckout(plan: Plan) {
    if (plan.usdMonthly === 0 || plan.usdMonthly === null) {
      router.push(signupHref(plan));
      return;
    }

    if (typeof window !== "undefined" && !window.localStorage.getItem("auth_token")) {
      router.push(signupHref(plan));
      return;
    }

    const orderCurrency = checkoutCurrency();
    setCheckoutPlanId(plan.id);
    setCheckoutMessage({
      tone: "info",
      text:
        currency === orderCurrency
          ? "Preparing secure Razorpay checkout..."
          : `Preparing secure Razorpay checkout in ${orderCurrency}.`,
    });

    try {
      const order = await createRazorpayOrder({
        planId: plan.id,
        billingCycle,
        currency: orderCurrency,
      });
      await loadRazorpayCheckout();

      if (!window.Razorpay) {
        throw new Error("Razorpay checkout did not load.");
      }

      const checkout = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: "QuDrugForge",
        description: `${order.plan_name} ${order.billing_cycle} plan`,
        order_id: order.order_id,
        notes: {
          plan_id: order.plan_id,
          billing_cycle: order.billing_cycle,
        },
        theme: {
          color: "#2563eb",
        },
        modal: {
          ondismiss: () => {
            setCheckoutPlanId(null);
            setCheckoutMessage({ tone: "info", text: "Checkout closed before payment." });
          },
        },
        handler: async (response) => {
          try {
            const verification = await verifyRazorpayPayment({
              planId: order.plan_id,
              billingCycle: order.billing_cycle,
              response,
            });
            if (!verification.verified) {
              throw new Error("Payment verification failed.");
            }
            setCheckoutMessage({
              tone: "success",
              text: "Payment verified. Your subscription change is ready for activation.",
            });
            router.push("/billing");
          } catch {
            setCheckoutMessage({
              tone: "error",
              text: "Payment was received but verification failed. Please contact support with your payment ID.",
            });
          } finally {
            setCheckoutPlanId(null);
          }
        },
      });

      checkout.on("payment.failed", (response) => {
        setCheckoutPlanId(null);
        setCheckoutMessage({
          tone: "error",
          text: response.error?.description || "Payment failed before completion.",
        });
      });

      checkout.open();
    } catch (error) {
      setCheckoutPlanId(null);
      if (isPaymentAuthError(error)) {
        router.push(signupHref(plan));
        return;
      }
      if (error instanceof ApiError && error.status === 503) {
        setCheckoutMessage({
          tone: "info",
          text: "Razorpay checkout is wired but not configured on this environment yet.",
        });
        return;
      }
      setCheckoutMessage({
        tone: "error",
        text: "Checkout could not start. Please try again shortly.",
      });
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-border/70 bg-card/70 p-3 shadow-soft backdrop-blur-md sm:flex-row">
        <div className="flex w-full rounded-xl bg-surface-subtle p-1 sm:w-auto">
          {(["monthly", "annual"] as BillingCycle[]).map((cycle) => (
            <button
              key={cycle}
              type="button"
              onClick={() => setBillingCycle(cycle)}
              className={`flex-1 rounded-lg px-5 py-2.5 text-sm font-bold capitalize transition sm:flex-none ${
                billingCycle === cycle
                  ? "bg-card text-text shadow-sm"
                  : "text-text-secondary hover:text-text"
              }`}
              aria-pressed={billingCycle === cycle}
            >
              {cycle}
              {cycle === "annual" ? (
                <span className="ml-2 rounded-full bg-success/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-success">
                  Save 20%
                </span>
              ) : null}
            </button>
          ))}
        </div>

        <div className="flex w-full items-center gap-2 sm:w-auto">
          <div className="flex shrink-0 rounded-xl bg-surface-subtle p-1">
            {["USD", "INR"].map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setCurrency(code)}
                className={`rounded-lg px-3 py-2 text-xs font-black transition ${
                  currency === code ? "bg-card text-primary shadow-sm" : "text-text-secondary"
                }`}
                aria-pressed={currency === code}
              >
                {code}
              </button>
            ))}
          </div>

          <label className="min-w-0 flex-1 sm:w-52 sm:flex-none">
            <span className="sr-only">Select another currency</span>
            <select
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
              className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm font-semibold text-text outline-none transition focus:border-primary"
            >
              {currencies.map((code) => (
                <option key={code} value={code}>
                  {code} - {getCurrencyName(code)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
        {PLANS.map((plan) => {
          const baseMonthly = monthlyPrice(plan);
          const displayedMonthly =
            baseMonthly === null
              ? null
              : billingCycle === "annual"
                ? roundConvertedPrice(baseMonthly * ANNUAL_DISCOUNT)
                : baseMonthly;
          const annualTotal =
            baseMonthly === null ? null : roundConvertedPrice(baseMonthly * ANNUAL_DISCOUNT * 12);

          return (
            <article
              key={plan.name}
              className={`relative flex min-h-full flex-col overflow-hidden rounded-3xl border p-6 transition duration-300 hover:-translate-y-1 ${
                plan.featured
                  ? "border-primary/50 bg-primary/[0.07] shadow-[0_24px_60px_-30px_rgba(99,102,241,0.7)]"
                  : "border-border/80 bg-card/75 shadow-soft hover:border-primary/30"
              }`}
            >
              {plan.featured ? (
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-accent to-primary" />
              ) : null}

              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                {plan.eyebrow}
              </p>
              <h3 className="mt-3 font-heading text-2xl font-black tracking-tight text-text">
                {plan.name}
              </h3>
              <p className="mt-3 min-h-[4.5rem] text-sm font-medium leading-6 text-text-secondary">
                {plan.description}
              </p>

              <div className="mt-6 border-y border-border/70 py-5">
                {displayedMonthly === null ? (
                  <>
                    <p className="font-heading text-3xl font-black text-text">Custom</p>
                    <p className="mt-1 text-xs font-medium text-text-secondary">
                      Tailored to your deployment
                    </p>
                  </>
                ) : (
                  <>
                    <p className="flex items-end gap-1 text-text">
                      <span className="font-heading text-3xl font-black tracking-tight">
                        {formatCurrency(displayedMonthly, currency)}
                      </span>
                      <span className="pb-1 text-xs font-semibold text-text-secondary">/ month</span>
                    </p>
                    <p className="mt-1 min-h-4 text-xs font-medium text-text-secondary">
                      {plan.usdMonthly === 0
                        ? "No credit card required"
                        : billingCycle === "annual" && annualTotal !== null
                          ? `Billed ${formatCurrency(annualTotal, currency)} yearly`
                          : "Billed monthly"}
                    </p>
                  </>
                )}
              </div>

              <p className="mt-5 text-sm font-black text-text">{plan.seats}</p>
              <ul className="mt-4 flex-1 space-y-3">
                {plan.features.slice(0, compact ? 5 : undefined).map((feature) => (
                  <li key={feature} className="flex gap-2.5 text-sm font-medium leading-5 text-text-secondary">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-success/10 text-[10px] font-black text-success">
                      ✓
                    </span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {plan.usdMonthly === 0 || plan.usdMonthly === null ? (
                <Link
                  href={signupHref(plan)}
                  className={`mt-7 flex h-11 items-center justify-center rounded-xl px-4 text-sm font-black transition ${
                    plan.featured
                      ? "btn-primary-glow"
                      : "border border-border bg-surface-subtle text-text hover:border-primary/40 hover:text-primary"
                  }`}
                >
                  {plan.cta}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => startCheckout(plan)}
                  disabled={checkoutPlanId === plan.id}
                className={`mt-7 flex h-11 items-center justify-center rounded-xl px-4 text-sm font-black transition ${
                  plan.featured
                    ? "btn-primary-glow"
                    : "border border-border bg-surface-subtle text-text hover:border-primary/40 hover:text-primary"
                } disabled:cursor-wait disabled:opacity-70`}
                >
                  {checkoutPlanId === plan.id ? "Preparing..." : plan.cta}
                </button>
              )}
            </article>
          );
        })}
      </div>

      {checkoutMessage ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
            checkoutMessage.tone === "success"
              ? "border-success/30 bg-success/10 text-success"
              : checkoutMessage.tone === "error"
                ? "border-danger/30 bg-danger/10 text-danger"
                : "border-primary/30 bg-primary/10 text-primary"
          }`}
          role="status"
        >
          {checkoutMessage.text}
        </div>
      ) : null}

      <div className="flex flex-col justify-between gap-2 text-xs font-medium text-text-secondary sm:flex-row">
        <p>Prices exclude applicable taxes. Compute overages are billed separately.</p>
        <p>
          {currency === "USD" || currency === "INR"
            ? `${currency} uses localized plan pricing.`
            : ratesAreLive
              ? `${currency} is converted from USD using current market rates.`
              : `${currency} is an estimated conversion; checkout rates may vary.`}
        </p>
      </div>
    </div>
  );
}
