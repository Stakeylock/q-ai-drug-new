import hashlib
import hmac

import pytest

from app.core.config import settings
from app.api.v1 import billing as billing_api


@pytest.mark.asyncio
async def test_razorpay_order_requires_auth(async_client):
    response = await async_client.post(
        "/api/v1/billing/razorpay/order",
        json={"plan_id": "research", "billing_cycle": "annual", "currency": "INR"},
    )

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_razorpay_order_reports_unconfigured_environment(async_client, auth_headers, monkeypatch):
    monkeypatch.setattr(settings, "RAZORPAY_KEY_ID", "")
    monkeypatch.setattr(settings, "RAZORPAY_KEY_SECRET", "")

    response = await async_client.post(
        "/api/v1/billing/razorpay/order",
        json={"plan_id": "research", "billing_cycle": "annual", "currency": "INR"},
        headers=auth_headers,
    )

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "PAYMENTS_NOT_CONFIGURED"


@pytest.mark.asyncio
async def test_razorpay_order_uses_server_catalog_amount(async_client, auth_headers, monkeypatch):
    monkeypatch.setattr(settings, "RAZORPAY_KEY_ID", "rzp_test_public")
    monkeypatch.setattr(settings, "RAZORPAY_KEY_SECRET", "test_secret_32_chars_minimum_value")

    captured_payload = {}

    async def fake_create_order(payload):
        captured_payload.update(payload)
        return {"id": "order_test_123", "receipt": payload["receipt"]}

    monkeypatch.setattr(billing_api, "_create_remote_razorpay_order", fake_create_order)

    response = await async_client.post(
        "/api/v1/billing/razorpay/order",
        json={"plan_id": "research", "billing_cycle": "annual", "currency": "INR"},
        headers=auth_headers,
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["key_id"] == "rzp_test_public"
    assert data["order_id"] == "order_test_123"
    assert data["amount"] == 23999040
    assert data["amount_display"] == "239990.40"
    assert captured_payload["amount"] == 23999040
    assert captured_payload["currency"] == "INR"
    assert captured_payload["notes"]["plan_id"] == "research"


@pytest.mark.asyncio
async def test_razorpay_verify_rejects_bad_signature(async_client, auth_headers, monkeypatch):
    monkeypatch.setattr(settings, "RAZORPAY_KEY_ID", "rzp_test_public")
    monkeypatch.setattr(settings, "RAZORPAY_KEY_SECRET", "test_secret_32_chars_minimum_value")

    response = await async_client.post(
        "/api/v1/billing/razorpay/verify",
        json={
            "plan_id": "research",
            "billing_cycle": "annual",
            "razorpay_order_id": "order_test_123",
            "razorpay_payment_id": "pay_test_123",
            "razorpay_signature": "bad_signature_value_bad_signature_value",
        },
        headers=auth_headers,
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "RAZORPAY_SIGNATURE_INVALID"


@pytest.mark.asyncio
async def test_razorpay_verify_accepts_valid_signature(async_client, auth_headers, monkeypatch):
    secret = "test_secret_32_chars_minimum_value"
    monkeypatch.setattr(settings, "RAZORPAY_KEY_ID", "rzp_test_public")
    monkeypatch.setattr(settings, "RAZORPAY_KEY_SECRET", secret)
    order_id = "order_test_123"
    payment_id = "pay_test_123"
    signature = hmac.new(
        secret.encode("utf-8"),
        f"{order_id}|{payment_id}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    response = await async_client.post(
        "/api/v1/billing/razorpay/verify",
        json={
            "plan_id": "research",
            "billing_cycle": "annual",
            "razorpay_order_id": order_id,
            "razorpay_payment_id": payment_id,
            "razorpay_signature": signature,
        },
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["data"]["verified"] is True
