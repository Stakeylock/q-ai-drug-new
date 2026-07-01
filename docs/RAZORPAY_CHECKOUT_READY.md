# Razorpay Checkout Readiness

The pricing UI is wired for Razorpay checkout, but live payments remain disabled
until production keys are injected into the backend environment.

## Environment

Set these only on the backend service or secret manager:

```env
RAZORPAY_KEY_ID=rzp_live_xxxxx
RAZORPAY_KEY_SECRET=xxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxx
RAZORPAY_API_URL=https://api.razorpay.com/v1
```

Do not expose `RAZORPAY_KEY_SECRET` through `NEXT_PUBLIC_*`, Vite, or static
frontend environment variables.

## Flow

1. A signed-in user clicks a paid pricing plan.
2. The frontend calls `POST /api/v1/billing/razorpay/order`.
3. The backend validates the plan and amount from its server-side catalog.
4. The backend creates a Razorpay order and returns only the public `key_id`.
5. Razorpay Checkout collects payment in the browser.
6. The frontend posts Razorpay's response to `POST /api/v1/billing/razorpay/verify`.
7. The backend verifies the HMAC signature with `RAZORPAY_KEY_SECRET`.

Free and Enterprise plans do not use self-serve checkout.
