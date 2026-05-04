"""Seasons — Global season definitions for tariff management."""

from typing import Optional
from sqlalchemy import String, Date, JSON, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.models import Base, BaseMixin


class Season(Base, BaseMixin):
    __tablename__ = "seasons"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    season_type: Mapped[str] = mapped_column(
        String(30), nullable=False, index=True,
        comment="haute | basse | moyenne | speciale",
    )
    date_from: Mapped[str] = mapped_column(String(10), nullable=False, comment="YYYY-MM-DD")
    date_to: Mapped[str] = mapped_column(String(10), nullable=False, comment="YYYY-MM-DD")
    applies_to: Mapped[Optional[dict]] = mapped_column(
        JSON, default=lambda: ["hotel", "transport", "guide"],
        comment='List of kinds this season applies to',
    )
    color: Mapped[Optional[str]] = mapped_column(String(20))
    notes: Mapped[Optional[str]] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(30), default="active", index=True)

    __table_args__ = (
        Index("idx_season_type_dates", "season_type", "date_from", "date_to"),
    )
