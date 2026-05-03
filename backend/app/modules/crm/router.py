"""CRM router — /api/crm.

Exposes a full Customer-Relationship-Management API:
- accounts (B2B agencies, direct customers, MICE…)
- contacts (people inside an account)
- activities (call/meeting/email/note timeline)
- deals (sales pipeline, Kanban)
- tasks (next-best-actions)
- 360° view (one endpoint returning everything for an account)
- pipeline view (Kanban grouped by stage)
- dashboard KPIs
"""
from __future__ import annotations
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.tenant import get_current_company_id
from app.shared.dependencies import require_auth

from app.modules.crm.models import (
    CrmAccount, CrmContact, CrmActivity, CrmDeal, CrmTask,
)
from app.modules.crm import schemas as S


router = APIRouter(
    prefix="/crm",
    tags=["crm"],
    dependencies=[Depends(require_auth)],
)


# ── helpers ────────────────────────────────────────────────────────────────
PIPELINE_STAGES = [
    ("qualification", "Qualification"),
    ("proposal",      "Proposition"),
    ("negotiation",   "Négociation"),
    ("won",           "Gagné"),
    ("lost",          "Perdu"),
]
OPEN_STAGES = {"qualification", "proposal", "negotiation"}


def _account_or_404(db: Session, company_id: str, account_id: str) -> CrmAccount:
    a = (
        db.query(CrmAccount)
        .filter(CrmAccount.company_id == company_id, CrmAccount.id == account_id)
        .first()
    )
    if not a:
        raise HTTPException(404, "Account not found")
    return a


def _now() -> datetime:
    # Naive UTC to align with SQLite-stored values
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _log_activity(db: Session, *, company_id: str, account_id: str,
                  type_: str, title: str, description: str | None = None,
                  deal_id: str | None = None, owner_user_id: str | None = None) -> None:
    db.add(CrmActivity(
        company_id=company_id, account_id=account_id, deal_id=deal_id,
        type=type_, title=title, description=description,
        occurred_at=_now(), owner_user_id=owner_user_id,
    ))


