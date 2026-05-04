"""Travel Designer Pro — single denormalized table holding the work-in-progress
draft for a circuit being assembled by drag-drop.

Each draft persists:
  * project_id (optional — can be free-form)
  * name / pax / start_date / currency
  * days[] — list of {day_num, date, city, items[]}
  * items[] — {kind, item_id, label, qty, unit_cost, supplier, meta}
  * totals (computed via /recompute)

We deliberately keep this self-contained (single JSON column) so the LLM can
freely reshape the draft without DB migrations every time the user drags a new
type of asset.
"""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, Integer, Numeric, JSON, DateTime, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.models import Base, BaseMixin


class TravelDraft(Base, BaseMixin):
    __tablename__ = "travel_designer_drafts"
    __table_args__ = (
        Index("ix_td_drafts_project", "project_id"),
    )

    project_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    name: Mapped[str] = mapped_column(String(200))
    pax: Mapped[int] = mapped_column(Integer, default=10)
    start_date: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    currency: Mapped[str] = mapped_column(String(8), default="MAD")
    margin_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=15.0)
    status: Mapped[str] = mapped_column(String(20), default="draft")  # draft|published|archived
    version: Mapped[int] = mapped_column(Integer, default=1)
    days: Mapped[Optional[list]] = mapped_column(JSON, nullable=True, default=list)
    totals: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, default=dict)
    notes: Mapped[Optional[str]] = mapped_column(String(2000), default="")
    last_saved_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime, nullable=True, default=lambda: datetime.now(timezone.utc)
    )
