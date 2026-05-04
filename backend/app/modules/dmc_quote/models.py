"""DMC Quote models — header + per-day services modeled like the YS Travel sheet.

A DmcQuote represents a full circuit estimate (e.g. "DISCOVER MOROCCO 09 DAYS / 08 NIGHTS").
Each DmcQuoteDay row maps 1:1 to a row in the operator's Excel sheet, holding hotel,
restaurant (lunch + dinner), monuments, transport km, water, taxes, guide, and computed
costs/sell prices in MAD.
"""

from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import (
    Boolean, Date, DateTime, ForeignKey, Index, Integer, JSON, Numeric,
    String, Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.models import Base, BaseMixin


class DmcQuote(Base, BaseMixin):
    """Header for a DMC quote. Lifecycle: draft → sent → accepted/rejected → archived."""

    __tablename__ = "dmc_quotes"

    company_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("companies.id", ondelete="CASCADE"), index=True
    )

    # Identity
    code: Mapped[Optional[str]] = mapped_column(String(40), index=True)        # RIH-Q-2026-0042
    title: Mapped[str] = mapped_column(String(255))                             # "DISCOVER MOROCCO 09D/08N"
    client_reference: Mapped[Optional[str]] = mapped_column(String(255))        # "YS Travel Morocco 11D adhoc..."
    client_name: Mapped[Optional[str]] = mapped_column(String(255))             # "SAINT TOUR"
    account_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("crm_accounts.id"), index=True)

    # Dates & sizing
    travel_period: Mapped[Optional[str]] = mapped_column(String(80))            # "NOV 2026"
    start_date: Mapped[Optional[date]] = mapped_column(Date)
    end_date: Mapped[Optional[date]] = mapped_column(Date)
    nb_days: Mapped[int] = mapped_column(Integer, default=0)
    nb_nights: Mapped[int] = mapped_column(Integer, default=0)
    language: Mapped[str] = mapped_column(String(8), default="en")              # en/fr/es
    currency_sell: Mapped[str] = mapped_column(String(8), default="USD")        # USD/EUR/MAD

    # Costing assumptions (MAD)
    fx_to_mad: Mapped[float] = mapped_column(Numeric(12, 4), default=10.25)     # USD→MAD
    markup_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=8.0)       # global markup
    bus_cost_per_km: Mapped[float] = mapped_column(Numeric(8, 2), default=8.5)  # MAD/km
    fuel_factor: Mapped[float] = mapped_column(Numeric(5, 2), default=1.0)
    foc_ratio: Mapped[Optional[str]] = mapped_column(String(20), default="1 FOC")  # complimentary single

    # Pricing brackets — the user picks bases (10/15/20/25/30/35) and quote auto-computes
    pax_brackets_json: Mapped[Optional[dict]] = mapped_column(JSON)
    # {"brackets":[10,15,20,25,30,35], "computed":{"10": {"twin":1588,"ss":315}, ...}}

    # Lifecycle
    status: Mapped[str] = mapped_column(String(20), default="draft", index=True)  # draft|sent|accepted|rejected|archived
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    accepted_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    sent_to_email: Mapped[Optional[str]] = mapped_column(String(255))             # last recipient
    sent_message_id: Mapped[Optional[str]] = mapped_column(String(255))           # M365 messageId

    # Versioning (V1 immuable → V2 modifiable)
    parent_quote_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("dmc_quotes.id", ondelete="SET NULL"), index=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False)               # immuable après envoi/clone

    # Linked artifacts (créé après accept)
    project_id: Mapped[Optional[str]] = mapped_column(String(36), index=True)

    # Free text sections (stored once, reused at PDF generation)
    inclusions: Mapped[Optional[str]] = mapped_column(Text)
    exclusions: Mapped[Optional[str]] = mapped_column(Text)
    terms: Mapped[Optional[str]] = mapped_column(Text)
    payment_terms: Mapped[Optional[str]] = mapped_column(Text)
    cancellation_policy: Mapped[Optional[str]] = mapped_column(Text)
    transportation_notes: Mapped[Optional[str]] = mapped_column(Text)
    guides_notes: Mapped[Optional[str]] = mapped_column(Text)

    notes: Mapped[Optional[str]] = mapped_column(Text)

    __table_args__ = (
        Index("idx_dmc_quotes_company_status", "company_id", "status"),
    )


class DmcQuoteDay(Base, BaseMixin):
    """One row per day of the circuit, mirroring the operator's Excel layout."""

    __tablename__ = "dmc_quote_days"

    quote_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("dmc_quotes.id", ondelete="CASCADE"), index=True
    )
    day_index: Mapped[int] = mapped_column(Integer)            # 1..n
    date: Mapped[Optional[date]] = mapped_column(Date)
    cities: Mapped[Optional[str]] = mapped_column(String(120))  # "CAS/RBA/CHEF"
    primary_city: Mapped[Optional[str]] = mapped_column(String(80))
    km: Mapped[float] = mapped_column(Numeric(8, 2), default=0)

    # Hotel
    hotel_name: Mapped[Optional[str]] = mapped_column(String(160))
    hotel_category: Mapped[Optional[str]] = mapped_column(String(20))   # 3*/4*/5*/Riad
    room_type: Mapped[Optional[str]] = mapped_column(String(60), default="STANDARD")
    basis: Mapped[Optional[str]] = mapped_column(String(20))            # BB/HB/FB
    hotel_twin_mad: Mapped[float] = mapped_column(Numeric(10, 2), default=0)   # 1/2 double
    hotel_ss_mad: Mapped[float] = mapped_column(Numeric(10, 2), default=0)     # single supplement
    hotel_taxes_mad: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    hotel_upgrade_mad: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    hotel_water_mad: Mapped[float] = mapped_column(Numeric(8, 2), default=0)

    # Restaurant — 1 row supports lunch + dinner
    lunch_name: Mapped[Optional[str]] = mapped_column(String(120))
    lunch_menu: Mapped[Optional[str]] = mapped_column(Text)
    lunch_pp_mad: Mapped[float] = mapped_column(Numeric(8, 2), default=0)
    dinner_name: Mapped[Optional[str]] = mapped_column(String(120))
    dinner_menu: Mapped[Optional[str]] = mapped_column(Text)
    dinner_pp_mad: Mapped[float] = mapped_column(Numeric(8, 2), default=0)
    meal_water_mad: Mapped[float] = mapped_column(Numeric(8, 2), default=0)

    # Monuments / activities (stored as JSON list for flexibility)
    monuments_json: Mapped[Optional[list]] = mapped_column(JSON)
    # [{"name":"Hassan II Mosque","entrance_fee":150,"entrance":true,"exterior":false}]
    monuments_total_mad: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    activities_json: Mapped[Optional[list]] = mapped_column(JSON)
    # [{"name":"Sunset Camel-Riding","included":true,"cost_pp_mad":100}]

    # Guides
    guide_day_mad: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    local_guide_mad: Mapped[float] = mapped_column(Numeric(10, 2), default=0)

    # Notes & narrative (used for the program DOCX day-by-day)
    narrative: Mapped[Optional[str]] = mapped_column(Text)

    __table_args__ = (
        Index("idx_dmc_quote_days_quote_day", "quote_id", "day_index", unique=True),
    )
