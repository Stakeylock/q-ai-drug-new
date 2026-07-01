from __future__ import annotations

import hashlib
import hmac
from decimal import Decimal, ROUND_HALF_UP
from typing import Literal
from uuid import uuid4

import httpx
from fastapi import APIRouter, Body, Depends, status
from pydantic import BaseModel, Field, field_validator

from app.core.config import settings
from app.core.dependencies import get_current_active_user
from app.core.exceptions import AppException

router = APIRouter(tags=["Billing"])

BillingCycle = Literal["monthly", "annual"]
CurrencyCode = Literal["INR", "USD"]

ANNUAL_DISCOUNT = Decimal("0.80")
MINOR_UNITS: dict[str, Decimal] = {
    "INR": Decimal("100"),
    "USD": Decimal("100"),
}


class PlanPrice(BaseModel):
    inr_monthly: Decimal
    usd_monthly: Decimal


class BillingPlan(BaseModel):
    id: str
    name: str
    price: PlanPrice | None
    checkout_enabled: bool = True


PLAN_CATALOG: dict[str, BillingPlan] = {
    "free": BillingPlan(
        id="free",
        name="Free",
        price=PlanPrice(inr_monthly=Decimal("0"), usd_monthly=Decimal("0")),
        checkout_enabled=False,
    ),
    "explorer": BillingPlan(
        id="explorer",
        name="Explorer",
        price=PlanPrice(inr_monthly=Decimal("6499"), usd_monthly=Decimal("79")),
    ),
    "research": BillingPlan(
        id="research",
        name="Research",
        price=PlanPrice(inr_monthly=Decimal("24999"), usd_monthly=Decimal("299")),
    ),
    "scale": BillingPlan(
        id="scale",
        name="Scale",
        price=PlanPrice(inr_monthly=Decimal("66999"), usd_monthly=Decimal("799")),
    ),
    "enterprise": BillingPlan(
        id="enterprise",
        name="Enterprise",
        price=None,
        checkout_enabled=False,
    ),
}


class RazorpayOrderRequest(BaseModel):
    plan_id: str = Field(..., min_length=2, max_length=40)
    billing_cycle: BillingCycle = "annual"
    currency: CurrencyCode = "INR"

    @field_validator("plan_id")
    @classmethod
    def normalize_plan_id(cls, value: str) -> str:
        return value.strip().lower().replace(" ", "_").replace("-", "_")


class RazorpayVerifyRequest(BaseModel):
    plan_id: str = Field(..., min_length=2, max_length=40)
    billing_cycle: BillingCycle = "annual"
    razorpay_order_id: str = Field(..., min_length=4, max_length=100)
    razorpay_payment_id: str = Field(..., min_length=4, max_length=100)
    razorpay_signature: str = Field(..., min_length=32, max_length=256)

    @field_validator("plan_id")
    @classmethod
    def normalize_plan_id(cls, value: str) -> str:
        return value.strip().lower().replace(" ", "_").replace("-", "_")


def _razorpay_is_configured() -> bool:
    return bool(settings.RAZORPAY_KEY_ID.strip() and settings.RAZORPAY_KEY_SECRET.strip())


def _get_checkout_plan(plan_id: str) -> BillingPlan:
    plan = PLAN_CATALOG.get(plan_id)
    if not plan:
        raise AppException(
            code="UNKNOWN_PLAN",
            message="Selected billing plan is not available.",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )
    if not plan.checkout_enabled or not plan.price:
        raise AppException(
            code="PLAN_CHECKOUT_DISABLED",
            message="Selected plan does not use self-serve checkout.",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )
    return plan


def _amount_for_plan(plan: BillingPlan, cycle: BillingCycle, currency: CurrencyCode) -> tuple[int, Decimal]:
    if not plan.price:
        raise AppException(
            code="PLAN_PRICE_MISSING",
            message="Selected plan does not have a checkout price.",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )

    monthly = plan.price.inr_monthly if currency == "INR" else plan.price.usd_monthly
    major_amount = monthly if cycle == "monthly" else monthly * Decimal("12") * ANNUAL_DISCOUNT
    major_amount = major_amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    minor_amount = int((major_amount * MINOR_UNITS[currency]).to_integral_value(rounding=ROUND_HALF_UP))
    return minor_amount, major_amount