# ── Accounts ───────────────────────────────────────────────────────────────
@router.get("/accounts", response_model=list[S.AccountOut])
def list_accounts(
    q: Optional[str] = Query(None, description="search by name/email/country"),
    tier: Optional[str] = None,
    lifecycle_stage: Optional[str] = None,
    account_type: Optional[str] = None,
    country: Optional[str] = None,
    owner_user_id: Optional[str] = None,
    limit: int = Query(200, le=1000),
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    query = db.query(CrmAccount).filter(
        CrmAccount.company_id == company_id, CrmAccount.active == True,
    )
    if q:
        like = f"%{q.lower()}%"
        query = query.filter(
            func.lower(CrmAccount.name).like(like)
            | func.lower(CrmAccount.primary_email).like(like)
            | func.lower(CrmAccount.country).like(like)
        )
    if tier:
        query = query.filter(CrmAccount.tier == tier)
    if lifecycle_stage:
        query = query.filter(CrmAccount.lifecycle_stage == lifecycle_stage)
    if account_type:
        query = query.filter(CrmAccount.account_type == account_type)
    if country:
        query = query.filter(CrmAccount.country == country)
    if owner_user_id:
        query = query.filter(CrmAccount.owner_user_id == owner_user_id)
    return query.order_by(CrmAccount.updated_at.desc()).limit(limit).all()


@router.post("/accounts", response_model=S.AccountOut, status_code=201)
def create_account(
    data: S.AccountIn,
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    row = CrmAccount(company_id=company_id, **data.model_dump())
    db.add(row)
    db.flush()
    _log_activity(db, company_id=company_id, account_id=row.id,
                  type_="note", title=f"Compte créé: {row.name}")
    db.commit()
    db.refresh(row)
    return row


@router.get("/accounts/{account_id}", response_model=S.AccountOut)
def get_account(
    account_id: str,
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    return _account_or_404(db, company_id, account_id)


@router.patch("/accounts/{account_id}", response_model=S.AccountOut)
def update_account(
    account_id: str,
    data: S.AccountUpdate,
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    row = _account_or_404(db, company_id, account_id)
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/accounts/{account_id}", status_code=204)
def delete_account(
    account_id: str,
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    row = _account_or_404(db, company_id, account_id)
    row.active = False
    db.commit()
    return None


# ── Account 360 ────────────────────────────────────────────────────────────
@router.get("/accounts/{account_id}/360", response_model=S.Account360)
def account_360(
    account_id: str,
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    a = _account_or_404(db, company_id, account_id)

    contacts = (
        db.query(CrmContact)
        .filter(CrmContact.company_id == company_id, CrmContact.account_id == account_id, CrmContact.active == True)
        .order_by(CrmContact.is_primary.desc(), CrmContact.created_at.asc())
        .all()
    )
    activities = (
        db.query(CrmActivity)
        .filter(CrmActivity.company_id == company_id, CrmActivity.account_id == account_id)
        .order_by(CrmActivity.occurred_at.desc())
        .limit(50)
        .all()
    )
    deals = (
        db.query(CrmDeal)
        .filter(CrmDeal.company_id == company_id, CrmDeal.account_id == account_id, CrmDeal.active == True)
        .order_by(CrmDeal.created_at.desc())
        .all()
    )
    tasks = (
        db.query(CrmTask)
        .filter(CrmTask.company_id == company_id, CrmTask.account_id == account_id,
                CrmTask.completed_at.is_(None), CrmTask.active == True)
        .order_by(CrmTask.due_date.asc().nullslast() if hasattr(CrmTask.due_date.asc(), "nullslast") else CrmTask.due_date.asc())
        .all()
    )

    open_deals = [d for d in deals if d.stage in OPEN_STAGES]
    won_deals = [d for d in deals if d.stage == "won"]
    lost_deals = [d for d in deals if d.stage == "lost"]
    pipeline_value = float(sum(float(d.amount_mad or 0) for d in open_deals))
    won_revenue = float(sum(float(d.amount_mad or 0) for d in won_deals))
    total_proj = len(deals)
    conv = (len(won_deals) / total_proj * 100.0) if total_proj else 0.0
    cutoff = _now() - timedelta(days=30)
    activities_30d = sum(1 for ev in activities if ev.occurred_at and ev.occurred_at >= cutoff)

    stats = S.AccountStats(
        total_projects=total_proj,
        won_projects=len(won_deals),
        lost_projects=len(lost_deals),
        open_deals=len(open_deals),
        pipeline_value_mad=pipeline_value,
        won_revenue_mad=won_revenue,
        conversion_rate=round(conv, 1),
        open_tasks=len(tasks),
        activities_30d=activities_30d,
    )

    return S.Account360(
        account=a, contacts=contacts, activities=activities,
        deals=deals, tasks=tasks, stats=stats,
    )


# ── Contacts ───────────────────────────────────────────────────────────────
@router.get("/accounts/{account_id}/contacts", response_model=list[S.ContactOut])
def list_contacts(
    account_id: str,
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    _account_or_404(db, company_id, account_id)
    return (
        db.query(CrmContact)
        .filter(CrmContact.company_id == company_id, CrmContact.account_id == account_id, CrmContact.active == True)
        .order_by(CrmContact.is_primary.desc(), CrmContact.created_at.asc())
        .all()
    )


@router.post("/accounts/{account_id}/contacts", response_model=S.ContactOut, status_code=201)
def create_contact(
    account_id: str,
    data: S.ContactIn,
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    _account_or_404(db, company_id, account_id)
    row = CrmContact(company_id=company_id, account_id=account_id, **data.model_dump())
    db.add(row)
    db.flush()
    _log_activity(db, company_id=company_id, account_id=account_id,
                  type_="note", title=f"Contact ajouté: {row.first_name} {row.last_name or ''}".strip())
    db.commit()
    db.refresh(row)
    return row


@router.patch("/contacts/{contact_id}", response_model=S.ContactOut)
def update_contact(
    contact_id: str,
    data: S.ContactUpdate,
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    row = db.query(CrmContact).filter(
        CrmContact.company_id == company_id, CrmContact.id == contact_id
    ).first()
    if not row:
        raise HTTPException(404, "Contact not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/contacts/{contact_id}", status_code=204)
def delete_contact(
    contact_id: str,
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    row = db.query(CrmContact).filter(
        CrmContact.company_id == company_id, CrmContact.id == contact_id
    ).first()
    if not row:
        raise HTTPException(404, "Contact not found")
    row.active = False
    db.commit()


# ── Activities ─────────────────────────────────────────────────────────────
@router.get("/accounts/{account_id}/activities", response_model=list[S.ActivityOut])
def list_activities(
    account_id: str,
    limit: int = Query(100, le=500),
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    _account_or_404(db, company_id, account_id)
    return (
        db.query(CrmActivity)
        .filter(CrmActivity.company_id == company_id, CrmActivity.account_id == account_id)
        .order_by(CrmActivity.occurred_at.desc())
        .limit(limit)
        .all()
    )


@router.post("/accounts/{account_id}/activities", response_model=S.ActivityOut, status_code=201)
def create_activity(
    account_id: str,
    data: S.ActivityIn,
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    _account_or_404(db, company_id, account_id)
    payload = data.model_dump()
    if not payload.get("occurred_at"):
        payload["occurred_at"] = _now()
    row = CrmActivity(company_id=company_id, account_id=account_id, **payload)
    db.add(row)
    # update last_contact_at on the account
    a = _account_or_404(db, company_id, account_id)
    a.last_contact_at = row.occurred_at
    db.commit()
    db.refresh(row)
    return row


# ── Deals (pipeline) ───────────────────────────────────────────────────────
@router.get("/deals", response_model=list[S.DealOut])
def list_deals(
    account_id: Optional[str] = None,
    stage: Optional[str] = None,
    owner_user_id: Optional[str] = None,
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    q = db.query(CrmDeal).filter(CrmDeal.company_id == company_id, CrmDeal.active == True)
    if account_id:
        q = q.filter(CrmDeal.account_id == account_id)
    if stage:
        q = q.filter(CrmDeal.stage == stage)
    if owner_user_id:
        q = q.filter(CrmDeal.owner_user_id == owner_user_id)
    return q.order_by(CrmDeal.expected_close_date.asc().nullslast() if hasattr(CrmDeal.expected_close_date.asc(), "nullslast") else CrmDeal.expected_close_date.asc()).all()


@router.post("/accounts/{account_id}/deals", response_model=S.DealOut, status_code=201)
def create_deal(
    account_id: str,
    data: S.DealIn,
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    _account_or_404(db, company_id, account_id)
    row = CrmDeal(company_id=company_id, account_id=account_id, **data.model_dump())
    db.add(row)
    db.flush()
    _log_activity(db, company_id=company_id, account_id=account_id, deal_id=row.id,
                  type_="stage_change", title=f"Deal créé: {row.title} · {row.stage}")
    db.commit()
    db.refresh(row)
    return row


@router.patch("/deals/{deal_id}", response_model=S.DealOut)
def update_deal(
    deal_id: str,
    data: S.DealUpdate,
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    row = db.query(CrmDeal).filter(
        CrmDeal.company_id == company_id, CrmDeal.id == deal_id
    ).first()
    if not row:
        raise HTTPException(404, "Deal not found")
    old_stage = row.stage
    payload = data.model_dump(exclude_unset=True)
    for k, v in payload.items():
        setattr(row, k, v)
    if "stage" in payload and payload["stage"] != old_stage:
        if payload["stage"] in ("won", "lost"):
            row.closed_at = _now()
        _log_activity(db, company_id=company_id, account_id=row.account_id, deal_id=row.id,
                      type_="stage_change",
                      title=f"Étape changée: {old_stage} → {row.stage}")
    db.commit()
    db.refresh(row)
    return row


@router.post("/deals/{deal_id}/win", response_model=S.DealOut)
def win_deal(
    deal_id: str,
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    row = db.query(CrmDeal).filter(
        CrmDeal.company_id == company_id, CrmDeal.id == deal_id
    ).first()
    if not row:
        raise HTTPException(404, "Deal not found")
    row.stage = "won"
    row.probability = 100
    row.closed_at = _now()
    _log_activity(db, company_id=company_id, account_id=row.account_id, deal_id=row.id,
                  type_="won", title=f"Deal gagné: {row.title}")
    db.commit()
    db.refresh(row)
    return row


@router.post("/deals/{deal_id}/lose", response_model=S.DealOut)
def lose_deal(
    deal_id: str,
    reason: Optional[str] = Query(None),
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    row = db.query(CrmDeal).filter(
        CrmDeal.company_id == company_id, CrmDeal.id == deal_id
    ).first()
    if not row:
        raise HTTPException(404, "Deal not found")
    row.stage = "lost"
    row.probability = 0
    row.closed_at = _now()
    row.lost_reason = reason
    _log_activity(db, company_id=company_id, account_id=row.account_id, deal_id=row.id,
                  type_="lost", title=f"Deal perdu: {row.title}", description=reason)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/deals/{deal_id}", status_code=204)
def delete_deal(
    deal_id: str,
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    row = db.query(CrmDeal).filter(
        CrmDeal.company_id == company_id, CrmDeal.id == deal_id
    ).first()
    if not row:
        raise HTTPException(404, "Deal not found")
    row.active = False
    db.commit()


# ── Pipeline Kanban ────────────────────────────────────────────────────────
@router.get("/pipeline", response_model=S.PipelineView)
def pipeline_view(
    owner_user_id: Optional[str] = None,
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    q = db.query(CrmDeal).filter(CrmDeal.company_id == company_id, CrmDeal.active == True)
    if owner_user_id:
        q = q.filter(CrmDeal.owner_user_id == owner_user_id)
    deals = q.all()

    columns: list[S.PipelineColumn] = []
    total_pipeline = 0.0
    weighted = 0.0
    for stage, label in PIPELINE_STAGES:
        col_deals = [d for d in deals if d.stage == stage]
        amount = float(sum(float(d.amount_mad or 0) for d in col_deals))
        if stage in OPEN_STAGES:
            total_pipeline += amount
            weighted += sum(float(d.amount_mad or 0) * (d.probability or 0) / 100.0 for d in col_deals)
        columns.append(S.PipelineColumn(
            stage=stage, label=label,
            deals=col_deals, total_amount_mad=amount, count=len(col_deals),
        ))
    return S.PipelineView(
        columns=columns,
        total_pipeline_mad=round(total_pipeline, 2),
        weighted_pipeline_mad=round(weighted, 2),
    )


# ── Tasks ──────────────────────────────────────────────────────────────────
@router.get("/tasks", response_model=list[S.TaskOut])
def list_tasks(
    completed: Optional[bool] = None,
    owner_user_id: Optional[str] = None,
    overdue: Optional[bool] = None,
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    q = db.query(CrmTask).filter(CrmTask.company_id == company_id, CrmTask.active == True)
    if completed is True:
        q = q.filter(CrmTask.completed_at.isnot(None))
    elif completed is False:
        q = q.filter(CrmTask.completed_at.is_(None))
    if owner_user_id:
        q = q.filter(CrmTask.owner_user_id == owner_user_id)
    if overdue:
        q = q.filter(CrmTask.completed_at.is_(None), CrmTask.due_date < _now())
    return q.order_by(CrmTask.due_date.asc()).all()


@router.post("/tasks", response_model=S.TaskOut, status_code=201)
def create_task(
    data: S.TaskIn,
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    if data.account_id:
        _account_or_404(db, company_id, data.account_id)
    row = CrmTask(company_id=company_id, **data.model_dump())
    db.add(row)
    db.flush()
    if row.account_id:
        _log_activity(db, company_id=company_id, account_id=row.account_id, deal_id=row.deal_id,
                      type_="note", title=f"Tâche: {row.title}")
    db.commit()
    db.refresh(row)
    return row


@router.patch("/tasks/{task_id}", response_model=S.TaskOut)
def update_task(
    task_id: str,
    data: S.TaskUpdate,
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    row = db.query(CrmTask).filter(
        CrmTask.company_id == company_id, CrmTask.id == task_id
    ).first()
    if not row:
        raise HTTPException(404, "Task not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


@router.post("/tasks/{task_id}/complete", response_model=S.TaskOut)
def complete_task(
    task_id: str,
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    row = db.query(CrmTask).filter(
        CrmTask.company_id == company_id, CrmTask.id == task_id
    ).first()
    if not row:
        raise HTTPException(404, "Task not found")
    row.completed_at = _now()
    if row.account_id:
        _log_activity(db, company_id=company_id, account_id=row.account_id, deal_id=row.deal_id,
                      type_="task_done", title=f"Tâche terminée: {row.title}")
    db.commit()
    db.refresh(row)
    return row


@router.delete("/tasks/{task_id}", status_code=204)
def delete_task(
    task_id: str,
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    row = db.query(CrmTask).filter(
        CrmTask.company_id == company_id, CrmTask.id == task_id
    ).first()
    if not row:
        raise HTTPException(404, "Task not found")
    row.active = False
    db.commit()


# ── Dashboard ──────────────────────────────────────────────────────────────
@router.get("/dashboard", response_model=S.CrmDashboard)
def crm_dashboard(
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    now = _now()
    cutoff_30 = now - timedelta(days=30)
    in_7 = now + timedelta(days=7)

    accounts = (
        db.query(CrmAccount)
        .filter(CrmAccount.company_id == company_id, CrmAccount.active == True)
        .all()
    )
    deals = (
        db.query(CrmDeal)
        .filter(CrmDeal.company_id == company_id, CrmDeal.active == True)
        .all()
    )
    tasks = (
        db.query(CrmTask)
        .filter(CrmTask.company_id == company_id, CrmTask.active == True,
                CrmTask.completed_at.is_(None))
        .all()
    )

    open_deals = [d for d in deals if d.stage in OPEN_STAGES]
    won_30d = [d for d in deals if d.stage == "won" and d.closed_at and d.closed_at >= cutoff_30]
    lost_30d = [d for d in deals if d.stage == "lost" and d.closed_at and d.closed_at >= cutoff_30]

    by_tier: dict[str, int] = {}
    by_lc: dict[str, int] = {}
    for a in accounts:
        by_tier[a.tier or "bronze"] = by_tier.get(a.tier or "bronze", 0) + 1
        by_lc[a.lifecycle_stage or "prospect"] = by_lc.get(a.lifecycle_stage or "prospect", 0) + 1

    open_pipeline = float(sum(float(d.amount_mad or 0) for d in open_deals))
    weighted = float(sum(float(d.amount_mad or 0) * (d.probability or 0) / 100.0 for d in open_deals))
    won_amount = float(sum(float(d.amount_mad or 0) for d in won_30d))
    avg_deal = (won_amount / len(won_30d)) if won_30d else 0.0
    overdue = sum(1 for t in tasks if t.due_date and t.due_date < now)
    upcoming = sum(1 for t in tasks if t.due_date and now <= t.due_date <= in_7)

    return S.CrmDashboard(
        total_accounts=len(accounts),
        new_accounts_30d=sum(1 for a in accounts if a.created_at and a.created_at >= cutoff_30),
        accounts_by_tier=by_tier,
        accounts_by_lifecycle=by_lc,
        open_deals_count=len(open_deals),
        open_pipeline_mad=round(open_pipeline, 2),
        weighted_pipeline_mad=round(weighted, 2),
        won_30d_count=len(won_30d),
        won_30d_mad=round(won_amount, 2),
        lost_30d_count=len(lost_30d),
        avg_deal_size_mad=round(avg_deal, 2),
        overdue_tasks=overdue,
        upcoming_tasks_7d=upcoming,
    )
