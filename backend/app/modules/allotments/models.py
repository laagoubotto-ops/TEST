"""Allotments — SQLAlchemy model.

Represents a block of rooms reserved at a hotel for a given date range under
a negotiated contract. Tracks confirmed vs released rooms and release deadlines.
"""

from datetime import date
from typing import Optional
from sqlalchemy import String, ForeignKey, Integer, Numeric, Date, Text, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.models import Base, BaseMixin


class ProjectAllotment(Base, BaseMixin):
    __tablename__ = "project_allotments"

    company_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("companies.id", ondelete="CASCADE"), index=True,
    )
    project_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True,
    )

    hotel_name: Mapped[str] = mapped_column(String(255))
    city: Mapped[str] = mapped_column(String(120))
    category: Mapped[Optional[str]] = mapped_column(String(20))
    contract_id: Mapped[Optional[str]] = mapped_column(String(60))

    check_in: Mapped[date] = mapped_column(Date)
    check_out: Mapped[date] = mapped_column(Date)
    deadline: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    rooms_blocked: Mapped[int] = mapped_column(Integer, default=0)
    rooms_confirmed: Mapped[int] = mapped_column(Integer, default=0)
    rooms_released: Mapped[int] = mapped_column(Integer, default=0)
    price_per_night: Mapped[float] = mapped_column(Numeric(12, 2), default=0)

    status: Mapped[str] = mapped_column(String(20), default="blocked")
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index("idx_project_allotments_company", "company_id"),
        Index("idx_project_allotments_project", "project_id"),
    )
