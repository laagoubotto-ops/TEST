"""CRM models — Accounts (B2B agencies / clients), Contacts, Activities, Deals, Tasks."""

from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import (
    Boolean, Date, DateTime, ForeignKey, Index, Integer, JSON, Numeric,
    String, Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.models import Base, BaseMixin


# ── Account (B2B partner / direct customer) ────────────────────────────────
class CrmAccount(Base, BaseMixin):
    """A company/agency or direct customer in the CRM."""
    __tablename__ = "crm_accounts"

    company_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("companies.id", ondelete="CASCADE"), index=True
    )

    # Identification
    code: Mapped[Optional[str]] = mapped_column(String(40), index=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    legal_name: Mapped[Optional[str]] = mapped_column(String(255))
    account_type: Mapped[str] = mapped_column(String(20), default="agency", index=True)
    # agency | tour_operator | direct | corporate | mice

    # Contact
    primary_email: Mapped[Optional[str]] = mapped_column(String(255), index=True)
    primary_phone: Mapped[Optional[str]] = mapped_column(String(40))
    website: Mapped[Optional[str]] = mapped_column(String(255))

    # Localisation
    country: Mapped[Optional[str]] = mapped_column(String(80), index=True)
    city: Mapped[Optional[str]] = mapped_column(String(120))
    address: Mapped[Optional[str]] = mapped_column(Text)
    language: Mapped[Optional[str]] = mapped_column(String(8))   # fr/en/es/...
    timezone: Mapped[Optional[str]] = mapped_column(String(40))
    currency: Mapped[str] = mapped_column(String(3), default="MAD")

    # Tax / billing
    tax_id: Mapped[Optional[str]] = mapped_column(String(64))
    payment_terms_days: Mapped[Optional[int]] = mapped_column(Integer)
    credit_limit: Mapped[Optional[float]] = mapped_column(Numeric(14, 2))

    # Commercial intelligence
    tier: Mapped[str] = mapped_column(String(20), default="bronze", index=True)
    # bronze | silver | gold | platinum
    lifecycle_stage: Mapped[str] = mapped_column(String(30), default="prospect", index=True)
    # prospect | lead | opportunity | customer | champion | at_risk | dormant
    health_score: Mapped[int] = mapped_column(Integer, default=50)   # 0..100
    nps_score: Mapped[Optional[int]] = mapped_column(Integer)        # -100..100

    owner_user_id: Mapped[Optional[str]] = mapped_column(String(36), index=True)
    last_contact_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    # Free-form
    tags: Mapped[Optional[dict]] = mapped_column(JSON)        # ['vip','luxury']
    preferences: Mapped[Optional[dict]] = mapped_column(JSON) # {hotels:'5*', guides:'fr'}
    description: Mapped[Optional[str]] = mapped_column(Text)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500))

    __table_args__ = (
        Index("idx_crm_account_company_name", "company_id", "name"),
        Index("idx_crm_account_tier", "tier"),
    )


# ── Contact (people inside an account) ─────────────────────────────────────
class CrmContact(Base, BaseMixin):
    __tablename__ = "crm_contacts"

    company_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("companies.id", ondelete="CASCADE"), index=True
    )
    account_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("crm_accounts.id", ondelete="CASCADE"), index=True
    )

    first_name: Mapped[str] = mapped_column(String(120))
    last_name: Mapped[Optional[str]] = mapped_column(String(120))
    title: Mapped[Optional[str]] = mapped_column(String(120))   # CEO, Travel Manager…
    email: Mapped[Optional[str]] = mapped_column(String(255), index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(40))
    mobile: Mapped[Optional[str]] = mapped_column(String(40))
    whatsapp: Mapped[Optional[str]] = mapped_column(String(40))
    linkedin: Mapped[Optional[str]] = mapped_column(String(255))

    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    is_decision_maker: Mapped[bool] = mapped_column(Boolean, default=False)

    notes: Mapped[Optional[str]] = mapped_column(Text)


# ── Activity (timeline event) ──────────────────────────────────────────────
class CrmActivity(Base, BaseMixin):
    """Log of any interaction: call, meeting, email, note, status change…"""
    __tablename__ = "crm_activities"

    company_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("companies.id", ondelete="CASCADE"), index=True
    )
    account_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("crm_accounts.id", ondelete="CASCADE"), index=True
    )
    contact_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("crm_contacts.id", ondelete="SET NULL"), nullable=True
    )
    deal_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("crm_deals.id", ondelete="SET NULL"), nullable=True
    )

    type: Mapped[str] = mapped_column(String(30), index=True)
    # call | meeting | email | whatsapp | note | proposal_sent | won | lost | stage_change | task_done
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[Optional[str]] = mapped_column(Text)

    occurred_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), index=True
    )
    owner_user_id: Mapped[Optional[str]] = mapped_column(String(36), index=True)

    extra: Mapped[Optional[dict]] = mapped_column(JSON)


# ── Deal (Pipeline opportunity) ────────────────────────────────────────────
class CrmDeal(Base, BaseMixin):
    """A sales opportunity — separate from Project to allow forecasting."""
    __tablename__ = "crm_deals"

    company_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("companies.id", ondelete="CASCADE"), index=True
    )
    account_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("crm_accounts.id", ondelete="CASCADE"), index=True
    )
    project_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True
    )

    title: Mapped[str] = mapped_column(String(255))
    stage: Mapped[str] = mapped_column(String(30), default="qualification", index=True)
    # qualification | proposal | negotiation | won | lost
    amount_mad: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    probability: Mapped[int] = mapped_column(Integer, default=20)   # 0..100

    expected_close_date: Mapped[Optional[date]] = mapped_column(Date)
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    lost_reason: Mapped[Optional[str]] = mapped_column(String(120))

    owner_user_id: Mapped[Optional[str]] = mapped_column(String(36), index=True)
    description: Mapped[Optional[str]] = mapped_column(Text)
    pax: Mapped[Optional[int]] = mapped_column(Integer)
    destination: Mapped[Optional[str]] = mapped_column(String(120))


# ── Task (next action) ─────────────────────────────────────────────────────
class CrmTask(Base, BaseMixin):
    __tablename__ = "crm_tasks"

    company_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("companies.id", ondelete="CASCADE"), index=True
    )
    account_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("crm_accounts.id", ondelete="CASCADE"), nullable=True, index=True
    )
    deal_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("crm_deals.id", ondelete="SET NULL"), nullable=True
    )
    contact_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("crm_contacts.id", ondelete="SET NULL"), nullable=True
    )

    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[Optional[str]] = mapped_column(Text)
    due_date: Mapped[Optional[datetime]] = mapped_column(DateTime, index=True)
    priority: Mapped[str] = mapped_column(String(10), default="normal")  # low | normal | high | urgent

    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    owner_user_id: Mapped[Optional[str]] = mapped_column(String(36), index=True)
