"""Portail B2B — 4 tables.

* `b2b_agencies`           — Agences partenaires (TO étrangers, retail networks)
* `b2b_sessions`           — Magic-link tokens + sessions actives (login passwordless)
* `b2b_quotations`         — Devis envoyés aux agences (lien public token-based)
* `b2b_tracking_events`    — Timeline live d'un voyage (status, location, photos…)
"""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, DateTime, Index, Integer, JSON, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.models import Base, BaseMixin


class B2BAgency(Base, BaseMixin):
    __tablename__ = "b2b_agencies"
    __table_args__ = (
        Index("ix_b2b_agencies_email", "email"),
        Index("ix_b2b_agencies_status", "status"),
    )

    name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(200), unique=True)
    contact_name: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    country: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    locale: Mapped[str] = mapped_column(String(8), default="fr")
    tier: Mapped[str] = mapped_column(String(20), default="standard")  # standard|gold|platinum
    status: Mapped[str] = mapped_column(String(20), default="active")  # active|paused|archived
    commission_pct: Mapped[float] = mapped_column(Numeric(5, 2), default=10.0)
    notes: Mapped[Optional[str]] = mapped_column(Text, default="")
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class B2BSession(Base, BaseMixin):
    __tablename__ = "b2b_sessions"
    __table_args__ = (
        Index("ix_b2b_sessions_token", "token"),
        Index("ix_b2b_sessions_agency", "agency_id"),
    )

    agency_id: Mapped[str] = mapped_column(String(64))
    token: Mapped[str] = mapped_column(String(128), unique=True)
    purpose: Mapped[str] = mapped_column(String(20), default="login")  # login|quote|tracking
    target_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)  # quotation_id ou booking_id
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    used_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_seen_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)


class B2BQuotation(Base, BaseMixin):
    __tablename__ = "b2b_quotations"
    __table_args__ = (
        Index("ix_b2b_quot_agency", "agency_id"),
        Index("ix_b2b_quot_status", "status"),
    )

    agency_id: Mapped[str] = mapped_column(String(64))
    title: Mapped[str] = mapped_column(String(200))
    reference: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    pax: Mapped[int] = mapped_column(Integer, default=2)
    currency: Mapped[str] = mapped_column(String(8), default="EUR")
    public_total: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    per_pax: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    margin_pct: Mapped[float] = mapped_column(Numeric(5, 2), default=15.0)
    days: Mapped[Optional[list]] = mapped_column(JSON, nullable=True, default=list)
    payload: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, default=dict)
    status: Mapped[str] = mapped_column(String(20), default="draft")  # draft|sent|viewed|accepted|rejected|expired
    public_token: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, unique=True)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    viewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    accepted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    rejected_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, default="")


class B2BTrackingEvent(Base, BaseMixin):
    __tablename__ = "b2b_tracking_events"
    __table_args__ = (
        Index("ix_b2b_track_booking", "booking_id"),
        Index("ix_b2b_track_agency", "agency_id"),
    )

    agency_id: Mapped[str] = mapped_column(String(64))
    booking_id: Mapped[str] = mapped_column(String(64))           # référence interne du voyage
    booking_label: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    kind: Mapped[str] = mapped_column(String(40))                 # status|location|note|photo|alert
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[Optional[str]] = mapped_column(Text, default="")
    severity: Mapped[str] = mapped_column(String(20), default="info")  # info|warning|critical|success
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    payload: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, default=dict)