async def _create_remote_razorpay_order(payload: dict) -> dict:
    api_url = settings.RAZORPAY_API_URL.rstrip("/")
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(
            f"{api_url}/orders",
            json=payload,
            auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET),
        )
    if response.status_code >= 400:
        raise AppException(
            code="RAZORPAY_ORDER_FAILED",
            message="Razorpay could not create a checkout order.",
            status_code=status.HTTP_502_BAD_GATEWAY,
            details={"provider_status": response.status_code},
        )
    return response.json()


@router.get("/billing/razorpay/config")
async def get_razorpay_config():
    return {
        "success": True,
        "data": {
            "provider": "razorpay",
            "configured": _razorpay_is_configured(),
            "key_id": settings.RAZORPAY_KEY_ID if _razorpay_is_configured() else None,
            "plans": [
                {
                    "id": plan.id,
                    "name": plan.name,
                    "checkout_enabled": plan.checkout_enabled,
                    "currencies": list(MINOR_UNITS.keys()) if plan.checkout_enabled else [],
                }
                for plan in PLAN_CATALOG.values()
            ],
        },
        "message": "Razorpay checkout configuration fetched",
    }


@router.post("/billing/razorpay/order")
async def create_razorpay_order(
    request: RazorpayOrderRequest = Body(...),
    current_user: dict = Depends(get_current_active_user),
):
    if not _razorpay_is_configured():
        raise AppException(
            code="PAYMENTS_NOT_CONFIGURED",
            message="Razorpay checkout is not configured for this environment.",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    plan = _get_checkout_plan(request.plan_id)
    amount_minor, amount_major = _amount_for_plan(plan, request.billing_cycle, request.currency)
    receipt = f"qdf_{plan.id}_{uuid4().hex[:18]}"
    order_payload = {
        "amount": amount_minor,
        "currency": request.currency,
        "receipt": receipt,
        "payment_capture": 1,
        "notes": {
            "plan_id": plan.id,
            "billing_cycle": request.billing_cycle,
            "user_id": str(current_user.get("_id", "")),
        },
    }

    provider_order = await _create_remote_razorpay_order(order_payload)
    order_id = provider_order.get("id")
    if not order_id:
        raise AppException(
            code="RAZORPAY_ORDER_INVALID",
            message="Razorpay returned an invalid checkout order.",
            status_code=status.HTTP_502_BAD_GATEWAY,
        )

    return {
        "success": True,
        "data": {
            "provider": "razorpay",
            "key_id": settings.RAZORPAY_KEY_ID,
            "order_id": order_id,
            "amount": amount_minor,
            "amount_display": str(amount_major),
            "currency": request.currency,
            "plan_id": plan.id,
            "plan_name": plan.name,
            "billing_cycle": request.billing_cycle,
            "receipt": provider_order.get("receipt", receipt),
        },
        "message": "Razorpay order created",
    }


@router.post("/billing/razorpay/verify")
async def verify_razorpay_payment(
    request: RazorpayVerifyRequest = Body(...),
    current_user: dict = Depends(get_current_active_user),
):
    if not _razorpay_is_configured():
        raise AppException(
            code="PAYMENTS_NOT_CONFIGURED",
            message="Razorpay checkout is not configured for this environment.",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    _get_checkout_plan(request.plan_id)
    signed_payload = f"{request.razorpay_order_id}|{request.razorpay_payment_id}"
    expected = hmac.new(
        settings.RAZORPAY_KEY_SECRET.encode("utf-8"),
        signed_payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected, request.razorpay_signature):
        raise AppException(
            code="RAZORPAY_SIGNATURE_INVALID",
            message="Payment signature verification failed.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    return {
        "success": True,
        "data": {
            "provider": "razorpay",
            "verified": True,
            "plan_id": request.plan_id,
            "billing_cycle": request.billing_cycle,
            "payment_id": request.razorpay_payment_id,
            "user_id": str(current_user.get("_id", "")),
        },
        "message": "Razorpay payment verified",
    }
