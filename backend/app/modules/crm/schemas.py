"""CRM Pydantic schemas."""
from __future__ import annotations
from datetime import date, datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict


# ── Account ────────────────────────────────────────────────────────────────
class AccountBase(BaseModel):
    name: str
    legal_name: Optional[str] = None
    code: Optional[str] = None
    account_type: str = "agency"
    primary_email: Optional[str] = None
    primary_phone: Optional[str] = None
    website: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    language: Optional[str] = None
    timezone: Optional[str] = None
    currency: str = "MAD"
    tax_id: Optional[str] = None
    payment_terms_days: Optional[int] = None
    credit_limit: Optional[float] = None
    tier: str = "bronze"
    lifecycle_stage: str = "prospect"
    health_score: int = 50
    nps_score: Optional[int] = None
    owner_user_id: Optional[str] = None
    tags: Optional[list[str] | dict[str, Any]] = None
    preferences: Optional[dict[str, Any]] = None
    description: Optional[str] = None
    avatar_url: Optional[str] = None


class AccountIn(AccountBase):
    pass


class AccountUpdate(BaseModel):
    name: Optional[str] = None
    legal_name: Optional[str] = None
    code: Optional[str] = None
    account_type: Optional[str] = None
    primary_email: Optional[str] = None
    primary_phone: Optional[str] = None
    website: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    language: Optional[str] = None
    timezone: Optional[str] = None
    currency: Optional[str] = None
    tax_id: Optional[str] = None
    payment_terms_days: Optional[int] = None
    credit_limit: Optional[float] = None
    tier: Optional[str] = None
    lifecycle_stage: Optional[str] = None
    health_score: Optional[int] = None
    nps_score: Optional[int] = None
    owner_user_id: Optional[str] = None
    tags: Optional[list[str] | dict[str, Any]] = None
    preferences: Optional[dict[str, Any]] = None
    description: Optional[str] = None
    avatar_url: Optional[str] = None


class AccountOut(AccountBase):
    id: str
    last_contact_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ── Account 360 ────────────────────────────────────────────────────────────
class AccountStats(BaseModel):
    total_projects: int = 0
    won_projects: int = 0
    lost_projects: int = 0
    open_deals: int = 0
    pipeline_value_mad: float = 0.0
    won_revenue_mad: float = 0.0
    conversion_rate: float = 0.0
    open_tasks: int = 0
    activities_30d: int = 0


class Account360(BaseModel):
    account: AccountOut
    contacts: list["ContactOut"] = []
    activities: list["ActivityOut"] = []
    deals: list["DealOut"] = []
    tasks: list["TaskOut"] = []
    stats: AccountStats


# ── Contact ────────────────────────────────────────────────────────────────
class ContactBase(BaseModel):
    first_name: str
    last_name: Optional[str] = None
    title: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    whatsapp: Optional[str] = None
    linkedin: Optional[str] = None
    is_primary: bool = False
    is_decision_maker: bool = False
    notes: Optional[str] = None


class ContactIn(ContactBase):
    pass


class ContactUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    title: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    whatsapp: Optional[str] = None
    linkedin: Optional[str] = None
    is_primary: Optional[bool] = None
    is_decision_maker: Optional[bool] = None
    notes: Optional[str] = None


class ContactOut(ContactBase):
    id: str
    account_id: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ── Activity ───────────────────────────────────────────────────────────────
class ActivityIn(BaseModel):
    type: str
    title: str
    description: Optional[str] = None
    occurred_at: Optional[datetime] = None
    contact_id: Optional[str] = None
    deal_id: Optional[str] = None
    extra: Optional[dict[str, Any]] = None


class ActivityOut(BaseModel):
    id: str
    account_id: str
    contact_id: Optional[str] = None
    deal_id: Optional[str] = None
    type: str
    title: str
    description: Optional[str] = None
    occurred_at: datetime
    owner_user_id: Optional[str] = None
    extra: Optional[dict[str, Any]] = None
    model_config = ConfigDict(from_attributes=True)


# ── Deal ───────────────────────────────────────────────────────────────────
class DealIn(BaseModel):
    title: str
    stage: str = "qualification"
    amount_mad: float = 0
    probability: int = 20
    expected_close_date: Optional[date] = None
    project_id: Optional[str] = None
    description: Optional[str] = None
    pax: Optional[int] = None
    destination: Optional[str] = None
    owner_user_id: Optional[str] = None


class DealUpdate(BaseModel):
    title: Optional[str] = None
    stage: Optional[str] = None
    amount_mad: Optional[float] = None
    probability: Optional[int] = None
    expected_close_date: Optional[date] = None
    project_id: Optional[str] = None
    description: Optional[str] = None
    pax: Optional[int] = None
    destination: Optional[str] = None
    owner_user_id: Optional[str] = None
    lost_reason: Optional[str] = None


class DealOut(BaseModel):
    id: str
    account_id: str
    project_id: Optional[str] = None
    title: str
    stage: str
    amount_mad: float
    probability: int
    expected_close_date: Optional[date] = None
    closed_at: Optional[datetime] = None
    lost_reason: Optional[str] = None
    owner_user_id: Optional[str] = None
    description: Optional[str] = None
    pax: Optional[int] = None
    destination: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ── Task ───────────────────────────────────────────────────────────────────
class TaskIn(BaseModel):
    title: str
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    priority: str = "normal"
    deal_id: Optional[str] = None
    contact_id: Optional[str] = None
    owner_user_id: Optional[str] = None
    account_id: Optional[str] = None  # for /crm/tasks (no account scope)


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    priority: Optional[str] = None
    completed_at: Optional[datetime] = None
    owner_user_id: Optional[str] = None


class TaskOut(BaseModel):
    id: str
    account_id: Optional[str] = None
    deal_id: Optional[str] = None
    contact_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    priority: str
    completed_at: Optional[datetime] = None
    owner_user_id: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ── Pipeline Kanban ────────────────────────────────────────────────────────
class PipelineColumn(BaseModel):
    stage: str
    label: str
    deals: list[DealOut]
    total_amount_mad: float
    count: int


class PipelineView(BaseModel):
    columns: list[PipelineColumn]
    total_pipeline_mad: float
    weighted_pipeline_mad: float


# ── Dashboard ──────────────────────────────────────────────────────────────
class CrmDashboard(BaseModel):
    total_accounts: int
    new_accounts_30d: int
    accounts_by_tier: dict[str, int]
    accounts_by_lifecycle: dict[str, int]
    open_deals_count: int
    open_pipeline_mad: float
    weighted_pipeline_mad: float
    won_30d_count: int
    won_30d_mad: float
    lost_30d_count: int
    avg_deal_size_mad: float
    overdue_tasks: int
    upcoming_tasks_7d: int


# Forward-ref
Account360.model_rebuild()
