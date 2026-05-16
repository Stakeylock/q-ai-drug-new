from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from q_ai_drug.product.module_registry import TIER_ORDER, TIER_QUOTAS, estimate_credits
from q_ai_drug.service.db import BillingAccountRecord, CreditLedgerRecord, UsageEventRecord, session_scope


MONTHLY_CREDIT_LIMITS = {
    "student_free": 100.0,
    "student_pro": 500.0,
    "academic_researcher": 2500.0,
    "professional_individual": 5000.0,
    "startup_team": 20000.0,
    "cro_service_lab": 50000.0,
    "industry_biotech": 200000.0,
    "enterprise_pharma": 1000000.0,
    "private_deployment": 1000000.0,
}


class BillingError(RuntimeError):
    pass


class QuotaError(BillingError):
    pass


def normalize_tier(tier: str | None) -> str:
    key = (tier or "student_free").strip().lower().replace(" ", "_").replace("/", "").replace("-", "_")
    return key if key in TIER_ORDER else "student_free"


def _numeric(value: Any) -> float | None:
    if isinstance(value, (int, float)):
        return float(value)
    return None


def ensure_billing_account(organization_id: str, requested_tier: str | None = None) -> BillingAccountRecord:
    tier = normalize_tier(requested_tier)
    with session_scope() as session:
        account = session.query(BillingAccountRecord).filter(BillingAccountRecord.organization_id == organization_id).first()
        if not account:
            limit = MONTHLY_CREDIT_LIMITS[tier]
            account = BillingAccountRecord(
                id=str(uuid.uuid4()),
                organization_id=organization_id,
                plan_tier=tier,
                credit_balance=limit,
                monthly_credit_limit=limit,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
            session.add(account)
            session.flush()
        session.expunge(account)
        return account


def _usage_since(organization_id: str, event_type: str, since: datetime) -> float:
    with session_scope() as session:
        rows = (
            session.query(UsageEventRecord)
            .filter(
                UsageEventRecord.organization_id == organization_id,
                UsageEventRecord.event_type == event_type,
                UsageEventRecord.created_at >= since,
            )
            .all()
        )
        return float(sum(row.quantity for row in rows))


def check_quota(organization_id: str, module_id: str, payload: dict[str, Any], tier: str | None = None) -> dict[str, Any]:
    account = ensure_billing_account(organization_id)
    account_tier = normalize_tier(account.plan_tier)
    tier_key = normalize_tier(tier or account.plan_tier)
    if TIER_ORDER.index(tier_key) > TIER_ORDER.index(account_tier):
        raise QuotaError(f"requested tier {tier_key} exceeds organization plan {account_tier}")
    quotas = TIER_QUOTAS[tier_key]
    molecule_count = float(payload.get("molecule_count") or payload.get("candidate_count") or payload.get("n_generate") or 0)
    docking_pairs = float(payload.get("docking_pairs") or 0)
    qm_rows = float(payload.get("qm_rows") or 0)
    failures: list[str] = []
    molecule_limit = _numeric(quotas.get("molecules_per_run"))
    if molecule_limit is not None and molecule_count > molecule_limit:
        failures.append(f"molecule_count {molecule_count:g} exceeds {tier_key} per-run limit {molecule_limit:g}")
    month_start = datetime.now(timezone.utc) - timedelta(days=30)
    docking_limit = _numeric(quotas.get("docking_pairs_month"))
    if docking_limit is not None and docking_pairs + _usage_since(organization_id, "docking_pairs_requested", month_start) > docking_limit:
        failures.append(f"docking pair request exceeds {tier_key} monthly quota {docking_limit:g}")
    qm_limit = _numeric(quotas.get("qm_rows_month"))
    if qm_limit is not None and qm_rows + _usage_since(organization_id, "qm_rows_requested", month_start) > qm_limit:
        failures.append(f"QM row request exceeds {tier_key} monthly quota {qm_limit:g}")
    credits = 0.1 if payload.get("_dry_run") else estimate_credits(module_id, payload)
    if credits > account.credit_balance:
        failures.append(f"estimated credits {credits:g} exceed available balance {account.credit_balance:g}")
    if failures:
        raise QuotaError("; ".join(failures))
    return {
        "organization_id": organization_id,
        "tier": tier_key,
        "plan_tier": account_tier,
        "estimated_credits": credits,
        "credit_balance": account.credit_balance,
        "quotas": quotas,
    }


def consume_credits(
    organization_id: str,
    *,
    credits: float,
    transaction_type: str,
    project_id: str | None = None,
    run_id: str | None = None,
    module_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> CreditLedgerRecord:
    with session_scope() as session:
        account = session.query(BillingAccountRecord).filter(BillingAccountRecord.organization_id == organization_id).first()
        if not account:
            account = BillingAccountRecord(
                id=str(uuid.uuid4()),
                organization_id=organization_id,
                plan_tier="student_free",
                credit_balance=MONTHLY_CREDIT_LIMITS["student_free"],
                monthly_credit_limit=MONTHLY_CREDIT_LIMITS["student_free"],
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
            session.add(account)
            session.flush()
        balance_after = account.credit_balance - float(credits)
        if balance_after < -1e-9:
            raise QuotaError("Insufficient credits.")
        account.credit_balance = balance_after
        account.updated_at = datetime.now(timezone.utc)
        row = CreditLedgerRecord(
            id=str(uuid.uuid4()),
            organization_id=organization_id,
            project_id=project_id,
            run_id=run_id,
            module_id=module_id,
            transaction_type=transaction_type,
            credits=float(credits),
            balance_after=balance_after,
            metadata_json=metadata,
            created_at=datetime.now(timezone.utc),
        )
        session.add(row)
        session.flush()
        session.expunge(row)
        return row


def billing_summary(organization_id: str) -> dict[str, Any]:
    account = ensure_billing_account(organization_id)
    with session_scope() as session:
        ledger = (
            session.query(CreditLedgerRecord)
            .filter(CreditLedgerRecord.organization_id == organization_id)
            .order_by(CreditLedgerRecord.created_at.desc())
            .limit(100)
            .all()
        )
        usage = (
            session.query(UsageEventRecord)
            .filter(UsageEventRecord.organization_id == organization_id)
            .order_by(UsageEventRecord.created_at.desc())
            .limit(200)
            .all()
        )
        return {
            "organization_id": organization_id,
            "plan_tier": account.plan_tier,
            "credit_balance": account.credit_balance,
            "monthly_credit_limit": account.monthly_credit_limit,
            "quotas": TIER_QUOTAS.get(account.plan_tier, TIER_QUOTAS["student_free"]),
            "ledger": [
                {
                    "id": row.id,
                    "transaction_type": row.transaction_type,
                    "credits": row.credits,
                    "balance_after": row.balance_after,
                    "project_id": row.project_id,
                    "run_id": row.run_id,
                    "module_id": row.module_id,
                    "created_at": row.created_at.isoformat(),
                    "metadata": row.metadata_json,
                }
                for row in ledger
            ],
            "recent_usage": [
                {
                    "event_type": row.event_type,
                    "quantity": row.quantity,
                    "project_id": row.project_id,
                    "run_id": row.run_id,
                    "created_at": row.created_at.isoformat(),
                    "metadata": row.metadata_json,
                }
                for row in usage
            ],
        }


def set_plan_tier(organization_id: str, tier: str) -> dict[str, Any]:
    tier_key = normalize_tier(tier)
    with session_scope() as session:
        account = session.query(BillingAccountRecord).filter(BillingAccountRecord.organization_id == organization_id).first()
        if not account:
            limit = MONTHLY_CREDIT_LIMITS[tier_key]
            account = BillingAccountRecord(
                id=str(uuid.uuid4()),
                organization_id=organization_id,
                plan_tier=tier_key,
                credit_balance=limit,
                monthly_credit_limit=limit,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
            session.add(account)
        else:
            previous_limit = account.monthly_credit_limit
            new_limit = MONTHLY_CREDIT_LIMITS[tier_key]
            account.plan_tier = tier_key
            account.monthly_credit_limit = new_limit
            if new_limit >= previous_limit:
                account.credit_balance = account.credit_balance + (new_limit - previous_limit)
            else:
                account.credit_balance = min(account.credit_balance, new_limit)
            account.updated_at = datetime.now(timezone.utc)
        session.flush()
        return {
            "organization_id": organization_id,
            "plan_tier": account.plan_tier,
            "credit_balance": account.credit_balance,
            "monthly_credit_limit": account.monthly_credit_limit,
            "quotas": TIER_QUOTAS[account.plan_tier],
        }


def credit_commit(
    organization_id: str,
    *,
    run_id: str,
    module_id: str,
    actual_credits: float,
    reserved_credits: float,
    project_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Commit actual credits used after module execution completes.

    If actual_credits < reserved_credits, the difference is refunded.
    If actual_credits > reserved_credits, additional credits are consumed
    (the caller should have already validated quota).

    Args:
        organization_id: Organization to commit against
        run_id: Run/job ID that completed
        module_id: Module that completed
        actual_credits: Credits actually consumed
        reserved_credits: Credits reserved at queue time
        project_id: Optional project context
        metadata: Optional additional metadata

    Returns:
        Summary of commit operation
    """
    actual = round(max(0.0, float(actual_credits)), 4)
    reserved = round(max(0.0, float(reserved_credits)), 4)
    delta = actual - reserved  # Positive = additional charge, negative = refund

    commit_row = None
    refund_row = None

    if delta > 0:
        # Additional credits needed
        commit_row = consume_credits(
            organization_id,
            credits=delta,
            transaction_type="credit_commit_additional",
            project_id=project_id,
            run_id=run_id,
            module_id=module_id,
            metadata={**(metadata or {}), "actual_credits": actual, "reserved_credits": reserved},
        )
    elif delta < 0:
        # Refund unused credits
        refund_amount = abs(delta)
        with session_scope() as session:
            account = session.query(BillingAccountRecord).filter(
                BillingAccountRecord.organization_id == organization_id
            ).first()
            if account:
                account.credit_balance = account.credit_balance + refund_amount
                account.updated_at = datetime.now(timezone.utc)
                refund_row = CreditLedgerRecord(
                    id=str(uuid.uuid4()),
                    organization_id=organization_id,
                    project_id=project_id,
                    run_id=run_id,
                    module_id=module_id,
                    transaction_type="credit_refund",
                    credits=-refund_amount,  # Negative = refund
                    balance_after=account.credit_balance,
                    metadata_json={**(metadata or {}), "actual_credits": actual, "reserved_credits": reserved},
                    created_at=datetime.now(timezone.utc),
                )
                session.add(refund_row)
                session.flush()

    # Always write a commit record for audit
    with session_scope() as session:
        audit_row = CreditLedgerRecord(
            id=str(uuid.uuid4()),
            organization_id=organization_id,
            project_id=project_id,
            run_id=run_id,
            module_id=module_id,
            transaction_type="credit_commit",
            credits=actual,
            balance_after=None,  # Will be resolved from account
            metadata_json={**(metadata or {}), "actual_credits": actual, "reserved_credits": reserved, "delta": delta},
            created_at=datetime.now(timezone.utc),
        )
        # Resolve balance_after
        account = session.query(BillingAccountRecord).filter(
            BillingAccountRecord.organization_id == organization_id
        ).first()
        if account:
            audit_row.balance_after = account.credit_balance
        else:
            audit_row.balance_after = 0.0
        session.add(audit_row)
        session.flush()

    return {
        "organization_id": organization_id,
        "run_id": run_id,
        "module_id": module_id,
        "actual_credits": actual,
        "reserved_credits": reserved,
        "delta": delta,
        "refunded": max(0.0, -delta),
        "additional_charged": max(0.0, delta),
        "status": "committed",
    }


def credit_refund(
    organization_id: str,
    *,
    run_id: str,
    module_id: str,
    refund_amount: float,
    reason: str = "module_cancelled_or_failed",
    project_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Refund credits for a cancelled or failed run.

    Used when a module fails before consuming any credits, or when
    a job is cancelled. Restores reserved credits to the account balance.

    Args:
        organization_id: Organization to refund
        run_id: Run/job ID that failed/cancelled
        module_id: Module that failed
        refund_amount: Credits to refund
        reason: Reason for refund
        project_id: Optional project context
        metadata: Optional additional metadata

    Returns:
        Summary of refund operation
    """
    amount = round(max(0.0, float(refund_amount)), 4)
    if amount == 0.0:
        return {"status": "no_refund_needed", "amount": 0.0}

    with session_scope() as session:
        account = session.query(BillingAccountRecord).filter(
            BillingAccountRecord.organization_id == organization_id
        ).first()
        if not account:
            return {"status": "account_not_found", "amount": 0.0}

        account.credit_balance = account.credit_balance + amount
        account.updated_at = datetime.now(timezone.utc)

        row = CreditLedgerRecord(
            id=str(uuid.uuid4()),
            organization_id=organization_id,
            project_id=project_id,
            run_id=run_id,
            module_id=module_id,
            transaction_type="credit_refund",
            credits=-amount,  # Negative = refund
            balance_after=account.credit_balance,
            metadata_json={**(metadata or {}), "reason": reason, "refund_amount": amount},
            created_at=datetime.now(timezone.utc),
        )
        session.add(row)
        session.flush()

    return {
        "organization_id": organization_id,
        "run_id": run_id,
        "module_id": module_id,
        "refunded": amount,
        "reason": reason,
        "status": "refunded",
    }

