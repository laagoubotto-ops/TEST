"""Room categories & rate grids for hotel items in Premium Catalogues."""

from typing import Optional
from sqlalchemy import String, Text, Numeric, Integer, ForeignKey, JSON, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.models import Base, BaseMixin


class RoomCategory(Base, BaseMixin):
    __tablename__ = "room_categories"

    hotel_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("premium_catalog_items.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False, comment="Standard, Supérieure, Suite…")
    capacity: Mapped[int] = mapped_column(Integer, default=2)
    description: Mapped[Optional[str]] = mapped_column(Text)
    amenities: Mapped[Optional[dict]] = mapped_column(JSON, default=list)
    view: Mapped[Optional[str]] = mapped_column(String(100), comment="jardin, piscine, mer, médina…")
    surface_m2: Mapped[Optional[int]] = mapped_column(Integer)
    bed_type: Mapped[Optional[str]] = mapped_column(String(50), comment="double, twin, king…")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(30), default="active")

    __table_args__ = (
        Index("idx_room_hotel", "hotel_id", "sort_order"),
    )


class RoomRate(Base, BaseMixin):
    __tablename__ = "room_rates"

    room_category_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("room_categories.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    season_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("seasons.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    season_label: Mapped[Optional[str]] = mapped_column(String(100))
    rate_type: Mapped[str] = mapped_column(
        String(30), default="contractuel",
        comment="rack | contractuel | promo",
    )
    rate_sgl: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    rate_dbl: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    rate_tpl: Mapped[Optional[float]] = mapped_column(Numeric(12, 2))
    meal_plan: Mapped[str] = mapped_column(
        String(10), default="BB",
        comment="RO | BB | HB | FB | AI",
    )
    currency: Mapped[str] = mapped_column(String(10), default="MAD")
    date_from: Mapped[Optional[str]] = mapped_column(String(10))
    date_to: Mapped[Optional[str]] = mapped_column(String(10))
    notes: Mapped[Optional[str]] = mapped_column(String(500))

    __table_args__ = (
        Index("idx_rate_room_season", "room_category_id", "season_id"),
    )
